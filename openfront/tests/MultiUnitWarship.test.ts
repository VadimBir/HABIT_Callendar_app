import { Executor } from "../src/core/execution/ExecutionManager";
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

const gameID: GameID = "multi_warship_game";
const coastX = 7;

// Proves the multi_unit (Warship) path: ONE build action spawns N independent
// warships from a single port, each its own destroyable unit. The gold/standard
// gate is bypassed via WarshipExecution forceSpawn for all but the first.
describe("MultiUnit Warship (single-port multi-spawn)", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [new PlayerInfo("admiral", PlayerType.Human, "p1_client", "p1_id")],
    );
    player = game.player("p1_id");
    executeTicks(game, 50);

    // A single port on the coast.
    player.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    expect(player.units(UnitType.Port)).toHaveLength(1);
  });

  test("multi_unit count=7 spawns 7 warships from one port", () => {
    const COUNT = 7;
    const executor = new Executor(game, gameID, "p1_client");
    const intent: StampedIntent = {
      type: "multi_unit",
      unit: UnitType.Warship,
      tile: game.ref(coastX + 1, 10), // water tile next to the port
      count: COUNT,
      clientID: "p1_client",
    };

    const execs = executor.createExec(intent);
    const arr = Array.isArray(execs) ? execs : [execs];
    expect(arr.length).toBe(COUNT);
    for (const e of arr) game.addExecution(e);

    // Each WarshipExecution spawns its unit on init/first tick.
    executeTicks(game, 3);
    const ships = player.units(UnitType.Warship).length;
    // eslint-disable-next-line no-console
    console.log(`[multi_warship] spawned ${ships} warships from 1 port (requested ${COUNT})`);
    expect(ships).toBe(COUNT);

    // Each is an independent unit: deleting one leaves the rest.
    player.units(UnitType.Warship)[0].delete();
    executeTicks(game, 2);
    expect(player.units(UnitType.Warship).length).toBe(COUNT - 1);
  });

  test("count is clamped to 50", () => {
    const executor = new Executor(game, gameID, "p1_client");
    const intent: StampedIntent = {
      type: "multi_unit",
      unit: UnitType.Warship,
      tile: game.ref(coastX + 1, 10),
      count: 999,
      clientID: "p1_client",
    };
    const execs = executor.createExec(intent);
    const arr = Array.isArray(execs) ? execs : [execs];
    // eslint-disable-next-line no-console
    console.log(`[multi_warship] count=999 clamped to ${arr.length}`);
    expect(arr.length).toBe(50);
  });
});
