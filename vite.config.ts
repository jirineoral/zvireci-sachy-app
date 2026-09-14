import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

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
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.chess.com/pub/ https://lichess.org/api/broadcast/",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'skm-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  plugins: [cspMeta()],
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp()),
  },
});
