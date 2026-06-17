import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "../../../client/Utils";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  Structures,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { Controller } from "../../Controller";
import {
  CloseViewEvent,
  MouseDownEvent,
  ShowBuildMenuEvent,
  ShowEmojiMenuEvent,
} from "../../InputHandler";
import { TransformHandler } from "../../TransformHandler";
import {
  BuildUnitIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../../Transport";
import { UIState } from "../../UIState";
import { renderNumber } from "../../Utils";
import { GameView } from "../../view";
const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const mirvIcon = assetUrl("images/MIRVIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const hydrogenBombIcon = assetUrl("images/MushroomCloudIconWhite.svg");
const atomBombIcon = assetUrl("images/NukeIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samlauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const shieldIcon = assetUrl("images/ShieldIconWhite.svg");

export interface BuildItemDisplay {
  unitType: PlayerBuildableUnitType;
  icon: string;
  description?: string;
  key?: string;
  countable?: boolean;
}

export const buildTable: BuildItemDisplay[][] = [
  [
    {
      unitType: UnitType.AtomBomb,
      icon: atomBombIcon,
      description: "build_menu.desc.atom_bomb",
      key: "unit_type.atom_bomb",
      countable: false,
    },
    {
      unitType: UnitType.MIRV,
      icon: mirvIcon,
      description: "build_menu.desc.mirv",
      key: "unit_type.mirv",
      countable: false,
    },
    {
      unitType: UnitType.HydrogenBomb,
      icon: hydrogenBombIcon,
      description: "build_menu.desc.hydrogen_bomb",
      key: "unit_type.hydrogen_bomb",
      countable: false,
    },
    {
      unitType: UnitType.Warship,
      icon: warshipIcon,
      description: "build_menu.desc.warship",
      key: "unit_type.warship",
      countable: true,
    },
    {
      unitType: UnitType.Port,
      icon: portIcon,
      description: "build_menu.desc.port",
      key: "unit_type.port",
      countable: true,
    },
    {
      unitType: UnitType.MissileSilo,
      icon: missileSiloIcon,
      description: "build_menu.desc.missile_silo",
      key: "unit_type.missile_silo",
      countable: true,
    },
    {
      unitType: UnitType.SAMLauncher,
      icon: samlauncherIcon,
      description: "build_menu.desc.sam_launcher",
      key: "unit_type.sam_launcher",
      countable: true,
    },
    {
      unitType: UnitType.DefensePost,
      icon: shieldIcon,
      description: "build_menu.desc.defense_post",
      key: "unit_type.defense_post",
      countable: true,
    },
    {
      unitType: UnitType.City,
      icon: cityIcon,
      description: "build_menu.desc.city",
      key: "unit_type.city",
      countable: true,
    },
    {
      unitType: UnitType.Factory,
      icon: factoryIcon,
      description: "build_menu.desc.factory",
      key: "unit_type.factory",
      countable: true,
    },
  ],
];

export const flattenedBuildTable = buildTable.flat();

@customElement("build-menu")
export class BuildMenu extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private clickedTile: TileRef;
  public playerBuildables: BuildableUnit[] | null = null;
  private filteredBuildTable: BuildItemDisplay[][] = buildTable;
  public transformHandler: TransformHandler;

  init() {
    this.eventBus.on(ShowBuildMenuEvent, (e) => {
      if (!this.game.myPlayer()?.isAlive()) {
        return;
      }
      if (!this._hidden) {
        // Players sometimes hold control while building a unit,
        // so if the menu is already open, ignore the event.
        return;
      }
      const clickedCell = this.transformHandler.screenToWorldCoordinates(
        e.x,
        e.y,
      );
      if (!this.game.isValidCoord(clickedCell.x, clickedCell.y)) {
        return;
      }
      const tile = this.game.ref(clickedCell.x, clickedCell.y);
      this.showMenu(tile);
    });
    this.eventBus.on(CloseViewEvent, () => this.hideMenu());
    this.eventBus.on(ShowEmojiMenuEvent, () => this.hideMenu());
    this.eventBus.on(MouseDownEvent, () => this.hideMenu());
  }

  tick() {
    if (!this._hidden) {
      this.refresh();
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    .build-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      background-color: #1e1e1e;
      padding: 15px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 95vw;
      max-height: 95vh;
      overflow-y: auto;
    }
    .build-description {
      font-size: 0.6rem;
    }
    .build-row {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      width: 100%;
    }
    .build-button {
      position: relative;
      width: 120px;
      height: 140px;
      border: 2px solid #444;
      background-color: #2c2c2c;
      color: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 8px;
      padding: 10px;
      gap: 5px;
    }
    .build-button:not(:disabled):hover {
      background-color: #3a3a3a;
      transform: scale(1.05);
      border-color: #666;
    }
    .build-button:not(:disabled):active {
      background-color: #4a4a4a;
      transform: scale(0.95);
    }
    .build-button:disabled {
      background-color: #1a1a1a;
      border-color: #333;
      cursor: not-allowed;
      opacity: 0.7;
    }
    .build-button:disabled img {
      opacity: 0.5;
    }
    .build-button:disabled .build-cost {
      color: #ff4444;
    }
    .build-icon {
      font-size: 40px;
      margin-bottom: 5px;
    }
    .build-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
      text-align: center;
    }
    .build-cost {
      font-size: 14px;
    }
    .hidden {
      display: none !important;
    }
    .build-multi-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-bottom: 8px;
    }
    .build-multi-label {
      color: #aaa;
      font-size: 13px;
      margin-right: 2px;
    }
    .build-multi-button {
      min-width: 34px;
      height: 34px;
      border: 1px solid #444;
      background-color: #2c2c2c;
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      transition: all 0.2s ease;
    }
    .build-multi-button:hover {
      background-color: #3a3a3a;
      border-color: #666;
    }
    .build-multi-button.selected {
      background-color: #4a7dff;
      border-color: #6f9bff;
    }
    @media (max-width: 480px) {
      .build-multi-button {
        min-width: 30px;
        height: 30px;
        font-size: 12px;
      }
    }
    .build-count-chip {
      position: absolute;
      top: -10px;
      right: -10px;
      background-color: #2c2c2c;
      color: white;
      padding: 2px 10px;
      border-radius: 10000px;
      transition: all 0.3s ease;
      font-size: 12px;
      display: flex;
      justify-content: center;
      align-content: center;
      border: 1px solid #444;
    }
    .build-button:not(:disabled):hover > .build-count-chip {
      background-color: #3a3a3a;
      border-color: #666;
    }
    .build-button:not(:disabled):active > .build-count-chip {
      background-color: #4a4a4a;
    }
    .build-button:disabled > .build-count-chip {
      background-color: #1a1a1a;
      border-color: #333;
      cursor: not-allowed;
    }
    .build-count {
      font-weight: bold;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .build-menu {
        padding: 10px;
        max-height: 80vh;
        width: 80vw;
      }
      .build-button {
        width: 140px;
        height: 120px;
        margin: 4px;
        padding: 6px;
        gap: 5px;
      }
      .build-icon {
        font-size: 28px;
      }
      .build-name {
        font-size: 12px;
        margin-bottom: 3px;
      }
      .build-cost {
        font-size: 11px;
      }
      .build-count {
        font-weight: bold;
        font-size: 10px;
      }
      .build-count-chip {
        padding: 1px 5px;
      }
    }

    @media (max-width: 480px) {
      .build-menu {
        padding: 8px;
        max-height: 70vh;
      }
      .build-button {
        width: calc(50% - 6px);
        height: 100px;
        margin: 3px;
        padding: 4px;
        border-width: 1px;
      }
      .build-icon {
        font-size: 24px;
      }
      .build-name {
        font-size: 10px;
        margin-bottom: 2px;
      }
      .build-cost {
        font-size: 9px;
      }
      .build-count {
        font-weight: bold;
        font-size: 8px;
      }
      .build-count-chip {
        padding: 0 3px;
      }
      .build-button img {
        width: 24px;
        height: 24px;
      }
      .build-cost img {
        width: 10px;
        height: 10px;
      }
    }
  `;

  @state()
  private _hidden = true;

  // Build-count multiplier: place this many structures per confirmed build.
  private static readonly BUILD_MULTIPLIERS: readonly number[] = [
    1, 2, 4, 8, 10, 20, 50,
  ];

  @state()
  private _buildMultiplier = 1;

  private setBuildMultiplier(n: number): void {
    this._buildMultiplier = n;
    this.requestUpdate();
  }

  // ---- Hold-to-stack: holding a build/upgrade button accumulates a count,
  // accelerating from a 1.0s step down to 0.25s (-0.1s per +1). Release builds
  // that many. A quick tap falls back to the x-multiplier selector.
  private _holdActive = false;
  @state() private _holdUnitType: UnitType | null = null;
  @state() private _holdCount = 1;
  private _holdInterval = 1000;
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;

  private clearHoldTimer(): void {
    if (this._holdTimer !== null) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  private startHold(buildableUnit: BuildableUnit): void {
    if (buildableUnit.canBuild === false && buildableUnit.canUpgrade === false) {
      return;
    }
    this.clearHoldTimer();
    this._holdActive = true;
    this._holdUnitType = buildableUnit.type;
    this._holdCount = 1;
    this._holdInterval = 1000;
    this.requestUpdate();
    this._holdTimer = setTimeout(
      () => this.tickHold(buildableUnit),
      this._holdInterval,
    );
  }

  private tickHold(buildableUnit: BuildableUnit): void {
    if (!this._holdActive) return;
    this._holdCount += 1;
    this._holdInterval = Math.max(250, this._holdInterval - 100);
    this.requestUpdate();
    this._holdTimer = setTimeout(
      () => this.tickHold(buildableUnit),
      this._holdInterval,
    );
  }

  private endHold(buildableUnit: BuildableUnit): void {
    if (!this._holdActive) return;
    this._holdActive = false;
    this.clearHoldTimer();
    const n = this._holdCount > 1 ? this._holdCount : this._buildMultiplier;
    this._holdUnitType = null;
    this._holdCount = 1;
    this.performBuildOrUpgradeN(buildableUnit, this.clickedTile, n);
  }

  private performBuildOrUpgradeN(
    buildableUnit: BuildableUnit,
    tile: TileRef,
    n: number,
  ): void {
    if (buildableUnit.canUpgrade !== false) {
      for (let i = 0; i < n; i++) {
        this.eventBus.emit(
          new SendUpgradeStructureIntentEvent(
            buildableUnit.canUpgrade,
            buildableUnit.type,
          ),
        );
      }
    } else if (buildableUnit.canBuild) {
      const rocketDirectionUp =
        buildableUnit.type === UnitType.AtomBomb ||
        buildableUnit.type === UnitType.HydrogenBomb
          ? this.uiState.rocketDirectionUp
          : undefined;
      this.eventBus.emit(
        new BuildUnitIntentEvent(buildableUnit.type, tile, rocketDirectionUp),
      );
      if (
        n > 1 &&
        (Structures.types as readonly UnitType[]).includes(buildableUnit.type)
      ) {
        void this.placeAdditional(buildableUnit, tile, n - 1);
      }
    }
    this.hideMenu();
  }

  public canBuildOrUpgrade(item: BuildItemDisplay): boolean {
    if (this.game?.myPlayer() === null || this.playerBuildables === null) {
      return false;
    }
    const unit = this.playerBuildables.find((u) => u.type === item.unitType);
    return unit ? unit.canBuild !== false || unit.canUpgrade !== false : false;
  }

  public cost(item: BuildItemDisplay): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item.unitType) {
        return bu.cost;
      }
    }
    return 0n;
  }

  public count(item: BuildItemDisplay): string {
    const player = this.game?.myPlayer();
    if (!player) {
      return "?";
    }

    return player.totalUnitLevels(item.unitType).toString();
  }

  public sendBuildOrUpgrade(buildableUnit: BuildableUnit, tile: TileRef): void {
    if (buildableUnit.canUpgrade !== false) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          buildableUnit.canUpgrade,
          buildableUnit.type,
        ),
      );
    } else if (buildableUnit.canBuild) {
      const rocketDirectionUp =
        buildableUnit.type === UnitType.AtomBomb ||
        buildableUnit.type === UnitType.HydrogenBomb
          ? this.uiState.rocketDirectionUp
          : undefined;
      // Always place the first one at the clicked tile.
      this.eventBus.emit(
        new BuildUnitIntentEvent(buildableUnit.type, tile, rocketDirectionUp),
      );
      // Build-multi: only for structures, and only if multiplier > 1.
      if (
        this._buildMultiplier > 1 &&
        (Structures.types as readonly UnitType[]).includes(buildableUnit.type)
      ) {
        // Fire-and-forget; placements are validated per-tile.
        void this.placeAdditional(
          buildableUnit,
          tile,
          this._buildMultiplier - 1,
        );
      }
    }
    this.hideMenu();
  }

  /**
   * Place up to `remaining` extra structures of the same type on the best
   * nearby valid owned tiles, spread out from the origin. Stops early when
   * gold runs out or no more valid tiles are found.
   */
  private async placeAdditional(
    buildableUnit: BuildableUnit,
    origin: TileRef,
    remaining: number,
  ): Promise<void> {
    const player = this.game?.myPlayer();
    if (!player || remaining <= 0) return;
    const type = buildableUnit.type;

    // Estimate available gold; per-unit cost grows, but the menu cost is a
    // reasonable lower bound — accumulate conservatively.
    let budget = player.gold();
    const perUnitCost = buildableUnit.cost;

    // Collect candidate owned tiles in expanding rings, spaced out so the
    // structures don't all cluster on a single spot.
    const mySmallID = player.smallID();
    const ox = this.game.x(origin);
    const oy = this.game.y(origin);
    const spacing = 6; // min spacing between placements (Chebyshev-ish)
    const maxRadius = 60;

    const placed: { x: number; y: number }[] = [{ x: ox, y: oy }];
    const candidates: TileRef[] = [];
    for (let r = spacing; r <= maxRadius && candidates.length < 400; r += 2) {
      for (let dx = -r; dx <= r; dx += spacing) {
        for (let dy = -r; dy <= r; dy += spacing) {
          // Only consider the ring perimeter to spread placements.
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = ox + dx;
          const y = oy + dy;
          if (!this.game.isValidCoord(x, y)) continue;
          const t = this.game.ref(x, y);
          const owner = this.game.owner(t);
          if (!owner.isPlayer() || owner.smallID() !== mySmallID) continue;
          // Respect spacing from already-chosen placements.
          if (
            placed.some(
              (p) =>
                Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < spacing,
            )
          ) {
            continue;
          }
          candidates.push(t);
          placed.push({ x, y });
        }
      }
    }

    for (const t of candidates) {
      if (remaining <= 0) break;
      if (perUnitCost > 0n && budget < perUnitCost) break;
      // Confirm the structure can actually be built here.
      const builds = await player.buildables(t, [type]);
      const bu = builds.find((b) => b.type === type);
      if (!bu || bu.canBuild === false) continue;
      this.eventBus.emit(new BuildUnitIntentEvent(type, bu.canBuild));
      budget -= perUnitCost;
      remaining--;
    }
  }

  render() {
    return html`
      <div
        class="build-menu ${this._hidden ? "hidden" : ""}"
        @contextmenu=${(e: MouseEvent) => e.preventDefault()}
      >
        <div class="build-multi-row">
          <span class="build-multi-label">x</span>
          ${BuildMenu.BUILD_MULTIPLIERS.map(
            (n) => html`
              <button
                class="build-multi-button ${this._buildMultiplier === n
                  ? "selected"
                  : ""}"
                @click=${() => this.setBuildMultiplier(n)}
                title="Place ${n} at once"
              >
                ${n}
              </button>
            `,
          )}
        </div>
        ${this.filteredBuildTable.map(
          (row) => html`
            <div class="build-row">
              ${row.map((item) => {
                const buildableUnit = this.playerBuildables?.find(
                  (bu) => bu.type === item.unitType,
                );
                if (buildableUnit === undefined) {
                  return html``;
                }
                const enabled =
                  buildableUnit.canBuild !== false ||
                  buildableUnit.canUpgrade !== false;
                return html`
                  <button
                    class="build-button"
                    @pointerdown=${() => this.startHold(buildableUnit)}
                    @pointerup=${() => this.endHold(buildableUnit)}
                    @pointerleave=${() => this.endHold(buildableUnit)}
                    @pointercancel=${() => this.endHold(buildableUnit)}
                    ?disabled=${!enabled}
                    title=${!enabled
                      ? translateText("build_menu.not_enough_money")
                      : ""}
                  >
                    <img
                      src=${item.icon}
                      alt="${item.unitType}"
                      width="40"
                      height="40"
                    />
                    <span class="build-name"
                      >${item.key && translateText(item.key)}</span
                    >
                    <span class="build-description"
                      >${item.description &&
                      translateText(item.description)}</span
                    >
                    <span class="build-cost" translate="no">
                      ${renderNumber(
                        this.game && this.game.myPlayer() ? this.cost(item) : 0,
                      )}
                      <img
                        src=${goldCoinIcon}
                        alt="gold"
                        width="12"
                        height="12"
                        class="align-middle"
                      />
                    </span>
                    ${item.countable
                      ? html`<div class="build-count-chip">
                          <span class="build-count">${this.count(item)}</span>
                        </div>`
                      : ""}
                    ${this._holdActive &&
                    this._holdUnitType === item.unitType &&
                    this._holdCount > 1
                      ? html`<div
                          class="build-count-chip"
                          style="background:#16a34a;left:2px;right:auto"
                        >
                          <span class="build-count">×${this._holdCount}</span>
                        </div>`
                      : ""}
                  </button>
                `;
              })}
            </div>
          `,
        )}
      </div>
    `;
  }

  hideMenu() {
    this._hidden = true;
    this._holdActive = false;
    this.clearHoldTimer();
    this.requestUpdate();
  }

  showMenu(clickedTile: TileRef) {
    this.clickedTile = clickedTile;
    this._hidden = false;
    this.refresh();
  }

  private refresh() {
    this.game
      .myPlayer()
      ?.buildables(this.clickedTile, BuildMenus.types)
      .then((buildables) => {
        this.playerBuildables = buildables;
        this.requestUpdate();
      });

    // remove disabled buildings from the buildtable
    this.filteredBuildTable = this.getBuildableUnits();
  }

  private getBuildableUnits(): BuildItemDisplay[][] {
    return buildTable.map((row) =>
      row.filter((item) => !this.game?.config()?.isUnitDisabled(item.unitType)),
    );
  }

  get isVisible() {
    return !this._hidden;
  }
}
