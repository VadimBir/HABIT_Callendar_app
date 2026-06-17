import { Execution, Game, Player } from "../game/Game";
import { GameID } from "../Schemas";
import { AutopilotExecution } from "./AutopilotExecution";

export class ToggleAutopilotExecution implements Execution {
  private active = true;
  private mg: Game;

  constructor(
    private player: Player,
    private enabled: boolean,
    private gameID: GameID,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    this.player.setAutopilot(this.enabled);
    if (this.enabled) {
      this.mg.addExecution(new AutopilotExecution(this.player, this.gameID));
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
