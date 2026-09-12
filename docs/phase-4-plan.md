# Phase 4 — Move feedback (hodnocení tahů): !! ! !? ?! ? ?? (plan, rev. 1)

## Context
Tester feedback (2026-09-12): the young player wants per-move feedback like chess.com —
`??` blunder (two red question marks), `?` mistake (orange), `?!` inaccuracy, `!?`
interesting, `!` great, `!!` brilliant. Phases 1–3 are done; the app has one
single-threaded Stockfish worker driven by `src/engine.ts` with FIFO `bestmove` matching,
and a controller with a transition protocol that cancels and awaits any in-flight search.
This phase adds **analysis searches** around the human's moves, a classifier that turns
their results into a glyph, and the display of that glyph on the board and in the move
list. It touches the controller's concurrency model, which is exactly the area the
Phase 2 review guarded most carefully — the plan therefore spells out the sequencing.

Model policy unchanged: this plan is the strongest-model step; a cheaper model implements
it; **any decision not written here is escalated, not improvised**; every deviation is
reported. Deliverable of the planning step: this document committed as
`docs/phase-4-plan.md`, then **stop for review**.

## Verified facts this plan relies on
- One worker, UCI over `postMessage`; `Engine.search()` returns only `bestmove`
  (`info` lines are ignored today). `stop()` resolves when every outstanding search is
  consumed; `setOptions()` must only be called with nothing outstanding (Phase 2 R1).
- The engine's `Skill Level` is set per difficulty (0–6); analysis needs full strength, so
  the option must be switched around analysis searches. Stockfish accepts `setoption`
  between searches; `MultiPV` is a standard option present in this build.
- Chessground supports `drawable.autoShapes` with `customSvg` (lichess uses it for move
  glyphs) — see `dist/draw.d.ts` (`DrawShape.customSvg?: { html: string; center?: … }`).
  Our board is created with `drawable: { enabled: false, visible: false }`; `visible`
  must become `true` for autoShapes to render while `enabled: false` keeps user drawing off.
- `chess.js` gives `board()`/`get()` for material counting and `moves({verbose})` for
  the SAN of any UCI move; no rule logic of ours is needed to detect captures or
  material balance.
- Measured on this machine: a depth-12 search on the lite build takes 100–300 ms in the
  middlegame; a phone will be 3–5× slower. Every analysis gets a `movetime` cap.

## Decisions taken in this plan (veto in review, not during implementation)
1. **Only the human's moves are annotated.** The opponent is a training partner; its
   moves get no glyph. (Chess.com annotates both — deliberately not copied.)
2. **Feedback is a setting** ("Hodnocení tahů: zapnuto / vypnuto") in the settings panel,
   default **on**, persisted in `localStorage` (`skm.moveFeedback`), same try/catch
   pattern as the piece set. Off = no analysis searches at all (verifiable in the UCI log).
3. **Two analyses per human move, same worker, strictly sequential:**
   - **A (pre-move)**: after the position becomes the human's to move (new game / after
     the opponent's reply / after undo), analyse it with `MultiPV 2`, full strength. Gives
     `evalBefore`, `bestMove`, `secondBestEval`. Runs while the human thinks; if the human
     moves before it finishes it is cancelled and that move gets **no glyph** (rare on
     desktop, possible on a phone; never blocks the human).
   - **B (post-move)**: right after the human's move, `MultiPV 1`, full strength. Gives
     `evalAfter`. The opponent's reply search starts **after** B completes, so B adds
     latency: capped by `ANALYSIS_MOVETIME_MS`.
   Each analysis brackets its own options: `Skill Level 20` + `MultiPV n` before,
   `Skill Level <level>` + `MultiPV 1` after; option lines are only sent with nothing
   outstanding (controller sequencing, as in Phase 2). Wire order per human move:
   `setoption×2 → go (B) → bestmove → setoption×2 → go (reply) → bestmove → setoption×2 → go (A) → bestmove → setoption×2`.
4. **Analysis limits** (one table, `src/feedback.ts`): `ANALYSIS_DEPTH = 12`,
   `ANALYSIS_MOVETIME_MS = 700`. Whichever comes first. Depth is fixed so verdicts are
   comparable across levels; the cap keeps a phone under ~1.5 s added per move.
5. **Score normalisation**: `info … score cp X` → X centipawns; `score mate M` →
   `±(10000 − |M|)` with the sign of M. Scores are converted to the **human's point of
   view** (Stockfish reports from the side to move: A is human-to-move → as is; B is
   opponent-to-move → negate).
6. **Classification** (`classifyMove()` in `src/feedback.ts`, pure function, unit-testable
   by hand in the DoD). Inputs: `evalBefore`, `evalAfter`, `bestMove` (UCI),
   `secondBestEval` (or null), `played` (UCI), `sacrificed` (material in pawns the human
   gives up — see 7). `loss = evalBefore − evalAfter` (≥ 0 means the move cost something).
   Precedence top to bottom, first match wins:

   | Glyph | Name (UI) | Rule |
   |---|---|---|
   | `??` | Hrubá chyba | `loss ≥ 300`, **or** `evalBefore ≥ +200 && evalAfter < +50` (throws away a win), **or** `evalAfter ≤ −9000` (allows forced mate) while `evalBefore > −9000` |
   | `?` | Chyba | `100 ≤ loss < 300` |
   | `?!` | Nepřesnost | `50 ≤ loss < 100` |
   | `!!` | Brilantní | `played === bestMove && sacrificed ≥ 2 && evalBefore ≤ +400` |
   | `!` | Skvělý | `played === bestMove && secondBestEval !== null && evalBefore − secondBestEval ≥ 150 && −400 ≤ evalBefore ≤ +400` (the only good move in a live position) |
   | `!?` | Zajímavý | `played !== bestMove && sacrificed ≥ 2 && loss < 50` (a sound speculative sacrifice) |
   | — | (no glyph) | everything else, including the best move in ordinary positions |

   Positions already decided (`|evalBefore| > 900` and `|evalAfter| > 900` with the same
   sign) never produce `?!`/`?` — only `??` if a mate is allowed or the win is thrown away.
   Thresholds are constants in one table, expected to be tuned by playing.
7. **Sacrifice detection without our own rules**: play the human's move and then the
   opponent's best reply from analysis B's principal variation (first PV move) on a
   throw-away `Chess` clone; `sacrificed = material(human) before − after` in pawns
   (P 1, N 3, B 3, R 5, Q 9). Covers "gives a piece that can be taken" and exchange
   sacrifices; misses deferred sacrifices — accepted.
8. **Display**: glyph on the **destination square** via chessground `autoShapes`
   (`customSvg` circle badge in the square's top-right corner, chess.com colours:
   `!!` #1baca6, `!` #5b8baf, `!?` #f7c631/`?!` #f7c631 with distinct text, `?` #ffa459,
   `??` #fa412d), and the same glyph appended to the SAN in the move list with a colour
   class. The board badge shows for the **last human move only**; the move list keeps all.
   Board rendering stays a chessground `set({ drawable: { autoShapes } })` call inside
   `board-bridge.sync()` — the bridge grows one optional `annotation` field, no other
   API change.
9. **Storage**: `annotations: (Glyph | null)[]` on the controller, index = ply of the
   human's move; truncated on undo; cleared on new game. Nothing persisted.
10. **No glyph is also information**: a "best move" without `!`/`!!` shows nothing (as on
    chess.com's "Best" only in review). Requested by the brief's list — the six glyphs
    only.
11. **Engine failure / two-player fallback**: no analysis, no glyphs; the setting stays on
    but is inert. Engine "failed" state never blocks the game.
12. **Latency budget** (DoD): added time per human move ≤ 2 × `ANALYSIS_MOVETIME_MS` on
    the desktop measured from the UCI log; typical desktop total < 500 ms.
13. **Temporary test hook**: `debugLoadFen()` (Phase 2/3 procedure) for the threshold
    positions in the DoD; removed before commit; grepped out.

## Files
```
src/feedback.ts            NEW  types, thresholds table, classifyMove(), material(), score normalisation
src/engine.ts              MOD  analyse(fen, {depth, movetimeMs, multiPv}): Analysis — parses `info` lines; setOptions gains multiPv
src/game-controller.ts     MOD  analysis sequencing (A/B), annotations array, setting, board/list rendering hooks
src/board-bridge.ts        MOD  sync() accepts `annotation?: { square, glyph }` → autoShapes; drawable.visible = true
src/ui/move-list.ts        MOD  renderMoveList(el, sans, glyphs) — glyph span with colour class
src/ui/controls.ts         MOD  feedback toggle (<select> zapnuto/vypnuto to match the row) + state
src/main.ts                MOD  toggle markup, persistence wiring (same pattern as piece set)
src/styles/app.css         MOD  glyph colours in the move list
docs/phase-4-plan.md       NEW  this file
```
Not touched: `difficulty.ts`, `piece-sets.ts`, `game-status.ts`, `ui/promotion-dialog.ts`,
`tsconfig.json`, `package.json`.

## Module design

### `src/engine.ts` additions
```ts
export interface AnalysisLimits { depth: number; movetimeMs: number; multiPv: 1 | 2 }
export interface PvLine { multipv: number; scoreCp: number; pv: UciMove[] }   // scoreCp already mate-normalised, side-to-move POV
export interface Analysis { readonly fen: string; readonly result: Promise<PvLine[] | null> } // null = cancelled
export interface EngineOptions { skillLevel: number; multiPv?: number }        // multiPv default 1
analyse(fen: string, limits: AnalysisLimits): Analysis
```
- Shares the FIFO with `search()`: an analysis record collects `info` lines whose
  `multipv` ≤ limits.multiPv (last line per multipv wins) and resolves them on its
  `bestmove`. Cancelled records resolve `null` exactly like searches. `stop()` covers both.
- `info` parsing: tokens `depth`, `multipv`, `score cp|mate`, `pv …`; lines without `pv`
  (e.g. `info string`, `currmove`) are ignored. Lower-depth lines are overwritten by later
  ones, so the last complete line per multipv is the final answer.
- `setOptions({ skillLevel, multiPv })` posts both option lines (MultiPV only if given).

### `src/feedback.ts`
```ts
export type Glyph = '!!' | '!' | '!?' | '?!' | '?' | '??';
export const GLYPH_LABEL: Record<Glyph, string>;        // Czech names for tooltips/aria
export const THRESHOLDS = { inaccuracy: 50, mistake: 100, blunder: 300, winThrown: { from: 200, to: 50 }, greatGap: 150, sacrificePawns: 2, liveEval: 400, decided: 900, mateScore: 10000 };
export const ANALYSIS = { depth: 12, movetimeMs: 700 };
export function normaliseScore(kind: 'cp' | 'mate', value: number): number;
export function material(chess: Chess, color: Color): number;   // pawns, from chess.board()
export function classifyMove(input: ClassifyInput): Glyph | null;
```

### `src/game-controller.ts` — sequencing
New state: `feedbackEnabled: boolean`, `pendingAnalysis: Analysis | null`,
`preMove: { fen: string; evalBefore: number; bestMove: UciMove; secondBestEval: number | null } | null`,
`annotations: (Glyph | null)[]`.

- **`afterPositionChange()`** order becomes: sync → render → if engine's turn:
  `maybeStartEngine()` (unchanged) — else if human's turn and feedback on and engine
  ready: `startPreMoveAnalysis()` (analysis A, MultiPV 2). A is stored in
  `pendingAnalysis`; it does **not** lock the board.
- **`handleUserMove()`**: after `chess.move()` succeeds and before `afterPositionChange()`:
  `const pre = this.preMove` (must match `fen` of the position just left, else `null`);
  cancel any running A (`await this.cancelAnalysis()`); if feedback on and engine ready:
  run analysis B (`MultiPV 1`) **awaited** with the board locked (`movableColor null`,
  status suffix "— hodnotím…"), classify, store the glyph, then `afterPositionChange()`
  which starts the opponent's reply. If B is cancelled (transition), no glyph.
  `handleUserMove` is already async and already routed through the bridge's `.catch`.
- **Transitions** (`newGame`, `undo`, `setDifficulty`, `setHumanColor`, `setFeedback`)
  extend `beginTransition()`: cancel **both** `pendingSearch` and `pendingAnalysis`
  (one `engine.stop()` covers both FIFO entries), then proceed as today. `undo()`
  truncates `annotations` to the new history length and clears `preMove`.
- **Options bracket**: `runAnalysis(kind)` = `engine.setOptions({ skillLevel: 20, multiPv })`
  → `engine.analyse(…)` → on settle `engine.setOptions({ skillLevel: level, multiPv: 1 })`.
  Because A runs while the human thinks, `maybeStartEngine` must never start while A is
  outstanding: it is only reached after B, and B is only started after A was cancelled
  and awaited — the invariant "at most one outstanding engine job" holds; the engine
  module still logs `console.error` if it is ever violated.
- **Rendering**: `render()` passes `annotations` to `renderMoveList` and the last human
  move's `{ square: to, glyph }` to `board.sync()`.

### UI
- Settings row gains `<label>Hodnocení tahů <select class="feedback"><option value="on">zapnuto</option><option value="off">vypnuto</option></select></label>`.
- Move list: `<span class="glyph glyph-blunder">??</span>` after the SAN; colours per
  decision 8; `title` = Czech name.
- Board badge: 0.3-square circle, white glyph text, top-right of the destination square.

## Explicitly NOT in this phase
Annotating the engine's moves; "Best/Excellent/Good/Book" labels; accuracy percentage or
game report; evaluation bar; hints/"show best move"; persistence of annotations; a second
worker; changing the difficulty ladder; sound/animation on a glyph (P5); PWA (P6).

## Definition of Done (browser, real clicks; thresholds via `debugLoadFen`)
1. Hang the queen from the start of a game (e.g. 1.e4 e5 2.Qh5 Nc6 3.Qxe5+?? is not a
   hang — use `1.e4 e5 2.Qg4 d5 3.Qg5??` where …Bxg5 wins the queen): the board shows a
   red `??` on the queen's square and the move list reads `Qg5??`.
2. A quiet inaccuracy (loss 50–100) and a mistake (100–300) from prepared FENs produce
   `?!` and `?` respectively; a best move in a balanced position produces no glyph.
3. `!`: a position with exactly one saving move (e.g. a forced recapture where every
   alternative loses ≥ 150 cp) → `!` when played.
4. `!!`: a sound piece sacrifice that is the engine's best move (prepared FEN, e.g. a
   Greek-gift Bxh7+ position that Stockfish confirms) → `!!`; the same sacrifice when it
   is *not* the best move but loses < 50 → `!?`.
5. Undo removes the glyph of the popped move from the list and the board; new game clears
   all glyphs.
6. Toggle off → no `setoption … MultiPV`/analysis `go` lines in the UCI log for a whole
   game; toggle on mid-game → the next human move is annotated.
7. Concurrency: press Nová hra / Zpět while "— hodnotím…" is shown → clean position, no
   stale glyph, no `console.error`; the opponent's reply never arrives before the glyph of
   the preceding human move is decided (order visible in the UCI log).
8. Human moves before analysis A finishes (level 1, fast play) → the move is accepted
   immediately and simply gets no glyph; no error.
9. Latency: UCI log timestamps show ≤ 2 × 700 ms added per human move on the desktop;
   typical < 500 ms. Checked once on the phone (subjective: still playable).
10. Engine-failed fallback: no analysis attempted, no glyphs, game playable.
11. `npm run build` strict; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty.

Commits: `Phase 4: plan` → `Phase 4: move feedback` (+ DoD results appended here) →
Pages deploy.
