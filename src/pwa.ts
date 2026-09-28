/**
 * Service worker registration and the "new version" banner (backlog R12, step 1 -
 * installable PWA; docs/security-review.md, 2026-09-28).
 *
 * Production only: `import.meta.env.PROD` is false in `vite` (the dev server), so nothing
 * here runs during development - a service worker caching `vite`'s own dev responses
 * would be its own source of confusing bugs. `scripts/build-sw.mjs` writes `dist/sw.js`
 * (from `scripts/sw-template.js`) with a cache name derived from the build, so every
 * deploy replaces the old cache instead of adding to it - see that file for the caching
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

  window.addEventListener('load', async () => {
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    } catch (err) {
      console.error('sw: registration failed', err);
      return;
    }

    if (registration.waiting && registration.active) showUpdateBanner(registration.waiting);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // `controller` is set once a worker already controls this page, i.e. this is an
        // update, not the very first install (which needs no banner - there is nothing to
        // switch away from).
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(installing);
        }
      });
    });
  });

  // A new worker taking control (after we sent SKIP_WAITING below) means the reload is
  // finally safe to do - the old cached shell is gone, so reload picks up the new one.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

function showUpdateBanner(worker: ServiceWorker): void {
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
    worker.postMessage('SKIP_WAITING');
  });
  banner.append(button);

  document.body.append(banner);
}
