// Service worker for Zvireci sachy (backlog R12, step 1 - installable PWA).
//
// This file is a TEMPLATE: `scripts/build-sw.mjs` fills in CACHE_VERSION,
// ENGINE_VERSION and PRECACHE_URLS after `vite build` and writes the result to
// `dist/sw.js`. The placeholders below are what makes every deploy change this file's
// bytes, which is what makes the browser's own update check notice a new version (it
// byte-compares the previously installed sw.js against the one it (re)fetches on each
// navigation) - do not hand-edit dist/sw.js or point index.html at this template directly.
//
// Design (docs/security-review.md, 2026-09-28 and 2026-09-28 review fixes):
//  - Own work, no library (no Workbox): the app has exactly one thing to precache (a
//    small app shell) and a few simple runtime strategies, so a hand-written worker is
//    easier to audit than pulling in vite-plugin-pwa/Workbox for it.
//  - Three cache "generations", each with its own lifetime:
//      skm-cache-<CACHE_VERSION>   the app shell (precached). Versioned by the shell's
//                                  own content; `activate` deletes every other
//                                  `skm-cache-*`, so a deploy never leaves stale shell
//                                  files behind.
//      skm-engine-<ENGINE_VERSION> the Stockfish .wasm, cached on first use. Versioned
//                                  separately, by the engine files' own content, so an
//                                  ordinary deploy (which changes CACHE_VERSION on
//                                  every release) does NOT force a 7 MB re-download -
//                                  only an actual engine upgrade does, and `activate`
//                                  deletes any other `skm-engine-*` when one occurs.
//      skm-runtime                 piece sets/lessons/puzzles/sounds/splash images,
//                                  cached on first use. Not versioned at all - it
//                                  survives every deploy - and bounded by construction:
//                                  only these few, finite, rarely-changing directories
//                                  are ever written here (tens of MB total, not
//                                  unbounded growth), refreshed in the background by
//                                  stale-while-revalidate whenever a file does change.
//  - HEAD requests are never intercepted (see below) - `src/engine.ts`'s wasm
//    content-length pre-check must see the real network response, never a cached or
//    synthesised one.
//  - Cross-origin requests (chess.com, Lichess, the friend relay WebSocket, Cloudflare
//    Web Analytics) are never intercepted - the fetch handler returns immediately and
//    lets the browser handle them exactly as it would with no service worker at all.
//  - Only ever cache a usable answer: same-origin, not redirected across origins, status
//    200 (`response.ok && status === 200 && type === 'basic'`) - never an opaque or
//    error response - and every `cache.put` is guarded with `.catch` (quota errors, a
//    response already consumed elsewhere, etc. must not turn into an unhandled
//    rejection that kills the fetch).

const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = `skm-cache-${CACHE_VERSION}`;
const ENGINE_VERSION = '__ENGINE_VERSION__';
const ENGINE_CACHE_NAME = `skm-engine-${ENGINE_VERSION}`;
const RUNTIME_CACHE_NAME = 'skm-runtime';
const PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', (event) => {
  // Precache with `{ cache: 'reload' }` so this bypasses the HTTP cache (GitHub Pages
  // sends `max-age=600` on static assets) and always fetches the bytes this exact build
  // actually shipped. Deliberately no `.catch` here: if even one file fails, `install`
  // rejects and the browser keeps the previous worker (and its cache) fully in charge -
  // better than silently activating a shell with a hole in it.
  const requests = PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(requests)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const stale = names.filter(
        (name) => (name.startsWith('skm-cache-') && name !== CACHE_NAME) || (name.startsWith('skm-engine-') && name !== ENGINE_CACHE_NAME),
      );
      await Promise.all(stale.map((name) => caches.delete(name)));
      // skm-runtime is never listed above and so never deleted here - it outlives deploys.
      await self.clients.claim();
    })(),
  );
});

// The waiting worker only takes over when the player clicks the update banner
// (src/pwa.ts) - never mid-game on its own.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const RUNTIME_CACHE_PREFIXES = ['/piece-sets/', '/lessons/', '/puzzles/', '/sounds/', '/splash/'];

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
    event.respondWith(networkFirstNavigation(event, request, url));
    return;
  }

  // The Stockfish .wasm: several MB, kept in its own generation so an ordinary deploy
  // doesn't force refetching it (see the header comment) - cache-first once it exists.
  if (url.pathname.startsWith('/engine/') && url.pathname.endsWith('.wasm')) {
    event.respondWith(cacheFirst(event, request, ENGINE_CACHE_NAME));
    return;
  }

  if (RUNTIME_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    // Piece sets/lessons/puzzles/sounds/splash rarely change and are not content-hashed.
    // Stale-while-revalidate: answer from cache instantly when present (this is what
    // makes these playable offline once fetched once) while refreshing in the background.
    event.respondWith(staleWhileRevalidate(event, request, RUNTIME_CACHE_NAME));
    return;
  }

  // Everything else same-origin (the precached app shell, the small Stockfish JS loader,
  // and any same-origin URL not covered above): cache-first, falling back to network.
  event.respondWith(cacheFirst(event, request, CACHE_NAME));
});

/** Same-origin, not redirected across origins, a real success - never opaque, never an error page. */
function cacheableResponse(response) {
  return !!response && response.ok && response.status === 200 && response.type === 'basic';
}

/** Written through `event.waitUntil` by every caller below: the fetch event's own promise
 *  (from `respondWith`) can resolve, and the browser may then tear the worker down, before
 *  a fire-and-forget `cache.put` finishes - `waitUntil` keeps the worker alive for it. */
async function putInCache(cacheName, request, response) {
  if (!cacheableResponse(response)) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    // Quota exceeded, a response body already used, etc. - the fetch itself still
    // succeeded for the caller; losing this one cache entry is not worth failing it.
  }
}

/** Navigations are keyed by pathname alone (no query string) so `?utm=...` etc. cannot
 *  spawn endless cache entries, and each real document (`/`, `/soukromi.html`) keeps its
 *  own entry instead of collapsing onto one. */
function navigationKey(url) {
  return new Request(new URL(url.pathname, self.location.origin).href);
}

async function networkFirstNavigation(event, request, url) {
  const key = navigationKey(url);
  try {
    const response = await fetch(request);
    event.waitUntil(putInCache(CACHE_NAME, key, response.clone()));
    return response;
  } catch {
    const cached = (await caches.match(key)) ?? (await caches.match('/'));
    return cached ?? Response.error();
  }
}

async function cacheFirst(event, request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  event.waitUntil(putInCache(cacheName, request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      event.waitUntil(putInCache(cacheName, request, response.clone()));
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}
