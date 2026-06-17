import { NationExecution } from "../src/core/execution/NationExecution";
import { AutopilotExecution } from "../src/core/execution/AutopilotExecution";
import {
  Cell,
  Difficulty,
  Game,
  Nation,
  Player,
  PlayerInfo,
  PlayerType,
  TroopClass,
  troopClassCounters,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { UseRealAttackLogic } from "./util/TestConfig";
import { executeTicks } from "./util/utils";

function setComposition(p: Player, t1: number, t2: number, t3: number): void {
  // Zero out then set explicit per-type troop counts.
  p.removeTroops(p.troops());
  if (t1 > 0) p.addTroops(t1, TroopClass.T1);
  if (t2 > 0) p.addTroops(t2, TroopClass.T2);
  if (t3 > 0) p.addTroops(t3, TroopClass.T3);
}

describe("Mod verification (runtime mechanics)", () => {
  test("(a) Nation AI commits to a dominant troop type", async () => {
    const game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
      difficulty: Difficulty.Medium,
    });

    const nationInfo = new PlayerInfo(
      "verify_nation",
      PlayerType.Nation,
      null,
      "verify_nation_id",
    );
    game.addPlayer(nationInfo);
    const nation = game.player("verify_nation_id");

    // Give the nation some land so it is a real player.
    for (let x = 40; x < 60; x++) {
      for (let y = 40; y < 60; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile) && !game.map().hasOwner(tile)) {
          nation.conquer(tile);
        }
      }
    }

    const execNation = new Nation(new Cell(50, 50), nation.info());
    const exec = new NationExecution("verify_game", execNation);
    exec.init(game);
    executeTicks(game, 5);

    const ratio = nation.troopRatio();
    const dominant = Math.max(ratio[0], ratio[1], ratio[2]);
    // eslint-disable-next-line no-console
    console.log(
      `[Task0a] Nation troop ratio = [${ratio[0]}, ${ratio[1]}, ${ratio[2]}], dominant=${dominant}`,
    );
    expect(dominant).toBeGreaterThanOrEqual(0.75);
  });

  test("(b) Autopilot picks a troop type and issues actions on a human", async () => {
    const game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
    });

    const humanInfo = new PlayerInfo(
      "verify_human",
      PlayerType.Human,
      null,
      "verify_human_id",
    );
    game.addPlayer(humanInfo);
    const human = game.player("verify_human_id");

    let spawn = game.ref(50, 50);
    for (let x = 30; x < 70; x++) {
      for (let y = 30; y < 70; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile) && !game.map().hasOwner(tile)) {
          human.conquer(tile);
          spawn = tile;
        }
      }
    }
    // Mark the player as spawned so autopilot will act on it.
    human.setSpawnTile(spawn);
    human.addGold(1_000_000_000n);

    // Default ratio before autopilot.
    const before = human.troopRatio();
    // eslint-disable-next-line no-console
    console.log(
      `[Task0b] Before autopilot ratio = [${before[0]}, ${before[1]}, ${before[2]}]`,
    );

    const exec = new AutopilotExecution(human, true);
    game.addExecution(exec);
    // Drive enough ticks for it to pick a type and act.
    executeTicks(game, 120);

    const after = human.troopRatio();
    const dominant = Math.max(after[0], after[1], after[2]);
    // eslint-disable-next-line no-console
    console.log(
      `[Task0b] After autopilot ratio = [${after[0]}, ${after[1]}, ${after[2]}], dominant=${dominant}`,
    );
    // Autopilot commits to a [0.8,0.1,0.1]-style mix; prove it actually ran
    // (not the default [1,0,0]) by checking dominant ~ 0.8 with two minor types.
    expect(dominant).toBeGreaterThan(0.7);
    expect(dominant).toBeLessThan(0.9);
    const minors = after.filter((v) => v < 0.7);
    expect(minors.length).toBe(2);
    expect(minors[0]).toBeGreaterThan(0);
  });

  test("(c) Real combat: countering attacker inflicts far more defender loss", async () => {
    const game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [],
      undefined,
      UseRealAttackLogic,
    );

    const aInfo = new PlayerInfo("atk", PlayerType.Human, null, "atk_id");
    const dInfo = new PlayerInfo("def", PlayerType.Human, null, "def_id");
    game.addPlayer(aInfo);
    game.addPlayer(dInfo);
    const attacker = game.player("atk_id");
    const defender = game.player("def_id");

    // Give defender a fixed territory so troops/numTilesOwned is well defined.
    let tile = game.ref(50, 50);
    for (let x = 45; x < 55; x++) {
      for (let y = 45; y < 55; y++) {
        const t = game.ref(x, y);
        if (game.map().isLand(t) && !game.map().hasOwner(t)) {
          defender.conquer(t);
          tile = t;
        }
      }
    }
    for (let x = 30; x < 40; x++) {
      for (let y = 30; y < 40; y++) {
        const t = game.ref(x, y);
        if (game.map().isLand(t) && !game.map().hasOwner(t)) {
          attacker.conquer(t);
        }
      }
    }

    const config = game.config();
    const attackTroops = 100_000;

    // Case COUNTER: attacker T1, defender T2 (T1 counters T2).
    setComposition(attacker, 100_000, 0, 0);
    setComposition(defender, 0, 100_000, 0);
    expect(troopClassCounters(TroopClass.T1, TroopClass.T2)).toBe(true);
    expect(attacker.effectiveTroopClass()).toBe(TroopClass.T1);
    expect(defender.effectiveTroopClass()).toBe(TroopClass.T2);
    const counter = config.attackLogic(
      game,
      attackTroops,
      attacker,
      defender,
      tile,
    );

    // Case COUNTERED: attacker T1, defender T3 (T3 counters T1).
    setComposition(attacker, 100_000, 0, 0);
    setComposition(defender, 0, 0, 100_000);
    expect(troopClassCounters(TroopClass.T3, TroopClass.T1)).toBe(true);
    const countered = config.attackLogic(
      game,
      attackTroops,
      attacker,
      defender,
      tile,
    );

    // Case NEUTRAL: same class -> no multiplier.
    setComposition(attacker, 100_000, 0, 0);
    setComposition(defender, 100_000, 0, 0);
    const neutral = config.attackLogic(
      game,
      attackTroops,
      attacker,
      defender,
      tile,
    );

    const defSwing = counter.defenderTroopLoss / countered.defenderTroopLoss;
    const atkSwing = countered.attackerTroopLoss / counter.attackerTroopLoss;
    const endToEnd = defSwing * atkSwing;

    // eslint-disable-next-line no-console
    console.log("[Task0c] Combat numbers:");
    // eslint-disable-next-line no-console
    console.log(
      `  COUNTER   defLoss=${counter.defenderTroopLoss.toFixed(3)} atkLoss=${counter.attackerTroopLoss.toFixed(3)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  COUNTERED defLoss=${countered.defenderTroopLoss.toFixed(3)} atkLoss=${countered.attackerTroopLoss.toFixed(3)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  NEUTRAL   defLoss=${neutral.defenderTroopLoss.toFixed(3)} atkLoss=${neutral.attackerTroopLoss.toFixed(3)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  defenderLoss swing (counter/countered) = ${defSwing.toFixed(3)}x`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  attackerLoss swing (countered/counter) = ${atkSwing.toFixed(3)}x`,
    );
    // eslint-disable-next-line no-console
    console.log(`  end-to-end swing = ${endToEnd.toFixed(3)}x`);

    // After Task 1: multiplier is x3 / x(1/3) => defender swing ~9x, end-to-end ~81x.
    expect(defSwing).toBeGreaterThan(8);
    expect(defSwing).toBeLessThan(10);
    // Neutral should be unmultiplied (between counter and countered).
    expect(neutral.defenderTroopLoss).toBeLessThan(counter.defenderTroopLoss);
    expect(neutral.defenderTroopLoss).toBeGreaterThan(
      countered.defenderTroopLoss,
    );
  });

  test("(d) Defense Post: upgrading raises defense bonus AND range", async () => {
    const game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [],
      undefined,
      UseRealAttackLogic,
    );

    const aInfo = new PlayerInfo("dp_atk", PlayerType.Human, null, "dp_atk_id");
    const dInfo = new PlayerInfo("dp_def", PlayerType.Human, null, "dp_def_id");
    game.addPlayer(aInfo);
    game.addPlayer(dInfo);
    const attacker = game.player("dp_atk_id");
    const defender = game.player("dp_def_id");

    // Defender owns a big block.
    for (let x = 40; x < 60; x++) {
      for (let y = 40; y < 60; y++) {
        const t = game.ref(x, y);
        if (game.map().isLand(t) && !game.map().hasOwner(t)) defender.conquer(t);
      }
    }
    for (let x = 20; x < 30; x++) {
      for (let y = 20; y < 30; y++) {
        const t = game.ref(x, y);
        if (game.map().isLand(t) && !game.map().hasOwner(t)) attacker.conquer(t);
      }
    }
    setComposition(attacker, 100_000, 0, 0);
    setComposition(defender, 100_000, 0, 0); // neutral matchup, isolate defense

    const postTile = game.ref(50, 50);
    defender.buildUnit(UnitType.DefensePost, postTile, {});
    const post = defender.units(UnitType.DefensePost)[0];
    expect(post).toBeDefined();
    expect(post.level()).toBe(1);

    const config = game.config();
    const nearTile = game.ref(51, 50); // within base range
    const atk = 100_000;

    const lvl1 = config.attackLogic(game, atk, attacker, defender, nearTile);

    // Upgrade the post a couple of levels.
    expect(defender.canUpgradeUnit(post)).toBe(true);
    defender.upgradeUnit(post);
    defender.upgradeUnit(post);
    expect(post.level()).toBe(3);

    const lvl3 = config.attackLogic(game, atk, attacker, defender, nearTile);

    // eslint-disable-next-line no-console
    console.log("[Task0d] Defense Post scaling:");
    // eslint-disable-next-line no-console
    console.log(
      `  bonus(1)=${config.defensePostDefenseBonus(1)} bonus(3)=${config.defensePostDefenseBonus(3)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  range(1)=${config.defensePostRange(1)} range(3)=${config.defensePostRange(3)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  attackerLoss lvl1=${lvl1.attackerTroopLoss.toFixed(2)} lvl3=${lvl3.attackerTroopLoss.toFixed(2)}`,
    );

    // Formula checks.
    expect(config.defensePostDefenseBonus(1)).toBeCloseTo(5);
    expect(config.defensePostDefenseBonus(3)).toBeCloseTo(5 * 1.5 * 1.5);
    expect(config.defensePostRange(3)).toBeGreaterThan(config.defensePostRange(1));
    expect(config.defensePostRange(3)).toBeCloseTo(300 * (1 + 0.15 * 2));
    // Higher level => more defense magnitude => attacker loses more.
    expect(lvl3.attackerTroopLoss).toBeGreaterThan(lvl1.attackerTroopLoss);
  });
});
