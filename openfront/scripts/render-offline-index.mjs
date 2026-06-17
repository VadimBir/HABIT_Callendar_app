import fs from "fs";
import path from "path";
import ejs from "ejs";

const root = process.cwd();
const staticDir = path.join(root, "static");
const htmlPath = path.join(staticDir, "index.html");
const manifest = JSON.parse(fs.readFileSync(path.join(staticDir, "asset-manifest.json"), "utf8"));
const cdnBase = "";

function buildAssetUrl(p) {
  const norm = p.replace(/^\/+/, "");
  const direct = manifest[norm];
  if (direct) return cdnBase ? `${cdnBase.replace(/\/+$/,"")}${direct}` : direct;
  return "/" + norm.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

const html = fs.readFileSync(htmlPath, "utf8");
const rendered = ejs.render(html, {
  gitCommit: JSON.stringify("offline"),
  assetManifest: JSON.stringify(manifest),
  cdnBase: "window.location.origin",  // worker needs absolute base offline
  cdnBaseRaw: cdnBase,
  gameEnv: JSON.stringify("prod"),
  numWorkers: JSON.stringify(4),
  turnstileSiteKey: JSON.stringify(""),
  jwtAudience: JSON.stringify(""),
  instanceId: JSON.stringify("OFFLINE_APK"),
  manifestHref: buildAssetUrl("manifest.json"),
  faviconHref: buildAssetUrl("images/Favicon.svg"),
  gameplayScreenshotUrl: buildAssetUrl("images/GameplayScreenshot.png"),
  backgroundImageUrl: buildAssetUrl("images/background.webp"),
  desktopLogoImageUrl: buildAssetUrl("images/OpenFront.png"),
  mobileLogoImageUrl: buildAssetUrl("images/OF.png"),
});
fs.writeFileSync(htmlPath, rendered);
const left = (rendered.match(/<%[-=]?/g) || []).length;
console.log("rendered; remaining EJS placeholders:", left);
