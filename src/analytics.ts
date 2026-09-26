/**
 * Cloudflare Web Analytics beacon (public build only; `vite.config.ts` passes the site token,
 * the dev site and local builds get an empty one and load nothing).
 *
 * The owner's own browsers opt out once so their testing does not count as visits: opening
 * the site with `#bezmereni` remembers the choice in `localStorage`, `#mereni` undoes it.
 * The fragment never leaves the browser (the beacon strips it) and is removed from the
 * address bar right away, so a shared link cannot carry it by accident.
 */
const OPT_OUT_KEY = 'skm.noAnalytics';

/** Loads the beacon unless this browser opted out; returns whether it loaded. */
export function startAnalytics(token: string, storage: Storage | null): boolean {
  if (!token) return false;
  applySwitch(storage);
  // typed into the address bar of an open tab: no reload happens by itself
  window.addEventListener('hashchange', () => {
    if (applySwitch(storage)) location.reload();
  });
  if (storage?.getItem(OPT_OUT_KEY) === '1') return false;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token });
  document.body.append(script);
  return true;
}

/** Handles `#bezmereni` / `#mereni` in the address bar; true when it was one of them. */
function applySwitch(storage: Storage | null): boolean {
  const hash = location.hash;
  if (hash !== '#bezmereni' && hash !== '#mereni') return false;
  try {
    if (hash === '#bezmereni') storage?.setItem(OPT_OUT_KEY, '1');
    else storage?.removeItem(OPT_OUT_KEY);
  } catch {
    // blocked storage: the switch simply does not stick
  }
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
