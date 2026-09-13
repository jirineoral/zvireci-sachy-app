/**
 * Intro animation + splash screen (Phase 8). One overlay, states `preload` → `playing` →
 * `splash` → gone. Pure CSS animation (classes + custom properties set through the CSSOM,
 * so the CSP's `style-src 'self'` is never involved); the page underneath keeps booting.
 *
 * Skips: any pointer/touch/key input during `playing` jumps to `splash`; reduced motion
 * or a missed preload budget go to `splash` directly; the setting `skm.intro = off` and
 * `sessionStorage['skm.introShown']` remove the overlay before anything is shown.
 */
import { FAR_RANK, FORMATION, NEAR_RANK, TIMING, type LandingSpot } from './landing-spots';
import type { IntroPool, IntroSide, Role } from './pool';

export const INTRO_STORAGE_KEY = 'skm.intro';
export const INTRO_SESSION_KEY = 'skm.introShown';

export interface IntroOptions {
  overlay: HTMLElement;
  /** The element to make inert while the overlay is up. */
  app: HTMLElement;
  baseUrl: string;
  storage: Storage | null;
  session: Storage | null;
  /** Called when the player asks never to see the intro again. */
  onDisable: () => void;
}

export interface IntroController {
  /** Starts the intro (or the splash) with the animals from `pool`; resolves when the overlay is gone. */
  start(pool: IntroPool | null): Promise<void>;
  /** Removes the overlay at once (setting off / already shown this session). */
  dismiss(): void;
}

export function readIntroSetting(storage: Storage | null): boolean {
  try {
    return storage?.getItem(INTRO_STORAGE_KEY) !== 'off'; // default on
  } catch {
    return true;
  }
}

export function writeIntroSetting(storage: Storage | null, enabled: boolean): void {
  try {
    storage?.setItem(INTRO_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (err) {
    console.warn('Could not persist the intro setting', err);
  }
}

function shownThisSession(session: Storage | null): boolean {
  try {
    return session?.getItem(INTRO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markShown(session: Storage | null): void {
  try {
    session?.setItem(INTRO_SESSION_KEY, '1');
  } catch {
    // session storage blocked: the intro simply plays again on reload
  }
}

export function createIntro(opts: IntroOptions): IntroController {
  const { overlay, app } = opts;
  let finished = false;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((r) => {
    resolveDone = r;
  });

  const remove = (): void => {
    if (finished) return;
    finished = true;
    app.inert = false;
    overlay.remove();
    resolveDone?.();
  };

  // ---- splash ----------------------------------------------------------------------------
  const splash = document.createElement('div');
  splash.className = 'splash';
  const splashImg = document.createElement('img');
  splashImg.className = 'splash-bg';
  splashImg.alt = '';
  splashImg.decoding = 'async';
  const title = document.createElement('h1');
  title.className = 'splash-title';
  // The outline is drawn by a ::before copy of the text (data-text) behind the gradient
  // fill: iOS Safari paints -webkit-text-stroke over a background-clip:text fill, which
  // leaves stroke lines inside the letters.
  const line1 = document.createElement('span');
  line1.className = 'splash-word';
  line1.textContent = 'ZVÍŘECÍ';
  line1.dataset.text = 'ZVÍŘECÍ';
  const line2 = document.createElement('span');
  line2.className = 'splash-word';
  line2.textContent = 'ŠACHY';
  line2.dataset.text = 'ŠACHY';
  const line3 = document.createElement('span');
  line3.className = 'splash-subtitle';
  line3.textContent = '(nejen) pro děti';
  title.append(line1, line2, line3);
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'splash-play';
  play.textContent = 'HRÁT';
  const never = document.createElement('button');
  never.type = 'button';
  never.className = 'splash-never';
  never.textContent = 'Příště bez intra';
  const bottom = document.createElement('div');
  bottom.className = 'splash-bottom';
  bottom.append(play, never);
  const splashFit = document.createElement('div');
  splashFit.className = 'intro-fit';
  splashFit.append(splashImg);
  // Title and button are placed against the viewport, not the image box: in a 3:4 viewport
  // the cover-fitted picture overflows top and bottom, and both must stay on screen.
  splash.append(splashFit, title, bottom);
  splashImg.addEventListener('load', () => splashImg.classList.add('loaded'));

  const startGame = (): void => {
    if (finished) return;
    markShown(opts.session);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      remove();
      return;
    }
    overlay.classList.add('intro-leaving');
    window.setTimeout(remove, TIMING.splashFadeOut);
  };
  play.addEventListener('click', startGame);
  never.addEventListener('click', () => {
    writeIntroSetting(opts.storage, false);
    opts.onDisable();
    startGame();
  });

  const showSplash = (): void => {
    if (finished || overlay.classList.contains('intro-splash')) return;
    clearTimers();
    splashImg.src = `${opts.baseUrl}splash/splash.jpg`;
    if (!splash.isConnected) overlay.appendChild(splash);
    overlay.classList.remove('intro-playing', 'intro-preload');
    overlay.classList.add('intro-splash');
    // Focus the button once it is visible; Enter/Space work natively, Escape starts too.
    window.setTimeout(() => play.focus(), 50);
  };

  // ---- playing ---------------------------------------------------------------------------
  const stage = document.createElement('div');
  stage.className = 'intro-stage';
  const plate = document.createElement('img');
  plate.className = 'intro-plate';
  plate.alt = '';
  plate.decoding = 'async';
  const pieces = document.createElement('div');
  pieces.className = 'intro-pieces';
  const flash = document.createElement('div');
  flash.className = 'intro-flash';
  const stageFit = document.createElement('div');
  stageFit.className = 'intro-fit';
  stageFit.append(plate, pieces);
  stage.append(stageFit, flash);

  let timers: number[] = [];
  const clearTimers = (): void => {
    for (const t of timers) window.clearTimeout(t);
    timers = [];
  };
  const later = (ms: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, ms));
  };

  const skipHandler = (event: Event): void => {
    if (!overlay.classList.contains('intro-playing')) return;
    if (event instanceof KeyboardEvent && (event.key === 'Tab' || event.key === 'Shift' || event.altKey || event.ctrlKey || event.metaKey)) return;
    showSplash();
  };
  overlay.addEventListener('pointerdown', skipHandler);
  overlay.addEventListener('touchstart', skipHandler, { passive: true });
  overlay.addEventListener('click', skipHandler);
  document.addEventListener('keydown', (event) => {
    if (finished) return;
    if (overlay.classList.contains('intro-playing')) skipHandler(event);
    else if (overlay.classList.contains('intro-splash') && event.key === 'Escape') {
      event.preventDefault();
      startGame();
    }
  });

  /** Loads one image; resolves false on error so a broken file never blocks. */
  const load = (url: string): Promise<boolean> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

  const shuffle = <T>(list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const buildLandings = (light: IntroSide, dark: IntroSide): { el: HTMLElement; spot: LandingSpot; url: string }[] => {
    const out: { el: HTMLElement; spot: LandingSpot; url: string }[] = [];
    const add = (side: IntroSide, spots: LandingSpot[]): void => {
      spots.forEach((spot, file) => {
        const role: Role = FORMATION[file];
        const url = side.urls[role];
        if (!url) return; // a user set without this piece: that square stays empty
        const el = document.createElement('div');
        el.className = `intro-piece intro-piece-${spot.rank}`;
        const img = document.createElement('img');
        img.alt = '';
        img.src = url;
        el.appendChild(img);
        el.style.setProperty('--x', `${(spot.x * 100).toFixed(2)}%`);
        el.style.setProperty('--y', `${(spot.y * 100).toFixed(2)}%`);
        el.style.setProperty('--size', `${(spot.size * 100).toFixed(2)}%`);
        el.style.setProperty('--drift', `${(Math.random() * 12 - 6).toFixed(1)}%`);
        out.push({ el, spot, url });
      });
    };
    add(dark, FAR_RANK);
    add(light, NEAR_RANK);
    return out;
  };

  const play_ = async (pool: IntroPool): Promise<void> => {
    const { light, dark } = pool.draw();
    const landings = buildLandings(light, dark);
    const urls = Array.from(new Set([`${opts.baseUrl}splash/plate.jpg`, ...landings.map((l) => l.url)]));
    const budget = new Promise<false>((r) => window.setTimeout(() => r(false), TIMING.preloadBudgetMs));
    const loaded = await Promise.race([Promise.all(urls.map(load)).then((ok) => ok.every(Boolean)), budget]);
    if (finished || overlay.classList.contains('intro-splash')) return; // skipped while loading
    if (!loaded) {
      console.warn('Intro: images not ready within the budget; showing the splash');
      showSplash();
      return;
    }
    plate.src = `${opts.baseUrl}splash/plate.jpg`;
    pieces.replaceChildren(...landings.map((l) => l.el));
    if (!stage.isConnected) overlay.appendChild(stage);
    overlay.classList.remove('intro-preload');
    overlay.classList.add('intro-playing');

    // Landing order: far rank first in shuffled file order, then the near rank, so the
    // flurry ends on the player's own side; the same animals still land differently.
    const order = [...shuffle(landings.filter((l) => l.spot.rank === 'far')), ...shuffle(landings.filter((l) => l.spot.rank === 'near'))];
    order.forEach((l, i) => {
      const at = TIMING.landings[Math.min(i, TIMING.landings.length - 1)];
      later(at, () => l.el.classList.add('landed'));
    });
    later(TIMING.beat, () => overlay.classList.add('intro-beat'));
    later(TIMING.crossfade, () => {
      showSplash();
      overlay.classList.add('intro-crossfade');
      later(TIMING.crossfadeDuration + 50, () => stage.remove());
    });
  };

  return {
    async start(pool) {
      if (finished) return;
      app.inert = true;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try {
        if (!pool || reduced) showSplash();
        else await play_(pool);
      } catch (err) {
        console.error('Intro failed; showing the splash', err);
        showSplash();
      }
      await done;
      pool?.release();
    },
    dismiss: remove,
  };
}

export { shownThisSession };
