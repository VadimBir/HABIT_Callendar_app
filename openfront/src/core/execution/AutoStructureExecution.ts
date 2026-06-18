import { Execution, Game, Player, PlayerID, UnitType } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { NationStructureBehavior } from "./nation/NationStructureBehavior";

/**
 * Per-category auto-build: spends the human player's gold to build OR upgrade
 * one structure type (City / Factory / SAMLauncher / Port) on a cadence. The
 * number built per act scales with the player's gold, so upgrades speed up as
 * you get richer instead of crawling one-at-a-time.
 * Reuses the nation AI's placement + upgrade logic
 * (NationStructureBehavior.buildOrUpgradeType) so tile selection is sane. Does
 * NOT attack, expand, or send nukes (that's full Autopilot).
 *
 * Toggle via the set_auto_structure intent. A static registry keyed by
 * (playerID, unitType) keeps one execution per (player, type) so toggling off
 * flips the live instance instead of stacking (mirrors AutopilotExecution).
 */
export class AutoStructureExecution implements Execution {
  private static registry = new Map<string, AutoStructureExecution>();

  private active = true;
  private isPrimary = false;
  private mg!: Game;
  private random!: PseudoRandom;
  private structureBehavior!: NationStructureBehavior;
  private initialized = false;
  private tickCounter = 0;
  // Build/upgrade attempt cadence (ticks). Pure economy, fairly frequent.
  private readonly actEvery = 2; // ~3x faster than the old 5-tick cadence
  // Max structures built/upgraded per act (gold permitting). Caps lag spikes.
  private readonly maxPerAct = 20;

  constructor(
    private player: Player,
    private unitType: UnitType,
    public enabled: boolean,
  ) {}

  private key(): string {
    return `${this.player.id()}::${this.unitType}`;
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const existing = AutoStructureExecution.registry.get(this.key());
    if (existing && existing !== this) {
      existing.enabled = this.enabled;
      this.active = false;
      return;
    }
    AutoStructureExecution.registry.set(this.key(), this);
    this.isPrimary = true;
    this.random = new PseudoRandom(
      simpleHash(this.player.id() + this.unitType) + ticks,
    );
  }

  tick(ticks: number): void {
    if (!this.isPrimary) {
      this.active = false;
      return;
    }
    if (!this.player.isAlive()) {
      this.active = false;
      AutoStructureExecution.registry.delete(this.key());
      return;
    }
    if (!this.enabled || !this.player.hasSpawned()) return;

    if (!this.initialized) {
      this.structureBehavior = new NationStructureBehavior(
        this.random,
        this.mg,
        this.player,
      );
      this.initialized = true;
    }

    this.tickCounter++;
    if (this.tickCounter % this.actEvery !== 0) return;
    // Gold-scaled batch: build/upgrade as many of this structure type as the
    // player's gold can cover this act, so upgrade speed grows with wealth
    // (rich = many per tick, broke = one). Capped so a huge stockpile can't
    // lag-spike by placing on every tile at once. Construction deducts gold on
    // the following tick, so we size the batch from current gold up front.
    const unitCost = this.mg.unitInfo(this.unitType).cost(this.mg, this.player);
    const batch =
      unitCost > 0n
        ? Math.max(
            1,
            Math.min(this.maxPerAct, Number(this.player.gold() / unitCost)),
          )
        : this.maxPerAct;
    for (let i = 0; i < batch; i++) {
      if (!this.structureBehavior.buildOrUpgradeType(this.unitType)) break;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
