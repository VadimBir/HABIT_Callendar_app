import { Execution, Game, UnitType } from "../game/Game";
import { SetTroopRatioExecution } from "./SetTroopRatioExecution";
import { AutopilotExecution } from "./AutopilotExecution";
import { AutoStructureExecution } from "./AutoStructureExecution";
import { AutoExpandExecution } from "./AutoExpandExecution";
import { PseudoRandom } from "../PseudoRandom";
import { ClientID, GameID, StampedIntent, Turn } from "../Schemas";
import { simpleHash } from "../Util";
import { AllianceExtensionExecution } from "./alliance/AllianceExtensionExecution";
import { AllianceRejectExecution } from "./alliance/AllianceRejectExecution";
import { AllianceRequestExecution } from "./alliance/AllianceRequestExecution";
import { BreakAllianceExecution } from "./alliance/BreakAllianceExecution";
import { AttackExecution } from "./AttackExecution";
import { BoatRetreatExecution } from "./BoatRetreatExecution";
import { ConstructionExecution } from "./ConstructionExecution";
import { DeleteUnitExecution } from "./DeleteUnitExecution";
import { DonateGoldExecution } from "./DonateGoldExecution";
import { DonateTroopsExecution } from "./DonateTroopExecution";
import { EmbargoAllExecution } from "./EmbargoAllExecution";
import { EmbargoExecution } from "./EmbargoExecution";
import { EmojiExecution } from "./EmojiExecution";
import { MarkDisconnectedExecution } from "./MarkDisconnectedExecution";
import { MoveWarshipExecution } from "./MoveWarshipExecution";
import { NationExecution } from "./NationExecution";
import { NoOpExecution } from "./NoOpExecution";
import { MirvExecution } from "./MIRVExecution";
import { NukeExecution } from "./NukeExecution";
import { PauseExecution } from "./PauseExecution";
import { QuickChatExecution } from "./QuickChatExecution";
import { RetreatExecution } from "./RetreatExecution";
import { SpawnExecution } from "./SpawnExecution";
import { TargetPlayerExecution } from "./TargetPlayerExecution";
import { TransportShipExecution } from "./TransportShipExecution";
import { TribeSpawner } from "./TribeSpawner";
import { UpgradeStructureExecution } from "./UpgradeStructureExecution";
import { WarshipExecution } from "./WarshipExecution";
import { PlayerSpawner } from "./utils/PlayerSpawner";

export class Executor {
  // private random = new PseudoRandom(999)
  private random: PseudoRandom;

  constructor(
    private mg: Game,
    private gameID: GameID,
    private clientID: ClientID | undefined,
  ) {
    // Add one to avoid id collisions with tribes.
    this.random = new PseudoRandom(simpleHash(gameID) + 1);
  }

  createExecs(turn: Turn): Execution[] {
    return turn.intents.flatMap((i) => this.createExec(i));
  }

  createExec(intent: StampedIntent): Execution | Execution[] {
    const player = this.mg.playerByClientID(intent.clientID);
    if (!player) {
      console.warn(`player with clientID ${intent.clientID} not found`);
      return new NoOpExecution();
    }

    // create execution
    switch (intent.type) {
      case "attack": {
        return new AttackExecution(
          intent.troops,
          player,
          intent.targetID,
          null,
        );
      }
      case "cancel_attack":
        return new RetreatExecution(player, intent.attackID);
      case "cancel_boat":
        return new BoatRetreatExecution(player, intent.unitID);
      case "move_warship":
        return new MoveWarshipExecution(player, intent.unitIds, intent.tile);
      case "spawn":
        return new SpawnExecution(this.gameID, player.info(), intent.tile);
      case "boat":
        return new TransportShipExecution(player, intent.dst, intent.troops);
      case "allianceRequest":
        return new AllianceRequestExecution(player, intent.recipient);
      case "allianceReject":
        return new AllianceRejectExecution(intent.requestor, player);
      case "breakAlliance":
        return new BreakAllianceExecution(player, intent.recipient);
      case "targetPlayer":
        return new TargetPlayerExecution(player, intent.target);
      case "emoji":
        return new EmojiExecution(player, intent.recipient, intent.emoji);
      case "donate_troops":
        return new DonateTroopsExecution(
          player,
          intent.recipient,
          intent.troops,
        );
      case "donate_gold":
        return new DonateGoldExecution(player, intent.recipient, intent.gold);
      case "embargo":
        return new EmbargoExecution(player, intent.targetID, intent.action);
      case "embargo_all":
        return new EmbargoAllExecution(player, intent.action);
      case "build_unit":
        return new ConstructionExecution(
          player,
          intent.unit,
          intent.tile,
          intent.rocketDirectionUp,
        );
      case "allianceExtension": {
        return new AllianceExtensionExecution(player, intent.recipient);
      }

      case "upgrade_structure":
        return new UpgradeStructureExecution(player, intent.unitId);
      case "delete_unit":
        return new DeleteUnitExecution(player, intent.unitId);
      case "quick_chat":
        return new QuickChatExecution(
          player,
          intent.recipient,
          intent.quickChatKey,
          intent.target,
        );
      case "mark_disconnected":
        return new MarkDisconnectedExecution(player, intent.isDisconnected);
      case "toggle_pause":
        return new PauseExecution(player, intent.paused);
      case "set_troop_ratio":
        return new SetTroopRatioExecution(player, intent.ratio0, intent.ratio1);
      case "set_autopilot":
        return new AutopilotExecution(player, intent.enabled);
      case "set_auto_structure": {
        if (intent.category === "expand") {
          return new AutoExpandExecution(player, intent.enabled);
        }
        const categoryToUnitType: Record<
          "city" | "factory" | "sam" | "port",
          UnitType
        > = {
          city: UnitType.City,
          factory: UnitType.Factory,
          sam: UnitType.SAMLauncher,
          port: UnitType.Port,
        };
        return new AutoStructureExecution(
          player,
          categoryToUnitType[intent.category],
          intent.enabled,
        );
      }
      case "multi_nuke": {
        const MAX_NUKES = 50;
        const count = Math.max(1, Math.min(MAX_NUKES, intent.count));
        const nukeType = intent.nukeType;
        const rocketDirectionUp = intent.rocketDirectionUp ?? true;
        const execs: Execution[] = [];

        // MIRV is itself a multi-warhead strike and MUST run through
        // MirvExecution — a NukeExecution with type MIRV does not launch.
        // (This was the ×N glitch: with count>1 the MIRV silently misfired.)
        if (nukeType === UnitType.MIRV) {
          execs.push(new MirvExecution(player, intent.tile));
          if (count > 1) {
            for (const t of this.spreadNukeTargets(intent.tile, count - 1)) {
              execs.push(new MirvExecution(player, t));
            }
          }
          return execs;
        }

        // First nuke: normal path (uses a silo as usual, applies cooldown).
        execs.push(
          new NukeExecution(
            nukeType,
            player,
            intent.tile,
            null,
            -1,
            0,
            rocketDirectionUp,
            false,
          ),
        );

        if (count > 1) {
          const targets = this.spreadNukeTargets(intent.tile, count - 1);
          for (const t of targets) {
            // Remaining nukes: force-spawn, bypassing the silo-cooldown gate.
            execs.push(
              new NukeExecution(
                nukeType,
                player,
                t,
                null,
                -1,
                0,
                rocketDirectionUp,
                true,
              ),
            );
          }
        }
        return execs;
      }
      case "multi_unit": {
        const MAX_UNITS = 50;
        const count = Math.max(1, Math.min(MAX_UNITS, intent.count));
        const execs: Execution[] = [];
        if (intent.unit === UnitType.Warship) {
          // First warship: normal path (uses a port as usual). Remaining ones
          // force-spawn from an owned port, bypassing the gold gate so all N
          // appear from a single port. Each is an independent unit.
          const tiles = [
            intent.tile,
            ...this.spreadWaterTargets(intent.tile, count - 1),
          ];
          for (let i = 0; i < tiles.length; i++) {
            execs.push(
              new WarshipExecution(
                { owner: player, patrolTile: tiles[i] },
                true, // force-spawn so all N appear from the single port
              ),
            );
          }
        }
        return execs;
      }
      default:
        throw new Error(`intent type ${intent} not found`);
    }
  }

  /**
   * Compute up to `count` spread target tiles around `center`, in expanding
   * rings spaced ~8 apart with the area growing as `count` grows. Deterministic
   * (seeded from gameID + center) so all clients agree. Mirrors the old
   * client-side BuildMenu.spreadNukes math, computed server-side.
   */
  private spreadNukeTargets(center: number, count: number): number[] {
    const result: number[] = [];
    if (count <= 0) return result;

    const rand = new PseudoRandom(simpleHash(this.gameID) + center + 7);
    const ox = this.mg.x(center);
    const oy = this.mg.y(center);
    const spacing = 8;
    const maxRadius = Math.min(120, spacing * (2 + Math.ceil(count / 4)));
    const chosen: { x: number; y: number }[] = [{ x: ox, y: oy }];

    for (
      let r = spacing;
      r <= maxRadius && result.length < count;
      r += 2
    ) {
      for (let dx = -r; dx <= r && result.length < count; dx += spacing) {
        for (let dy = -r; dy <= r && result.length < count; dy += spacing) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          // small deterministic jitter so the grid is not perfectly regular
          const jx = rand.nextInt(-2, 3);
          const jy = rand.nextInt(-2, 3);
          const x = ox + dx + jx;
          const y = oy + dy + jy;
          if (!this.mg.isValidCoord(x, y)) continue;
          if (
            chosen.some(
              (p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < spacing,
            )
          ) {
            continue;
          }
          chosen.push({ x, y });
          result.push(this.mg.ref(x, y));
        }
      }
    }
    return result;
  }

  /**
   * Compute up to `count` spread patrol tiles around `center`, preferring water
   * tiles (so warships spawn at distinct sail-able patrol points). Falls back to
   * the center if no water tile is found in a ring. Deterministic.
   */
  private spreadWaterTargets(center: number, count: number): number[] {
    const result: number[] = [];
    if (count <= 0) return result;

    const rand = new PseudoRandom(simpleHash(this.gameID) + center + 13);
    const ox = this.mg.x(center);
    const oy = this.mg.y(center);
    const spacing = 6;
    const maxRadius = Math.min(120, spacing * (2 + Math.ceil(count / 4)));

    for (let r = spacing; r <= maxRadius && result.length < count; r += 2) {
      for (let dx = -r; dx <= r && result.length < count; dx += spacing) {
        for (let dy = -r; dy <= r && result.length < count; dy += spacing) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const jx = rand.nextInt(-1, 2);
          const jy = rand.nextInt(-1, 2);
          const x = ox + dx + jx;
          const y = oy + dy + jy;
          if (!this.mg.isValidCoord(x, y)) continue;
          const t = this.mg.ref(x, y);
          if (!this.mg.isWater(t)) continue;
          result.push(t);
        }
      }
    }
    // Pad with the center tile if not enough distinct water tiles were found so
    // the requested count of warships is still honoured.
    while (result.length < count) {
      result.push(center);
    }
    return result;
  }

  spawnTribes(numTribes: number): SpawnExecution[] {
    return new TribeSpawner(this.mg, this.gameID).spawnTribes(numTribes);
  }

  spawnPlayers(): SpawnExecution[] {
    return new PlayerSpawner(this.mg, this.gameID).spawnPlayers();
  }

  nationExecutions(): Execution[] {
    const execs: Execution[] = [];
    for (const nation of this.mg.nations()) {
      execs.push(new NationExecution(this.gameID, nation));
    }
    return execs;
  }
}
