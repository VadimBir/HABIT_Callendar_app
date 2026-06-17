# Reassemble the APK

The debug APK exceeds GitHub's 100 MB limit, so it's committed in 90 MB split parts.

```
cd apk
cat OpenFront-offline-debug.apk.part-* > OpenFront-offline-debug.apk
```

Then sideload `OpenFront-offline-debug.apk` on Android (allow install from unknown sources).
This is the BASELINE build (stock OpenFront, offline single-player). The mod-featured
APK is built from the merged `openfront/` source via `npm run build-prod` →
`node scripts/render-offline-index.mjs` → `npx cap copy android` →
`LANG=C.UTF-8 ./gradlew assembleDebug`.
