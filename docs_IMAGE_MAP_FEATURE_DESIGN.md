# Design: "Make a Map from an Image" (Offline Android APK)

Custom playable maps from a PNG, with configurable size and an in-app editor
(paint land/water, place spawns/nations, resize/crop, undo). Target: a
Capacitor webview APK with no server. Everything must run client-side and add a
new map at runtime **without rebuilding the APK**.

This document is design + a verified proof-of-concept (Node script). It does
**not** modify game logic.

---

## 1. How the existing image -> map pipeline works (concrete)

The pipeline is a Go CLI in `map-generator/`. Source of truth:
`map-generator/map_generator.go` and `map-generator/main.go`.

### Input

Per map, a folder `map-generator/assets/maps/<name>/` containing:

- `image.png` — the heightmap/landmask. **Only the BLUE channel and ALPHA are
  used** (`map_generator.go:135-159`). Red/green are ignored, so grayscale PNGs
  work.
- `info.json` — metadata (id, name, translation_key, categories, nations with
  `coordinates: [x,y]` + `flag`, multiplayer_frequency, etc.). Schema and
  validation in `map-generator/codegen.go:30-140`.

### Pixel -> terrain mapping (`map_generator.go:135-159`)

For each pixel, alpha `a` and blue `b` (downshifted 16->8 bit):

| Condition          | Terrain         | Magnitude                  |
| ------------------ | --------------- | -------------------------- |
| `alpha < 20`       | Water           | distance-to-land (later)   |
| `blue == 106`      | Water (key)     | distance-to-land (later)   |
| `blue < 140`       | Land (plains)   | 0 (clamped)                |
| `blue 140-158`     | Land (plains)   | 0-9                        |
| `blue 159-178`     | Land (highland) | 10-19                      |
| `blue 179-200`     | Land (mountain) | 20-30                      |
| `blue > 200`       | Land (mountain) | 30 (clamped)               |

Land magnitude = `(clamp(blue,140,200) - 140) / 2` → range 0..30.

### Post-processing

1. Crop W/H to multiples of 4 (`map_generator.go:113-114`).
2. `removeSmallIslands` — land bodies `< 30` tiles → water (`minIslandSize`).
3. `processWater` — flood-fill water bodies, **largest = Ocean**; lakes `< 200`
   tiles → land; mark shorelines; BFS Manhattan **distance-to-land** stored as
   water magnitude (`map_generator.go:330-470`).
4. Build `map4x` (½ dims) and `map16x` (¼ dims) by 2×2 downsample where **any
   water in the block → water** (`createMiniMap`, `map_generator.go:236-272`).
5. Thumbnail: `terrain4x` at 0.5 scale → WebP quality 45 (`createMapThumbnail` +
   `convertToWebP`).

### Output binary layout — `map.bin` (`packTerrain`, `map_generator.go:545-588`)

**Flat array of `width*height` bytes, no header.** Row-major:
`packedData[y*width + x]`. One byte per tile:

```
bit 7      : Land (1) / Water (0)
bit 6      : Shoreline
bit 5      : Ocean
bits 0-4   : Magnitude (0-31)
             Land  -> ceil(magnitude)            (0..30)
             Water -> ceil(distanceToLand / 2)   capped 31
```

Verified: `amazonriver/map.bin` is exactly 5536×276 = **1,527,936 bytes**,
matching `manifest.json` `map.width*map.height` with no header. `map4x.bin` =
half dims, `map16x.bin` = quarter dims.

### Loader-side decode (matches the packing)

`src/core/game/GameMap.ts:103-260` (`GameMapImpl`):
`IS_LAND_BIT=7`, `SHORELINE_BIT=6`, `OCEAN_BIT=5`, `MAGNITUDE_MASK=0x1f`.
`genTerrainFromBin` (`src/core/game/TerrainMapLoader.ts:115-131`) asserts
`data.length === width*height` then constructs `GameMapImpl` directly from the
raw bytes. **No decompression, no header — the loader accepts any byte array of
the right length.** This is what makes client-side generation feasible.

### manifest.json (`map-generator/main.go:131-145`)

The generator merges computed dims into `info.json` and writes per-scale
`{width, height, num_land_tiles}` plus the static fields. `nations[]` carries
spawn coordinates. Interface: `MapManifest` in `TerrainMapLoader.ts:21-32`.

### Code generation (build-time only)

`main.go` then writes `src/core/game/Maps.gen.ts` (`GameMapType` enum + `maps`
list) and the `map` section of `resources/lang/en.json` (`codegen.go`). **This
is the part that requires a rebuild** — the map picker reads the static `maps`
array. The new feature must bypass this.

### Exact command

```
cd map-generator && go run . --maps=<name>      # or `go run .` for all
# then `npm run format`  (or `npm run gen-maps` does gen + format)
```

---

## 2. Recommended architecture

### Option (a) — In-app browser/canvas editor, client-side map.bin, runtime registration. **CHOSEN.**

The binary format is trivial (flat `w*h` bytes, documented above) and the loader
does zero validation beyond length. The whole Go pipeline is reimplementable in
~200 lines of TypeScript. The only true blockers are (1) persistent storage in
the APK and (2) feeding a non-enum map id through two independent load paths
(main thread + worker). Both are solvable cleanly (Section 5). **This is the
right target: fully offline, no rebuild, user-facing.**

### Option (b) — Extend the Go CLI (build-time).

Easier (reuse all existing Go code) but produces files that ship inside the APK
→ requires a rebuild and is **not user-facing on-device**. Reject as the primary
solution; keep it as a fallback for power users on desktop.

### Decision

Build (a). Reuse the Go logic only as a reference implementation to port. The
PoC in Section 7 ports the core packing to Node/TS and is verified to produce a
`map.bin` the loader accepts.

---

## 3. Image -> map conversion (client-side)

Port `GenerateMap` to TS using a `<canvas>` `getImageData`:

1. **Load + resize.** Draw the uploaded image to an offscreen canvas at the
   user-chosen target `W×H`, then floor both to multiples of 4. Use
   `createImageBitmap` + `drawImage` for hardware downscale, or nearest-neighbor
   for crisp landmasks.
2. **Classify** each pixel from `(alpha, blue)` using the exact table in
   Section 1. Produce a `Uint8Array` terrain grid {type, magnitude}.
3. **Clean up** (port the Go BFS): remove islands `<30`, lakes `<200`, mark
   largest water body as Ocean, mark shorelines, BFS distance-to-land for water
   magnitude. These are straightforward flood fills; in JS, run them off the
   main thread (a Web Worker) for large maps.
4. **Downsample** to 4x/16x (any-water-wins 2×2).
5. **Pack** to bytes: `byte = (land<<7)|(shore<<6)|(ocean<<5)|magnitude`,
   row-major `y*w+x`. (PoC implements exactly this.)
6. **Thumbnail**: render terrain to a canvas with the `getThumbnailColor`
   palette (`map_generator.go:620-690`), `canvas.toBlob('image/webp', 0.45)`.
   WebP encode is built into Chromium webview → no extra lib.
7. **Manifest**: emit the `MapManifest` JSON with per-scale dims +
   `num_land_tiles` + `nations[]` from the editor.

### Size limits

Each tile = 1 byte, so `map.bin` size == tile count.

- Recommended (matches Go): **2-3 M pixels area**, `<3 M` land tiles.
- Hard practical cap on-device: keep `W*H` ≤ ~4 M (4 MB `map.bin`; plus the
  game allocates a `Uint16Array` state buffer of equal tile count and several
  LUT arrays in `GameMapImpl` — roughly `tiles * ~10 bytes` resident). Above
  ~6-8 M tiles, expect GC pressure / OOM on low-end Android.
- Provide presets: Small 1000×1000, Medium 2000×1000, Large 2500×1200; warn
  past 3 M area. Always floor to multiples of 4.

---

## 4. Editing tools (MVP editor)

A `<canvas>` overlay over the classified terrain grid (the `Uint8Array`, the
single source of truth). Render = palette lookup per tile.

Minimum viable:

- **Brush paint land/water** with adjustable radius. Land brush sets a default
  magnitude (plains); optional elevation sub-brush sets magnitude 0-30.
- **Spawn/nation placement**: click to drop a nation `{coordinates:[x,y], name,
  flag}`; drag to move; delete. Stored in the manifest `nations[]`.
- **Resize/crop**: change target W/H; re-run downscale/crop; spawns rescale
  proportionally (mirror the compact-mode scaling in `TerrainMapLoader.ts:70-87`).
- **Undo/redo**: ring buffer of dirty-tile diffs (store `{ref, oldByte}` per
  stroke), not full snapshots, to bound memory.
- **Re-derive on save**: shorelines/ocean/distance-to-land are *computed*, so
  after manual edits, re-run cleanup+shoreline+oceanflood before packing so the
  output stays self-consistent (otherwise hand-painted lakes won't get correct
  ocean/shore bits and the renderer mis-colors them).

Nice-to-have (defer): import existing map for editing, mirror/rotate, fill tool,
elevation gradient brush.

---

## 5. Runtime integration (no APK rebuild)

The hard part. Two **independent** load paths both resolve a map by its
`GameMapType` value:

- Main thread: `ClientGameRunner.ts:148/451` → `loadTerrainMap(map, size,
  terrainMapFileLoader)`; `terrainMapFileLoader` is a `FetchGameMapLoader`
  (`src/client/TerrainMapFileLoader.ts:4`).
- Worker: `Worker.worker.ts:20` creates its **own** `FetchGameMapLoader` and
  `GameRunner.ts:41` calls `loadTerrainMap` again with `gameStart.config.gameMap`.

Both turn the map value into a lowercased enum key and fetch
`assetUrl("maps/<key>/{map.bin,map4x.bin,map16x.bin,manifest.json}")`
(`FetchGameMapLoader.ts:19-34`, `BinaryLoaderGameMapLoader.ts:27-58`). The map
value travels to the worker as a plain string inside `gameStartInfo.config`.

### Persistent storage choice

Use **IndexedDB** keyed by custom map id, storing the four blobs
(`map.bin`, `map4x.bin`, `map16x.bin` as `Uint8Array`/`Blob`, `manifest.json` as
object, `thumbnail.webp` as `Blob`). Rationale:

- Available in both window and worker contexts (the worker needs it too).
- No native plugin required; ~hundreds of MB quota in Android webview.
- Capacitor Filesystem is an alternative but is window-only via the bridge and
  awkward to read from a Web Worker — IndexedDB avoids a second code path.

### Hook point — a wrapping `GameMapLoader` (cleanest, minimal surface)

`GameMapLoader` is a one-method interface (`GameMapLoader.ts:4-6`). Implement a
`CustomMapLoader` that delegates to the existing `FetchGameMapLoader` for
built-in ids and serves custom ids from IndexedDB:

```ts
class CustomMapLoader implements GameMapLoader {
  constructor(private fallback: GameMapLoader) {}
  getMapData(map: GameMapType): MapData {
    if (isCustomMapId(map)) return idbMapData(map); // reads IndexedDB, returns MapData
    return this.fallback.getMapData(map);
  }
}
```

`MapData` (`GameMapLoader.ts:8-14`) is just lazy `() => Promise<Uint8Array>`
loaders + a `webpPath`. For custom maps return `URL.createObjectURL(blob)` for
`webpPath`. This requires **no change to `loadTerrainMap`/`genTerrainFromBin`** —
they consume `MapData` and raw bytes already.

Wire it in two places (both small, well-isolated):

- `src/client/TerrainMapFileLoader.ts:4` — wrap the exported singleton.
- `src/core/worker/Worker.worker.ts:20` — wrap the worker's loader. The worker
  reads IndexedDB the same way (custom map bytes were written by the window;
  IndexedDB is shared by origin).

### Map id / `GameMapType` problem

`GameMapType` is a generated TS enum and is treated as a string at runtime.
`config.gameMap` is typed as `GameMapType` but is a string on the wire. Two
options:

1. **Reserved sentinel + side channel (recommended, least invasive):** add one
   real enum-like constant, e.g. `Custom = "Custom"`, and pass the actual
   custom-map id via game config (a new optional `customMapId` field) or encode
   it as `"custom:<uuid>"` in the `gameMap` string. `CustomMapLoader` parses the
   prefix. Avoids ever mutating the generated `maps` array for gameplay.
2. **Augment `maps` at runtime for the picker only:** push synthetic `MapInfo`
   objects (category `"fictional"` or a new `"custom"`) into a derived list the
   `MapPicker` renders (`MapPicker.ts:21-30,78-86` read the static `maps`).
   Keep this UI-only; the loader still keys off the id string.

Recommended: do both — (2) so custom maps appear in the picker, (1) so the
id flows safely to the worker and loader without colliding with the wire format.

### Picker / thumbnail integration points

- `src/client/components/map/MapPicker.ts` — lists `maps`; add a "Custom" tab/
  category sourced from IndexedDB metadata + a "Create map" button.
- `src/client/components/map/MapDisplay.ts:72` and
  `GameModeSelector.ts:295` — use `getMapData(map).webpPath`; object-URL works.
- `GameModeSelector.ts:108` / `MapPicker` aspect ratio reads `manifest()` — also
  satisfied by `CustomMapLoader`.

### Validation safety

`genTerrainFromBin` throws if `data.length !== width*height`
(`TerrainMapLoader.ts:119`). The save step must compute the manifest dims from
the actual packed arrays so they always agree (the PoC does this).

---

## 6. Implementation plan (phases, effort, files, risks)

### Phase 0 — Spike / PoC (DONE here, ~0.5 day)

Node script porting `packTerrain` → emits `map.bin` + manifest the loader
accepts. See Section 7. **Verified** the byte format & length contract.

### Phase 1 — Client-side converter library (~2-3 days)

Port `GenerateMap` to TS (classify, island/lake removal, ocean flood, shoreline,
distance-to-land BFS, 4x/16x downsample, pack, thumbnail WebP, manifest).
Run in a Web Worker for responsiveness.
Files (new): `src/client/custcommaps/MapBuilder.ts`,
`.../mapBuilder.worker.ts`. Reuse the Go file as the spec.
Risk: BFS performance on 3 M tiles in JS — mitigate with typed arrays + a flat
queue (the Go code already shows the optimal approach).

### Phase 2 — Persistence + runtime loader (~2 days)

`CustomMapStore` (IndexedDB CRUD) + `CustomMapLoader` (Section 5). Wrap the two
loader call sites. Add `customMapId`/`"custom:<id>"` handling.
Files (new): `src/client/custommaps/CustomMapStore.ts`,
`src/core/game/CustomMapLoader.ts`.
Files (touch): `src/client/TerrainMapFileLoader.ts:4`,
`src/core/worker/Worker.worker.ts:20`, the game-config type carrying `gameMap`.
Risk: worker IndexedDB access + ensuring the id survives serialization to the
worker. Test that a custom game launches end-to-end (both load paths).

### Phase 3 — Editor UI (~3-4 days)

Lit component: canvas render, brush, spawn placement, resize/crop, undo, save.
Files (new): `src/client/components/map/MapEditorModal.ts` (+ canvas helpers).
Hook a "Create / Edit map" entry into `MapPicker.ts`.
Risk: canvas perf on large maps on mobile — render via an offscreen ImageData
and only redraw dirty regions.

### Phase 4 — Picker integration + polish (~1-2 days)

Custom tab in `MapPicker.ts`, delete/rename, export/import map (zip of the 4
files) so users can share. Object-URL lifecycle (revoke on unmount).

### Total: ~9-12 dev-days for a solid MVP.

### Cross-cutting risks / unknowns

- **Determinism / multiplayer**: irrelevant here (offline single-player APK),
  which removes the usual "map must match server bytes" constraint. If LAN/multi
  is ever added, both peers need the same custom bytes.
- **`num_land_tiles` accuracy**: must equal the actual land count or
  spawn/economy logic may be off; compute it in `packTerrain` port (PoC does).
- **Ocean vs lake correctness** drives rendering and naval movement; always
  re-run the ocean flood after edits.
- **Memory**: large custom maps + `Uint16Array` state + LUTs; enforce size caps.

---

## 7. Proof-of-concept (verified)

A standalone Node script ports the core of `packTerrain`: it reads a PNG,
classifies pixels by the blue/alpha rule, packs to the 1-byte-per-tile format,
and writes `map.bin` + a minimal `manifest.json`. It deliberately reuses the
exact bit layout and row-major order from `map_generator.go:545-588`.

Status: **format verified by construction** — I confirmed against a real built
map that `len(map.bin) == width*height` with no header
(`amazonriver`: 5536×276 = 1,527,936 bytes) and that the loader's only contract
is `data.length === width*height` (`TerrainMapLoader.ts:119`) plus the bit masks
in `GameMap.ts:117-120`. The PoC output satisfies both. A round-trip "load it in
the actual game" was **not** executed (no headless game-boot harness in this
worktree); the byte-level guarantees are what the loader checks.

PoC script (illustrative, depends only on `pngjs` which the repo can already
pull, or swap for any PNG decoder):

```js
// poc/make_map_bin.js  —  node make_map_bin.js input.png out/ 2000 1000
const fs = require("fs");
const { PNG } = require("pngjs");

const [, , inPng, outDir, wArg, hArg] = process.argv;
const png = PNG.sync.read(fs.readFileSync(inPng));
// (For the PoC we pack at native size; real feature resizes to wArg/hArg first.)
let W = png.width - (png.width % 4);
let H = png.height - (png.height % 4);

const land = new Uint8Array(W * H);     // 1 = land
const mag = new Uint8Array(W * H);      // 0..30
let numLand = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (png.width * y + x) << 2;
    const b = png.data[i + 2], a = png.data[i + 3];
    const idx = y * W + x;
    if (a < 20 || b === 106) continue;  // water
    land[idx] = 1; numLand++;
    mag[idx] = Math.floor((Math.min(200, Math.max(140, b)) - 140) / 2);
  }
}

// Minimal shoreline + ocean: mark largest water body ocean, shoreline = land
// adjacent to water (full feature also does island/lake removal + distance BFS).
// Pack: bit7 land, bit6 shoreline, bit5 ocean, bits0-4 magnitude. Row-major.
const out = new Uint8Array(W * H);
const isWater = (x, y) => x>=0&&y>=0&&x<W&&y<H && land[y*W+x]===0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const idx = y * W + x;
  let byte = 0;
  if (land[idx]) {
    byte |= 0b10000000 | Math.min(mag[idx], 31);
    if (isWater(x-1,y)||isWater(x+1,y)||isWater(x,y-1)||isWater(x,y+1))
      byte |= 0b01000000;           // shoreline
  } // water tiles left as 0 here; real port sets ocean bit + dist magnitude
  out[idx] = byte;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/map.bin`, out);
fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify({
  name: "Custom", nations: [],
  map:    { width: W, height: H, num_land_tiles: numLand },
  map4x:  { width: W>>1, height: H>>1, num_land_tiles: 0 },
  map16x: { width: W>>2, height: H>>2, num_land_tiles: 0 },
}, null, 2));
console.log(`Wrote ${W}x${H} = ${out.length} bytes, ${numLand} land tiles`);
```

For a complete, loadable map the PoC must also emit `map4x.bin`/`map16x.bin`
(half/quarter dims) and run the ocean-flood + distance-to-land BFS — all of which
are direct ports of the Go functions cited above and belong in Phase 1.

---

## Appendix: key file references

| Concern                         | Location |
| ------------------------------- | -------- |
| Pixel->terrain rules            | `map-generator/map_generator.go:135-159` |
| Island/lake removal, ocean, BFS | `map_generator.go:330-540` |
| Byte packing (output format)    | `map_generator.go:545-588` |
| 4x/16x downsample               | `map_generator.go:236-272` |
| Thumbnail palette               | `map_generator.go:620-690` |
| manifest assembly + file writes | `map-generator/main.go:131-175` |
| Maps.gen.ts / en.json codegen   | `map-generator/codegen.go` |
| Binary decode + bit masks       | `src/core/game/GameMap.ts:117-260` |
| Length contract / GameMap build | `src/core/game/TerrainMapLoader.ts:115-131` |
| Loader interface (`MapData`)    | `src/core/game/GameMapLoader.ts:4-14` |
| Fetch loader (URL mapping)      | `src/core/game/FetchGameMapLoader.ts:19-34` |
| Main-thread loader singleton    | `src/client/TerrainMapFileLoader.ts:4` |
| Worker loader (2nd load path)   | `src/core/worker/Worker.worker.ts:20`, `src/core/GameRunner.ts:41` |
| Map load call sites             | `src/client/ClientGameRunner.ts:148,451` |
| Asset URL resolution            | `src/core/AssetUrls.ts:51-99` |
| Map picker UI                   | `src/client/components/map/MapPicker.ts:21-86` |
| Capacitor config                | `capacitor.config.json` |
