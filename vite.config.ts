import { defineConfig, type Plugin } from 'vite';

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
 *  - connect-src 'self': sets.json, the wasm HEAD pre-check and the worker's wasm fetch.
 *  - frame-ancestors cannot be expressed in a <meta> policy; a header would be needed.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
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
});
