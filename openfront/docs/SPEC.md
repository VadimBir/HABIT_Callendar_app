# OpenFrontIO Mod — Implementation Spec (Stage 2)

Read `docs/EXPLORATION.md` first for the line-referenced seams. Formulas are fixed by the user — do not "improve" them. Re-confirm line numbers before editing (they drift).

## Stream partition (conflict-minimized)

**Stream A** (worktree `/home/user/OF-stream-a`, branch `stream-a`):

- Autopilot: new `src/core/execution/AutopilotExecution.ts`, `SetAutopilotEvent` in Transport, `set_autopilot` schema + ExecutionManager case, autopilot toggle button in ControlPanel.
- Defense/SAM tuning in Config.ts (ranges ×10, SAM cost ÷2, DefensePost `upgradable:true`, level-scaled defense bonus).
- New Artillery Post: `src/core/execution/ArtilleryPostExecution.ts`, `UnitType.ArtilleryPost` in Game.ts, unitInfo block in Config.ts, AI build wiring in NationStructureBehavior, build-menu entry (+ icon).
- `docs/DESIGN.md`.

**Stream B** (worktree `/home/user/OF-stream-b`, branch `stream-b`):

- 3 troop types end-to-end (enum, PlayerImpl per-type storage, growth allocation in PlayerExecution, ×1.66 in attackLogic, widened stats wire format encode+decode, PlayerView.troopsByType, slider HUD in ControlPanel, AI type selection in NationExecution incl. `setNationTroopType`).
- Economy in Config.ts (factory 1.1^level, port 1.5^level in goldAdditionRate; trainSpawnRate ÷2) + `FactoryStopHandler.onStop` in TrainStation.ts.
- `scripts/render-offline-index.ts`, `capacitor.config.ts`, Capacitor deps/scripts in package.json.

## File ownership matrix

| File                                  | Stream A                                  | Stream B                                                    | Conflict risk               |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | --------------------------- |
| Config.ts                             | defense/SAM fns, ArtilleryPost unitInfo   | attackLogic, troop growth, goldAdditionRate, trainSpawnRate | LOW (distinct fns)          |
| Game.ts                               | UnitType.ArtilleryPost + Structures group | TroopClass enum (new, separate)                             | LOW                         |
| Schemas.ts                            | `set_autopilot` intent                    | `set_troop_ratio` intent                                    | TRIVIAL (append union)      |
| ExecutionManager.ts                   | `set_autopilot` case                      | `set_troop_ratio` case                                      | TRIVIAL (append switch)     |
| Transport.ts                          | SetAutopilotEvent                         | SetTroopRatioEvent                                          | TRIVIAL (append)            |
| ControlPanel.ts                       | autopilot toggle                          | troop sliders                                               | MEDIUM (resolve post-merge) |
| PlayerImpl.ts                         | —                                         | troop storage + stats encode                                | none                        |
| PlayerExecution.ts                    | —                                         | growth + (income unchanged call site)                       | none                        |
| PlayerView.ts                         | —                                         | troopsByType + decode                                       | none                        |
| NationExecution.ts                    | —                                         | setNationTroopType + AI pick/counter                        | none                        |
| NationStructureBehavior.ts            | ArtilleryPost ratio                       | —                                                           | none                        |
| TrainStation.ts                       | —                                         | FactoryStopHandler                                          | none                        |
| WarshipExecution.ts/ShellExecution.ts | read-only ref                             | —                                                           | none                        |

**Cross-stream dependency (handled POST-MERGE by orchestrator, NOT by either stream):** autopilot must also pick a troop type on init by calling Stream B's `setNationTroopType`. This was the exact gap in the prior session. Stream A leaves a clearly-commented `// ORCHESTRATOR: wire troop-type pick after merge` hook in AutopilotExecution.init(); orchestrator wires it after both land.

## Feature specs

### A1 Autopilot

- `AutopilotExecution(player, enabled)`: on init, instantiate the same behavior classes NationExecution uses (`new XBehavior(random, game, player)`) pointed at the human `player`; on each `tick()` invoke them on the bot cadence. Reuse, don't duplicate, the behavior logic. Add a `PseudoRandom` seeded from player id.
- Transport: `SetAutopilotEvent(enabled: boolean)`; emit `set_autopilot` intent `{type:"set_autopilot", player, enabled}`.
- Schemas.ts: add `SetAutopilotIntentSchema` to the intent union (zod).
- ExecutionManager: `case "set_autopilot": addExecution(new AutopilotExecution(...))` (toggle: enable creates/enables, disable stops).
- ControlPanel: a toggle button (mirror existing toggle styling) that fires SetAutopilotEvent and reflects state.

### A2 Defense / SAM (Config.ts)

- `defensePostRange()`: 30 → **300**.
- `defensePostDefenseBonus(level=1)`: return `5 * Math.pow(1.5, level-1)`; update the call site `Config.ts:~601` to pass the defense post's `level()`.
- DefensePost unit config (~359–367): add `upgradable: true`.
- `maxSamRange()`: 150 → **1500**; `defaultSamRange()`: 70 → **700**; `samRange(level)`: keep shape, scale constant ×10 (e.g. `1500 - 4800/(level+5)` — preserve monotonic increase, clamp ≤ maxSamRange).
- SAMLauncher cost (~372): `min(3_000_000,(n+1)*1_500_000)` → `min(1_500_000,(n+1)*750_000)`.

### A3 Artillery Post (new)

- `UnitType.ArtilleryPost = "Artillery Post"` in Game.ts; add to Structures group.
- Config.ts unitInfo block: cost similar to DefensePost (e.g. `min(300_000,(n+1)*60_000)`), construction `5*10`, `upgradable: true`, territoryBound like DefensePost.
- `ArtilleryPostExecution`: every N ticks, find an enemy unit/target within `2 * defensePostRange()` and spawn a `ShellExecution` doing `unitInfo(Shell).damage * 1.5`. Mirror WarshipExecution.shootTarget. (Add a config `artilleryShellAttackRate()` and a 1.5 damage multiplier — pass via a new Shell-like exec or reuse ShellExecution with a damage scale param; simplest: new `artilleryDamageMultiplier()=1.5` applied in a small ArtilleryShell path or extend ShellExecution with an optional multiplier arg.)
- AI: add ArtilleryPost ratio to NationStructureBehavior.getStructureRatios so bots build it.
- Build menu: add entry with an icon (reuse an existing SVG if no new asset; acceptable to ship AI-buildable + menu entry using shield/sam icon as placeholder).

### B1 Three troop types

- `enum TroopClass { T1=0, T2=1, T3=2 }` in Game.ts. Counter map: T1 beats T2, T2 beats T3, T3 beats T1.
- PlayerImpl: store `_troopsByType: [bigint,bigint,bigint]` (keep `troops()` = sum for backward compat). `addTroops(n, type?)`, `removeTroops(n)` proportional across types. Per-player growth ratio `_troopRatio:[number,number,number]` (sums to 1) + `setTroopRatio(r0,r1)` (r2=1-r0-r1). `troopsByType(t)`.
- Growth (PlayerExecution ~78): split the per-tick troop increase across the 3 types by `_troopRatio`. If army is at/near max and the dominant type differs from where growth is allocated (i.e. converting existing troops to a new type), apply **0.3×** rate to the converted portion.
- Combat (Config.ts attackLogic ~649–661): when attacker class counters defender class → `defenderTroopLoss *= 1.66; attackerTroopLoss *= 0.602`; reversed when defender counters attacker. Use the players' dominant/effective class (define `effectiveTroopClass(player)=argmax(troopsByType)`).
- AI (NationExecution): `setNationTroopType()` picks a dominant type (set ratio e.g. [0.8,0.1,0.1]); on Hard/Impossible choose the class that counters the strongest neighbor.

### B2 Stats wire format (atomic — all sites in Stream B)

- Current quad (PlayerImpl ~186): `[smallID, tilesOwned, gold, troops]` (4 floats).
- New layout (**7 floats**): `[smallID, tilesOwned, gold, troopsT1, troopsT2, troopsT3, troopsTotal]`.
- Update: encode `PlayerImpl ~186–191`; the Float64Array drain stride `GameImpl ~500–504` (step 4 → 7); docstring `GameUpdates ~37–43`; decode `PlayerView.stateFromUpdate ~81` (read 7, set troopsT1/T2/T3 + troops=total); `PlayerState` type +troopsByType; any test asserting quad width.

### B3 Economy (Config.ts goldAdditionRate ~821–830)

- Multiply income by `Math.pow(1.1, factoryLevelSum) * Math.pow(1.5, portLevelSum)` where level sums come from `player.unitCount(UnitType.Factory)` / `unitCount(UnitType.Port)` (these return level sums).
- `trainSpawnRate` (~213): `*15` → `*7.5` (2× frequency).
- `FactoryStopHandler.onStop` (TrainStation.ts ~40–46): mirror TradeStationStopHandler — grant `config.trainGold()` to train owner + station owner, record stats.

### B4 Offline render + Capacitor

- `scripts/render-offline-index.ts`: read `static/asset-manifest.json`, reuse RenderHtml/buildAssetUrl, write `static/index.html` with `cdnBase=""`, `instanceId="OFFLINE_APK"`, `gameEnv="prod"`, real numWorkers, empty turnstile/jwt. Assert 0 `<%-` placeholders remain.
- `capacitor.config.ts`: appId `io.openfront.offline`, appName "OpenFront", webDir `static`.
- package.json: add `@capacitor/core @capacitor/cli @capacitor/android` (devDep ok) — do NOT run the android build (orchestrator does).

## Each stream MUST

- Work ONLY in its own worktree dir. `npx tsc --noEmit` clean. Run `npm test` (best-effort; note failures). Commit on its branch with a clear message. Leave new files where the matrix says.

## Merge plan (orchestrator)

1. Merge stream-a into main (clean).
2. Merge stream-b; expect trivial "keep both" conflicts in Schemas.ts (intent union), ExecutionManager.ts (switch), Transport.ts (events), and a MEDIUM conflict in ControlPanel.ts (keep both autopilot toggle + sliders).
3. Wire autopilot→setNationTroopType (the cross-stream hook).
4. `tsc --noEmit` + `npm test` + `build-prod` must all pass.

## Verification (headless)

- Add a test that constructs a Nation, ticks it, asserts its growth ratio committed to a dominant type.
- Add a test enabling autopilot and asserting it picks a troop type.
- Add a combat test using `UseRealAttackLogic` that shows a countering attacker inflicts ~1.66× the defender troop loss vs the countered case.
