import {
  Execution,
  Game,
  Player,
  PlayerID,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { ConstructionExecution } from "./ConstructionExecution";

/**
 * Auto-Expand: an AUTO-BUILDER for buildings (NOT a territorial-conquest tool).
 * On a fixed cadence it spends the human player's gold to BUILD ONE structure,
 * cycling through a mix City → Factory → Port → SAMLauncher. It does NOT attack,
 * does NOT expand territory and does NOT send nukes.
 *
 * PLACEMENT — "furthest from enemies, spreading":
 *  - It computes the player's enemy-facing frontier ("threat tiles"): the
 *    player's border tiles whose neighbour is owned by another (non-self,
 *    non-ally) player. If none exist yet, it falls back to border tiles adjacent
 *    to non-owned land (the open frontier / map edge direction).
 *  - The build tile is an owned, valid-for-that-structure tile that MAXIMISES
 *    the distance to the nearest threat tile (the safe interior / rear), with a
 *    spacing bonus that pushes successive same-type structures apart so they
 *    SPREAD outward as the safe rear fills up.
 *
 * Performance / determinism:
 *  - No Math.random — all sampling uses PseudoRandom (deterministic).
 *  - The threat set is cached and only recomputed every THREAT_REFRESH_ROUNDS
 *    cadence rounds, so we never do an O(tiles × threats) scan every tick.
 *  - Candidates are a bounded PseudoRandom subset of owned tiles (CANDIDATE_*),
 *    and the threat set itself is capped (MAX_THREAT_TILES) so the per-build
 *    work is O(CANDIDATES × MAX_THREAT_TILES) — constant, not territory-sized.
 *
 * Toggled via the set_auto_structure intent with category "expand". Static
 * registry keeps one per player so toggling off stops the live instance.
 */
export class AutoExpandExecution implements Execution {
  private static registry = new Map<PlayerID, AutoExpandExecution>();

  private active = true;
  private isPrimary = false;
  private mg!: Game;
  private random!: PseudoRandom;
  private initialized = false;
  private tickCounter = 0;
  // ~3x faster than the old 5-tick cadence (mirrors AutoStructureExecution).
  private readonly actEvery = 2;

  // Weighted build mix (user ratio ~ City 20 : Factory 5 : SAM 2 : Silo 1).
  // Expanded into a flat cycle so one structure is built per acting round at a
  // frequency matching the weights. Ports excluded per design. Tune freely.
  private readonly buildCycle: readonly UnitType[] = [
    ...Array<UnitType>(20).fill(UnitType.City),
    ...Array<UnitType>(5).fill(UnitType.Factory),
    ...Array<UnitType>(2).fill(UnitType.SAMLauncher),
    ...Array<UnitType>(1).fill(UnitType.MissileSilo),
  ];
  private cycleIndex = 0;

  // Number of candidate owned tiles sampled per build attempt (bounded work).
  private static readonly CANDIDATE_SAMPLES = 40;
  // Cap on threat tiles kept in cache (bounded distance-eval work per candidate).
  private static readonly MAX_THREAT_TILES = 60;
  // Recompute the (expensive) threat set only every N acting rounds.
  private static readonly THREAT_REFRESH_ROUNDS = 8;

  private threatTilesCache: TileRef[] = [];
  private threatCacheRound = -Infinity;
  private actRound = 0;

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

  tick(_ticks: number): void {
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

    this.initialized = true;

    this.tickCounter++;
    if (this.tickCounter % this.actEvery !== 0) return;

    this.actRound++;
    // Try each type in the cycle once this round; build the first that works so a
    // type that can't be placed (e.g. Port when landlocked) is skipped, not stuck.
    for (let i = 0; i < this.buildCycle.length; i++) {
      const type = this.buildCycle[this.cycleIndex];
      this.cycleIndex = (this.cycleIndex + 1) % this.buildCycle.length;
      if (this.tryBuild(type)) {
        return;
      }
    }
  }

  /**
   * Attempts to build one structure of `type` at the safe-rear tile that is
   * furthest from the enemy frontier (with same-type spacing). Returns true if a
   * real, gold-charged ConstructionExecution was queued.
   */
  private tryBuild(type: UnitType): boolean {
    const game = this.mg;
    const player = this.player;

    if (game.config().isUnitDisabled(type)) return false;

    // Gold gate: only build if affordable.
    const cost = game.unitInfo(type).cost(game, player);
    if (player.gold() < cost) return false;

    const candidates = this.sampleCandidates(type);
    if (candidates.length === 0) return false;

    const threats = this.getThreatTiles();

    // Pre-collect existing same-type structure tiles for spreading.
    const sameType = player.units(type).map((u) => u.tile());

    let bestTile: TileRef | null = null;
    let bestScore = -Infinity;

    for (const tile of candidates) {
      if (player.canBuild(type, tile) === false) continue;

      // Distance to nearest enemy threat tile: bigger = safer rear.
      let safety: number;
      if (threats.length === 0) {
        safety = 0;
      } else {
        let minD = Infinity;
        for (const th of threats) {
          const d = game.euclideanDistSquared(tile, th);
          if (d < minD) minD = d;
        }
        // Use the (un-squared) distance so it composes linearly with spacing.
        safety = Math.sqrt(minD);
      }

      // Spreading: reward distance from the NEAREST existing same-type structure
      // so placements fan out across the safe rear instead of stacking.
      let spread = 0;
      if (sameType.length > 0) {
        let minS = Infinity;
        for (const st of sameType) {
          const d = game.euclideanDistSquared(tile, st);
          if (d < minS) minS = d;
        }
        spread = Math.sqrt(minS);
      }

      const score = safety + 0.5 * spread;
      if (score > bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    }

    if (bestTile === null) return false;

    game.addExecution(new ConstructionExecution(player, type, bestTile));
    return true;
  }

  /**
   * Bounded PseudoRandom subset of the player's owned tiles, biased toward the
   * bounding box so it works on large territories without scanning them all.
   * Ports additionally require a coastal (shore-with-shared-water) tile.
   */
  private sampleCandidates(type: UnitType): TileRef[] {
    const game = this.mg;
    const player = this.player;

    if (type === UnitType.Port) {
      const shared = game.sharedWaterComponents(player);
      if (shared === null) return [];
      const coastal: TileRef[] = [];
      for (const t of player.borderTiles()) {
        if (!game.isShore(t)) continue;
        for (const n of game.neighbors(t)) {
          if (!game.isWater(n)) continue;
          if (game.isOcean(n)) {
            coastal.push(t);
            break;
          }
          const comp = game.getWaterComponent(n);
          if (comp !== null && shared.has(comp)) {
            coastal.push(t);
            break;
          }
        }
      }
      return this.sampleArray(coastal, AutoExpandExecution.CANDIDATE_SAMPLES);
    }

    // Land structures: sample from owned tiles via the bounding box (fast).
    const samples: TileRef[] = [];
    const owned = player.numTilesOwned();
    if (owned <= 0) return [];

    const bb = this.boundingBox();
    if (bb === null) return [];

    const attempts = AutoExpandExecution.CANDIDATE_SAMPLES * 3;
    for (
      let i = 0;
      i < attempts && samples.length < AutoExpandExecution.CANDIDATE_SAMPLES;
      i++
    ) {
      const x = this.random.nextInt(bb.minX, bb.maxX + 1);
      const y = this.random.nextInt(bb.minY, bb.maxY + 1);
      if (!game.isValidCoord(x, y)) continue;
      const t = game.ref(x, y);
      if (game.owner(t) !== player) continue;
      samples.push(t);
    }
    return samples;
  }

  private sampleArray(a: TileRef[], n: number): TileRef[] {
    if (a.length <= n) return a;
    const out: TileRef[] = [];
    const remaining = new Set(a);
    for (let i = 0; i < n && remaining.size > 0; i++) {
      const t = this.random.randFromSet(remaining);
      remaining.delete(t);
      out.push(t);
    }
    return out;
  }

  private boundingBox(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null {
    const game = this.mg;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;
    for (const t of this.player.borderTiles()) {
      const x = game.x(t);
      const y = game.y(t);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      any = true;
    }
    if (!any) return null;
    return { minX, minY, maxX, maxY };
  }

  /**
   * Returns the cached enemy-facing frontier ("threat tiles"), recomputing only
   * every THREAT_REFRESH_ROUNDS acting rounds. Threat = our border tile whose
   * neighbour is owned by a non-self, non-ally player. Fallback when we have no
   * enemy borders yet: border tiles adjacent to non-owned (neutral/water) land,
   * i.e. the open frontier / map-edge direction.
   */
  private getThreatTiles(): TileRef[] {
    if (
      this.actRound - this.threatCacheRound <
      AutoExpandExecution.THREAT_REFRESH_ROUNDS
    ) {
      return this.threatTilesCache;
    }
    this.threatCacheRound = this.actRound;

    const game = this.mg;
    const player = this.player;

    const enemy: TileRef[] = [];
    const openFrontier: TileRef[] = [];
    for (const bt of player.borderTiles()) {
      let isEnemyFront = false;
      let isOpenFront = false;
      for (const n of game.neighbors(bt)) {
        const owner = game.owner(n);
        if (owner === player) continue;
        if (owner.isPlayer()) {
          const op = owner as Player;
          // Treat allies/same-team as safe; everyone else is a threat.
          if (player.isAlliedWith(op) || player.isOnSameTeam(op)) continue;
          isEnemyFront = true;
          break;
        } else {
          // TerraNullius / water — the open frontier direction.
          isOpenFront = true;
        }
      }
      if (isEnemyFront) {
        enemy.push(bt);
      } else if (isOpenFront) {
        openFrontier.push(bt);
      }
    }

    const chosen = enemy.length > 0 ? enemy : openFrontier;
    this.threatTilesCache = this.sampleArray(
      chosen,
      AutoExpandExecution.MAX_THREAT_TILES,
    );
    return this.threatTilesCache;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
