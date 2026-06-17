import { Executor } from "../src/core/execution/ExecutionManager";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { GameID, StampedIntent } from "../src/core/Schemas";
import { setup } from "./util/Setup";
import { constructionExecution, executeTicks } from "./util/utils";

const gameID: GameID = "multi_nuke_game";
let game: Game;
let attacker: Player;

describe("MultiNuke (silo-cooldown bypass)", () => {
  beforeEach(async () => {
    game = await setup("plains", { infiniteGold: true, instantBuild: true });

    const attackerInfo = new PlayerInfo(
      "attacker_name",
      PlayerType.Human,
      "attacker_client", // real clientID so Executor can resolve the player
      "attacker_id",
    );
    game.addPlayer(attackerInfo);

    // A victim so the target tile is owned (realistic nuke target).
    const victimInfo = new PlayerInfo(
      "victim_name",
      PlayerType.Human,
      "victim_client",
      "victim_id",
    );
    game.addPlayer(victimInfo);

    game.addExecution(
      new SpawnExecution(gameID, game.player("attacker_id").info(), game.ref(1, 1)),
      new SpawnExecution(gameID, game.player("victim_id").info(), game.ref(60, 60)),
    );

    attacker = game.player("attacker_id");

    // Attacker has exactly ONE missile silo (the single-silo gate is what
    // normally limits launches to one per cooldown).
    constructionExecution(game, attacker, 1, 1, UnitType.MissileSilo);

    expect(attacker.units(UnitType.MissileSilo)).toHaveLength(1);
  });

  test("multi_nuke count=5 spawns ~5 nukes from a single silo", () => {
    const COUNT = 5;
    const executor = new Executor(game, gameID, "attacker_client");

    const intent: StampedIntent = {
      type: "multi_nuke",
      nukeType: UnitType.AtomBomb,
      tile: game.ref(60, 60),
      count: COUNT,
      rocketDirectionUp: true,
      clientID: "attacker_client",
    };

    const execs = executor.createExec(intent);
    const execArray = Array.isArray(execs) ? execs : [execs];
    // One NukeExecution per requested nuke.
    expect(execArray.length).toBe(COUNT);
    for (const e of execArray) {
      game.addExecution(e);
    }

    // Tick so each NukeExecution inits then runs its spawn branch on the SAME
    // tick (forced nukes must NOT be blocked by the silo cooldown).
    executeTicks(game, 2);

    const spawned = attacker.units(UnitType.AtomBomb).length;
    // eslint-disable-next-line no-console
    console.log(`multi_nuke spawned ${spawned} AtomBomb units (requested ${COUNT})`);

    // Without the bypass this would be 1. We expect all N to fire.
    expect(spawned).toBe(COUNT);
  });
});
