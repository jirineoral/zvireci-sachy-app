/**
 * Shared harness for the UI smoke suite (scripts/test-ui.mjs) and ad-hoc screenshots:
 * serves the built `dist/` through `vite preview` and drives the installed Microsoft Edge
 * (or Chrome) through playwright-core — no browser download.
 *
 *   UI_BROWSER=chrome        use Google Chrome instead of Edge
 *   UI_BROWSER_PATH=<exe>    an explicit Chromium-based executable
 *   UI_HEADED=1              show the browser window
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Starts `vite preview` on a free port; returns its base URL and a close function. */
export async function startPreview() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('dist/ is missing — run `npm run build` first');
  const server = await preview({ root: ROOT, logLevel: 'error', preview: { port: 0, host: '127.0.0.1', strictPort: false, open: false } });
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 4173;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.httpServer.close(() => resolve())),
  };
}

/** Launches the installed Edge (default) or Chrome. */
export function launchBrowser() {
  const executablePath = process.env.UI_BROWSER_PATH;
  const channel = executablePath ? undefined : process.env.UI_BROWSER === 'chrome' ? 'chrome' : 'msedge';
  return chromium.launch({ channel, executablePath, headless: process.env.UI_HEADED !== '1' });
}

export const VIEWPORTS = {
  mobile: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  smallPhone: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1366, height: 768 } },
};

/**
 * A fresh context (empty storage = a genuinely new user) at `viewport`. `local` is written
 * to localStorage before the app runs; the intro splash is skipped for this session only
 * (sessionStorage — it does not make the user look like a returning one).
 */
export async function newPage(browser, viewport, { local = null, intro = false } = {}) {
  const context = await browser.newContext({ ...VIEWPORTS[viewport], locale: 'cs-CZ', serviceWorkers: 'block' });
  await context.addInitScript(
    ([seed, skipIntro]) => {
      try {
        if (skipIntro) sessionStorage.setItem('skm.introShown', '1');
        if (seed && !sessionStorage.getItem('skm.test.seeded')) {
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
          sessionStorage.setItem('skm.test.seeded', '1'); // a reload must not re-seed
        }
      } catch {
        // storage blocked: the app falls back on its own
      }
    },
    [local, !intro],
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    // A failed request is reported below with its URL instead.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`);
  });
  return { context, page, errors };
}
