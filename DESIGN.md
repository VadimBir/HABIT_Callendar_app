# Stream A Design: Autopilot, Defense/SAM Rebalance, Artillery Post

This document describes the Stream A features added to this OpenFrontIO fork:
a per-player **Autopilot** that runs the existing bot AI on a human player,
a **defense/SAM rebalance**, and a new attacking structure, the **Artillery Post**.
All simulation code lives in `src/core` and stays deterministic (it uses
`PseudoRandom`/`simpleHash`, never `Date.now`/`Math.random`).

## 1. Autopilot

Autopilot lets a human player hand control of their nation to the same AI that
drives computer-controlled nations.

### Files

- **`src/core/execution/AutopilotExecution.ts`** — The long-lived execution that
  drives the bot AI on the human player. It is seeded with
  `new PseudoRandom(simpleHash(player.id()) ^ simpleHash(gameID) ^ 0xdeadbeef)`
  so each player's autopilot is deterministic but distinct. On the first active
  tick it lazily constructs the exact same behavior objects `NationExecution`
  uses (`NationEmojiBehavior`, `NationMIRVBehavior`, `NationAllianceBehavior`,
  `NationWarshipBehavior`, `AiAttackBehavior`, `NationNukeBehavior`,
  `NationStructureBehavior`) with the same constructor argument order. Each tick:
  - If the player is dead, it goes inactive.
  - If autopilot is disabled, it no-ops (so it can be cheaply re-enabled).
  - On the attack cadence (`ticks % attackRate === attackTick`, with
    `attackRate ∈ [30,50)`), it runs alliance handling, MIRV consideration,
    structure building, warship spawning, attacking, warship counter-infestation,
    and nuke sending — in the same order as `NationExecution`.
  - Between attack ticks it calls `structureBehavior.handleStructures()` at the
    1/3 and 2/3 sub-offsets so gold is spent steadily (mirrors `NationExecution`).
  - Attack ratios: `triggerRatio ∈ [50,60)%`, `reserveRatio ∈ [30,40)%`,
    `expandRatio ∈ [10,20)%`.

- **`src/core/execution/ToggleAutopilotExecution.ts`** — One-shot execution.
  In `tick()` it calls `player.setAutopilot(enabled)`; if enabling, it registers a
  fresh `AutopilotExecution`, then goes inactive.

### Shared-file wiring

- `src/core/game/Game.ts` — Added `isAutopilotEnabled()` / `setAutopilot()` to the
  `Player` interface.
- `src/core/game/PlayerImpl.ts` — Added `_autopilotEnabled` field plus the two
  accessor methods, and added `UnitType.ArtilleryPost` to the land-based-structure
  spawn switch.
- `src/core/Schemas.ts` — Added `ToggleAutopilotIntentSchema`
  (`{ type: "toggle_autopilot", enabled: boolean }`), its type export, and entries
  in both the `Intent` union and the `IntentSchema` discriminated union.
- `src/core/execution/ExecutionManager.ts` — Added the `"toggle_autopilot"` case
  in `createExec` constructing `ToggleAutopilotExecution(player, intent.enabled, this.gameID)`.
- `src/client/Transport.ts` — Added `ToggleAutopilotEvent`, an event-bus listener,
  and a handler that sends the `toggle_autopilot` intent.
- `src/client/hud/layers/ControlPanel.ts` — Added a single "Autopilot ON/OFF"
  toggle button (LitElement `@state`) that emits `ToggleAutopilotEvent` and flips
  local state, in its own isolated div.

### Flow

UI button → `ToggleAutopilotEvent` → `Transport` sends `toggle_autopilot` intent →
server stamps + broadcasts → `ExecutionManager` builds `ToggleAutopilotExecution` →
it sets the player flag and registers `AutopilotExecution`, which then runs the bot
AI each tick while the flag stays enabled.

## 2. Defense / SAM Rebalance

All changes are in `src/core/configuration/Config.ts` (plus a Game.ts `unitInfo`
flag).

- **Defense Post range**: `defensePostRange()` raised `30 → 300`.
- **Level-aware Defense Posts**: in `attackLogic()`, the defense-post block now
  scales its bonuses by the post's level using `scale = Math.pow(1.5, level - 1)`:
  `mag *= defensePostDefenseBonus() * scale; speed *= defensePostSpeedBonus() * scale;`.
  Combat-scaling formula: a level-N defense post multiplies the base attack
  magnitude/speed cost by `bonus * 1.5^(N-1)`, so each level is a 50% compounding
  increase over the previous level.
- **SAM ranges**: `defaultSamRange()` `70 → 700`; the `samRange(level)` growth
  constant `480 → 4800`; `maxSamRange()` `150 → 1500`.
- **Costs / upgradability**: `DefensePost` is now `upgradable: true`. `SAMLauncher`
  cost halved to `Math.min(1_500_000, (numUnits + 1) * 750_000)`.

## 3. Artillery Post (new attacking structure)

A land structure that bombards nearby enemy ships.

### Files

- **`src/core/game/Game.ts`** — New `UnitType.ArtilleryPost = "Artillery Post"`,
  added to the `Structures` group (so it flows into `BuildMenus`), and a
  `UnitParamsMap` entry (`Record<string, never>`).
- **`src/core/configuration/Config.ts`**:
  - `artilleryPostRange()` → `600`.
  - `artilleryShellDamageMultiplier()` → `1.5`.
  - `artilleryPostAttackBonus(level)` → `Math.pow(1.5, level - 1)`.
  - `unitInfo` case: cost `Math.min(500_000, (numUnits + 1) * 100_000)`,
    `constructionDuration` `0` if instant-build else `80`, `upgradable: true`.
- **`src/core/execution/ArtilleryPostExecution.ts`** — Modeled on the warship
  shooting pattern. Every `ATTACK_COOLDOWN = 30` ticks it scans
  `nearbyUnits(post.tile(), artilleryPostRange(), [Warship, TransportShip, TradeShip])`,
  skips self-owned and non-attackable units, then spawns one
  `ArtilleryShellExecution` (breaking after the first valid target).
- **`src/core/execution/ArtilleryShellExecution.ts`** — A copy of `ShellExecution`
  with an added `damageMult` constructor parameter. Damage applied in
  `effectOnTarget()` is `baseShellDamage * damageMult * artilleryShellDamageMultiplier()`.
  Uses the same `PseudoRandom` roll as `ShellExecution`.
- **`src/core/execution/ConstructionExecution.ts`** — `completeConstruction` spawns
  an `ArtilleryPostExecution`; `isStructure()` returns true for it.
- **`src/core/execution/nation/NationStructureBehavior.ts`** — Added to
  `getStructureRatios` (`ratioPerCity ≈ 0.3`), to the `buildOrder` (after
  `SAMLauncher`), and to `structureSpawnTileValue` (reuses the missile-silo value
  function). This makes the bot AI (and Autopilot, which uses the same behavior)
  build Artillery Posts.

### Combat-scaling formula

For a level-N Artillery Post firing at a ship:

```
damage = baseShellDamage(roll) * 1.5^(N-1) * 1.5
```

where `1.5^(N-1)` is the per-level attack bonus and the trailing `1.5` is the
global artillery shell multiplier. Higher-level posts hit harder, rewarding
upgrades; range is fixed at 600.

## Building the Android APK

Single-player is fully offline: when no server connection is configured the client
runs a `LocalServer` in-process, so the game simulation, AI, and Autopilot all run
on-device with no network required.

**One command** (requires `ANDROID_HOME` pointing at an Android SDK with
`platform-tools`, `platforms;android-34`, `build-tools;34.0.0`, and JDK 17+):

```
ANDROID_HOME=/path/to/android-sdk ./scripts/build-apk.sh
```

The APK is produced at `android/app/build/outputs/apk/debug/app-debug.apk`.

The script runs these steps; the two marked **(!)** are non-obvious and were the
difference between an APK that boots and one that doesn't:

1. **Build the web bundle** — `npm run build-prod` emits the static app to `static/`.

2. **(!) Render `index.html` offline** — `npx tsx scripts/render-offline-html.ts`.
   The committed `index.html` is an EJS template whose `BOOTSTRAP_CONFIG` is
   normally filled in by the Node/nginx server at request time
   (`src/server/RenderHtml.ts`). A static wrap would ship invalid JS and the app
   would throw "Missing BOOTSTRAP_CONFIG" on launch. This script bakes in static
   offline values (asset manifest, `cdnBase=""`, dummy keys) so the WebView boots
   with no server.

3. **Wrap with Capacitor** — `npx cap add android` (first time) or
   `npx cap copy android` (re-sync assets). `capacitor.config.ts` sets
   `appId: io.openfront.game`, `webDir: static`.

4. **(!) Assemble with a UTF-8 locale** — `LANG=C.UTF-8 ./gradlew assembleDebug`.
   Some bundled flag assets have non-ASCII filenames (e.g.
   `Polish–Lithuanian Commonwealth.svg`). Without a UTF-8 locale the JVM's
   `sun.jnu.encoding` defaults to ASCII and Gradle's asset merge fails with
   "Failed to create MD5 hash ... as it does not exist".

**`AndroidManifest.xml`** declares `INTERNET` + `ACCESS_NETWORK_STATE` and
`android:usesCleartextTraffic="true"`. Multiplayer needs connectivity; single-player
runs fully offline via the in-process `LocalServer`, so the game, AI, and Autopilot
all work with the device offline.

> Note: the Capacitor-copied `android/app/src/main/assets/public/` (~426 MB) is
> gitignored — it is regenerated by `npx cap copy android`.
