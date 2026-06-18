// Copies the single-file web app into www/ for Capacitor packaging.
// app.html is the source of truth; Capacitor expects index.html in webDir.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
fs.mkdirSync(www, { recursive: true });

fs.copyFileSync(path.join(root, 'app.html'), path.join(www, 'index.html'));
for (const f of ['manifest.json', 'service-worker.js']) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(www, f));
}
console.log('web assets copied to www/');
