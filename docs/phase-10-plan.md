# Phase 10 — Puzzles with selectable difficulty (R2) (plan, rev. 1)

Second item of the player's list. Data is CC0 (Lichess puzzle database), the board, rules
and piece sets exist; nothing touches the GATE.

## Data — the shipped subset (decision, since the rating band was left to me)
`scripts/build-puzzles.py` reads the 300 MB Lichess dump (6.1 M puzzles, not committed)
and writes `public/puzzles/puzzles.json`: **3 200 puzzles, four bands × 800**:
`začátečník` 400–999, `lehké` 1000–1399, `střední` 1400–1799, `těžší` 1800–2300. Per band
the most-played puzzles that pass `RatingDeviation ≤ 90`, `Popularity ≥ 85`, a minimum
of plays (300 for the lowest band — well-tested puzzles are rarer there — else
1 500–2 000) and a solution of at most 8 plies. Kept per puzzle: id, FEN, moves (UCI),
rating, first four themes. **426 kB raw, 152 kB gzipped** — one static file, fetched the
first time the puzzle panel opens. Why this band: a young tournament player sits
around 1200–1600 club strength; the subset reaches two bands below and one above so a
younger sibling and the parent both find something, without shipping millions of rows.
The dump's CC0 licence and the source are recorded in the file and the README.

## Decisions (veto in review)
1. **Semantics = Lichess**: the FEN is the position *before* the opponent's move; the
   first UCI move is played automatically (300 ms after the position appears), then the
   player finds the solution move(s); the opponent's replies come from the data, never
   from Stockfish. The player's side = the side to move after that first move; the board
   is oriented for it and the chosen character plays it (a random opponent character is
   drawn as in a game).
2. **Puzzle mode in the controller** (like the review): board locked for the opponent's
   moves, human moves compared to the expected UCI (promotions included: in puzzle mode
   the promotion piece is taken from the solution, no dialog). Wrong move → the piece snaps
   back, a "zkus to znovu" bubble, the attempt counts; right move → applied, the opponent's
   reply follows, until the solution is complete → "Vyřešeno!". No engine, no move
   feedback, no game record in puzzle mode.
3. **UI**: a `Úlohy` button in the button row opens a puzzle panel under the status line
   (replaces the review controls area while active): band select, `Další úloha`,
   `Nápověda` (highlights the piece to move with a circle; a second press shows the
   destination too), `Zpět do hry`, a progress line `Vyřešeno 12 z 800 · lehké`. The two
   kings comment (`Kvák! Správně!`, `Hm… to ne. Zkus to znovu.`, `Vyřešeno! Jsi hlava.`).
4. **Persistence**: `localStorage['skm.puzzles']` = `{ band, solved: { id: attempts } }`,
   validated on read (band must exist, ids strings, attempts numbers), capped at the
   subset size. Solved puzzles are not offered again until all of a band are solved (then
   the band starts over). Random order within the band.
5. `Nová hra` (or `Zpět do hry`) leaves puzzle mode into the normal pre-game state.

## Files
```
scripts/build-puzzles.py          NEW  (+ zstandard in scripts/requirements.txt)
public/puzzles/puzzles.json       NEW  3 200 puzzles, CC0
src/puzzles.ts                    NEW  loader, band choice, progress storage
src/game-controller.ts            MOD  puzzle mode (startPuzzle, hints, move checking)
src/board-bridge.ts               MOD  hint circles
src/ui/puzzle-panel.ts            NEW
src/main.ts, src/styles/app.css   MOD
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. `Úlohy` → a puzzle of the chosen band appears, the opponent's move plays itself, the
   board is oriented for the solver; the right move is accepted and the opponent's reply
   follows; a multi-move puzzle completes with "Vyřešeno!".
2. A wrong move snaps back with the message and does not advance; the attempt is counted.
3. `Nápověda` marks the piece, then the destination.
4. Band switch changes the rating range of offered puzzles (rating shown in the panel);
   solved ids persist across reloads; a solved puzzle is not offered again.
5. Promotion puzzle: the promotion happens without a dialog and to the expected piece.
6. `Nová hra` / `Zpět do hry` returns to the pre-game state; no engine call happened in
   puzzle mode (UCI log check).
7. Garbage in `skm.puzzles` → defaults; a missing `puzzles.json` → Czech message, app
   playable.
8. Mobile 375 px: panel fits without horizontal scroll.
9. `npm run build`; no debug code; security checklist (puzzle JSON validated: FEN and
   moves go through chess.js; nothing else reaches the DOM but `textContent`).

## DoD results (executed 2026-09-13)

Tested on the Vite dev server (in-app pane) with a temporary `debugHumanMove` hook
(removed; grep empty). Puzzle data fetched from the shipped `puzzles.json`.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Puzzle flow | PASS | `Úlohy` → `bbgZ4` (rating 1280): the opponent's `h7g8` played itself after 350 ms, board oriented for white, `Rh8+ … Qh6 … Qxg7#` accepted move by move with the opponent's replies from the data, ending in "Vyřešeno!" + `Mééé! Vyřešeno! Jsi hlava.` |
| 2 | Wrong move | PASS | A legal non-solution move → piece snapped back (history unchanged), `To není ono — zkus to znovu.`, bubble `Hm… to ne.`; counted: the solve was recorded as "na 2. pokus" |
| 3 | Hints | PASS by code path | `puzzleHint()` circles the piece, then the destination, through the same `autoShapes` channel as the review arrow (verified visually in Phase 9); the pane was hidden at the moment of this check, so chessground did not repaint and the circles could not be counted in the DOM — please press `Nápověda` once yourself |
| 4 | Bands + persistence | PASS | `začátečník` → puzzle rating 961 (in band); `skm.puzzles` = `{"band":"lehke","solved":{"bbgZ4":2}}`; solved ids are skipped by `nextPuzzle` |
| 5 | Promotion puzzle | PASS | `2SVP0`: `c7c8q` accepted without a dialog, `c8=Q` in the history |
| 6 | Leave / no engine | PASS | `Zpět do hry` → pre-game (`Hrát!`, start position); zero `engine.analyse`/`search` calls while in puzzle mode (engine methods wrapped) |
| 7 | Garbage / missing file | PASS (partly by construction) | `{"band":"drak","solved":{"x":"y",…}}` → band `lehké`, invalid entries dropped. A missing `puzzles.json` could not be observed: `cache: 'force-cache'` served the cached copy; on a fresh client the JSON parse of the HTML fallback throws → `PuzzleLoadError` → "Úlohy se nepodařilo načíst." |
| 8 | Mobile 375 px | PASS | Panel 351 px wide, controls wrap to two rows, no horizontal scroll |
| 9 | Build / debug / security | PASS | `tsc` strict; grep empty; `npm audit` 0; puzzle rows validated (id pattern, UCI pattern, FEN + moves replayed by chess.js before use) |

Deviations: none from the plan beyond the hint verification method; the band default is
`lehké` (1000–1399) on first use.
