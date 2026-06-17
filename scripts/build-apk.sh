#!/usr/bin/env bash
# Builds a self-contained offline debug APK of the single-player game.
#
# Prerequisites:
#   - JDK 17+ and an Android SDK (platform-tools, platforms;android-34,
#     build-tools;34.0.0). Point ANDROID_HOME at the SDK.
#   - Capacitor deps installed (npm install).
#
# Produces: android/app/build/outputs/apk/debug/app-debug.apk
set -euo pipefail
cd "$(dirname "$0")/.."

# A UTF-8 locale is REQUIRED: some bundled flag assets have non-ASCII
# filenames (e.g. "Polish–Lithuanian Commonwealth.svg"). Without UTF-8 the
# JVM uses ASCII for filenames and Gradle's asset merge fails to find them.
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"

echo "==> 1/4 Building web bundle (static/)"
npm run build-prod

echo "==> 2/4 Rendering offline index.html (bakes BOOTSTRAP_CONFIG, no server)"
npx tsx scripts/render-offline-html.ts

echo "==> 3/4 Scaffolding/syncing Android project"
if [ ! -d android ]; then
  npx cap add android
else
  npx cap copy android
fi

echo "==> 4/4 Assembling debug APK"
cd android
echo "sdk.dir=${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK path}" > local.properties
./gradlew assembleDebug --no-daemon

echo "==> Done: android/app/build/outputs/apk/debug/app-debug.apk"
