import {
  Execution,
  Game,
  Player,
  PlayerID,
} from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { NationAllianceBehavior } from "./nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "./nation/NationEmojiBehavior";
import { AiAttackBehavior } from "./utils/AiAttackBehavior";

/**
 * Auto-Expand: periodically expands the human player's territory into
 * neighbouring NEUTRAL / terra-nullius land by reusing the nation AI's
 * attack behavior with a forced attack on TerraNullius. It does NOT attack
 * other players (that's Autopilot) — only unclaimed land. Toggled via the
 * set_auto_structure intent with category "expand". Static registry keeps one
 * per player so toggling off stops the live instance.
 */
export class AutoExpandExecution implements Execution {
  private static registry = new Map<PlayerID, AutoExpandExecution>();

  private active = true;
  private isPrimary = false;
  private mg!: Game;
  private random!: PseudoRandom;
  private attackBehavior!: AiAttackBehavior;
  private initialized = false;
  private tickCounter = 0;
  // 4x faster auto actions (mirrors AutoStructureExecution cadence).
  private readonly actEvery = 5;

  constructor(
    private player: Player,
    public enabled: boolean,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const existing = AutoExpandExecution.registry.get(this.player.id());
    if (existing && existing !== this) {
      existing.enabled = this.enabled;
      this.active = false;
      return;
    }
    AutoExpandExecution.registry.set(this.player.id(), this);
    this.isPrimary = true;
    this.random = new PseudoRandom(simpleHash(this.player.id()) + ticks + 11);
  }

  tick(ticks: number): void {
    if (!this.isPrimary) {
      this.active = false;
      return;
    }
    if (!this.player.isAlive()) {
      this.active = false;
      AutoExpandExecution.registry.delete(this.player.id());
      return;
    }
    if (!this.enabled || !this.player.hasSpawned()) return;

    if (!this.initialized) {
      const emoji = new NationEmojiBehavior(this.random, this.mg, this.player);
      const alliance = new NationAllianceBehavior(
        this.random,
        this.mg,
        this.player,
        emoji,
      );
      this.attackBehavior = new AiAttackBehavior(
        this.random,
        this.mg,
        this.player,
        0.5,
        0.3,
        0.3,
        alliance,
        emoji,
      );
      this.initialized = true;
    }

    this.tickCounter++;
    if (this.tickCounter % this.actEvery !== 0) return;
    // Run the bot's full expansion: grabs neutral/terra-nullius land AND
    // presses weak bordering players to actually grow territory. (Plain
    // sendAttack(terraNullius) did nothing once nearby unclaimed land was gone.)
    this.attackBehavior.maybeAttack();
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
