import { Execution, Game, Unit, UnitType } from "../game/Game";
import { ArtilleryShellExecution } from "./ArtilleryShellExecution";

const ATTACK_COOLDOWN = 30;

export class ArtilleryPostExecution implements Execution {
  private mg: Game;
  private active = true;
  private lastAttackTick = 0;

  constructor(private post: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.lastAttackTick = mg.ticks();
  }

  tick(ticks: number): void {
    if (!this.post.isActive()) {
      this.active = false;
      return;
    }

    if (this.post.isUnderConstruction()) {
      return;
    }

    if (this.mg.ticks() - this.lastAttackTick < ATTACK_COOLDOWN) {
      return;
    }

    const owner = this.post.owner();
    const range = this.mg.config().artilleryPostRange();
    const nearby = this.mg.nearbyUnits(this.post.tile(), range, [
      UnitType.Warship,
      UnitType.TransportShip,
      UnitType.TradeShip,
    ]);

    for (const { unit } of nearby) {
      if (unit.owner() === owner) continue;
      if (!owner.canAttackPlayer(unit.owner(), true)) continue;

      this.lastAttackTick = this.mg.ticks();
      this.mg.addExecution(
        new ArtilleryShellExecution(
          this.post.tile(),
          owner,
          this.post,
          unit,
          this.mg.config().artilleryPostAttackBonus(this.post.level()),
        ),
      );
      break;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
