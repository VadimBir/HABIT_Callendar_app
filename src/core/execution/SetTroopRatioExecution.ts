import { Execution, Game, Player } from "../game/Game";
import { SetTroopRatioIntent } from "../Schemas";

export class SetTroopRatioExecution implements Execution {
  private active = true;

  constructor(
    private player: Player,
    private intent: SetTroopRatioIntent,
  ) {}

  init(mg: Game, ticks: number): void {}

  tick(ticks: number): void {
    let growthR0 = this.intent.growthR0;
    let growthR1 = this.intent.growthR1;
    if (growthR0 + growthR1 > 1) {
      const sum = growthR0 + growthR1;
      growthR0 = growthR0 / sum;
      growthR1 = growthR1 / sum;
    }

    let targetR0 = this.intent.targetR0;
    let targetR1 = this.intent.targetR1;
    if (targetR0 + targetR1 > 1) {
      const sum = targetR0 + targetR1;
      targetR0 = targetR0 / sum;
      targetR1 = targetR1 / sum;
    }

    this.player.setGrowthRatio(growthR0, growthR1);
    this.player.setTargetRatio(targetR0, targetR1);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
