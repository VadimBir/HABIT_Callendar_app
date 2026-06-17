import { Execution, Game, Player } from "../game/Game";

export class SetTroopRatioExecution implements Execution {
  constructor(
    private player: Player,
    private ratio0: number,
    private ratio1: number,
  ) {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return true;
  }

  init(game: Game, ticks: number): void {
    this.player.setTroopRatio(this.ratio0, this.ratio1);
  }

  tick(ticks: number): void {}
}
