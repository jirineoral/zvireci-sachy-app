import { execSync } from 'node:child_process';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Build stamp for the footer / feedback form: short commit + its date, e.g. "1d80155 · 13. 9. 2026" (deterministic per commit). */
function buildStamp(): string {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const [y, m, d] = execSync('git log -1 --format=%cs', { encoding: 'utf-8' }).trim().split('-').map(Number);
    return `${commit} · ${d}. ${m}. ${y}`;
  } catch {
    return 'dev';
  }
}

/**
 * Content Security Policy for the published build (docs/security-review.md, C4).
 *
 * GitHub Pages cannot send headers, so the policy ships as a <meta> tag. It is injected
 * only into the production HTML: the Vite dev server injects CSS through <style> elements
 * and would need 'unsafe-inline', which we refuse to ship. Verify any change to this list
 * by playing a game against the engine on `vite preview` and on the Pages URL.
 *
 *  - 'wasm-unsafe-eval': Stockfish is WebAssembly compiled in a Web Worker
 *    (WebAssembly.instantiateStreaming). Without it the engine fails and the app silently
 *    falls back to two-player mode. It permits wasm compilation only, not JS eval.
 *  - img-src data:: the built-in cburnett piece set is data:image/svg+xml in the bundled CSS.
 *  - img-src blob:: the player's own piece sets (MVP M1) are object URLs of PNGs that our
 *    own code re-encoded from sniffed uploads; no other blob: source exists.
 *  - connect-src 'self' https://api.chess.com https://lichess.org: sets.json, the wasm
 *    HEAD pre-check, the worker's wasm fetch, and the two external endpoints — the public
 *    chess.com API (Phase 15 import) and the Lichess broadcast API (Phase 16), both
 *    unauthenticated with CORS `*`.
 *  - frame-ancestors cannot be expressed in a <meta> policy; a header would be needed.
 *  - connect-src <relay>: the "Hrát s kamarádem" WebSocket (Phase 20) — only this origin.
 *  - Cloudflare Web Analytics (public site only, `--mode pages`): the beacon script from
 *    static.cloudflareinsights.com and its POST to cloudflareinsights.com. It counts page
 *    views and visits per day without cookies, fingerprinting or a visitor id (Cloudflare's
 *    "privacy-first" analytics) — the one third-party script the site loads, and only there.
 */
function csp(analytics: boolean, friendWs: string): string {
  return [
    "default-src 'none'",
    `script-src 'self' 'wasm-unsafe-eval'${analytics ? ' https://static.cloudflareinsights.com' : ''}`,
    "style-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://api.chess.com/pub/ https://lichess.org/api/broadcast/ ${friendWs}${analytics ? ' https://cloudflareinsights.com' : ''}`,
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Cloudflare Web Analytics site token for zvirecisachy.cz (public: it only identifies the site to count for). */
const CF_BEACON_TOKEN = '827f2cbd704d40b0bd3917ac4c481f2e';

function cspMeta(analytics: boolean, friendWs: string): Plugin {
  return {
    name: 'skm-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      const tags = [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp(analytics, friendWs) }, injectTo: 'head-prepend' as const }];
      if (analytics) {
        tags.push({
          tag: 'script',
          attrs: { defer: true, src: 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': JSON.stringify({ token: CF_BEACON_TOKEN }) },
          injectTo: 'body' as const,
        } as never);
      }
      return tags;
    },
  };
}

/** The relay's origin: `VITE_FRIEND_WS` from `.env.local` / the environment (dev server, dev site) or the public one. */
function friendWs(mode: string): string {
  const override = loadEnv(mode, process.cwd(), 'VITE_').VITE_FRIEND_WS;
  if (override && /^wss?:\/\/[a-z0-9.:-]+$/i.test(override)) return override;
  return 'wss://hra.zvirecisachy.cz';
}

export default defineConfig(({ mode }) => ({
  // `--mode pages` = the public site build: Cloudflare Web Analytics beacon + its CSP entries.
  plugins: [cspMeta(mode === 'pages', friendWs(mode))],
  define: {
    __FRIEND_WS__: JSON.stringify(friendWs(mode)),
    __BUILD_STAMP__: JSON.stringify(buildStamp()),
    // `--mode devsite` = the dev.zvirecisachy.cz build: banner in the footer, feedback link hidden
    // (test builds must not mix into the pilot's feedback), otherwise identical.
    __DEV_SITE__: JSON.stringify(mode === 'devsite'),
  },
}));
