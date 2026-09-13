# Phase 9 — Analysis view with game replay (R4) + saved games (plan, rev. 1)

First item of the player's list in the parent's build order (R4 → R2 → R5 → R1 → R3 → …).
R4 is the shared infrastructure: a game record that any source can produce (the game just
played, a saved game, a pasted PGN, later chess.com), and a review that evaluates the
whole game with the local engine. Everything is in the browser; nothing touches the GATE.

## What ships
1. **Game records** — `{ id, playedAt, sans[], startFen, result, humanColor, white/black
   character names, plies[] feedback, source }`. Every finished game in the app is saved
   automatically to IndexedDB (`skm` database, new store `games`, DB version 2; the
   `userSets` store is untouched). A `Partie` button opens a dialog listing them (date,
   pairing, result, moves) with `Otevřít` (into the review) and `Smazat`, plus a `Vložit
   PGN` textarea for any game (chess.js `loadPgn`; a rejected PGN shows a plain Czech
   message). This is the server-free "games played in this app" half of R3 and the entry
   point the chess.com half will reuse.
2. **Whole-game analysis** — in the review, `Analyzovat partii` runs the engine
   (Skill 20, MultiPV 2, the feedback's `ANALYSIS` limits: depth 12 / 700 ms) over every
   position of the game, sequentially, with a progress text (`Analyzuji… 14/62`), cancel
   on `Nová hra`/leaving the review. Per ply it stores the eval of the position (white
   POV), the engine's best move (SAN) and a glyph for **both sides** with exactly the
   live feedback's `classifyMove` rules (so the review of an imported game reads like a
   game played here). Play-time glyphs are shown until the analysis replaces them.
3. **Review upgrades** — an eval bar beside the board (white POV, mate shown as `M3`),
   the engine's best move for the shown position as a green arrow on the board, glyph
   badges for either side's move, glyphs in the move list for both sides, bubbles as
   today (the opponent's king now gets `?`/`??` lines too, with the better move).
   The review can open any record, not only the game just finished.

## Decisions (veto in review)
1. Analysis runs through the controller's engine with the existing transition protocol
   (`beginTransition` cancels it; one outstanding job at a time). It is only offered in
   review mode, when no game search can be running.
2. Eval numbers: centipawns from the engine's `PvLine.scoreCp` (mate-normalised
   ±(10000−n)) converted to white POV; the bar maps cp through `1/(1+10^(-cp/400))`
   clamped to 5–95 %, text `+1.3` / `−0.4` / `M3`.
3. The best-move arrow shows the engine's line for the **position on the board**
   (what should be played next), not the alternative to the move just made — the bubble
   already names that. Arrow only in review, only after analysis, drawn with chessground's
   `autoShapes` (brush `green`), never for the final (game-over) position.
4. Loading a game (saved or PGN) enters the review directly at ply 0 with the recorded
   pairing (characters) when it was an app game, otherwise the current pairing. `Nová hra`
   leaves it. Records of unfinished imported games are reviewed as they are; `result`
   `*` is shown as "nedohráno".
5. Auto-save: one record per finished game (mate, stalemate, draw), written when the
   status becomes `over`; a game abandoned by `Nová hra` is not saved (nothing to review).
   Games loaded from PGN are not saved unless the user presses `Uložit` in the dialog
   (decision: yes, offer it — one button, and it is how a tournament game gets into the
   list until R3's chess.com import exists).
6. Storage: same fallback as user sets — IndexedDB unavailable → in-memory list for the
   session with the one-sentence notice.
7. PGN paste accepts headers or bare moves; `loadPgn` strict = false; the record's
   `startFen` honours a `[FEN]` header.

## Files
```
src/db.ts                  NEW  shared IndexedDB opener (version 2: userSets + games)
src/user-sets.ts           MOD  uses db.ts
src/games.ts               NEW  GameRecord, store (IDB / memory), PGN → record
src/analysis.ts            NEW  whole-game analysis over the Engine (cancelable, progress)
src/game-controller.ts     MOD  loadGame(record), analyseGame(), auto-save hook, arrow/eval in sync/render
src/board-bridge.ts        MOD  optional best-move arrow in sync()
src/review.ts              MOD  PlyRecord gains evalCp/bestSan; glyph templates for either side
src/ui/eval-bar.ts         NEW
src/ui/games-dialog.ts     NEW  list, open, delete, PGN paste, save
src/main.ts, src/styles/app.css  MOD  buttons, dialog, eval bar layout
README.md, docs/BACKLOG.md (R3 part 2 done), docs/security-review.md  MOD
```
No new dependency. PGN text is parsed by chess.js only and rendered through `textContent`.

## Not in this phase
chess.com API (R3), variations/branches, "play from here", eval graph, puzzles (R2),
any change to the live feedback thresholds, the ladder or the intro.

## Definition of Done
1. A finished game appears in `Partie` with date, pairing, result; `Otevřít` shows it in
   the review with the play-time glyphs; `Smazat` removes it; reload keeps the list.
2. `Analyzovat partii` on a ~40-ply game: progress counts up, finishes in the expected
   time (≈ 40 × ≤ 0.7 s on desktop, less with TT hits), then every ply has an eval, both
   sides have glyphs where deserved, the eval bar follows the navigation, the arrow shows
   the best move for the displayed position and disappears on the final position.
3. Cancel: `Nová hra` during analysis stops it cleanly (no late writes into the new
   game, no console errors).
4. Pasted PGN (headers + moves, and bare moves) opens in the review; garbage PGN → Czech
   message, nothing changes; a PGN with a `[FEN]` header replays from that position;
   `Uložit` puts it into the list.
5. A game reviewed after analysis shows `?`/`??` bubbles for the engine's mistakes too,
   with the better move named.
6. Blocked IndexedDB → session list, app playable.
7. Mobile 375 px: eval bar does not squeeze the board below usable width; dialog fits.
8. `npm run build` strict; no leftover debug code; security checklist (PGN is data,
   parsed by chess.js; new IDB store; no new sinks).

## DoD results (executed 2026-09-13)

Tested on the Vite dev server (Chromium, in-app pane) with a temporary `debugLoadFen` /
`debugHumanMove` hook for finishing a game (removed; `git grep -e SKM_DEBUG -e debugLoadFen
HEAD -- src` empty). Dialog actions were real DOM clicks / `change` events.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Finished game saved, listed, opened, deleted, persists | PASS | Mate from a prepared position → record `kůzlata (ty) × myšky`, `1 : 0 · 1 tahů`, `humanColor w`, stores `games` + `userSets` (DB v2); `Otevřít` enters the review at ply 0; the list survives a reload; `Smazat` (confirm) removes |
| 2 | Whole-game analysis | PASS | Morphy's Opera game (33 plies): progress `analyzuji… n/34`, ≈ 2 s on the desktop (TT hits), evals on every ply, glyphs for both sides (`10.Nxb5!`, `13.Rxd7!!`, `16.Qb8+!!`, `9…b5?`, `12…Rd8?!`), eval bar follows the navigation (`+0.4` → `+5.6` → `M2` → `M0`), the green arrow shows the engine's move for the shown position (e.g. Qf3→b3 before `7.Qb3`) and is absent on the final position |
| 3 | Cancel | PASS | `Nová hra` at `2/34` → pre-game state, no late writes (fresh start position, no glyphs), no console errors |
| 4 | PGN | PASS | Headers + moves and bare moves both open; garbage → Czech message, nothing changes; `[FEN]` honoured by construction (`startFen` from the header, replay via `positionAt(startFen, …)`); `Uložit do partií` lists the game; players `Bílý/Černý` when tags are missing (chess.js fills `?`) |
| 5 | Both sides' bubbles | PASS | `Bg4?! Nic hrozného… exd4 bylo přesnější.` from the mice's king; `Nxb5! Tenhle tah by našel jen málokdo.` + `Píp… Tak to byl podraz.` |
| 6 | Blocked IndexedDB | PASS by code path | `openGameStore()` falls back to the memory list like the user sets (same `openDatabase` rejection path tested in Phase 7); the dialog says so |
| 7 | Mobile 375 px | PASS | Board 331 px next to a 14 px bar, no horizontal scroll, arrow and bar visible, dialog fits |
| 8 | Build / debug / security | PASS | `tsc` strict, 150 kB JS; grep empty; `npm audit` 0; PGN parsed by chess.js only; new IDB store shape-checked on read |

Findings and deviations:
- **Only-move positions**: Stockfish answers a position with a single legal move instantly
  with a depth-1 score; the analysis now takes the next position's eval for such
  positions (walking backwards). The live feedback's analysis A has the same blind spot
  when the human has exactly one legal move — recorded in the backlog, not changed here.
- Engine strength caveat: the lite engine at depth 12 / 700 ms called `15.Bxd7+` a `??`
  in the Opera game (it prefers `15…Qxd7` for black and misses the depth of the mate);
  a stronger setting would agree with history. The verdicts are the engine's, at this
  depth — shown as such.
- An analysed PGN game is kept in the list even without `Uložit` (the analysis is saved
  with it) — a small extension of decision 5.
- The pairing of a loaded game is not restored (the current characters stay on the board);
  the matchup line shows the record's players instead (`Rozbor: Morphy × Duke · 1 : 0`).
- `Zpět` is disabled while a loaded record is on the board (a saved game is not continued).
- The eval bar's number is rotated text on a 14 px bar — legible on desktop, small on a
  phone; the bubble/list carry the same information.
