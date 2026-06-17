import { AttackExecution } from "../src/core/execution/AttackExecution";
import { NationExecution } from "../src/core/execution/NationExecution";
import { ToggleAutopilotExecution } from "../src/core/execution/ToggleAutopilotExecution";
import {
  Cell,
  Nation,
  Player,
  PlayerInfo,
  PlayerType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { UseRealAttackLogic } from "./util/TestConfig";
import { executeTicks } from "./util/utils";

describe("New mechanisms fire (AI + combat + autopilot)", () => {
  test("AI nation picks a dominant troop type (rock-paper-scissors)", async () => {
    const game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
    });
    const nationInfo = new PlayerInfo(
      "ai_nation",
      PlayerType.Nation,
      null,
      "ai_nation",
    );
    game.addPlayer(nationInfo);
    const nation = game.player("ai_nation");
    let n = 0;
    game.map().forEachTile((t) => {
      if (game.map().isLand(t) && n++ % 3 === 0) nation.conquer(t);
    });

    expect(Math.max(...nation.growthRatio())).toBeLessThan(0.5);

    const exec = new NationExecution(
      "game",
      new Nation(new Cell(50, 50), nation.info()),
    );
    exec.init(game);
    executeTicks(game, 5);
    for (let i = 0; i < 60; i++) {
      exec.tick(game.ticks());
      game.executeNextTick();
    }

    const gr = nation.growthRatio();
    expect(Math.max(...gr)).toBeGreaterThan(0.7);
    console.log("AI nation growthRatio after running:", gr);
  });

  test("autopilot turns on and drives the human player", async () => {
    const game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
    });
    const humanInfo = new PlayerInfo(
      "human",
      PlayerType.Human,
      null,
      "human",
    );
    game.addPlayer(humanInfo);
    const human = game.player("human");
    let n = 0;
    game.map().forEachTile((t) => {
      if (game.map().isLand(t) && n++ % 3 === 0) human.conquer(t);
    });

    expect(human.isAutopilotEnabled()).toBe(false);
    game.addExecution(new ToggleAutopilotExecution(human, true, "game"));
    executeTicks(game, 80);

    expect(human.isAutopilotEnabled()).toBe(true);
    expect(Math.max(...human.growthRatio())).toBeGreaterThan(0.7);
    console.log(
      "Autopilot enabled:",
      human.isAutopilotEnabled(),
      "growthRatio:",
      human.growthRatio(),
    );
  });

  test("rock-paper-scissors changes combat: countered attacker loses more troops", async () => {
    async function attackerLossWith(
      attackerType: 0 | 1 | 2,
    ): Promise<number> {
      const game = await setup(
        "big_plains",
        { instantBuild: true },
        [],
        undefined,
        UseRealAttackLogic,
      );
      const aInfo = new PlayerInfo("atk", PlayerType.Human, null, "atk");
      const dInfo = new PlayerInfo("def", PlayerType.Human, null, "def");
      game.addPlayer(aInfo);
      game.addPlayer(dInfo);
      const attacker = game.player("atk");
      const defender = game.player("def");

      defender.setGrowthRatio(0, 1);
      attacker.setGrowthRatio(
        attackerType === 0 ? 1 : 0,
        attackerType === 1 ? 1 : 0,
      );

      game.map().forEachTile((t) => {
        if (!game.map().isLand(t)) return;
        (game.x(t) < 50 ? attacker : defender).conquer(t);
      });
      attacker.addTroops(300_000, attackerType);
      defender.addTroops(300_000, 1);

      const defBefore = defender.troops();
      game.addExecution(new AttackExecution(150_000, attacker, defender.id()));
      executeTicks(game, 50);
      return defBefore - defender.troops();
    }

    const counterDefLoss = await attackerLossWith(0);
    const counteredDefLoss = await attackerLossWith(2);
    console.log(
      "defender troops destroyed — by countering atk(T1):",
      counterDefLoss,
      " by countered atk(T3):",
      counteredDefLoss,
    );
    expect(counterDefLoss).toBeGreaterThan(counteredDefLoss);
  });
});
