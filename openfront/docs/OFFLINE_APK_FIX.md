# Offline APK — critical fix

## Endless "Starting…" root cause + fix
Single-player runs the sim in an inline Web Worker (a `blob:` URL). With
`cdnBase=""` the asset URLs are root-relative (`/_assets/...`); the main thread
resolves them, but the worker's `blob:` origin cannot parse a path-only URL, so
`fetch("/_assets/maps/.../manifest.json")` throws "Failed to parse URL", the
worker dies, and the game hangs at "Starting…".

FIX: render `BOOTSTRAP_CONFIG.cdnBase = window.location.origin` (NOT "") so the
worker builds absolute URLs. See scripts/render-offline-index.mjs.

## Build pipeline (verified, slim 6-map ~46MB)
1. npm run build-prod
2. node scripts/render-offline-index.mjs        # bakes offline BOOTSTRAP_CONFIG (cdnBase=origin)
3. (optional) trim static/_assets/maps to a small whitelist to shrink the APK
4. npx cap copy android
5. cd android && LANG=C.UTF-8 LC_ALL=C.UTF-8 ./gradlew clean assembleDebug
   (UTF-8 locale required: a flag file has an en-dash in its name)
