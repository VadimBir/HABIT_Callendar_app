import { AutoExpandExecution } from "../src/core/execution/AutoExpandExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  Structures,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

/**
 * Verifies that the redesigned Auto Expand is an AUTO-BUILDER that:
 *   (a) actually builds several structures over time, and
 *   (b) starts at the safe REAR — placements furthest from the enemy frontier.
 *
 * Map layout (big_plains, 200×200, all land):
 *   enemy bot owns the LEFT strip   x ∈ [10, 20)
 *   human owns the interior strip   x ∈ [20, 80)   (territory midline x = 50)
 * The safe rear for the human is therefore HIGH x (right side, far from the
 * enemy on the left). We assert the first few placed structures sit on the far
 * (right) side of the midline.
 */
describe("AutoExpand auto-builder", () => {
  let game: Game;
  let human: Player;
  let enemy: Player;

  const HUMAN_X_MIN = 20;
  const HUMAN_X_MAX = 80; // exclusive
  const ENEMY_X_MIN = 10;
  const ENEMY_X_MAX = 20; // exclusive
  const Y_MIN = 20;
  const Y_MAX = 80; // exclusive
  const MIDLINE = (HUMAN_X_MIN + HUMAN_X_MAX) / 2; // 50

  beforeEach(async () => {
    game = await setup("big_plains", {
      infiniteGold: false,
      instantBuild: true,
      infiniteTroops: true,
    });

    const enemyInfo = new PlayerInfo(
      "enemy_bot",
      PlayerType.Bot,
      null,
      "enemy_bot",
    );
    const humanInfo = new PlayerInfo(
      "human_test",
      PlayerType.Human,
      null,
      "human_test",
    );
    game.addPlayer(enemyInfo);
    game.addPlayer(humanInfo);

    enemy = game.player("enemy_bot");
    human = game.player("human_test");

    // Carve the strips.
    for (let x = ENEMY_X_MIN; x < ENEMY_X_MAX; x++) {
      for (let y = Y_MIN; y < Y_MAX; y++) {
        enemy.conquer(game.ref(x, y));
      }
    }
    for (let x = HUMAN_X_MIN; x < HUMAN_X_MAX; x++) {
      for (let y = Y_MIN; y < Y_MAX; y++) {
        human.conquer(game.ref(x, y));
      }
    }

    // Mark both players as spawned (Auto Expand guards on hasSpawned()).
    human.setSpawnTile(game.ref(HUMAN_X_MIN, Y_MIN));
    enemy.setSpawnTile(game.ref(ENEMY_X_MIN, Y_MIN));

    human.addTroops(50000);
    enemy.addTroops(50000);
    // Plenty of gold to build many structures.
    human.addGold(1_000_000_000n);
  });

  test("builds several structures, starting at the safe rear (far from enemy)", () => {
    expect(human.hasSpawned()).toBe(true);

    const before = human.units(...Structures.types).length;
    expect(before).toBe(0);

    const exec = new AutoExpandExecution(human, true);
    game.addExecution(exec);

    // Advance enough ticks for many build rounds (cadence = 5 ticks/round).
    for (let i = 0; i < 200; i++) {
      game.executeNextTick();
    }

    const structures = human.units(...Structures.types);
    const after = structures.length;

    // (a) Several structures were actually built.
    expect(after).toBeGreaterThanOrEqual(4);

    // Record placement order via unit id (monotonic) — earliest = first built.
    const ordered = [...structures].sort((a, b) => a.id() - b.id());

    // Enemy frontier is at x = ENEMY_X_MAX - 1 (the bot's right edge). Distance
    // to enemy ≈ how far right of the human's left border the structure sits.
    const distToEnemy = (u: (typeof ordered)[number]) =>
      game.x(u.tile()) - ENEMY_X_MAX;

    console.log(
      `AutoExpand: built ${after} structures (started with ${before}).`,
    );
    console.log(
      "First placements [type @ (x,y) distToEnemy]:",
      ordered
        .slice(0, 8)
        .map(
          (u) =>
            `${u.type()}@(${game.x(u.tile())},${game.y(u.tile())}) d=${distToEnemy(u)}`,
        )
        .join("  "),
    );

    const firstFew = ordered.slice(0, Math.min(4, ordered.length));
    const avgX =
      firstFew.reduce((s, u) => s + game.x(u.tile()), 0) / firstFew.length;
    const avgDist =
      firstFew.reduce((s, u) => s + distToEnemy(u), 0) / firstFew.length;

    console.log(
      `Midline x=${MIDLINE}; first-${firstFew.length} avg x=${avgX.toFixed(1)}, avg distToEnemy=${avgDist.toFixed(1)}`,
    );

    // (b) The first structures start on the FAR side from the enemy: their
    // average x is past the territory midline (toward the safe rear).
    expect(avgX).toBeGreaterThan(MIDLINE);

    // A mix of types is used (not all the same structure).
    const typesUsed = new Set(structures.map((u) => u.type()));
    console.log("Types used:", [...typesUsed].join(", "));
    expect(typesUsed.size).toBeGreaterThanOrEqual(2);
  });
});
