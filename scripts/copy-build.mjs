// Copies the single-file build to a friendly name in the project root,
// so there is one obvious file to e-mail or upload.
import { copyFileSync, statSync } from 'node:fs';

const src = 'dist/index.html';
const dest = 'Eiwitshift-kalender-prototype.html';
copyFileSync(src, dest);
console.log(`\n✔ ${dest} (${Math.round(statSync(dest).size / 1024)} kB) — open dit bestand rechtstreeks in je browser.`);
