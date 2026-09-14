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
git('add', '-A');
try {
  git('-c', 'user.name=Jiri', '-c', 'user.email=jiri.neoral@gmail.com', 'commit', '-q', '-m', message);
} catch {
  console.log('push-pages: nothing to commit');
}
git('fetch', '-q');
git('-c', 'user.name=Jiri', '-c', 'user.email=jiri.neoral@gmail.com', 'rebase', '-q', 'origin/main');
git('push', '-q');
console.log(`push-pages: pushed ${target}`);
