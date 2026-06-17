import { Execution, Game, Player, PlayerID, UnitType } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { NationStructureBehavior } from "./nation/NationStructureBehavior";

/**
 * Per-category auto-build: spends the human player's gold to build OR upgrade
 * exactly ONE structure type (City / Factory / SAMLauncher / Port) on a cadence.
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
  private readonly actEvery = 5; // 4x faster auto actions

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
    // Spend gold to build/upgrade exactly this one structure type.
    this.structureBehavior.buildOrUpgradeType(this.unitType);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
