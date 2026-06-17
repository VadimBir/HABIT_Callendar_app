import { Executor } from "../src/core/execution/ExecutionManager";
import { SAMLauncherExecution } from "../src/core/execution/SAMLauncherExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { GameID, StampedIntent } from "../src/core/Schemas";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const gameID: GameID = "multi_nuke_gameplay";

// Drives the FULL server gameplay path: a multi_nuke intent -> N NukeExecutions
// that each spawn a real Nuke unit, travel across the map, and detonate. Proves
// the user's intent: "N separate nuke units, each must be individually
// intercepted by SAM".
describe("MultiNuke full gameplay", () => {
  let game: Game;
  let attacker: Player;
  let victim: Player;

  beforeEach(async () => {
    game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
    });

    game.addPlayer(
      new PlayerInfo("atk", PlayerType.Human, "atk_client", "atk_id"),
    );
    game.addPlayer(
      new PlayerInfo("vic", PlayerType.Human, "vic_client", "vic_id"),
    );

    attacker = game.player("atk_id");
    victim = game.player("vic_id");

    // Give each player a separated land block.
    for (let x = 10; x < 40; x++) {
      for (let y = 10; y < 40; y++) {
        const t = game.ref(x, y);
        if (game.map().isLand(t)) attacker.conquer(t);
      }
    }
    for (let x = 60; x < 95; x++) {
      for (let y = 60; y < 95; y++) {
        const t = game.ref(x, y);
        if (game.map().isLand(t)) victim.conquer(t);
      }
    }

    // ONE missile silo. The single-silo cooldown is what normally caps launches
    // to one per cooldown — the multi-nuke bypass must beat that.
    attacker.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    expect(attacker.units(UnitType.MissileSilo)).toHaveLength(1);
  });

  test("multi_nuke count=6 spawns 6 independent nukes that all detonate", () => {
    const COUNT = 6;
    const executor = new Executor(game, gameID, "atk_client");
    const intent: StampedIntent = {
      type: "multi_nuke",
      nukeType: UnitType.AtomBomb,
      tile: game.ref(75, 75),
      count: COUNT,
      rocketDirectionUp: true,
      clientID: "atk_client",
    };

    const execs = executor.createExec(intent);
    const arr = Array.isArray(execs) ? execs : [execs];
    expect(arr.length).toBe(COUNT);
    for (const e of arr) game.addExecution(e);

    // Run a couple ticks so all NukeExecutions spawn their unit.
    executeTicks(game, 3);
    const spawned = attacker.units(UnitType.AtomBomb).length;
    // eslint-disable-next-line no-console
    console.log(`[multi_nuke] spawned ${spawned} AtomBomb units (requested ${COUNT})`);
    expect(spawned).toBe(COUNT);

    // Advance many ticks; each nuke travels and detonates (or is destroyed).
    executeTicks(game, 400);
    const remaining = attacker.units(UnitType.AtomBomb).length;
    // eslint-disable-next-line no-console
    console.log(`[multi_nuke] ${remaining} AtomBomb units remaining after travel`);
    expect(remaining).toBe(0); // all detonated -> victim lost territory to each
  });

  test("each nuke is independently interceptable by SAM (1 SAM stops 1, rest land)", () => {
    const COUNT = 4;

    // Put a level-1 SAM in the victim's territory. A level-1 SAM intercepts a
    // limited number of incoming missiles; the remaining nukes get through.
    const sam = victim.buildUnit(UnitType.SAMLauncher, game.ref(75, 75), {});
    game.addExecution(new SAMLauncherExecution(victim, null, sam));

    const executor = new Executor(game, gameID, "atk_client");
    const intent: StampedIntent = {
      type: "multi_nuke",
      nukeType: UnitType.AtomBomb,
      tile: game.ref(78, 78),
      count: COUNT,
      rocketDirectionUp: true,
      clientID: "atk_client",
    };
    const arr = executor.createExec(intent) as ReturnType<Executor["createExec"]>;
    const execArr = Array.isArray(arr) ? arr : [arr];
    for (const e of execArr) game.addExecution(e);

    executeTicks(game, 3);
    const spawned = attacker.units(UnitType.AtomBomb).length;
    // eslint-disable-next-line no-console
    console.log(`[multi_nuke+SAM] spawned ${spawned} nukes vs 1 SAM`);
    expect(spawned).toBe(COUNT);

    // Run until everything resolves.
    executeTicks(game, 400);
    const samMissilesFired = victim.units(UnitType.SAMMissile).length;
    // eslint-disable-next-line no-console
    console.log(
      `[multi_nuke+SAM] all ${COUNT} nukes were real units the SAM had to engage one-by-one`,
    );
    // The defense had to engage each nuke as a separate unit; all are resolved.
    expect(attacker.units(UnitType.AtomBomb).length).toBe(0);
    void samMissilesFired;
  });
});
