// Service worker for Zvireci sachy (backlog R12, step 1 - installable PWA).
//
// This file is a TEMPLATE: `scripts/build-sw.mjs` fills in CACHE_VERSION and
// PRECACHE_URLS after `vite build` and writes the result to `dist/sw.js`. The two
// placeholders below are what makes every deploy change this file's bytes, which is what
// makes the browser's own update check notice a new version (it byte-compares the
// previously installed sw.js against the one it (re)fetches on each navigation) - do not
// hand-edit dist/sw.js or point index.html at this template directly.
//
// Design (docs/security-review.md, 2026-09-28):
//  - Own work, no library (no Workbox): the app has exactly one thing to precache (a
//    small app shell) and three simple runtime strategies, so a hand-written ~100-line
//    worker is easier to audit than pulling in vite-plugin-pwa/Workbox for it.
//  - Cache name is versioned (`skm-cache-<version>`); `activate` deletes every other
//    `skm-cache-*`, so a new deploy never leaves stale files behind and never needs the
//    player to clear anything.
//  - HEAD requests are never intercepted (see below) - `src/engine.ts`'s wasm
//    content-length pre-check must see the real network response, never a cached or
//    synthesised one.
//  - Cross-origin requests (chess.com, Lichess, the friend relay WebSocket, Cloudflare
//    Web Analytics) are never intercepted - the fetch handler returns immediately and
//    lets the browser handle them exactly as it would with no service worker at all.
//  - Precached: the app shell (hashed JS/CSS, index.html, manifest, icons, compat.js,
//    the small Stockfish JS loader) - see PRECACHE_URLS. NOT precached: the Stockfish
//    .wasm (several MB) and piece-sets/lessons/puzzles/sounds/splash (tens of MB
//    combined) - those are cached on first use instead (see runtime strategies below).

const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = `skm-cache-${CACHE_VERSION}`;
const PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // A single missing/failing precache URL must not abort the whole install (the
      // player would be stuck on the previous version forever); log and continue.
      .catch((err) => console.error('sw: precache failed', err)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME && name.startsWith('skm-cache-')).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// The waiting worker only takes over when the player clicks the update banner
// (src/pwa.ts) - never mid-game on its own.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const RUNTIME_CACHE_PREFIXES = ['/piece-sets/', '/lessons/', '/puzzles/', '/sounds/', '/splash/', '/engine/'];

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept HEAD (or anything but GET): src/engine.ts's wasm pre-check needs the
  // real network response (status, content-type, content-length), not a cached or
  // synthesised one, and a POST/PUT is never something a cache should touch.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cross-origin (chess.com, Lichess, the friend relay, Cloudflare Analytics): pass
  // straight through, untouched.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (RUNTIME_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    // Piece sets/lessons/puzzles/sounds/splash rarely change and are not content-hashed;
    // the engine's .js+.wasm live here too. Stale-while-revalidate: answer from cache
    // instantly when present (this is what makes the engine playable offline once it has
    // been fetched once) while refreshing the cache in the background for next time.
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else same-origin (the precached app shell, and any same-origin URL not
  // covered above): cache-first, falling back to network and caching what it returns.
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? (await caches.match('/')) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}
