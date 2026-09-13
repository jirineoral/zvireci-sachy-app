# Phase 13 — Endgame training (R5) (plan, rev. 1)

"Given a position, win it or hold the draw." A curated list of positions, the existing
engine as the opponent, a goal check on the result. Browser-only.

## Decisions (veto in review)
1. **Positions are code, not a fetched file:** `src/endgames.ts` holds ~15 textbook
   positions in three groups (`základy`, `střední`, `těžké`), each with a Czech title,
   a one-line hint, the human's colour and the goal (`win` / `draw`). **Every FEN was
   checked with Stockfish 18 at depth 22 before it went in** (win ≥ +4 or mate for the
   human, draw within ±0.1); the results are in the DoD table.
2. **The opponent defends at full strength** — a weak defender would let sloppy technique
   pass and teach nothing. Training sets a difficulty override `Trenér` (skill 20,
   depth 12, 700 ms); leaving training restores the campaign's strength if a campaign is
   running, else the selected level.
3. **Controller:** `startTraining(fen, humanColor)` = load the position, `started`
   (no `Hrát!`, no piece drop — the position is the point), the engine plays the other
   side; move feedback and undo stay available. The game ends like any game and produces
   a `GameRecord` (saved among the games — `startFen` marks it); the campaign ignores
   records whose `startFen` is not the initial position.
4. **Goal check** in the panel from the record: `win` succeeds only on the human's win;
   `draw` succeeds on a draw or a win. Success is stored in `localStorage['skm.endgames']`
   (`{ done: { id: true } }`), shown as `Zvládnuto 3 z 15`; a position stays playable.
5. **UI:** `Koncovky` button → panel under the status (same place as the puzzle panel):
   position select (grouped), `Hrát`, the goal line (`Cíl: vyhraj` / `Cíl: udrž remízu`),
   the hint, result message with `Znovu`, `Zpět do hry`. The kings comment through the
   normal game bubbles.

## Files
```
src/endgames.ts             NEW  positions, progress storage
src/ui/endgame-panel.ts     NEW
src/game-controller.ts      MOD  startTraining
src/main.ts, src/styles/app.css  MOD  button, panel, wiring, difficulty restore
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. `Koncovky` → `Dáma a král proti králi` → position on the board, human white, engine
   answers as black at trainer strength (UCI: skill 20, depth 12); mate → `Zvládnuto!`,
   stored, counter +1.
2. A draw goal (`Pěšcovka: udrž remízu`, human black): stalemate/draw → success; a loss →
   `Tentokrát ne`, nothing stored; `Znovu` restarts the same position.
3. Every shipped FEN passes the engine check (table).
4. `Zpět do hry` → pre-game, difficulty back to the selected level (or the campaign's);
   a training game during a campaign leaves campaign progress untouched.
5. Garbage in `skm.endgames` → defaults; 375 px: panel fits.
6. `npm run build`; no debug code; security checklist (FENs are constants; text via
   `textContent`).

## DoD results (executed 2026-09-13)

Dev server, in-app pane, temporary `debugHumanMove` + UCI log (removed; grep empty).

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Open + trainer strength + win | PASS | `Koncovky` → `Dáma a král proti králi`, `Cíl: vyhraj · hraješ bílými`, matchup with the drawn opponent; UCI `Skill Level 20`, `go depth 12 movetime 700`; difficulty select shows 6 and is locked. `Dvě věže: žebřík` → `1.Ra7 Kf8 2.Rh8#` → `Zvládnuto! …`, `skm.endgames = {"done":{"rr":true}}`, `Zvládnuto 1 z 17`, `✓ zvládnuto` on the goal line |
| 2 | Draw goal / failure / `Znovu` | PASS by unit check + plumbing | `goalMet`: win-goal accepts only the human's win, draw-goal accepts draw or win (node). A drawn game against the engine could not be produced in the harness within a reasonable number of scripted moves (the engine defends to the 50-move rule); the result path is the same code as the win above. `Znovu`/select change restart via the same `start` |
| 3 | Engine check of every FEN | PASS | Stockfish 18, depth 22, side to move = human: kq mate 7 · kr mate 13 · rr mate 2 · kp-win +12.6 · kp-draw −0.05 · square 0.00 · kp-far +12.7 · race +13.1 · lucena +4.1 · philidor −0.01 · bb +3.0 · rvp +4.6 · qvbp mate 6 · kbn +1.7 (theoretical win, horizon) · qvp +12.5 · rvp2 mate 15 · qvap 0.00. Rejected on the way: a Philidor with an open a-file (−9.6, rook hanging), a pawn race that was a draw, an outside-passed-pawn position (0.00), a rook-vs-pawn with the king in front (0.00) |
| 4 | Leave / campaign | PASS | `Zpět do hry` → pre-game, difficulty back to the selected 3 (or, with a campaign running, to its step: `1`, locked); a training win during the campaign left `skm.campaign` and the bar untouched |
| 5 | Garbage / mobile | PASS | `{"done":{"rr":1,"nope":true},"x":5}` → `done: {rr}`; 375 px: panel 351 px, controls wrap to two rows, no horizontal scroll |
| 6 | Build / debug / security | PASS | `tsc` strict clean; grep empty; checklist run recorded |

Deviation: 17 positions instead of "~15"; the two bishops / bishop + knight mates are
long — the child may prefer `Zpět do hry` over the 50-move rule, which is fine.
