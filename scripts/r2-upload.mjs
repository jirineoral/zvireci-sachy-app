// Uploads scripts/lesson-audio/out/ (the "sova čte nahlas" read-aloud clips,
// scripts/lesson-audio/build.mjs) to the Cloudflare R2 bucket that already serves the lesson
// videos (owner-approved, docs/BACKLOG.md 2026-09-28): bucket `zvirecisachy-videa`, prefix
// `lesson-audio/`, public at https://videa.zvirecisachy.cz/lesson-audio/.
//
//   node scripts/r2-upload.mjs                # upload anything missing
//   node scripts/r2-upload.mjs --dry-run       # just say what would be uploaded
//
// Idempotent: filenames are content-addressed (sha1 of voice + text, scripts/lesson-audio/
// build.mjs), so before uploading each file this HEADs its public URL — a 200 means it is
// already there byte-for-byte (same hash = same content, nothing to overwrite) and is
// skipped; only genuinely new files are `wrangler r2 object put`. Safe to re-run after every
// `build.mjs` run, and safe to interrupt and re-run.
//
// Cache-Control is `public, max-age=31536000, immutable`: the filename changes if the audio
// ever changes (content-addressed), so a client or the CDN caching the old bytes forever
// under the old name is correct, not stale. Requires wrangler already logged in
// (`npx wrangler whoami`); run from anywhere in the repo (uses `--cwd` into worker/, which is
// where wrangler and its Cloudflare account context already live for this project).
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const OUT_DIR = join(REPO_ROOT, 'scripts', 'lesson-audio', 'out');
const WORKER_DIR = join(REPO_ROOT, 'worker');
const BUCKET = 'zvirecisachy-videa';
const PREFIX = 'lesson-audio';
const PUBLIC_BASE = 'https://videa.zvirecisachy.cz';
const CONTENT_TYPE = { ogg: 'audio/ogg', m4a: 'audio/mp4' };
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DRY = process.argv.includes('--dry-run');

if (!existsSync(OUT_DIR)) {
  console.error(`nothing to upload: ${OUT_DIR} does not exist (run scripts/lesson-audio/build.mjs first)`);
  process.exit(1);
}

const files = readdirSync(OUT_DIR).filter((f) => /\.(ogg|m4a)$/.test(f));
if (files.length === 0) {
  console.log(`nothing to upload: no .ogg/.m4a files in ${OUT_DIR}`);
  process.exit(0);
}

async function alreadyThere(key) {
  try {
    const res = await fetch(`${PUBLIC_BASE}/${key}`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false; // network hiccup or the domain isn't answering yet: treat as "not there", upload it
  }
}

// `npx` needs a shell on Windows (it is a .cmd) — but plain `shell: true` there always uses
// cmd.exe, whose global `npx.cmd` shim misresolves relative to a cwd with no node_modules
// (fine for `worker/` interactively, not through a spawned child for reasons not fully
// tracked down). `$SHELL` (Git Bash in this project's environment) runs the same `npx`
// resolution that works fine from an interactive shell, so prefer it when set; building one
// quoted command string ourselves (rather than relying on `shell: true`'s own array-joining,
// which does not quote at all) also sidesteps this repo path's spaces ("A - AI Tooling
// Experiments").
const SHELL = process.env.SHELL ?? true;
const BASH_SHELL = typeof SHELL === 'string';
const q = (s) => (BASH_SHELL ? `'${String(s).replace(/'/g, `'\\''`)}'` : `"${String(s).replace(/"/g, '""')}"`);

/** One `wrangler r2 object put`, as a child process (not blocking the event loop) so many can run at once. */
function put(key, filePath, contentType) {
  return new Promise((res, rej) => {
    const cmd = ['npx', 'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', filePath, '--content-type', contentType, '--cache-control', CACHE_CONTROL, '--remote']
      .map(q)
      .join(' ');
    const child = spawn(cmd, { cwd: WORKER_DIR, shell: SHELL });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (err) => rej(new Error(`wrangler r2 object put ${key}: ${err.message}`)));
    child.on('close', (code) => (code === 0 ? res() : rej(new Error(`wrangler r2 object put ${key} exited ${code}:\n${out}`))));
  });
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// The HEAD existence check is I/O-bound (CDN round trip); `wrangler put` is a whole child
// process (its own node + npx resolution) but otherwise independent per key, so both run with
// concurrency — sequential uploads (one child-process cold start, ~1-2 s, at a time) would take
// well over an hour for a full 5-level catalogue.
const CHECK_CONCURRENCY = 16;
const UPLOAD_CONCURRENCY = 24;

console.log(`checking ${files.length} files against ${PUBLIC_BASE}/${PREFIX}/ ...`);
const present = await mapWithConcurrency(files, CHECK_CONCURRENCY, (f) => alreadyThere(`${PREFIX}/${f}`));

const toUpload = files.filter((_, i) => !present[i]);
const skipped = files.length - toUpload.length;
console.log(`${toUpload.length} to upload, ${skipped} already present.`);

if (DRY) {
  for (const f of toUpload) console.log(`  would upload: ${PREFIX}/${f}`);
  console.log(`\nwould upload ${toUpload.length}, already present ${skipped} (of ${files.length} local files).`);
  process.exit(0);
}

let done = 0;
let failed = 0;
await mapWithConcurrency(toUpload, UPLOAD_CONCURRENCY, async (f) => {
  const key = `${PREFIX}/${f}`;
  const ext = f.slice(f.lastIndexOf('.') + 1);
  try {
    await put(key, join(OUT_DIR, f), CONTENT_TYPE[ext]);
    done++;
    if (done % 25 === 0 || done === toUpload.length) console.log(`uploaded ${done}/${toUpload.length}${failed ? ` (${failed} failed so far)` : ''}`);
  } catch (err) {
    failed++;
    console.error(String(err.message ?? err));
  }
});

console.log(`\nuploaded ${done}, failed ${failed}, already present ${skipped} (of ${files.length} local files).`);
if (failed > 0) process.exitCode = 1;
