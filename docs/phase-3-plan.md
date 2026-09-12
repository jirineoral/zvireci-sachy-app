# Phase 3+4 — Swappable piece sets, shipped with the `farm` artwork (plan, rev. 2)

Rev. 2 applies the review of rev. 1: C1 `background-size` verified + dialog sizing DoD,
C2 pawn:king ratio guard with a documented per-role compression, C3 de-halo gated to
light fringe pixels with an erosion fallback, C4 wasm pre-check also validates
`content-length`, C5 cburnett is the built-in set (no extracted SVGs), C6 commit 2 ships
cburnett-only `sets.json`, C7 DoD 2 uses a temporarily long `movetime`. Approved for
implementation without a further plan review.

## Context
Phases 1–2 are done (`b4c0d93`): chess.js rules, chessground view, Stockfish opponent,
promotion dialog, undo, side selection. Piece artwork is still baked in: `src/styles/pieces.css`
imports chessground's cburnett data-URI CSS. This phase turns piece artwork into **data**
(`public/piece-sets/<id>/` + one entry in `sets.json`, zero `.ts` changes per new set) and ships
the first real set, `farm` — cream goats (white) vs. green frogs (black) — extracted from the
two AI-generated sheets already sitting in `assets/source/goats.png` and `frogs.png`
(1958×803 each, six pieces left→right: pawn, knight, bishop, rook, queen, king, on white).

Part C folds in three carried-over review items (B12 loop bound, B10 engine-failure
detection, B11 backlog note), each as its own commit.

Model policy unchanged. Deliverable of the planning step: this document as
`docs/phase-3-plan.md`, committed as `Phase 3: plan (rev. 2)`; per the rev. 1 review,
implementation follows directly. The next review is on the contact sheet, the diff and the
DoD results.

## Verified facts (2026-09-12, this machine)
- `assets/source/goats.png`, `assets/source/frogs.png` exist (untracked), 1958×803 RGB(A) PNG,
  plain white background, every piece has a continuous dark-brown outline; the bishop's
  arrow tip comes within ~5 px of the rook on both sheets; both sheets contain **enclosed**
  white pockets (inside the bow, between the horse's legs) that a corner flood-fill cannot
  reach, while pure-white details that must survive also exist (eye whites; goat mitre).
- Tooling: Python 3.13.1 + numpy 2.5.1 present; **no Pillow**, no scipy/cv2/skimage, no
  ImageMagick, no `sharp`. `pip index versions pillow` → latest 12.3.0.
- chessground's cburnett CSS: 12 rules `.cg-wrap piece.<role>.<color> { background-image:
  url('data:image/svg+xml;base64,…') }`; each SVG is `width="45" height="45"` with **no
  viewBox**. The cburnett set is © Colin M.L. Burnett, CC BY-SA 3.0.
- **Piece sizing (C1):** `chessground.base.css` sets on `.cg-wrap piece`:
  `width: 12.5%; height: 12.5%; background-size: cover;` and nothing for
  `background-position` / `background-repeat` (defaults `0 0` / `repeat`). For a square
  image in a square box, `cover` scales the image to exactly the box, so a 256×256 PNG and a
  45×45 SVG are sized identically and nothing repeats. The Phase 2 dialog override
  (`.promotion-dialog .cg-wrap piece { position: static; display: block; width: 64px;
  height: 64px; pointer-events: none }`) does not touch `background-*`, so the same sizing
  applies in the dialog. Belt and braces: `farm/pieces.css` declares
  `background-size: contain; background-position: center; background-repeat: no-repeat`
  on `.cg-wrap piece` (equivalent for square images, explicit for future non-square
  slips) — in the set's stylesheet, not in `src/`.
- The `.board` div *is* the `.cg-wrap` element (chessground adds the class), so
  `--board-light/--board-dark` are set on that element. The promotion dialog's buttons sit
  inside their own `.cg-wrap` wrapper, so any `.cg-wrap piece.*` stylesheet reaches them.
- Vite serves `public/` verbatim in dev and copies it into `dist/`; relative `url(wK.png)`
  inside `public/piece-sets/farm/pieces.css` resolves against the CSS file's URL.

## Decisions taken in this plan (veto in review, not during implementation)
1. **Tooling: Python + Pillow.** `pip install pillow==12.3.0` (user site-packages), pinned in
   `scripts/requirements.txt`; numpy already present. Reasons: flood fill with tolerance,
   alpha handling and contact-sheet rendering are all first-class in Pillow; no native build
   step, no 30 MB `sharp` in `node_modules`. ImageMagick is not installed.
2. **Stylesheet swap = replace a `<link>`.** `src/styles/pieces.css` (bundled cburnett data
   URIs) stays as the **built-in fallback** and loads first; the selected set is a
   `<link rel="stylesheet" data-piece-set="<id>" href="{BASE_URL}piece-sets/<id>/pieces.css">`
   appended to `<head>` **after** the bundled CSS, so equal-specificity rules from the set
   win. Switching creates the new link, waits for its `load`, then removes the old one (no
   flash of missing pieces). A `error` on the link logs `console.error` and removes it → the
   bundled cburnett rules show through (requirement 5).
3. **The controller is not involved.** Piece sets are pure view state: a new module
   `src/piece-sets.ts` owns manifest loading, selection, persistence, `<link>` swapping and
   the two CSS variables; `main.ts` wires the `<select>`. `game-controller.ts`,
   `board-bridge.ts` and `engine.ts` are untouched by the mechanism (Part A), which is
   what makes requirements 3 and DoD 1–2 true by construction.
4. **Default set = first entry of `sets.json`.** `farm` is listed first, so an empty
   `localStorage` opens on the frogs (requirement 8) without any set id in `src/`
   (requirement 1). Unknown stored id → `console.warn` + first entry (requirement 5).
5. **Persistence key** `skm.pieceSetId` in `localStorage`, every access in `try/catch`
   (private mode / blocked storage → behave as first visit).
6. **Manifest failure** (fetch rejects, non-2xx, invalid JSON, not an array, entry missing
   `id`/`board`): `console.error`, the piece-set `<select>` shows one disabled option
   "Klasické (vestavěné)", no `<link>` is added, board variables stay at their CSS
   defaults → playable classic board. Entries that fail validation are dropped
   individually with a `console.warn`; if none survive, treat as manifest failure.
7. **cburnett is the built-in set, not an extracted one (C5).** Its `sets.json` entry
   carries `"stylesheet": null`; selecting it **removes** the current set `<link>` so the
   bundled `src/styles/pieces.css` (cburnett data URIs) shows through — the same code path
   as the stylesheet-failure fallback. No `public/piece-sets/cburnett/` folder, no
   extraction script, no derivative SVG files. `sets.json` field semantics: `stylesheet`
   absent → `piece-sets/<id>/pieces.css` (the ordinary case); `stylesheet: null` → built-in.
   This is the one named exception to "a set is a folder plus a manifest entry"; it is
   documented in `CONTRACT.md`. CC BY-SA 3.0 attribution for cburnett stays in README and
   `CONTRACT.md`.
8. **Farm board palette** exactly as the brief: light `#dce6f0`, dark `#8fa3bd`.
9. **Extraction algorithm** (Part B below): column-projection segmentation with hand-set
   cut positions; corner flood-fill with tolerance; **enclosed-pocket** removal by explicit
   per-piece seed list; edge de-halo from luminance; one global scale from the tallest of
   all twelve pieces; horizontal centring on the **base** (pedestal) rather than the full
   bounding box, plus optional per-piece nudges. All constants live in the script.
10. **"Trim each file's alpha"** is read as: no opaque fringe or leftover background outside
    the silhouette; the canvas stays 256×256 (the contract's square canvas with a shared
    baseline requires it). Say so in review if a literal bounding-box trim was meant.
11. **The piece-set `<select>` is not disabled during the promotion dialog** (the dialog is
    modal, and switching sets while it is open is harmless); it is not part of
    `renderControls()`.
12. **B10 fix: reachability + size pre-check, longer handshake (C4).** Before creating the
    worker, `engine.ts` issues `fetch(wasmUrl, { method: 'HEAD' })` with a 5 s abort:
    - network error or non-OK other than 405/501 → fail immediately
      (`Engine wasm not reachable: <status>`);
    - 405/501 (host refuses HEAD) → unknown, proceed;
    - OK → read `content-length`; if present and outside
      `ENGINE_WASM_BYTES ± 5 %` → fail immediately (`Engine wasm has unexpected size`);
      absent → unknown, proceed.
    `ENGINE_WASM_BYTES = 7_295_411` lives next to the worker URL in `main.ts`-adjacent
    config (passed into `createEngine` as an option) with a comment that it must be updated
    when the engine version changes. The handshake timeout is **raised from 10 s to 30 s**
    (deliberate: a legitimate 7 MB load on a slow mobile link must not disable a working
    engine). Remaining corruption modes (right size, bad bytes) still fall through to the
    30 s handshake; accepted, because the pre-check now covers missing, empty, truncated
    and wrong-file cases in well under a second. The status suffix stays "— načítám
    engine…"; no new UI state.
13. **B12:** `beginTransition()` re-cancels at most twice; on the third iteration it logs
    `console.error('beginTransition: search kept restarting; breaking out')` and returns.
14. **B11:** append to `docs/BACKLOG.md` only (vendoring the two engine files, dropping the
    dependency + postinstall; GPL note per B6). No build change.
15. **Temporary test hook**: DoD 7 (promotion dialog in both sets) re-uses the Phase 2
    `debugLoadFen` procedure — added for the test, removed before commit, grepped out
    (DoD 17). No other DoD item needs it.

## Files
```
assets/source/goats.png, frogs.png          COMMIT (source material, already present)
public/piece-sets/sets.json                 NEW  manifest (shape from the brief; farm first, cburnett with "stylesheet": null)
public/piece-sets/CONTRACT.md               NEW  asset rules (Part B) + attribution + the built-in exception
public/piece-sets/farm/pieces.css           NEW  12 rules → wK.png … (+ explicit background sizing)
public/piece-sets/farm/{w,b}{K,Q,R,B,N,P}.png       NEW  256×256 RGBA, produced by scripts/extract-pieces.py
scripts/extract-pieces.py                   NEW  Python + Pillow + numpy; also writes the contact sheet
scripts/requirements.txt                    NEW  pillow==12.3.0
docs/piece-contact-sheet.png                NEW  quality gate output
docs/phase-3-plan.md                        NEW  this file
src/piece-sets.ts                           NEW  manifest / selection / persistence / stylesheet swap
src/main.ts                                 MOD  piece-set <select> in .controls; initPieceSets()
src/styles/app.css                          MOD  nothing beyond the select already styled by `.controls select`
src/engine.ts                               MOD  B10 (pre-check incl. size + 30 s); createEngine gains an options object { expectedWasmBytes }
src/game-controller.ts                      MOD  B12 (bounded loop)
docs/BACKLOG.md                             MOD  B11
README.md                                   MOD  piece sets + attribution paragraph
```
Not touched: `board-bridge.ts`, `game-status.ts`, `difficulty.ts`, `ui/*`, `tsconfig.json`,
`package.json` (no new npm dependency).

## Part A — mechanism

### `sets.json`
The brief's shape, `farm` first, then `cburnett` with the extra field `"stylesheet": null`
(C5). Commit 2 ships it with the `cburnett` entry only (C6); commit 3 adds `farm` at the
top together with its folder.

### `src/piece-sets.ts`
```ts
export interface PieceSet {
  id: string; name: string; pair: string;
  board: { light: string; dark: string };
  stylesheet: string | null;      // resolved: `${baseUrl}piece-sets/${id}/pieces.css`, or null = built-in
}
export interface PieceSetManager {
  readonly sets: readonly PieceSet[];        // [] when the manifest failed
  readonly currentId: string | null;         // null = built-in fallback
  select(id: string): void;                  // no-op with console.warn for unknown ids
}
export async function initPieceSets(opts: {
  baseUrl: string;                            // import.meta.env.BASE_URL
  boardEl: HTMLElement;                       // the .board / .cg-wrap element (CSS variables)
  storage: Storage | null;                    // window.localStorage, or null when inaccessible
}): Promise<PieceSetManager>
```
- Load: `fetch(\`${baseUrl}piece-sets/sets.json\`, { cache: 'no-cache' })` → validate
  (array; each entry `id` non-empty string matching `/^[a-z0-9-]+$/`, `name` string,
  `board.light/dark` strings) → dropped/failed per decision 6.
- Initial choice: stored id if present in `sets`, else `sets[0]` (warn if a stored id was
  present but unknown). Apply = `applyStylesheet(id)` + `boardEl.style.setProperty('--board-light', …)`/`--board-dark`.
- `applyStylesheet(set)`: if `set.stylesheet === null` → remove any `link[data-piece-set]`
  (built-in shows through). Otherwise build `<link>`; on `load` remove any previous
  `link[data-piece-set]`; on `error` log and remove the new link (previous set — or the
  bundled fallback — stays).
- `select(id)`: apply + persist (`storage.setItem(KEY, id)` in try/catch).
- Board variables on manifest failure: not touched (CSS defaults from `board.css`).

### `main.ts`
- Markup: `<label>Figurky <select class="piece-set"></select></label>` appended to the
  existing `.controls` row (after "Hraju za"). Looked up with `requireElement`.
- After constructing the controller:
  ```ts
  void initPieceSets({ baseUrl: import.meta.env.BASE_URL, boardEl, storage: safeLocalStorage() })
    .then((sets) => populatePieceSetSelect(select, sets))   // options = sets.map(name); disabled single option on failure
    .catch((err) => console.error('piece sets failed', err));
  ```
  `select.addEventListener('change', () => sets.select(select.value))`. The board is
  playable before the manifest resolves (bundled cburnett), and the swap happens whenever
  it resolves — no game state involved.

### Vite / paths
`piece-sets/<id>/pieces.css` uses `url(wK.png)` etc.; browsers resolve relative to the
stylesheet URL, so no base-path logic exists in `src/`. Only `pieces.css` knows extensions.

## Part B — artwork: `scripts/extract-pieces.py`

Run: `python scripts/extract-pieces.py` (from the repo root) → writes the 12 PNGs, the
contact sheet, and a debug overlay `assets/source/_debug/*.png` (git-ignored) used while
tuning. Deterministic: same inputs + same constants → byte-identical outputs (Pillow PNG
encoder, fixed `compress_level`, no timestamps).

Pipeline, per sheet then jointly:
1. **Segment** columns: non-white mask (sum|rgb−255| > 30) → column occupancy → runs
   separated by gaps ≥ 8 px; expect 6 runs. Because the bishop's arrow nearly touches the
   rook, the script has `CUTS = { 'goats': [x1..x5], 'frogs': [x1..x5] }` hand-set x
   positions that override the automatic split when it does not yield exactly six runs
   (initial values taken from the automatic run and adjusted by eye; recorded in comments).
   Order left→right maps to `P N B R Q K`.
2. **Background removal**: flood fill from the four sheet corners plus points every 200 px
   along all four edges, tolerance `sum|rgb−seed| ≤ 40` (cream body ≈ 78 from white, so it is
   never eaten; outlines stop the fill). The filled region = background.
3. **Enclosed pockets**: connected components of near-white pixels (`sum|rgb−255| ≤ 15`)
   not in the background. The debug overlay numbers each pocket with its area/centroid.
   `POCKETS_TO_CLEAR = { 'wN': [...], 'bN': [...], 'wB': [...], 'bB': [...], … }` lists, per
   piece, the seed points (source coordinates) of pockets that are background (bow
   interior, between legs). Everything not listed stays (eye whites, mitre, teeth).
   Decision rule when tuning: a pocket is background iff it is visibly the sheet's white
   showing through, never a drawn white surface. Recorded in the script with comments.
4. **Alpha + de-halo (C3)**: alpha = 0 for background+cleared pockets, 255 elsewhere. Then
   only within the 2 px band of opaque pixels adjacent to transparency, and **only for
   pixels lighter than `HALO_LUMA_MIN = 140`** (the outline is ≈ 40–70; the anti-aliased
   fringe is 150–250), set alpha = clamp(255 − luminance) and RGB = the piece's outline
   colour (median of its darkest 5 % pixels). Dark outline pixels are never touched, so the
   silhouette keeps its full-strength edge. Fallback selectable by one constant
   `DEHALO_MODE = 'gated' | 'erode'`: `'erode'` = plain 1 px erosion of the alpha mask, no
   recolouring. The mode actually shipped is recorded in the script comment and in the DoD.
5. **Global scale with a ratio guard (C2)**: `tallest = max(bbox height of all 12 alpha
   masks)`; base `scale = 0.90 × 256 / tallest`. Before writing anything the script prints,
   per side, every role's height ratio to its king. If pawn:king < 0.55 on either side the
   script applies `ROLE_HEIGHT_FACTOR` — one table applied identically to both sides, e.g.
   `{ P: 1.25, N: 1.08, B: 1.08, R: 1.05, Q: 1.0, K: 1.0 }` — and prints the resulting
   ratios; it asserts the ordering `P < N ≈ B < R < Q < K` still holds (`N`/`B` within 5 % of
   each other) and aborts otherwise. Initial factors are an estimate (source pawn ≈ 43 % of
   king → ~1.25 lifts it to ≈ 54–56 %); the final values are tuned once against the
   contact sheet and recorded with a comment. This is the documented per-role adjustment
   the contract permits; without the guard triggering, the factors stay at 1.0.
   Resizing: Lanczos on premultiplied alpha (no dark fringes).
6. **Placement** on a 256×256 transparent canvas: bottom of the alpha bbox at
   `y = 256 − 12` (shared baseline, 12 px ≈ 4.7 % margin); horizontally centred on the
   **base**: the base bbox = columns with alpha in the bottom 12 % of the piece's rows;
   its centre goes to x = 128. `NUDGE_X = { 'wN': 0, … }` per-piece pixel overrides for the
   visual pass (expected non-zero for the knights and bishops, whose bows/heads extend right).
   A piece wider than 256 after scaling would be an error (assert; none is — the widest,
   the knights, scale to ≈ 125 px).
7. **Save** `public/piece-sets/farm/<code>.png` (RGBA, `optimize=True`, `compress_level=9`).
8. **Contact sheet** `docs/piece-contact-sheet.png`: row 1 = the 12 pieces at **40 px
   square** on farm **light** squares, row 2 = the same on farm **dark** squares (outline
   continuity must hold on both — C3), row 3 = row 1 converted to greyscale (Pillow
   `convert('L')` after compositing — equivalent to `filter: grayscale(1)`), row 4 = the
   same twelve at 96 px for reference. Order wP wN wB wR wQ wK bP bN bB bR bQ bK, labels
   under each column. This file is shown in the review.

### `public/piece-sets/farm/pieces.css`
```css
.cg-wrap piece { background-size: contain; background-position: center; background-repeat: no-repeat; }
.cg-wrap piece.pawn.white { background-image: url(wP.png); }
… twelve rules (roles pawn knight bishop rook queen king × white black → wP…bK)
```

### `CONTRACT.md` (content)
Rules for any set, vector or raster:
- One folder per set under `public/piece-sets/<id>/`, one `sets.json` entry
  (`id`, `name`, `pair`, `board.light`, `board.dark`). No code change.
- Files exactly `wK wQ wR wB wN wP bK bQ bR bB bN bP` (case-sensitive), one extension per
  set; `pieces.css` maps them to `.cg-wrap piece.<role>.<color>` and is the only place that
  knows the extension.
- Square canvas: raster 256×256 PNG with alpha; vector: square `viewBox`, `0 0 64 64`.
  Chessground sizes the image with `background-size: cover` into a square box; a set's
  `pieces.css` may restate sizing (`contain/center/no-repeat`) but must not rely on `src/`.
- One scale factor for all twelve pieces is the **default** (pawn smaller than king, both
  kings equal). A documented per-role adjustment is permitted when the source art's
  proportions differ sharply from chess convention (e.g. a pawn under ~55 % of the king);
  it must be applied identically to both sides and preserve the ordering
  pawn < knight ≈ bishop < rook < queen < king.
- The built-in exception: the `cburnett` entry has `"stylesheet": null` and no folder — it
  is the bundled fallback. Every other set is a folder plus an entry.
- Bottom-aligned on a shared baseline, ≈ 4–5 % margin below; tallest piece ≈ 90 % of canvas.
- Identifiable at 40 px (test by rendering at 40 px); the two sides distinguishable under
  `filter: grayscale(1)`; transparent background, no white halo.
- Board colours are part of the set (`board.light/dark`) because readability depends on
  the pieces' palette.
- Attribution: cburnett © Colin M.L. Burnett, CC BY-SA 3.0; farm = AI-generated sheets in
  `assets/source/`, extracted by `scripts/extract-pieces.py`.

## Part C
- **B12** (`game-controller.ts`): loop counter in `beginTransition()`; `> 2` → `console.error`
  + break, still returning `t`.
- **B10** (`engine.ts`): `createEngine(workerUrl, onError, { expectedWasmBytes })` derives
  `wasmUrl = workerUrl.replace(/\.js$/, '.wasm')` (the glue's own rule), runs the HEAD
  pre-check with `AbortController` (5 s) including the `content-length` check (decision
  12), and only then constructs the `Worker`; `HANDSHAKE_TIMEOUT_MS = 30_000`. `ready`
  rejects (→ `engineFailed`) on a failed pre-check. `main.ts` passes
  `ENGINE_WASM_BYTES = 7_295_411` (commented: update on engine upgrade). Public methods
  called before the worker exists queue behind `ready` exactly as today.
- **B11**: backlog text only.

## Commits (in order)
1. `Phase 3: plan (rev. 2)` — `docs/phase-3-plan.md`
2. `Phase 3: piece-set mechanism` — `src/piece-sets.ts`, `main.ts`, `sets.json` with the
   `cburnett` entry only (clean on its own — C6), `CONTRACT.md`, README.
3. `Phase 3: farm piece set` — `assets/source/*.png`, `scripts/extract-pieces.py`,
   `requirements.txt`, the 12 PNGs, `farm/pieces.css`, `docs/piece-contact-sheet.png`,
   and the `farm` entry added at the top of `sets.json`.
4. `B12: bound the beginTransition re-cancel loop`
5. `B10: engine wasm reachability pre-check, 30 s handshake`
6. `B11: backlog note on vendoring the engine files`
7. `Phase 3: DoD results` (appended to `docs/phase-3-plan.md`)

## Explicitly NOT in this phase
Capture animations/sound (P5), victory animation (B9), PWA (P6), chess.com import (B3),
further pairs (B1), board theme picker independent of the set, per-piece naming, difficulty
tuning/ladder changes, vectorising the raster pieces, any engine-strength change, changing
`package.json` dependencies, re-generating artwork (B5 is considered closed by the sheets
provided — if the greyscale gate fails, that is reported, not fixed here).

## Commands (PowerShell, one per block)
```powershell
pip install -r scripts/requirements.txt
```
```powershell
python scripts/extract-pieces.py
```
```powershell
npm run build
```
```powershell
npx vite preview --port 4173 --strictPort --host
```

## Definition of Done (executed in the browser; results read from the rendered UI)
Mechanism
1. Mid-game switch farm ↔ cburnett: pieces + board colours change immediately (computed
   `background-image` of a piece element and `--board-light` on `.cg-wrap` change); FEN
   replayed from the move list, status text, side to move and engine indicator identical
   before/after.
2. Switch while the engine is thinking (C7): level 6's `movetimeMs` is **temporarily**
   raised to 3000 (and depth to 30) as in Phase 2; the set is switched while the status
   line genuinely reads "přemýšlím…"; the engine's move still arrives and is applied; no
   `console.error`. The constant is reverted and `git diff -- src/difficulty.ts` is
   confirmed empty before committing.
2b. **Sizing in both places (C1)**: screenshots of the starting position and of the open
   promotion dialog in `farm` and in `cburnett` — every piece fully inside its square /
   button, centred, not cropped or tiled. (Shares the hook of DoD 7.)
3. Reload restores the selected set (`localStorage` key `skm.pieceSetId`).
4. `localStorage.setItem('skm.pieceSetId','nope')` + reload → first entry (`farm`) active,
   `console.warn` present, board playable.
5. Rename `public/piece-sets/sets.json` → reload → classic pieces (bundled), `console.error`,
   board playable (make a move), select shows the single disabled fallback option; restore.
6. Rename the `farm` folder and remove its entry from `sets.json` → app works on cburnett
   with no code change; restore.
7. Promotion dialog shows the current set: a human promotion cannot be forced against the
   engine, so the Phase 2 temporary `debugLoadFen` hook is re-added for this item only
   (position `4k3/P7/8/8/8/8/8/4K3 w`), the dialog is opened on `farm` and the four
   `piece` elements' computed `background-image` URLs must point into `/piece-sets/farm/`
   (screenshot); repeat on `cburnett` (URLs are the bundled `data:image/svg+xml` ones). Hook removed before
   commit (DoD 17). This supersedes decision 15's "not needed".
8. Empty `localStorage` + reload → `farm` selected and rendered.

Artwork
9. Contact sheet produced at `docs/piece-contact-sheet.png`, shown in the review; every piece
   identifiable at 40 px; kings distinguishable in greyscale (goat king: cross-topped crown +
   ermine cape + sceptre vs. frog king: same crown shape but frog silhouette — if they read
   the same in grey, **stop and report**); **outlines visibly continuous at 40 px on both
   the light and the dark row** (C3) — the `DEHALO_MODE` used is recorded.
10. Relative sizes: script prints every role's height ratio to its king for both sides;
    pawn:king ≥ 0.55 after any per-role adjustment (or the shortfall is reported, not
    shipped); ordering `P < N ≈ B < R < Q < K` asserted; goat king and frog king heights
    equal within 2 px; the goat pawn is visibly smaller than the goat king on the sheet.
11. Screenshot of the starting position in `farm` at full board size: no white fringe, no
    clipped crowns/bows; zoom on the knights and bishops.
12. No piece overflows its square (alpha bbox within 256×256 with ≥ 4 px side margins —
    printed by the script); shared baseline (all bottoms at y = 244); horizontal centring
    judged on the starting-position screenshot; nudges recorded.
13. Rerun `python scripts/extract-pieces.py` → `git status` shows no change in
    `public/piece-sets/farm/` (byte-identical).

Carried-over + hygiene
14. B12: temporarily force the loop (e.g. make `cancelSearch()` leave a dummy `pendingSearch`
    twice) → the error is logged once and the transition completes; revert.
15. B10: (a) rename the `.wasm` → fallback suffix appears in < 2 s (pre-check), not after
    the handshake timeout; (b) **truncate** the `.wasm` to a few kilobytes → fallback in
    < 2 s via the size check (C4); restore the file (`npm install` re-copies it or
    `node scripts/copy-engine.mjs`) → normal load unaffected (status without suffix,
    engine replies). Verify the restored file is 7 295 411 bytes.
16. `npm run build` strict-clean.
17. `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty.

Wrap-up: leave `npx vite preview --port 4173 --strictPort --host` running and report the URL.
