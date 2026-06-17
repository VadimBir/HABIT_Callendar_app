import { Execution, Game, Unit, UnitType } from "../game/Game";
import { ShellExecution } from "./ShellExecution";

/**
 * Drives an ArtilleryPost structure. Periodically finds the nearest enemy
 * target within 2 × defensePostRange() and fires a shell at it, dealing
 * unitInfo(Shell).damage × artilleryDamageMultiplier() (1.5).
 *
 * Mirrors WarshipExecution.shootTarget() / DefensePostExecution, reusing
 * ShellExecution (extended with an optional damage-multiplier argument).
 */
export class ArtilleryPostExecution implements Execution {
  private mg: Game;
  private active: boolean = true;

  private target: Unit | null = null;
  private lastShellAttack = 0;
  private alreadySentShell = new Set<Unit>();

  // Target types the artillery post will fire at.
  private static readonly TARGET_TYPES: readonly UnitType[] = [
    UnitType.TransportShip,
    UnitType.Warship,
    UnitType.TradeShip,
    UnitType.City,
    UnitType.Port,
    UnitType.Factory,
    UnitType.MissileSilo,
    UnitType.SAMLauncher,
    UnitType.DefensePost,
    UnitType.ArtilleryPost,
  ];

  constructor(private post: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  private range(): number {
    return 2 * this.mg.config().defensePostRange();
  }

  private findTarget(): Unit | null {
    const owner = this.post.owner();
    const candidates = this.mg.nearbyUnits(
      this.post.tile(),
      this.range(),
      ArtilleryPostExecution.TARGET_TYPES,
    );

    let best: Unit | null = null;
    let bestDist = Infinity;
    for (const { unit, distSquared } of candidates) {
      if (unit === this.post) continue;
      if (unit.owner() === owner) continue;
      if (unit.owner().isFriendly(owner)) continue;
      if (!owner.canAttackPlayer(unit.owner(), true)) continue;
      if (this.alreadySentShell.has(unit)) continue;
      if (distSquared < bestDist) {
        bestDist = distSquared;
        best = unit;
      }
    }
    return best;
  }

  private shoot() {
    if (this.target === null) return;
    const shellAttackRate = this.mg.config().artilleryShellAttackRate();
    if (this.mg.ticks() - this.lastShellAttack <= shellAttackRate) {
      return;
    }
    this.lastShellAttack = this.mg.ticks();
    this.mg.addExecution(
      new ShellExecution(
        this.post.tile(),
        this.post.owner(),
        this.post,
        this.target,
        this.mg.config().artilleryDamageMultiplier(),
      ),
    );
    if (!this.target.hasHealth()) {
      // Don't send multiple shells to a target that can be oneshotted.
      this.alreadySentShell.add(this.target);
      this.target = null;
    }
  }

  tick(ticks: number): void {
    if (!this.post.isActive()) {
      this.active = false;
      return;
    }

    // Do nothing while the structure is under construction.
    if (this.post.isUnderConstruction()) {
      return;
    }

    if (this.target !== null && !this.target.isActive()) {
      this.target = null;
    }

    if (this.target === null) {
      this.target = this.findTarget();
    }

    if (this.target !== null) {
      this.shoot();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
