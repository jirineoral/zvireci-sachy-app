# Phase 2 — Engine opponent, promotion dialog, undo (plan, rev. 3)

Rev. 2 incorporated the review of rev. 1: R1 awaitable cancellation (option/search race),
R2 no floating promise from the board callback, R3 six-level `Skill Level`-only ladder,
R4 one coherent label series, R5/R6 recorded notes, backlog items B6–B9.
Rev. 3 applies four local corrections: C1 `DifficultyLevel` = six levels, C2 exactly one
`afterPositionChange()` per promotion path, C3 DoD 2b loads its positions via the debug
hook with chess.js-verified FENs, C4 no dropped promise in `engineFailed`; temporary UCI
logging is gated behind `SKM_DEBUG_UCI` so the leftover grep catches it. Rev. 3 is
approved for implementation without a further plan review.

## Context
Phase 1 (`8f56fa4`, verified `b30431d`) is a synchronous local two-player board:
click → `chess.move()` → `board.sync()` → `render()`. Phase 2 adds a Stockfish WASM
opponent, which makes the controller **concurrent** for the first time; a real promotion
dialog (replacing the `TODO(phase-2)` auto-queen in `game-controller.ts`); undo that is
correct with an engine present; side selection with board orientation; and two fixes
carried over from the Phase 1 review (F1 one definition of "game over", F2 consistent
element lookup). The defining bug to design against: a stale engine reply landing on a
position it was not computed for.

Model policy unchanged: this plan is the strongest-model step; a cheaper model implements
it; **any decision not written here is escalated, not improvised** (including "harmless"
tsconfig/package changes — report every deviation).

Deliverable of the planning step: this document committed as `docs/phase-2-plan.md`
(commit `Phase 2: plan (rev. 3)`, together with backlog items B6–B9 appended to
`docs/BACKLOG.md`). Per the rev. 2 review, implementation follows directly after that
commit; the next review is on the diff and the DoD results.

## Verified facts this plan relies on (checked 2026-09-12)
- npm `stockfish@18.0.8` (nmrugg / Chess.com, **GPL-3.0**) ships
  `bin/stockfish-18-lite-single.js` (21 kB) + `bin/stockfish-18-lite-single.wasm` (7.3 MB):
  single-threaded, no SharedArrayBuffer, no COOP/COEP needed. Its README recommends
  exactly this flavour.
- Loaded as a `Worker`, the glue script resolves the `.wasm` URL as its own script URL
  with `.js` → `.wasm` (same directory, same basename) unless a URL is given in the
  location hash. Commands go in as plain strings via `postMessage`; engine output comes
  back as plain strings in `event.data`. Messages sent before the module is ready are
  queued by the glue itself.
- The wasm exposes UCI options `Skill Level`, `UCI_LimitStrength`, `UCI_Elo`, `Threads`,
  `Hash`, `MultiPV`, `Move Overhead`, `Ponder` (strings present in the binary).
  Stockfish's `UCI_Elo` range is 1320–3190; anything weaker must come from `Skill Level`
  plus a depth cap.
- Chessground piece images are scoped as `.cg-wrap piece.<role>.<color>`; the promotion
  dialog can reuse them (and therefore the Phase 3 piece set) by wrapping its buttons in
  a `.cg-wrap` element and overriding the absolute positioning.
- Current `chess.js@1.4.0` API used: `move({from,to,promotion})`, `undo()`, `load(fen)`,
  `moves({square, verbose})`, `history({verbose})`, `isGameOver()`, `turn()`, `fen()`.

## Decisions taken in this plan (veto in review, not during implementation)
1. **Engine flavour & delivery:** `stockfish-18-lite-single.{js,wasm}` copied verbatim
   from `node_modules` into `public/engine/` by `scripts/copy-engine.mjs`, run from the
   npm `postinstall` script. `public/engine/` is git-ignored (7 MB binary, reproducible).
   Vite serves `public/` untouched in dev and copies it into `dist/`, so the `.js→.wasm`
   naming rule holds in both. Worker URL:
   `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`.
2. **Position transfer:** every search sends `position fen <current fen>` (not
   `startpos moves …`). Simpler, works after any position load, and the only cost is
   that Stockfish does not see prior repetitions — repetition *rules* stay in chess.js.
3. **Difficulty ladder:** 6 levels (table below), **all** driven by `Skill Level` plus a
   depth cap — one strength mechanism only, so the ladder cannot break where a mechanism
   changes. `UCI_LimitStrength` is set to `false` once during the handshake and never
   touched again (`UCI_Elo` is not used in this phase). Granularity sits at the weak end
   because the actual players are a child and an adult for whom ~1100 is a stretch.
   Every `go` carries a `movetime` cap so the UI can never hang. Default level: **3**.
   The numbers are an **initial estimate to be tuned by playing**; the table in
   `src/difficulty.ts` is the single place to change them.
4. **Side switch = new game.** Choosing the other colour mid-game starts a new game as
   that colour (no side swap in the middle of a game). Default: human plays white.
5. **Difficulty change mid-game applies immediately**: if the engine is thinking, its
   search is cancelled and restarted with the new settings; otherwise the new settings
   apply from the engine's next move.
6. **Engine unavailable** (worker/wasm fails to load, or an engine move is rejected by
   chess.js): the failure is logged with `console.error` (FEN + move), the status line
   shows the error, and the game continues in Phase 1 two-player mode for the rest of
   that page load (`engineState = 'failed'`). Nothing is ever applied to the board without
   going through `chess.move()`.
7. **F1 — `gameStatus()` is the single definition of "game over".** Its `over` field
   becomes `chess.isGameOver()` (chess.js's own definition, which is exactly the five
   branches); the text branches only pick wording. `board-bridge.sync()` stops calling
   `chess.isGameOver()` and instead receives the movable colour decided by the
   controller from `status.over` + engine/dialog state. The engine gate reads the same
   `status.over`. One call site, three consumers.
8. **F2 — one lookup policy:** `requireElement<T extends Element>(root, selector)` in
   `src/ui/dom.ts` throws `Error('Required element "<selector>" not found')`; used for
   `#app` and every child lookup (no `!` anywhere in `main.ts`).
9. **Licence note:** README gets one line stating the engine is Stockfish.js (GPL-3.0)
   with a link. The project is private; this just keeps the attribution honest.
10. **UI strings** stay Czech (matching Phase 1); identifiers/comments English.
11. **Temporary test hook** (as in the Phase 1 wrap-up): `debugLoadFen()` exposed on
    `window.__SKM_DEBUG_CONTROLLER__` for the DoD positions that cannot be reached by
    play in reasonable time (engine promotion). Removed before the final commit,
    verified with `git grep`.
12. **Awaitable cancellation (R1):** `Engine.stop()` returns a promise that settles when
    every outstanding search has been consumed; every controller transition
    (`newGame`, `undo`, `setDifficulty`, `setHumanColor`) awaits it before sending
    `setoption` / `ucinewgame` or starting a new search. There is no "defer option lines"
    fallback in the engine module — ordering is the controller's job, and a violation is
    a logged bug, not something to paper over.
13. **No floating promises (R2):** `handleUserMove` is async; the bridge's `after`
    handler is explicitly fire-and-forget with its own `.catch`; the promotion flow uses
    `try/finally` so `promotionOpen` can never stay `true`.
14. **Known cosmetic difference (R5):** `refreshView()` before opening the promotion
    dialog re-syncs from FEN, so the pawn snaps back to its origin square while the
    player chooses (Lichess leaves it on the destination square). Functionally correct;
    no change in Phase 2.
15. **Undo as black at move 1 (R6):** kept as planned — the engine simply moves again,
    so from the player's side "Zpět" only changes the engine's opening move. Alternative
    for a later phase: disable the button when the resulting position would be the
    engine's turn at ply 0.

## Difficulty ladder (`src/difficulty.ts`)

All levels: `setoption name Skill Level value <n>`; `go depth <d> movetime <ms>`
(Stockfish stops at whichever limit is reached first). Labels follow the frog life
cycle — one coherent series, no goat words (R4); labels are data in the same table.

| Level | Label (UI) | `Skill Level` | `go` limits | Intended feel |
|---|---|---|---|---|
| 1 | 1 · Jikra | 0 | `depth 1 movetime 300` | absolute beginner; hangs pieces |
| 2 | 2 · Pulec | 0 | `depth 2 movetime 400` | sees one-move captures, little else |
| 3 | 3 · Žabka | 1 | `depth 3 movetime 500` | **default**; casual adult |
| 4 | 4 · Skokan | 3 | `depth 4 movetime 700` | club beginner |
| 5 | 5 · Ropucha | 6 | `depth 6 movetime 1000` | club player |
| 6 | 6 · Žabí král | 10 | `depth 8 movetime 1200` | strong club player; the ceiling for this phase |

Initial estimate to be tuned by playing (decision 3). Monotonicity is sanity-checked in
the DoD, not measured. A genuinely strong opponent (`UCI_LimitStrength`/`UCI_Elo`, full
strength) is a non-goal for this phase.

## Files

```
scripts/copy-engine.mjs        NEW  copies the two engine files node_modules → public/engine/
public/engine/                 NEW  (git-ignored) stockfish-18-lite-single.js + .wasm
src/engine.ts                  NEW  Web Worker + UCI behind a typed interface (only UCI text in the app)
src/difficulty.ts              NEW  the ladder table above + types
src/ui/dom.ts                  NEW  requireElement()
src/ui/promotion-dialog.ts     NEW  <dialog>-based Q/R/B/N picker
src/ui/controls.ts             NEW  wiring/rendering of difficulty <select>, side <select>, undo button state
src/board-bridge.ts            MOD  sync() takes orientation + movableColor; no isGameOver()
src/game-status.ts             MOD  over = chess.isGameOver(); defensive fallback text
src/game-controller.ts         MOD  engine, promotion, undo, side, concurrency
src/ui/status.ts               MOD  thinking / engine-loading / engine-error suffixes
src/main.ts                    MOD  new controls in the panel; requireElement everywhere
src/styles/app.css             MOD  controls row, dialog, piece-button overrides
package.json                   MOD  dependency stockfish 18.0.8 (exact), postinstall script
.gitignore                     MOD  public/engine/
README.md                      MOD  engine licence line
docs/phase-2-plan.md           NEW  this file
```
No other files. No new dev dependencies. `tsconfig.json` unchanged.

## Module design

### `src/engine.ts`
```ts
export type UciMove = string;                       // "e2e4", "e7e8q"
export interface EngineOptions { skillLevel: number }   // the only per-level option (decision 3)
export interface SearchLimits { depth: number; movetimeMs: number }
export interface Search {
  readonly fen: string;                             // position the search was started from
  readonly result: Promise<UciMove | null>;         // null = cancelled (stop/newGame/dispose)
}
export interface Engine {
  readonly ready: Promise<void>;                    // uciok → UCI_LimitStrength false → isready → readyok
  setOptions(options: EngineOptions): void;         // caller guarantees no search outstanding
  newGame(): void;                                  // ucinewgame → isready (new readyGate); caller guarantees no search outstanding
  search(fen: string, limits: SearchLimits): Search;
  stop(): Promise<void>;                            // cancels outstanding searches; resolves when all are settled (R1)
  dispose(): void;                                  // worker.terminate(); every outstanding result → null; stop() promises resolve
}
export function createEngine(workerUrl: string, onError: (err: Error) => void): Engine;
```
Internals (the mechanism, stated explicitly):
- `new Worker(workerUrl)` (classic worker, not module). Handshake: post `uci`; on a line
  `=== 'uciok'` post `setoption name UCI_LimitStrength value false` then `isready`; on
  `readyok` resolve `ready`. `onerror`/`messageerror` and a **10 s handshake timeout**
  call `onError` and reject `ready`.
- **Command gate:** every outgoing command is queued behind `ready`, and additionally
  behind the last `isready` we issued (`newGame()` posts `isready` after `ucinewgame`
  and creates a new `readyGate` promise resolved by the next `readyok`). `search()`
  awaits both gates before posting `position fen …` / `go depth … movetime …`.
- **FIFO bestmove matching:** UCI guarantees exactly one `bestmove` per `go`, in order,
  including for searches ended by `stop`. The module keeps `outstanding: SearchRecord[]`
  (`{ id, fen, resolve, cancelled }`), pushes on `go`, and on every line starting with
  `bestmove ` shifts the oldest record: if `cancelled` → resolve `null`; else resolve the
  move token (`bestmove (none)` → resolve `null` + `console.error`). This is what makes a
  stale reply impossible to confuse with a fresh one at the engine layer.
- **`stop(): Promise<void>` (R1):** marks every outstanding record `cancelled`, posts
  `stop` once if any is outstanding, and returns a promise that resolves when
  `outstanding` becomes empty (i.e. when the last cancelled `bestmove` has been consumed,
  or immediately if nothing was outstanding, or on `dispose()`). Implementation: a list
  of `drainWaiters` resolved whenever `outstanding.length` drops to 0.
- `setOptions()` / `newGame()` post their lines immediately. **If either is called while
  `outstanding.length > 0`, log `console.error('setoption/ucinewgame while a search is
  outstanding')` and still post** — the controller's sequencing (below) is what makes
  this unreachable; there is deliberately no deferral fallback that would hide an
  ordering bug (R1).
- All `info …` lines are ignored. No UCI string leaves this module.

### `src/difficulty.ts`
```ts
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;        // exactly the six rows of the table (C1)
export interface Difficulty { level: DifficultyLevel; label: string; options: EngineOptions; limits: SearchLimits }
export const DIFFICULTIES: readonly Difficulty[];   // the table above, in order
export const DEFAULT_DIFFICULTY: DifficultyLevel = 3;
export function difficulty(level: DifficultyLevel): Difficulty;
```

### `src/board-bridge.ts` (changes only)
```ts
export type BoardColor = 'white' | 'black';
export interface BoardSyncOptions { orientation: BoardColor; movableColor: BoardColor | null }
export interface BoardBridge { sync(chess: Chess, opts: BoardSyncOptions): void }
```
`sync()` sets `orientation`, `movable.color = opts.movableColor ?? undefined`, and keeps
`fen/turnColor/check/lastMove/dests` exactly as today. **It no longer calls
`chess.isGameOver()`** (F1).
`createBoardBridge(el, onUserMove: (from: Square, to: Square) => Promise<void>)`; the
chessground `after` handler is explicitly fire-and-forget (R2):
```ts
after: (orig, dest) => {
  void onUserMove(orig as Square, dest as Square).catch(err =>
    console.error('handleUserMove failed', err));
},
```

### `src/game-status.ts` (F1)
```ts
export function gameStatus(chess: Chess): GameStatus {
  const over = chess.isGameOver();
  // branches choose wording only; order unchanged
  ...
  if (over) { console.error('Game over with no matching reason', chess.fen()); return { over, text: 'Konec hry' }; }
  return { over: false, text: `Na tahu: …` };
}
```

### `src/ui/dom.ts` (F2)
```ts
export function requireElement<T extends Element>(root: ParentNode, selector: string): T
```

### `src/ui/promotion-dialog.ts`
```ts
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export function promptPromotion(dialog: HTMLDialogElement, color: Color): Promise<PromotionPiece | null>
```
- The `<dialog class="promotion-dialog">` is created once in `main.ts`; the function
  (re)fills it with four `<button data-piece="q|r|b|n">` each containing
  `<piece class="{white|black} {queen|rook|bishop|knight}">`, all inside a
  `<div class="cg-wrap promotion-pieces">` so the current piece set's CSS applies
  (colour = the promoting side, from `chess.turn()` at call time), plus a "Zrušit" button.
- `dialog.showModal()` — the rest of the page is inert, so the board cannot be touched
  while it is open. Resolves with the piece on button click; resolves `null` on the
  dialog's `close` event without a choice (Escape, i.e. keyboard dismissal, or "Zrušit").
  Focus starts on the queen button; Tab/Enter/Space work natively.
- CSS (app.css): `.promotion-dialog .cg-wrap piece { position: static; width: 64px; height: 64px; pointer-events: none; display: block }`
  (overrides chessground base's absolute 12.5 % sizing), plus a `::backdrop`.

### `src/ui/controls.ts`
```ts
export interface ControlsElements { difficulty: HTMLSelectElement; side: HTMLSelectElement; undo: HTMLButtonElement }
export interface ControlsState { difficulty: DifficultyLevel; humanColor: Color; undoEnabled: boolean; disabled: boolean }
export function populateControls(els: ControlsElements): void          // fills the two <select>s from DIFFICULTIES / ['w','b']
export function renderControls(els: ControlsElements, state: ControlsState): void
```
`disabled` greys the difficulty/side selects while the promotion dialog is open (belt
and braces; the modal already makes them inert).

### `src/ui/status.ts`
```ts
export interface StatusView { status: GameStatus; engine: 'loading' | 'ready' | 'thinking' | 'failed' }
export function renderStatus(el: HTMLElement, view: StatusView): void
```
Text = `status.text` + suffix: `loading` → " — načítám engine…", `thinking` →
" — přemýšlím…", `failed` → " — engine nedostupný, hrají dva hráči". Class
`game-over` toggled as today.

### `src/game-controller.ts` — the single stateful object
```ts
export interface GameControllerElements {
  board: HTMLElement; status: HTMLElement; moveList: HTMLElement;
  newGameButton: HTMLButtonElement; undoButton: HTMLButtonElement;
  difficultySelect: HTMLSelectElement; sideSelect: HTMLSelectElement;
  promotionDialog: HTMLDialogElement;
}
export class GameController {
  private readonly chess: Chess;
  private readonly board: BoardBridge;
  private readonly engine: Engine;
  private humanColor: Color = 'w';
  private difficultyLevel: DifficultyLevel = DEFAULT_DIFFICULTY;
  private engineState: 'loading' | 'ready' | 'failed' = 'loading';
  private pendingSearch: Search | null = null;          // the ONE in-flight search, or null
  private promotionOpen = false;
  private transition = 0;                               // generation counter for async transitions (R1)

  constructor(els, engine)             // wires buttons/selects, engine.ready.then(ready).catch(failed), newGame()
  newGame(): Promise<void>
  undo(): Promise<void>
  setDifficulty(level: DifficultyLevel): Promise<void>
  setHumanColor(color: Color): Promise<void>    // = newGame() as that colour (decision 4)

  private handleUserMove(from: Square, to: Square): Promise<void>   // promotion-aware
  private applyEngineMove(uci: UciMove): void                        // parse → chess.move → afterPositionChange
  private cancelSearch(): Promise<void>  // pendingSearch = null; return engine.stop() (resolves when settled)
  private beginTransition(): Promise<number>  // const t = ++transition; await cancelSearch(); return t
  private afterPositionChange(): void  // sync + render + maybeStartEngine
  private refreshView(): void          // sync + render only (no engine start) — used while thinking / dialog open
  private maybeStartEngine(status: GameStatus): void
  private movableColor(status: GameStatus): BoardColor | null
  private render(status: GameStatus): void
}
```
Key methods, stated as the implementer must write them:

- `movableColor(status)`: `null` if `status.over` or `promotionOpen` or `pendingSearch`;
  otherwise, if `engineState === 'failed'` → side to move (two-player fallback);
  otherwise → `humanColor` if it is the human's turn, else `null`.
  (While `engineState === 'loading'` and it is the engine's turn, this also yields
  `null`; the search starts as soon as `ready` resolves — see constructor.)
- `afterPositionChange()`: `const status = gameStatus(chess)`;
  `board.sync(chess, { orientation: humanColor → 'white'|'black', movableColor: movableColor(status) })`;
  `render(status)`; `maybeStartEngine(status)`.
- `maybeStartEngine(status)`: start iff `!status.over && engineState === 'ready' &&
  chess.turn() !== humanColor && !pendingSearch`. Start:
  ```ts
  const d = difficulty(this.difficultyLevel);
  const search = this.engine.search(this.chess.fen(), d.limits);
  this.pendingSearch = search;
  this.refreshView();                                   // locks board, shows "přemýšlím…"
  search.result.then(move => {
    if (this.pendingSearch !== search) return;          // superseded/cancelled → discard
    this.pendingSearch = null;
    if (move === null) return;                          // cancelled by stop()
    if (search.fen !== this.chess.fen()) {              // belt and braces: position moved on
      console.error('Stale engine move discarded', search.fen, this.chess.fen()); return;
    }
    this.applyEngineMove(move);
  });
  ```
  Two independent guards (identity + FEN) — the identity guard is the mechanism, the FEN
  guard makes a wrong identity impossible to exploit.
- Constructor: `engine.ready.then(() => { engineState = 'ready'; engine.setOptions(difficulty(level).options); afterPositionChange(); })`
  (so an engine turn that was waiting during load starts now) and
  `.catch(err => this.engineFailed(err))`.
- `engineFailed(err: unknown): void` (C4 — no dropped promise):
  ```ts
  console.error('Engine unavailable', err);
  this.engineState = 'failed';
  void this.cancelSearch().catch(e => console.error('cancelSearch failed', e));
  this.afterPositionChange();          // two-player fallback takes effect immediately
  ```
  It is synchronous on purpose (called from `.catch` handlers and from
  `applyEngineMove`); the cancellation promise is explicitly voided with its own catch.
- **Dropped-promise policy for the whole controller (C4 sweep):** every call site of a
  promise-returning method that does not `await` it must be written
  `void x().catch(err => console.error('<method> failed', err))`. Concretely: the four
  button/select event listeners in the constructor
  (`() => void this.newGame().catch(…)`, `undo`, `setDifficulty`, `setHumanColor`); the
  constructor's initial `newGame()`; `engineFailed`'s `cancelSearch()`; the bridge's
  `after` handler (R2); and `search.result.then(...)` in `maybeStartEngine`, which gets a
  trailing `.catch(err => console.error('engine search failed', err))`. `engine.ts` has
  the same rule for its internal `ready`/`readyGate` chains. DoD 16b greps for it.
- `applyEngineMove(uci)`: `{ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] }`;
  `try { chess.move(...) } catch (err) { console.error('Engine move rejected by chess.js', uci, chess.fen(), err); this.engineFailed(err); return; }`
  then `afterPositionChange()` (on the failure path `engineFailed` already called it).
  Never touches the board directly.
- `handleUserMove(from, to)` (R2: `try/finally`, nothing can strand `promotionOpen`):
  ```ts
  const candidates = chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
  if (candidates.length === 0) { console.error(...); afterPositionChange(); return; }   // cannot happen: dests came from chess.js
  let promotion: PromotionPiece | undefined;
  if (candidates[0].promotion) {                       // chess.js says this is a promotion
    this.promotionOpen = true;
    this.refreshView();                                // board locked, controls disabled (pawn snaps back — R5)
    let choice: PromotionPiece | null = null;
    try {
      choice = await promptPromotion(els.promotionDialog, chess.turn());
    } catch (err) {
      this.promotionOpen = false;
      this.afterPositionChange();                      // re-sync and unlock before the error leaves
      throw err;                                       // the bridge's .catch logs it
    } finally {
      this.promotionOpen = false;                      // clears the flag only
    }
    if (choice === null) { this.afterPositionChange(); return; }   // cancelled: nothing applied
    promotion = choice;
  }
  try { chess.move({ from, to, promotion }); } catch (err) { console.error(`Move ${from}->${to} rejected by chess.js`, err); }
  this.afterPositionChange();
  ```
  Exactly one `afterPositionChange()` per path (C2): success → after the move is
  applied; cancel → in the `choice === null` branch; rejection → in the `catch`, before
  rethrowing to the bridge's `.catch` (`handleUserMove failed`). The `finally` only
  clears `promotionOpen`. (`promotion` is only passed when chess.js reported a promotion
  — the Phase 1 "always pass q" trick goes away with the TODO.)
- **Transition protocol (R1)** — used by `newGame`, `undo`, `setDifficulty`,
  `setHumanColor`:
  ```ts
  private async beginTransition(): Promise<number> {
    const t = ++this.transition;
    await this.cancelSearch();          // pendingSearch = null; engine.stop() settles when the old bestmove is consumed
    return t;
  }
  // in each transition:  const t = await this.beginTransition(); if (t !== this.transition) return;  // superseded
  ```
  What the UI does during the await: **nothing changes** — the board is already locked
  (`pendingSearch` was set) and the status already reads "přemýšlím…"; the await is the
  time Stockfish needs to answer `stop` with `bestmove` (milliseconds). If nothing was
  outstanding the await resolves immediately. Buttons stay enabled; a second click during
  the await simply starts a newer transition and the older one returns at the generation
  check. `handleUserMove` cannot run during the await (board locked) and never needs the
  protocol (it sends no engine commands itself; `maybeStartEngine` only starts a search
  when `pendingSearch` is null, i.e. after a previous one has settled).
- `newGame()`:
  ```ts
  const t = await this.beginTransition(); if (t !== this.transition) return;
  chess.reset();
  if (engineState === 'ready') engine.newGame();      // ucinewgame + isready gate — no search outstanding now
  this.afterPositionChange();                         // engine opens (new search) only if the human is black
  ```
  (Engine-failed state is *not* reset by a new game in this phase; a page reload
  re-tries. Stated so nobody "improves" it.)
- `undo()`:
  ```ts
  if (chess.history().length === 0) return;
  const wasEngineTurn = chess.turn() !== humanColor;   // evaluated BEFORE the await; position cannot change during it (board locked or idle)
  const t = await this.beginTransition(); if (t !== this.transition) return;
  // Back to the most recent position where it was the human's turn:
  //  - engine to move (thinking, or game just ended after a human move): pop 1 ply
  //  - human to move: pop the engine reply and the human move: pop 2 plies
  //  - two-player fallback: pop 1 ply
  const plies = engineState === 'failed' ? 1 : wasEngineTurn ? 1 : 2;
  for (let i = 0; i < plies && chess.history().length > 0; i++) chess.undo();
  this.afterPositionChange();
  ```
  Edge cases this covers: undo at move 1 as white (history empty → no-op; button
  disabled); undo at move 1 as black after the engine's first move (pops to the start
  position, engine to move → engine plays again — R6); undo after game over (works; the
  position reopens and the engine, if it is its turn, moves); undo mid-search (search
  cancelled and *settled* first, the human's last ply is popped, no ghost move can land:
  `pendingSearch` is null, the old record resolved `null`, and the FEN changed).
- `setDifficulty(level)`:
  ```ts
  this.difficultyLevel = level; renderControls(...);
  if (engineState !== 'ready') return;
  const wasThinking = !!pendingSearch;
  const t = await this.beginTransition(); if (t !== this.transition) return;
  engine.setOptions(difficulty(level).options);       // no search outstanding → no setoption-mid-search
  if (wasThinking) this.afterPositionChange();        // restarts the search with the new options/limits
  ```
  Wire order is now guaranteed: `stop` → `bestmove` (consumed) → `setoption` →
  `position` / `go`.
- `setHumanColor(color)`: `humanColor = color; return newGame();`.
- Undo button enabled iff `chess.history().length > 0 && !promotionOpen`.
- **Concurrency matrix (the answers the brief asks for):**

  | User action while the engine is thinking | Mechanism | Outcome |
  |---|---|---|
  | Nová hra | `beginTransition()` (stop → await settled) → `chess.reset()` → `engine.newGame()` (ucinewgame + isready gate) → `afterPositionChange()` | Old `bestmove` is matched FIFO to the cancelled record → `null`; even if it resolved a move, `pendingSearch !== search` discards it; even then FEN differs. `ucinewgame` is never sent mid-search. Clean start position; engine opens only if the human is black, via a *new* search. |
  | Undo | `beginTransition()`, pop 1 ply (engine was to move) | Human's last move is taken back; board unlocked for the human; no ghost move. |
  | Difficulty change | `beginTransition()` → `setOptions` → `afterPositionChange()` | New search runs with the **new** options; no `setoption` mid-search (R1). |
  | Side switch | `setHumanColor` → `newGame()` | As Nová hra, with orientation flipped. |
  | Human tries to move | `movableColor(status)` returns `null` while `pendingSearch` is set | chessground refuses to pick up any piece. |
  | Promotion dialog open | modal `<dialog>` + `promotionOpen` → `movableColor null`, controls disabled | Nothing else can happen until the dialog resolves; `try/finally` guarantees it resolves the controller state even on error. |
  | Two transitions overlap (double-click) | generation counter | The older transition returns at its generation check; only the newest completes. |

### `src/main.ts`
- Panel markup adds, under the title: a `.controls` row with
  `<label>Obtížnost <select class="difficulty"></select></label>`,
  `<label>Hraju za <select class="side"><option value="w">bílé</option><option value="b">černé</option></select></label>`;
  the buttons row `Nová hra` + `Zpět` (`.undo`); and `<dialog class="promotion-dialog">`.
- All lookups through `requireElement` (F2). Creates `createEngine(workerUrl, onError)`
  and passes it to the controller; `onError` is the controller's `engineFailed()`.

### `scripts/copy-engine.mjs`
Node ESM, no deps: `mkdir -p public/engine`, copy the two files from
`node_modules/stockfish/bin/`, fail loudly (exit 1 with the missing path) if absent.
`package.json`: `"postinstall": "node scripts/copy-engine.mjs"`,
`"dependencies": { …, "stockfish": "18.0.8" }`.

## Explicitly NOT in Phase 2
Custom piece sets (P3), artwork (P4), sound/capture effects (P5), PWA (P6), chess.com
import (B3), clocks, opening book, evaluation display/analysis mode, engine-side-only
takeback, i18n, persistence of settings, artificial "thinking" delay, multi-threaded
engine / COOP-COEP headers, a genuinely strong opponent (`UCI_LimitStrength`/`UCI_Elo`
or full-strength search — may return in a later phase), a real two-player option in the
side selector (B7), Node-side engine tests, test framework, any tsconfig change, retrying
a failed engine within the same page load, keeping the pawn on the promotion square while
the dialog is open (R5).

## Commands (PowerShell, one per block)
```powershell
npm install
```
```powershell
npm run dev
```
```powershell
npm run build
```

## Definition of Done (all executed in the browser by real clicks; results read from the rendered UI)
1. **Full game, level 1**, human white: play to completion; every engine move appears
   in the SAN list and is therefore chess.js-legal; game ends with a correct status.
2. **Full game, level 4**, human white: same criteria; engine replies arrive within the
   movetime cap (< ~1 s).
2b. **Ladder sanity check (R3, C3)** — a plausibility check, not a rating measurement.
   The engine picks Black's moves itself, so these positions are **loaded through the
   temporary `debugLoadFen` hook** (same hook as DoD 5; its removal is covered by DoD 16)
   with human = **white** so that the engine (black) is to move immediately after the
   load. FENs verified with chess.js on 2026-09-12:
   - P1, after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 (28 legal replies, `d5` among them):
     `r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4`
   - P2, after 1.e4 e5 2.Nf3 d6 3.Bb5+ (Black in check; legal: Nd7 Nc6 Bd7 Qd7 Ke7 c6):
     `rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 3`
   Procedure per level 1…6: select the level, `debugLoadFen(P1)`, record the engine's
   reply; then `debugLoadFen(P2)`, record the reply. Expect the weak levels to play
   indifferent moves in P1 and the upper levels to find …d5 (or another sound defence of
   f7); in P2 the upper levels must not lose material. The apparent quality must not
   obviously regress as the level rises. Record all twelve replies in the DoD results.
   (`debugLoadFen` on the controller must go through `beginTransition()` like the other
   transitions, so a load while the engine is thinking is safe — hook-only code, removed
   with the hook.)
2c. **Promotion flow cannot strand the controller (R2)**: temporarily make
   `promptPromotion` throw before `showModal()`; play to a human promotion → the console
   shows `handleUserMove failed`, the board is unlocked (a different piece can be picked
   up), the position/move list are unchanged, and the controls are enabled. Revert the
   throw; confirm with `git diff` that it is gone before committing.
3. **Human promotion ×4**: reach a promotion (e.g. 1.e4 d5 2.exd5 c6 3.dxc6 Nf6 4.cxb7 Nc6
   5.bxa8=?) at level 1; dialog shows four **white** pieces; choose Q, then (new game,
   same line) R, B, N — SAN shows `=Q`, `=R`, `=B`, `=N` respectively and the piece on
   a8 matches.
4. **Cancelled promotion**: same position, open the dialog, press **Escape** → dialog
   closes, pawn is back on b7, move list unchanged, it is still the human's turn;
   repeat with the "Zrušit" button.
5. **Engine promotion** (temporary `debugLoadFen` hook):
   `7k/P7/8/8/8/8/8/K7 w - - 0 1` with human = **black** → engine promotes; no dialog
   appears; SAN contains `=` and a white piece stands on a8.
6. **Undo mid-search**: level 6 (movetime 1200), make a human move, press Zpět within
   the think time → the human move is taken back, the board is unlocked, and after
   waiting 3 s no engine move has appeared and the move list is unchanged.
7. **Nová hra mid-search**: same setup, press Nová hra during the think → start
   position, empty list, "Na tahu: bílý"; after 3 s still no move on the board.
8. **Difficulty change mid-search (R1)**: press it during a level-6 think, switch to
   level 1 → engine reply arrives promptly and exactly one engine move is added. In the
   console the order must be `stop` → `bestmove …` received → `setoption name Skill
   Level value 0` → `position fen …` → `go depth 1 …`; no `setoption` between a `go` and
   its `bestmove`. The logging for this test is temporary and gated behind a constant
   `const SKM_DEBUG_UCI = true` in `engine.ts` (log every posted command and every
   `bestmove`/`readyok` line when set); the constant and its uses are removed before
   commit and DoD 16 greps for the name.
8b. **Double-click transition**: press Nová hra twice quickly during a think → one clean
   start position, exactly one engine reply if human is black, none if white.
9. **Play as black**: select "černé" → board flips (`h1` at the top-left, `a8` at the
   bottom-right), engine opens with a white move, human can then move black.
10. **Undo as black at move 1** after the engine's first move → engine moves again;
    list has exactly one white move.
11. **Undo after game over** (from test 1's final position) → game reopens, status is
    no longer game-over, engine moves if it is its turn.
12. **Undo at move 1 as white** → button disabled, nothing happens.
13. **Engine unavailable fallback**: temporarily rename `public/engine/*.wasm`, reload →
    status shows the engine-failed suffix, both colours are movable, undo pops one ply;
    restore the file.
14. **F1**: `git grep isGameOver src` returns exactly one hit, in `game-status.ts`.
15. **F2**: `git grep '!,' src/main.ts` and `git grep '!;' src/main.ts` return nothing;
    temporarily rename `.move-list` in the markup → page throws
    `Required element ".move-list" not found`; revert.
16. `npm run build` passes strict; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src`
    returns nothing in the final commit (covers the controller hook, the `window`
    exposure, and the `SKM_DEBUG_UCI` logging).
16b. **Dropped-promise sweep (C4)**: `git grep -n -E '\.(newGame|undo|setDifficulty|setHumanColor|cancelSearch|stop)\(' src` — every hit is either
    `await`ed, `return`ed, or prefixed with `void …().catch(`; every `.then(` in `src`
    has a `.catch(`.
17. Fresh-clone check: `git clean -xfd public/engine` then `npm install` recreates
    `public/engine/` with both files.

Commits: `Phase 2: plan (rev. 3)` (docs only: this file as `docs/phase-2-plan.md` +
B6–B9 appended to `docs/BACKLOG.md`) → after implementation and DoD, one commit
`Phase 2: engine opponent, promotion dialog, undo` (+ DoD results appended to
`docs/phase-2-plan.md`).

## Backlog additions (append verbatim to `docs/BACKLOG.md` in the plan commit — not Phase 2 work)

### B6 — GPL-3.0
Stockfish.js is GPL-3.0. Private repo, no issue today. If this is ever published, the
whole app must be GPL-3.0. Decide before publishing, not after.

### B7 — Two-player mode as a deliberate choice
Phase 2 gets local two-player play only as the engine-failure fallback. Promoting it to a
real option in the side selector is roughly a select entry plus a branch in
`movableColor()`. Deferred: expected to be used rarely.

### B8 — `history()` cost
`chess.history({verbose:true})` replays the whole game; it is called in `sync()` for
`lastMove` and again in `render()`. Two full replays per move. Invisible in a 40-move
game, potentially not in B3 (chess.com import). Fix when something feels slow: keep the
`Move` object returned by `chess.move()` and pass it into `sync()`.

### B9 — Victory animation (Phase 5 input)
A storyboard exists for both sides (goat headbutt / frog tongue), 6 panels, ~2.5 s each,
produced as a single reference image.

Design corrections required before this is built:
1. **Win and loss must not be the same animation mirrored.** The player plays one side;
   showing him a 2.5 s celebration of his opponent after a loss is the wrong response.
   Win = the current storyboard. Loss = short, quiet, no gloating: the defeated king sits
   down and removes his crown. Different tone, not a different animal.
2. **Skippable on any click, and shorter.** Panels 4 and 5 (crown flying, crown landing)
   are filler; four panels is enough. Target ~1.5 s.
3. Draw only after the piece artwork is final (B5), so the style matches.

Implementation approach (decided): do NOT attempt frame-by-frame animation. Render the
storyboard panels as a **cross-faded sequence of static images with a slow zoom
(Ken Burns)**, plus sound. The existing panels are usable as final assets. Roughly 1–2 h
versus 4–8 h for hand-animated SVG, and visually close to what the storyboard promises.

Open question: whether the frog-tongue and goat-headbutt panels can be regenerated
individually in a matching style, or whether the single sheet must be cut up. Cutting up
the existing sheet is the safe option.

### Later-phase candidates recorded from the Phase 2 review
- Undo as black at move 1: disable the button when the resulting position would be the
  engine's turn at ply 0 (R6).
- Promotion dialog: keep the pawn on the destination square while choosing, as Lichess
  does (R5).
- Strong opponent levels via `UCI_LimitStrength`/`UCI_Elo` (R3).
