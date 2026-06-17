import { Execution, Game, Player } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { GameID } from "../Schemas";
import { simpleHash } from "../Util";
import { NationAllianceBehavior } from "./nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "./nation/NationEmojiBehavior";
import { NationMIRVBehavior } from "./nation/NationMIRVBehavior";
import { NationNukeBehavior } from "./nation/NationNukeBehavior";
import { NationStructureBehavior } from "./nation/NationStructureBehavior";
import { NationWarshipBehavior } from "./nation/NationWarshipBehavior";
import { AiAttackBehavior } from "./utils/AiAttackBehavior";

export class AutopilotExecution implements Execution {
  private active = true;
  private random: PseudoRandom;
  private mg: Game;

  private behaviorsInitialized = false;
  private emojiBehavior!: NationEmojiBehavior;
  private mirvBehavior!: NationMIRVBehavior;
  private attackBehavior!: AiAttackBehavior;
  private allianceBehavior!: NationAllianceBehavior;
  private warshipBehavior!: NationWarshipBehavior;
  private nukeBehavior!: NationNukeBehavior;
  private structureBehavior!: NationStructureBehavior;

  private attackRate: number;
  private attackTick: number;
  private triggerRatio: number;
  private reserveRatio: number;
  private expandRatio: number;

  constructor(
    private player: Player,
    private gameID: GameID,
  ) {
    this.random = new PseudoRandom(
      simpleHash(player.id()) ^ simpleHash(gameID) ^ 0xdeadbeef,
    );
    this.attackRate = this.random.nextInt(30, 50);
    this.attackTick = this.random.nextInt(0, this.attackRate);
    this.triggerRatio = this.random.nextInt(50, 60) / 100;
    this.reserveRatio = this.random.nextInt(30, 40) / 100;
    this.expandRatio = this.random.nextInt(10, 20) / 100;
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (!this.player.isAlive()) {
      this.active = false;
      return;
    }

    if (!this.player.isAutopilotEnabled()) {
      return;
    }

    if (!this.behaviorsInitialized) {
      this.initializeBehaviors();
      this.attackBehavior.forceSendAttack(this.mg.terraNullius());
      return;
    }

    if (ticks % this.attackRate !== this.attackTick) {
      const offset = ticks % this.attackRate;
      const oneThird =
        (this.attackTick + Math.floor(this.attackRate / 3)) % this.attackRate;
      const twoThirds =
        (this.attackTick + Math.floor((this.attackRate * 2) / 3)) %
        this.attackRate;
      if (offset === oneThird || offset === twoThirds) {
        this.structureBehavior.handleStructures();
      }
      return;
    }

    this.allianceBehavior.handleAllianceRequests();
    this.allianceBehavior.handleAllianceExtensionRequests();
    this.mirvBehavior.considerMIRV();
    this.structureBehavior.handleStructures();
    this.warshipBehavior.maybeSpawnWarship();
    this.attackBehavior.maybeAttack();
    this.warshipBehavior.counterWarshipInfestation();
    this.nukeBehavior.maybeSendNuke();
  }

  private initializeBehaviors(): void {
    this.emojiBehavior = new NationEmojiBehavior(
      this.random,
      this.mg,
      this.player,
    );
    this.mirvBehavior = new NationMIRVBehavior(
      this.random,
      this.mg,
      this.player,
      this.emojiBehavior,
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
      this.triggerRatio,
      this.reserveRatio,
      this.expandRatio,
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
    const troopType = this.random.nextInt(0, 3);
    const ratios: [number, number, number] = [0.1, 0.1, 0.1];
    ratios[troopType] = 0.8;
    this.player.setGrowthRatio(ratios[0], ratios[1]);
    this.player.setTargetRatio(ratios[0], ratios[1]);
    this.behaviorsInitialized = true;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
