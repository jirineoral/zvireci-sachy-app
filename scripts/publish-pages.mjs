// Copies a fresh `dist/` (from `npm run build:pages`) into the working copy of the
// GitHub Pages repository, replacing the previously published build instead of layering
// on top of it. Old hashed bundles must not accumulate: everything under the Pages repo is
// public, so the published tree should contain exactly one build (docs/security-review.md, C2).
//
// Usage: node scripts/publish-pages.mjs <path-to-pages-working-copy>
// Committing and pushing the Pages repo stays a manual, reviewable step.
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const target = process.argv[2] ? resolve(process.argv[2]) : null;

if (!target) {
  console.error('publish-pages: usage: node scripts/publish-pages.mjs <pages-working-copy>');
  process.exit(1);
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error('publish-pages: dist/index.html missing — run `npm run build:pages` first');
  process.exit(1);
}
if (!existsSync(join(target, '.git')) || !existsSync(join(target, '.nojekyll'))) {
  console.error(`publish-pages: ${target} does not look like the Pages working copy (.git and .nojekyll expected)`);
  process.exit(1);
}

// Only the build output is replaced; README, LICENSE and .nojekyll in the Pages repo stay.
const built = readdirSync(dist);
for (const entry of built) {
  const stale = join(target, entry);
  if (existsSync(stale)) rmSync(stale, { recursive: true, force: true });
}
cpSync(dist, target, { recursive: true });

const files = [];
const walk = (dir, prefix) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, `${prefix}${name}/`);
    else files.push(`${prefix}${name}`);
  }
};
walk(dist, '');
console.log(`publish-pages: ${files.length} files copied to ${target}:`);
for (const f of files) console.log(`  ${f}`);
console.log('publish-pages: now review `git status` in the Pages repo, commit and push.');
