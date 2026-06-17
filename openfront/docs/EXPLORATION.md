# OpenFrontIO Mod — Stage 1 Exploration Maps

Consolidated WHAT/WHERE/WHY maps from the Haiku exploration pass (verified against current clone).
Line numbers are current as of this clone; implementers must re-confirm before editing.

## Locked design decisions (from user)

- **3 troop types** T1>T2>T3>T1, winner gets **×1.66** combat advantage (loser ×0.602 ≈ 1/1.66).
- Player controls growth mix with **two sliders** → ratio across the 3 types.
- When army is at max troops, **switching type runs at 0.3× growth speed**.
- **Types must be wired into the Nation AI** (bots pick a dominant type; on Hard/Impossible counter neighbor).
- **Ports +1.5× income** (railway synergy).
- **Everything new must be reflected in the Nations AI.**

## 1. Autopilot / Nation AI

- Bot AI: `src/core/execution/NationExecution.ts` (constructor/init/tick ~50–210); behaviors in `src/core/execution/nation/*` (structure, attack, warship, nuke, alliance, MIRV, emoji). Each behavior constructs with `(random, game, player)` and calls `game.addExecution()` — reusable for a human player.
- Dispatch: `src/core/execution/ExecutionManager.ts` (~49–127) switch on `intent.type` → Execution class. Add a `set_autopilot` case.
- Intents/Transport: Zod schemas in `src/core/Schemas.ts` (~354–517); Transport events in Transport.ts (~34–274). Mirror an existing toggle (e.g. `PauseGameIntentEvent` → `PauseExecution`).
- New `AutopilotExecution` wraps/reuses NationExecution behaviors pointed at the human player; toggle via `SetAutopilotEvent`.
- No existing autopilot code. NOTE (prior session): autopilot must ALSO pick a troop type on init (mirror NationExecution.setNationTroopType) — this was a real gap.

## 2. Troops / Combat

- Single pool: `src/core/game/PlayerImpl.ts:98` `_troops: bigint`; accessors ~1138–1156 (`troops()/addTroops()/removeTroops()`, proportional removal).
- Growth: `src/core/execution/PlayerExecution.ts:78–79` calls `config.troopIncreaseRate(player)`; formula `Config.ts:787–819`; cap `maxTroops()` `Config.ts:753–782`.
- Combat: `Config.ts:564–685` `attackLogic()` returns `{attackerTroopLoss, defenderTroopLoss, tilesPerTickUsed}`. Inject ×1.66/×0.602 multiplier ~649–661.
- Apply loss: `src/core/execution/AttackExecution.ts:303–316` (`removeTroops(loss)` per tile).
- Wire format (packed quad): `PlayerImpl.ts:164–168/186–191` `[smallID, tilesOwned, gold, troops]` (4 floats → widen to carry per-type). Buffered `GameImpl.ts:98–99`, drained as Float64Array `GameImpl.ts:500–504`. Docstring `GameUpdates.ts:37–43`.
- Client view: `PlayerView.ts:71–97` `stateFromUpdate()` unpacks troops at ~81; add `troopsByType()`.
- Tests: `TestConfig.ts:78–90` stubs attackLogic to 1.00; `UseRealAttackLogic` (~101–122) delegates to real `Config.prototype.attackLogic`. Combat tests must use UseRealAttackLogic.

## 3. Defense / SAM / Structures

- Config.ts knobs: `defensePostRange()` 146–148 = 30 → ×10 (300); `defensePostDefenseBonus()` 150–152 = 5 (→ ×1.5/level); `defensePostSpeedBonus()` 154–156 = 3; `samRange(level)` 860–863 & `maxSamRange()` 865–867 = 150 → ×10 (1500); `defaultSamRange()` 856–858 = 70 → 700; SAMLauncher cost 368–380 (`min(3_000_000,(n+1)*1_500_000)`) → ÷2.
- UnitType enum: `src/core/game/Game.ts:174–176` (MissileSilo/DefensePost/SAMLauncher); Structures group ~204–211.
- Unit config blocks in Config.ts: DefensePost 359–367 (ADD `upgradable:true`), SAMLauncher 368–380 (already upgradable), Port 307–318, City 381–391.
- Defense bonus applied in combat: `Config.ts:594–606` — within `defensePostRange()` of an owned DefensePost: `mag *= defensePostDefenseBonus()` (601), `speed *= defensePostSpeedBonus()` (602). Make bonus level-scaled: `5 * 1.5^(level-1)`.
- Level: `Unit.level()` `Game.ts:505`; upgrade `src/core/execution/UpgradeStructureExecution.ts`.
- Shell pattern: `WarshipExecution.ts` `shootTarget()` (~609–632) spawns `ShellExecution(tile, owner, source, target)`; `ShellExecution.ts` damage `effectOnTarget()` (~65–73) base `unitInfo(Shell).damage`=250 (Config.ts ~296–301). New **ArtilleryPost**: fire at 2× defensePostRange, ×1.5 shell damage.
- Construction: `src/core/execution/ConstructionExecution.ts`; AI building `src/core/execution/nation/NationStructureBehavior.ts` `getStructureRatios()` (~46–64) + DefensePost logic ~143–150.
- Build menu: `src/client/hud/layers/BuildMenu.ts` (icons ~29–39, table ~49–122). New structure needs an icon SVG in `resources/images/` (prior session shipped it AI-buildable without a menu button).

## 4. Economy

- Income: `src/core/execution/PlayerExecution.ts:80–81` calls `config.goldAdditionRate(player)`; formula `Config.ts:821–830` (single edit point; structure income NOT implemented today). Applies to ALL player types incl. nations → AI benefits automatically.
- Factory: `src/core/execution/FactoryExecution.ts` (makes TrainStations, zero passive income). Add `1.1^factoryLevels` in `goldAdditionRate()`. `unitCount(type)` returns SUM of levels (`PlayerImpl.ts:437`).
- Trains: `trainSpawnRate(numPlayerFactories)` `Config.ts:210–214` = `(n+10)*15` → change `*15` to `*7.5` for 2×. Spawn use `TrainStationExecution.ts:53–63`.
- Factory train-stop gold: `src/core/game/TrainStation.ts` `FactoryStopHandler.onStop()` (~40–46) is EMPTY; mirror `TradeStationStopHandler` (~15–38) using `config.trainGold()`.
- Port income: `src/core/execution/PortExecution.ts`; add `1.5^portLevels` in `goldAdditionRate()`.

## 5. Build / Offline / APK

- Offline engine: `src/core/worker/LocalServer.ts` (~67–150); Transport auto-detects `GameType.Singleplayer` (~200–202). No network/auth once `gameStartInfo` provided.
- Build: `npm run build-prod` (package.json:5) → Vite → `static/` (`vite.config.ts` ~54–260, output `static/`, bundle in `assets/`, hashed in `_assets/`, manifest `static/asset-manifest.json`).
- BLOCKER: built `index.html` has unrendered EJS placeholders (`<%- gitCommit %>`, `assetManifest`, `BOOTSTRAP_CONFIG`, `cdnBase`, `gameEnv`, `numWorkers`, `turnstileSiteKey`, `jwtAudience`, `instanceId`, plus manifest/favicon/image hrefs). Server renders them at request time in `src/server/.../RenderHtml.ts` (~14–51).
- FIX: post-build `scripts/render-offline-index.ts` that reads `static/asset-manifest.json`, reuses RenderHtml/buildAssetUrl logic, injects static offline values (`cdnBase=""`, `instanceId="OFFLINE_APK"`, `gameEnv="prod"`, real numWorkers, empty turnstile), overwrites `static/index.html`. Verify 0 placeholders remain.
- APK: no existing Capacitor/android. Use Capacitor: init, add android, `npx cap copy`, gradle assembleDebug.
- KNOWN GOTCHA: Gradle asset-merge fails on flag file `Polish–Lithuanian Commonwealth.svg` (en-dash) under ASCII JVM locale → build with `LANG=C.UTF-8 LC_ALL=C.UTF-8` (sets `sun.jnu.encoding=UTF-8`).
- Stats wire change (prior session): widening the player-stats quad requires matching encode (PlayerImpl) AND decode (PlayerView) AND tests that assert the quad width.
