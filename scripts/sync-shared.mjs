// Copies the app code the edge functions reuse (e-mail texts, .ics, dates, mappers) into
// supabase/functions/_shared/app/, adding the ".ts" import extensions Deno requires.
// Runs automatically before deploying functions (npm run functions:deploy).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FILES = [
  'types.ts',
  'roles.ts',
  'lib/dates.ts',
  'lib/moments.ts',
  'lib/emails.ts',
  'lib/emailHtml.ts',
  'lib/prefill.ts',
  'lib/pageExtract.ts',
  'lib/ics.ts',
  'data/mappers.ts',
];

const out = 'supabase/functions/_shared/app';
rmSync(out, { recursive: true, force: true });
for (const f of FILES) {
  const src = readFileSync(join('src', f), 'utf8');
  const fixed = src.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, a, path, b) =>
    path.endsWith('.ts') ? m : `${a}${path}.ts${b}`,
  );
  const target = join(out, f);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `// Copied from src/${f} by scripts/sync-shared.mjs. Edit the original, not this copy.\n${fixed}`);
}
console.log(`✔ ${FILES.length} bestanden gekopieerd naar ${out}`);
