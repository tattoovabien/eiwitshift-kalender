// Publishes the live build (dist/index.html) to the gh-pages branch of the "origin" remote.
// GitHub Pages then serves it. Run with: npm run deploy:site
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html ontbreekt: voer eerst "npm run build:live" uit.');
  process.exit(1);
}

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const remote = git(['remote', 'get-url', 'origin'], process.cwd());

const dir = mkdtempSync(join(tmpdir(), 'eiwitshift-pages-'));
try {
  cpSync('dist/index.html', join(dir, 'index.html'));
  writeFileSync(join(dir, '.nojekyll'), '');
  git(['init', '-q', '-b', 'gh-pages'], dir);
  git(['add', '-A'], dir);
  git(
    ['-c', 'user.name=Eiwitshift-kalender', '-c', 'user.email=deploy@users.noreply.github.com', 'commit', '-q', '-m', `Publiceer ${new Date().toISOString()}`],
    dir,
  );
  execFileSync('git', ['push', '--force', remote, 'gh-pages'], { cwd: dir, stdio: 'inherit' });
  console.log('\n✔ Gepubliceerd. GitHub Pages is binnen een minuutje bijgewerkt.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
