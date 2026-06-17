import { Execution, Game, Player, PlayerID } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { NationStructureBehavior } from "./nation/NationStructureBehavior";

/**
 * Auto-Build: spends the human player's gold on structures only — cities
 * (population/troops), factories (income), ports, SAM launchers (anti-nuke),
 * defense posts — by reusing the nation's structure-building behavior. Does
 * NOT attack, expand, or send nukes (that's full Autopilot). Toggle via the
 * set_auto_build intent; a static registry keeps one execution per player.
 */
export class AutoBuildExecution implements Execution {
  private static registry = new Map<PlayerID, AutoBuildExecution>();

  private active = true;
  private isPrimary = false;
  private mg!: Game;
  private random!: PseudoRandom;
  private structureBehavior!: NationStructureBehavior;
  private initialized = false;
  private tickCounter = 0;
  // Build attempt cadence (ticks). Pure economy, so fairly frequent.
  private readonly actEvery = 20;

  constructor(
    private player: Player,
    public enabled: boolean,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const existing = AutoBuildExecution.registry.get(this.player.id());
    if (existing && existing !== this) {
      existing.enabled = this.enabled;
      this.active = false;
      return;
    }
    AutoBuildExecution.registry.set(this.player.id(), this);
    this.isPrimary = true;
    this.random = new PseudoRandom(simpleHash(this.player.id()) + ticks + 7);
  }

  tick(ticks: number): void {
    if (!this.isPrimary) {
      this.active = false;
      return;
    }
    if (!this.player.isAlive()) {
      this.active = false;
      AutoBuildExecution.registry.delete(this.player.id());
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
    // Spend gold on structures (cities/factories/ports/SAM/defense).
    this.structureBehavior.handleStructures();
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
