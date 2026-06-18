import {
  Execution,
  Game,
  Player,
  PlayerID,
  TroopClass,
} from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { NationAllianceBehavior } from "./nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "./nation/NationEmojiBehavior";
import { NationNukeBehavior } from "./nation/NationNukeBehavior";
import { NationStructureBehavior } from "./nation/NationStructureBehavior";
import { NationWarshipBehavior } from "./nation/NationWarshipBehavior";
import { AiAttackBehavior } from "./utils/AiAttackBehavior";

/**
 * Runs the existing Nation bot behaviors on behalf of a HUMAN player.
 * Toggle via the set_autopilot intent; a static registry keeps one execution
 * per player so a disable intent flips the live instance instead of stacking.
 */
export class AutopilotExecution implements Execution {
  private static registry = new Map<PlayerID, AutopilotExecution>();

  private active = true;
  private isPrimary = false;
  private mg!: Game;
  private random!: PseudoRandom;
  private behaviorsInitialized = false;
  private troopTypePicked = false;

  private emojiBehavior!: NationEmojiBehavior;
  private allianceBehavior!: NationAllianceBehavior;
  private warshipBehavior!: NationWarshipBehavior;
  private nukeBehavior!: NationNukeBehavior;
  private structureBehavior!: NationStructureBehavior;
  private attackBehavior!: AiAttackBehavior;

  private tickCounter = 0;
  // ~3x faster: act every ~17 ticks (was 50). Half-cadence sub-action at ~8.
  private readonly actEvery = 17;

  constructor(
    private player: Player,
    public enabled: boolean,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const existing = AutopilotExecution.registry.get(this.player.id());
    if (existing && existing !== this) {
      // Re-use the already-running execution; just update its enabled flag.
      existing.enabled = this.enabled;
      this.active = false;
      return;
    }
    AutopilotExecution.registry.set(this.player.id(), this);
    this.isPrimary = true;
    this.random = new PseudoRandom(simpleHash(this.player.id()) + ticks);
  }

  private initializeBehaviors(): void {
    this.emojiBehavior = new NationEmojiBehavior(
      this.random,
      this.mg,
      this.player,
    );
    this.allianceBehavior = new NationAllianceBehavior(
      this.random,
      this.mg,
      this.player,
      this.emojiBehavior,
    );
    this.warshipBehavior = new NationWarshipBehavior(
      this.random,
      this.mg,
      this.player,
      this.emojiBehavior,
    );
    this.attackBehavior = new AiAttackBehavior(
      this.random,
      this.mg,
      this.player,
      0.55,
      0.35,
      0.15,
      this.allianceBehavior,
      this.emojiBehavior,
    );
    this.nukeBehavior = new NationNukeBehavior(
      this.random,
      this.mg,
      this.player,
      this.attackBehavior,
      this.emojiBehavior,
    );
    this.structureBehavior = new NationStructureBehavior(
      this.random,
      this.mg,
      this.player,
    );
    this.behaviorsInitialized = true;
  }

  private pickTroopType(): void {
    if (this.troopTypePicked) return;
    // Counter the strongest bordering enemy; otherwise pick randomly.
    let dominant: TroopClass | null = null;
    let strongest: Player | null = null;
    let best = -1;
    for (const other of this.mg.players()) {
      if (other.id() === this.player.id()) continue;
      if (!other.isAlive()) continue;
      if (!this.player.sharesBorderWith(other)) continue;
      const t = other.troops();
      if (t > best) {
        best = t;
        strongest = other;
      }
    }
    if (strongest !== null) {
      const enemyClass = strongest.effectiveTroopClass();
      dominant = ((enemyClass + 2) % 3) as TroopClass;
    } else {
      dominant = this.random.nextInt(0, 3) as TroopClass;
    }
    const r: [number, number, number] = [0.1, 0.1, 0.1];
    r[dominant] = 0.8;
    this.player.setTroopRatio(r[0], r[1]);
    this.troopTypePicked = true;
  }

  tick(ticks: number): void {
    if (!this.isPrimary) {
      this.active = false;
      return;
    }
    if (!this.player.isAlive()) {
      this.active = false;
      AutopilotExecution.registry.delete(this.player.id());
      return;
    }
    if (!this.enabled || !this.player.hasSpawned()) return;

    if (!this.behaviorsInitialized) {
      this.initializeBehaviors();
    }
    this.pickTroopType();

    this.tickCounter++;
    // Build structures more often than we attack so gold gets spent.
    if (this.tickCounter % Math.floor(this.actEvery / 2) === 0) {
      this.structureBehavior.handleStructures();
    }
    if (this.tickCounter % this.actEvery !== 0) return;

    this.structureBehavior.handleStructures();
    this.warshipBehavior.maybeSpawnWarship();
    this.attackBehavior.maybeAttack();
    this.nukeBehavior.maybeSendNuke();
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
