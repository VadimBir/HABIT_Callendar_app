# OpenFrontIO — Transferable Patterns

> From exploring https://github.com/openfrontio/OpenFrontIO (cloned to /tmp/openfrontio).
> Only patterns that genuinely transfer to a vanilla-JS PWA calendar/habit tracker.

OpenFrontIO is a TypeScript + Vite + Lit + WebGL2 .io strategy game. Its game-sim,
WebGL, and multiplayer machinery do NOT transfer. These patterns do:

- **Inverse pan/zoom math** (`src/client/TransformHandler.ts`): `setTransform(scale,0,0,scale,tx,ty)`
  with `screenToWorldCoordinates`/`worldToScreenCoordinates` + `clampOffsets()` — reusable for a
  draggable/zoomable calendar grid.
- **Library-free pinch-zoom from Pointer Events** (`src/client/InputHandler.ts`):
  track pointers in `Map<pointerId, PointerEvent>`, `getPinchDistance()`/`getPinchCenter()`,
  and "zoom toward cursor/pinch point" math (anchored zoom).
- **Drag-threshold tap detection** (Manhattan distance) to distinguish tap (open day) from scroll/drag.
- **Long-press with cancel-on-move timer** for "long-press a day to add event".
- **Typed EventBus** (`src/core/EventBus.ts`, ~45 lines) — decouple input → state → render.
- **Cached + debounced localStorage** (`UserSettings.ts`): in-memory Map cache, async writes,
  `CustomEvent` change notifications. Ideal lightweight state/persistence.
- **Single self-re-arming rAF loop + ResizeObserver + devicePixelRatio** for crisp, smooth canvas.
- **PWA manifest template** (`resources/manifest.json`): standalone, maskable icons, start_url/id, orientation.
- **iOS/mobile viewport**: `viewport-fit=cover` + `env(safe-area-inset-*)` + `height:-webkit-fill-available`.
- **Flash-prevention** `.preload` class (hidden until JS ready).
- **Build hygiene**: Vite + Prettier + ESLint + Husky/lint-staged; **Zod** for validating imported/persisted JSON.

**Notable gap to learn from:** OpenFrontIO ships NO service worker (no offline). A calendar/habit
tracker MUST keep its cache-first service worker for offline — don't drop it.
