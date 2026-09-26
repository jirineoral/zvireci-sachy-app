// Commits and pushes a Pages working copy after publish-pages.mjs. Used by the dev-site
// script only (the public site stays a manual, reviewed push).
// Usage: node scripts/push-pages.mjs <pages-working-copy> "<commit message>"
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const target = process.argv[2] ? resolve(process.argv[2]) : null;
const message = process.argv[3] ?? 'publish';
if (!target) {
  console.error('push-pages: usage: node scripts/push-pages.mjs <pages-working-copy> "<message>"');
  process.exit(1);
}
const git = (...args) => execFileSync('git', ['-C', target, ...args], { stdio: 'inherit' });
// GitHub itself commits to the Pages branch when the custom domain is (re)set in the
// settings ("Create CNAME"); rebase onto that before pushing.
// Commits use the machine's own git identity (no address hard-coded in this public repo).
git('add', '-A');
try {
  git('commit', '-q', '-m', message);
} catch {
  console.log('push-pages: nothing to commit');
}
git('fetch', '-q');
git('rebase', '-q', 'origin/main');
git('push', '-q');
console.log(`push-pages: pushed ${target}`);
