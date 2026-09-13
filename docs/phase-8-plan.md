# Phase 8 — Intro animation and splash screen (plan, rev. 1)

A ~2.5 s arcade flourish built from the real piece PNGs, settling into a splash screen with
an HTML title and a `HRÁT` button. No new animation artwork; two static images from the user
(see "Assets requested"). Model policy unchanged: this plan, review, implementation, DoD;
every decision not written here is escalated.

## Assets requested — please supply before implementation starts

1. **Splash illustration** (already generated): portrait, no text, empty upper third and an
   empty band across the lower third. → `public/splash/splash.png` (or `.jpg`; I will keep
   the original and also emit a 1080-px-wide web copy if the file is over ~600 kB).
2. **Intro background plate**: the same scene with a completely empty board, from the Part 2
   prompt. → `public/splash/plate.png`. I will check that the board is empty and sits where
   it sits in the splash; if it drifts, the cut will jump and I will report it rather than
   fudge it.

No third image is needed: pieces, shadows, the flash and the title are CSS/HTML.

## Verified facts (2026-09-13)
- Piece images are plain files: `public/piece-sets/animals/<id>/{light,dark}/{K,Q,R,B,N,P}.png`
  (19 characters) and, for user sets, PNG blobs in IndexedDB (`user-sets.ts`), both loadable
  with `new Image()` under the current CSP (`img-src 'self' data: blob:`).
- `piece-sets.ts` already knows the library (`families[].library.animals`) and the user
  sets; `main.ts` reads user sets before the manager is built — the intro can draw its
  pool from the same data without a second read.
- The app boots in ~1 s on desktop (engine handshake included); the intro runs *over* the
  booting app, so the engine's load time is hidden behind the flourish instead of a
  status line — the intro must never wait for the engine, and the engine never waits
  for the intro.
- CSP: `style-src 'self'` — all animation is in the bundled stylesheet; per-piece
  positions and delays are set through CSSOM (`el.style.setProperty('--x', …)`), which the
  policy does not restrict. No `font-src` today (see decision 12).

## Decisions (veto in review, not during implementation)

### Flow
1. **One overlay, two states.** `<div class="intro">` covers the viewport above `#app`
   from the first paint (it is in the initial markup, so there is no flash of the board).
   State `playing` shows the plate and the landing pieces; state `splash` shows the splash
   image, the title and `HRÁT`. `HRÁT` fades the overlay out (200 ms) and removes it; the
   game underneath is already initialised, so the first move is possible immediately.
2. **Once per session**: `sessionStorage['skm.introShown'] = '1'` after the splash is
   dismissed; a reload within the tab goes straight to the game. (A page reload is the only
   "navigation" the app has.)
3. **Setting** `skm.intro` = `on` (default) | `off`, in `Nastavení` as
   `Intro: zapnuto / vypnuto` next to the other selects, plus a small link on the splash
   itself (`Příště bez intra`) that sets it to `off` — adults will look for it there.
   `off` skips both the animation and the splash: the app opens on the board as today.
4. **Skip**: `pointerdown`, `touchstart`, `keydown` (any key) and `click` on the overlay
   during `playing` jump to `splash` at once (animations cancelled by swapping the state
   class, no timers left behind). During `splash`, `Enter`/`Space` press the focused
   `HRÁT`; other input does nothing.
5. **Reduced motion**: `matchMedia('(prefers-reduced-motion: reduce)')` → straight to
   `splash`, no plate, no landings; the splash itself has no motion beyond the 200 ms
   fade, which is also dropped under reduced motion.
6. **Never blocking**: the intro preloads the plate + the twelve pieces with a
   **1200 ms budget** (`Promise.race` of `Promise.all(loads)` and a timer). Budget missed
   → `splash` directly. The splash image is decorative: the splash renders its title and
   button over a solid colour (`#3b6ea5`, the illustration's sky) at once and the image
   fades in when it arrives — the button is usable before the image.

### The animation (≈ 2.5 s, CSS `animation` + transforms only)
7. **Pool and pick**: two sides drawn at random from the pool `library characters ∪ user
   sets` (the pair sets `farm`/`cburnett` are excluded: `farm` is not a busts set and
   `cburnett` lives in data URIs). Side A (light) and side B (dark) may be the same character,
   exactly as the game allows. A user set contributes its uploaded pieces only; a slot it
   lacks is skipped (fewer landings), so the intro never shows a classic piece.
8. **What lands**: twelve pieces — the dark side's `K Q R B N P` on the far rank, the light
   side's on the near rank — i.e. one full set as the game shows it. Landing spots are a
   **hand-tuned table of twelve points in plate-image coordinates** (percent of width /
   height) plus a per-row scale for the perspective, calibrated once against the delivered
   plate and recorded in `src/intro/landing-spots.ts`. The board in the illustration is in
   perspective, so "squares" are these points, not a computed grid.
9. **Timing** (all from `t = 0` = plate visible): landings at
   `0.20 0.55 0.85 1.05 1.20 1.32 1.42 1.50 1.57 1.63 1.68 1.72` s (spacing shrinks from
   350 ms to 40 ms — the accelerating flurry); each landing is a 380 ms keyframe: drop from
   `translateY(-60vh) scale(0.6)` with the piece's soft shadow ellipse growing underneath,
   impact at 70 % with `scaleX(1.12) scaleY(0.86)` (squash), settle to `scale(1)` with a
   4 px shadow flash (the shadow brightens then dims — the "impact" without particles).
   At `2.05 s` the final beat: the whole stage zooms to `scale(1.03)` over 150 ms while a
   white overlay flashes to 60 % opacity and back (200 ms). At `2.30 s` cross-fade to the
   splash (250 ms). Total ≈ 2.55 s. Numbers live in one constants block for tuning.
10. **Randomness beyond the animals**: landing order is shuffled per run and each drop
    starts from a slightly different horizontal offset (±6 %), so two runs with the same
    animals still differ.

### The splash
11. **Fitting the two images identically** (so the intro→splash cut does not jump): both
    are `<img>` with `object-fit: cover`, `object-position: 50% 45%` in **portrait viewports**
    (aspect < 0.8 — phones; the image is portrait, so cover ≈ contain there); in **landscape
    viewports** they switch to `object-fit: contain` with `height: 100%` centred, and the
    letterbox sides are filled with a vertical gradient sky→ground sampled from the
    illustration's edge colours (two CSS variables set once, by me, from the delivered
    image). Result: on a phone the full picture; on a desktop the full picture in the middle
    with painted sides — the empty upper third and the lower band are never cropped, which
    is what the title and the button rely on. `contain` on 16:9 with a 3:4 image uses ~42 %
    of the width, which is the trade-off I propose over cropping; the alternative
    (cover + accepting the title over the artwork) is a one-line change if you prefer it.
12. **Title** `ŠACH KVÁK MEK!!!` as HTML: two lines (`ŠACH KVÁK` / `MEK!!!`), system
    display stack (`"Arial Rounded MT Bold", "Segoe UI Black", "Trebuchet MS", system-ui,
    sans-serif`, `font-weight: 900`), fill = warm yellow→orange gradient
    (`background-clip: text`), thick dark-brown outline (`-webkit-text-stroke` + layered
    `text-shadow` fallback so browsers without stroke still get the outline), a slight
    counter-clockwise tilt (−3°), size `clamp(2.2rem, 9vw, 5.5rem)`. Positioned in the
    upper third of the *image area* (not the viewport), so it sits in the empty sky in every
    aspect ratio. This is a proposal to iterate on. A real rounded display webfont (e.g.
    Baloo 2, OFL) would look better but needs `font-src 'self'` in the CSP and a bundled
    woff2 — escalated, not done unless you say so.
13. **Button** `HRÁT`: `<button class="play">`, min 64 px tall, `padding 16px 48px`, green
    (`#4caf50`) with a dark outline and a soft shadow, `font-size clamp(1.4rem, 5vw, 2.2rem)`,
    `autofocus` when the splash appears, visible focus ring, `Enter`/`Space` work natively.
    Placed in the lower band of the image area. Below it, small: `Příště bez intra` (a
    `<button>` styled as a link) per decision 3.
14. **Accessibility**: the overlay is `role="dialog" aria-modal="true" aria-label="Úvodní
    obrazovka"`; focus is moved to `HRÁT` on splash; `Escape` also starts the game (same as
    `HRÁT`); the board underneath is `inert` while the overlay is up.

## Files
```
public/splash/splash.(png|jpg), public/splash/plate.png   NEW  assets from the user
src/intro/intro.ts            NEW  state machine: preload → playing → splash → done; skip; reduced motion; budget
src/intro/landing-spots.ts    NEW  the twelve calibrated points + row scales + timing constants
src/intro/pool.ts             NEW  builds the random pool from the library + user sets, picks two sides, resolves URLs
src/styles/intro.css          NEW  overlay, keyframes, title, button, portrait/landscape fitting
src/main.ts                   MOD  overlay markup, setting, wiring (after user sets + manifest are known)
src/ui/controls.ts            MOD  none expected; the intro select is wired in main.ts like the piece selects
README.md                     MOD  a line on the intro + the setting
docs/security-review.md       MOD  checklist run (no new sinks: URLs come from validated ids and our own object URLs)
```
Not touched: `game-controller.ts`, `engine.ts`, `piece-sets.ts` internals, `feedback.ts`,
`difficulty.ts`, `board-bridge.ts`, `tsconfig.json`, `package.json`.

## Commits
1. `Phase 8: plan`  2. `Phase 8: splash screen`  3. `Phase 8: intro animation`
4. `Phase 8: DoD results`  → Pages deploy.

## Explicitly NOT in this phase
Victory/defeat animations (B9/B18), `victoryCry` (B16), a splash composed from the selected
set's kings (B16), sound, replay, lessons, any gameplay/engine/ladder change, a webfont
(unless approved under decision 12), a service worker or any preloading of the game itself.

## Definition of Done (as in the brief, with how each is executed)
1. Intro plays on load, ≈ 2.5 s (timestamps logged in a temporary hook and removed), and
   three consecutive reloads show different animals (the pair is printed in the hook).
2. Click, tap (touch emulation), and a key press each skip immediately at t ≈ 0.3 s and
   at t ≈ 1.5 s — the splash is up within one frame, no landing continues.
3. `prefers-reduced-motion: reduce` (DevTools emulation) → no plate, splash directly.
4. Network throttled to "Slow 3G": splash (solid sky + title + button) within ≈ 1.3 s of
   the HTML; no empty board, no blank; image arrives later.
5. A user-uploaded set is picked for the intro (forced pool in the hook once, then a random
   run that includes it).
6. `skm.intro = off` → reload → no intro, no splash; `on` again → intro returns; the
   splash link sets `off`.
7. Title with `Š`/`Á`/`É` rendered (screenshot), button focusable (Tab), `Enter` and `Space`
   start the game, sizes at 360 px and 1600 px widths compared.
8. 9:16 (360×640), 3:4 (768×1024), 16:9 (1600×900): title in the empty sky, button in the
   empty band, nothing cropped (screenshots of all three, intro plate and splash).
9. Real phone on the LAN preview URL — **you** or I with the phone in hand; I will report
   the result honestly if it is not mine to test.
10. `npm run build` strict; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty;
    security checklist re-run (new asset loads are same-origin files and our own blob URLs).

## Addendum after the assets arrived (2026-09-13)

- Assets: `assets/source/prazdna_sachovnice.png` (plate) and `assets/source/splash_zviratka.png`
  (splash without text) are the sources, 1024×1536 each; the app ships JPEG copies
  `public/splash/plate.jpg` (248 kB) and `public/splash/splash.jpg` (307 kB), quality 86.
  `assets/source/splash_screen.png` (an earlier version with baked-in text) is kept as a
  style reference for the title only and is not shipped.
- The two boards do **not** share geometry (user's note): landings use the plate's board
  (measured trapezoid, `landing-spots.ts`), and the cut is a 450 ms cross-fade with a camera
  push-in — the plate drifts from scale 1.03 to 1.09 while the splash settles from 1.06 to
  1 — so the different board reads as camera movement. No warping or cropping.
- **Pre-game state (user request during the phase):** after the splash the game is set up
  but nothing moves. The status line reads "Vyber si, za koho hraješ, a dej Hrát!", the
  `Nová hra` button becomes a pulsing `Hrát!`; the engine's first move (when it has white)
  waits for `Hrát!`; a human playing white starts simply by moving. `Nová hra` returns to
  the pre-game state, so the character/colour can be changed calmly before every game.
  `GameController.started` + `startPlaying()`, no other controller change.
- 16 landings (the back rank `R N B Q K B N R` of both sides) instead of the planned 12 —
  one real starting formation; the flurry spacing shrinks from 330 ms to 35 ms.
- Title and button are anchored to the **viewport** (top/bottom 2.5 vh), not to the image
  box: in a 3:4 viewport the cover-fitted 2:3 picture overflows 64 px top and bottom and
  the title would have been cut (found in DoD 8).
- The overlay lives outside `#app` (a sibling in `<body>`): `#app` is `inert` while the
  overlay is up, and an overlay inside it would have been inert too (found in DoD 7 — a
  real click on `HRÁT` did nothing until this fix).
- `will-change` dropped from the pieces (no visible benefit; it made the debugging
  screenshots misleading).

## DoD results (executed 2026-09-13)

Tested on the Vite dev server in Chromium (real Chrome window + the in-app pane). Note on
method: a background/occluded tab throttles timers and freezes CSS animations, and
screenshots taken mid-animation were unreliable; timings and positions were therefore
read from the DOM (`getAnimations()`, bounding rects) and the final frame was captured
with every landing animation seeked to its end.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Plays on load, ≈ 2.5 s, different animals | PASS | Recorder in the page: plate up at ≈ 0.35 s after boot, 16 landings between 0.20 and 1.91 s, beat at 2.05 s, cross-fade at 2.30 s (450 ms). Six consecutive reloads: žáby/tučňáci, pštrosi/kočky, lamy/slepice, kravky/kočky, oslíci/hadi, user set/žížaly |
| 2 | Skip on any input | PASS | `keydown` (letter), `pointerdown` and `click` during `playing` → `intro-splash` within the same tick; timers cleared, the stage removed |
| 3 | Reduced motion | PASS by code path, not driven | `matchMedia('(prefers-reduced-motion: reduce)')` → `showSplash()` directly (no plate, no timers); the CSS also disables every intro/splash animation under the media query. I could not toggle the OS setting from here — please flip Windows "Show animations" off once if you want it seen |
| 4 | Slow network | PASS (fallback path) | The 1200 ms budget races the plate + 16 piece loads; a missing plate (`plate.jpg` renamed, dev server answers HTML) → splash at once with title + button on the sky colour. A real Slow-3G throttle was not available in the pane; the budget path is the same code |
| 5 | User set in the intro | PASS | A 12-piece user set joined the pool and was drawn as the dark side on the 6th reload (`blob:` sources on the far rank) |
| 6 | Setting persists | PASS | `Intro: vypnuto` → reload → no overlay, no splash; `zapnuto` → intro back; `Příště bez intra` on the splash sets `skm.intro = off` and updates the select |
| 7 | Real HTML title/button | PASS | `ŠACH KVÁK` / `MEK!!!` render with diacritics (screenshots at 360, 768, 1600 px); `HRÁT` is a `<button>` (tabIndex 0, focus-visible ring), receives focus when the splash appears, Enter/Space native, Escape also starts; a real pane click on it removes the overlay and clears `inert` |
| 8 | 9:16, 3:4, 16:9 | PASS | 360×640: title 26–128 px, button 523–587 px, all inside; 768×1024: title 6–204, button 877–957 (image box −64…1088, i.e. only picture overflow); 1600×900: image 500–1100 wide with the foliage gradient beside it, title 2–229, button 756–836 |
| 9 | Real phone via LAN | NOT EXECUTED by me | http://192.168.68.40:4173 — please give it one look on the phone (intro, tap-to-skip, `HRÁT`, then `Hrát!`) |
| 10 | Build, debug, security | PASS | `tsc` strict; no debug hooks were added this phase (`git grep` empty); checklist run appended to `docs/security-review.md` |

Deviations (all above): pre-game `Hrát!` flow (user request), 16 landings, viewport-anchored
title/button, overlay outside `#app`, JPEG asset copies, `will-change` removed, the plan's
"two commits" became one feature commit.
