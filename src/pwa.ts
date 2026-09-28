/**
 * Service worker registration and the "new version" banner (backlog R12, step 1 -
 * installable PWA; docs/security-review.md, 2026-09-28).
 *
 * Production only: `import.meta.env.PROD` is false in `vite` (the dev server), so nothing
 * here runs during development - a service worker caching `vite`'s own dev responses
 * would be its own source of confusing bugs. `scripts/build-sw.mjs` writes `dist/sw.js`
 * (from `scripts/sw-template.js`) with cache names derived from the build, so a deploy
 * replaces the old shell cache instead of adding to it - see that file for the caching
 * strategy.
 *
 * Update flow: the browser installs a new worker in the background and parks it
 * "waiting" as long as the old one still controls an open tab. We never swap it in
 * ourselves (that would reload a child mid-game) - instead we show a small banner and
 * only tell the waiting worker to `skipWaiting()` once the player clicks it, then reload
 * once it actually takes control.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // `clients.claim()` in the worker's `activate` (scripts/sw-template.js) hands every open
  // tab a controller as soon as any worker activates - including this tab's very first
  // install, and including every OTHER tab still open when one tab's player clicks
  // "Obnovit". `controllerchange` fires in all of those cases, not just "the update this
  // tab asked for". Reloading unconditionally on it used to: reload a first-time visit
  // for no reason (interrupting it, and dropping a `#hra=` invite already in the address
  // bar if storage was blocked so nothing could remember it across the reload, and
  // double-counting the analytics beacon); and reload every other open tab mid-game the
  // moment one tab's player clicked the banner. Only reload when THIS tab is the one that
  // asked for the update - other tabs just keep (or get) their own banner instead.
  let updateRequestedInThisTab = false;
  let reloaded = false;

  window.addEventListener('load', async () => {
    let registration: ServiceWorkerRegistration | undefined;
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    } catch (err) {
      console.error('sw: registration failed', err);
      return;
    }
    // Some environments (e.g. Playwright's `serviceWorkers: 'block'`, used by the UI smoke
    // suite) resolve `register()` with `undefined` instead of rejecting - not a real
    // browser's behaviour, but cheap to guard rather than assume.
    if (!registration) return;

    const requestUpdate = (): void => {
      updateRequestedInThisTab = true;
    };
    // Always read `registration.waiting` fresh at the point we act on it (on load, and
    // again on every statechange below) rather than holding on to a ServiceWorker
    // reference captured earlier, which a fast second update could make stale.
    if (registration.waiting && registration.active) showUpdateBanner(registration, requestUpdate);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // `controller` is set once a worker already controls this page, i.e. this is an
        // update, not the very first install (which needs no banner - there is nothing to
        // switch away from).
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(registration, requestUpdate);
        }
      });
    });

    // A backgrounded tab can sit on an old version for a long time without ever
    // navigating again; re-check whenever the player comes back to it. Cheap: the browser
    // only refetches sw.js (a byte-for-byte compare) and does nothing if it is unchanged.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequestedInThisTab || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

function showUpdateBanner(registration: ServiceWorkerRegistration, requestUpdate: () => void): void {
  if (document.querySelector('.skm-update-banner')) return; // already shown

  const banner = document.createElement('div');
  banner.className = 'skm-update-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;' +
    'justify-content:center;gap:.75rem;flex-wrap:wrap;padding:.6rem 1rem;' +
    'background:#2e7d32;color:#fff;font:600 1rem/1.3 system-ui,sans-serif;' +
    'box-shadow:0 -2px 8px rgba(0,0,0,.3);';

  const text = document.createElement('span');
  text.textContent = 'Je tu nová verze hry.';
  banner.append(text);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Obnovit';
  button.style.cssText =
    'padding:.35rem .9rem;border:2px solid #fff;border-radius:999px;background:#fff;' +
    'color:#2e7d32;font:inherit;font-weight:700;cursor:pointer;';
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Obnovuji…';
    requestUpdate();
    // Re-read `.waiting` now rather than trusting a reference from whenever the banner was
    // shown - it is still the same worker in practice, but this is the one place a stale
    // reference would actually matter (posting to the wrong/gone worker silently no-ops).
    registration.waiting?.postMessage('SKIP_WAITING');
  });
  banner.append(button);

  document.body.append(banner);
}
