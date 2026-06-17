// Renders static/index.html for the offline (Capacitor APK) build.
import ejs from "ejs";
import fs from "fs";
import path from "path";
import { buildAssetUrl } from "../src/core/AssetUrls";

const staticDir = path.resolve(process.cwd(), "static");
const htmlPath = path.join(staticDir, "index.html");
const manifestPath = path.join(staticDir, "asset-manifest.json");

const assetManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const cdnBase = "";
const htmlContent = fs.readFileSync(htmlPath, "utf-8");

const rendered = ejs.render(htmlContent, {
  gitCommit: JSON.stringify("OFFLINE"),
  assetManifest: JSON.stringify(assetManifest),
  cdnBase: JSON.stringify(cdnBase),
  cdnBaseRaw: cdnBase,
  gameEnv: JSON.stringify("prod"),
  numWorkers: JSON.stringify(4),
  turnstileSiteKey: JSON.stringify("1x00000000000000000000AA"),
  jwtAudience: JSON.stringify("offline"),
  instanceId: JSON.stringify("offline"),
  manifestHref: buildAssetUrl("manifest.json", assetManifest, cdnBase),
  faviconHref: buildAssetUrl("images/Favicon.svg", assetManifest, cdnBase),
  gameplayScreenshotUrl: buildAssetUrl(
    "images/GameplayScreenshot.png",
    assetManifest,
    cdnBase,
  ),
  backgroundImageUrl: buildAssetUrl(
    "images/background.webp",
    assetManifest,
    cdnBase,
  ),
  desktopLogoImageUrl: buildAssetUrl("images/OpenFront.png", assetManifest, cdnBase),
  mobileLogoImageUrl: buildAssetUrl("images/OF.png", assetManifest, cdnBase),
});

fs.writeFileSync(htmlPath, rendered);
console.log(`Rendered offline ${htmlPath}`);
if (rendered.includes("<%")) {
  console.error("WARNING: unrendered EJS placeholders remain!");
  process.exit(1);
}
