#!/usr/bin/env node
// Post-build step (backlog R12, step 1 - installable PWA): turns scripts/sw-template.js
// into dist/sw.js, filling in a build-derived cache version and the list of app-shell
// files to precache. Runs after `vite build` in every build script (npm run build,
// build:pages, build:dev-site) - see package.json.
//
// Why a separate script instead of a Vite plugin hook: the precache list depends on the
// finished `dist/` tree (hashed asset filenames only exist after the bundle is written),
// so this has to run as a distinct step after `vite build` returns, not during it.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const TEMPLATE = join(ROOT, 'scripts/sw-template.js');
const OUT = join(DIST, 'sw.js');

// The app shell: small, same-origin, needed to boot the UI and start an engine search.
// Everything else (the Stockfish .wasm; piece-sets/lessons/puzzles/sounds/splash) is
// cached on first use by the service worker's runtime strategies instead - see
// scripts/sw-template.js and docs/security-review.md, 2026-09-28.
function shouldPrecache(relPath) {
  if (relPath === 'index.html' || relPath === 'manifest.webmanifest' || relPath === 'compat.js') return true;
  if (relPath === 'soukromi.html' || relPath === 'THIRD-PARTY-NOTICES.txt') return true;
  if (relPath.startsWith('icons/')) return true;
  if (relPath.startsWith('assets/') && (relPath.endsWith('.js') || relPath.endsWith('.css'))) return true;
  // The Stockfish *loader* is ~20 kB and needed before any search can start; the .wasm
  // next to it is several MB and is deliberately left to runtime caching (see below).
  if (relPath === 'engine/stockfish-18-lite-single.js') return true;
  return false;
}

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, base, out);
    } else {
      out.push(posix.relative(base.split('\\').join('/'), full.split('\\').join('/')));
    }
  }
  return out;
}

function main() {
  const allFiles = walk(DIST);
  const precacheFiles = allFiles.filter(shouldPrecache).sort();
  if (!precacheFiles.includes('index.html')) throw new Error('build-sw: dist/index.html missing - run vite build first');

  const hash = createHash('sha256');
  let totalBytes = 0;
  for (const relPath of precacheFiles) {
    const buf = readFileSync(join(DIST, relPath));
    hash.update(relPath);
    hash.update(buf);
    totalBytes += buf.length;
  }
  const version = hash.digest('hex').slice(0, 12);

  // '/' is what an actual navigation requests; '/index.html' is the literal file. Both
  // point at the same bytes, so precache both under the URLs a request could plausibly use.
  const urls = ['/', ...precacheFiles.map((p) => `/${p}`)];

  const template = readFileSync(TEMPLATE, 'utf-8');
  const sw = template.replace('__CACHE_VERSION__', version).replace('__PRECACHE_URLS__', JSON.stringify(urls));
  writeFileSync(OUT, sw);

  const wasmPath = allFiles.find((f) => f.endsWith('.wasm'));
  const wasmBytes = wasmPath ? statSync(join(DIST, wasmPath)).size : 0;
  console.log(`build-sw: dist/sw.js written - version ${version}, ${precacheFiles.length} files precached (${(totalBytes / 1024).toFixed(0)} kB)`);
  if (wasmPath) {
    console.log(`build-sw: NOT precached - ${wasmPath} (${(wasmBytes / 1024 / 1024).toFixed(1)} MB); cached on first use instead`);
  }
}

main();
