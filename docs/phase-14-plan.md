# Phase 14 — Your own record per level (R1, option c) + B19 (plan, rev. 1)

## R1 — decisions (veto in review)
1. **No Elo numbers.** Backlog option (c): the player's own win/draw/loss record against
   each level, computed from the games already saved in IndexedDB. True, local, no
   measurement needed. Option (b)'s "approximate ranges" are not shown — nothing has been
   measured (the backlog's own argument).
2. **Records learn two fields**, both optional so old records stay valid: `level`
   (1–6, the level in force — a campaign step rounds to its nearest level) and `mode`
   (`play` | `campaign` | `training`). Old games without `level` count in the total only.
3. **Where:** a `Bilance` section at the top of the `Partie` dialog: one line per level
   (`3 · Žabka` with the player's current character names): `výhry : remízy : prohry`,
   then `Kampaň` and `celkem`. Training games (endgames) are left out — a won textbook
   ending is not a won game. Imported PGNs (`source: 'pgn'`) are left out too. A level
   without games shows `—`.
4. **Per opponent:** a second short table by opponent character (from `record.white/black`
   names), because the child thinks in animals, not numbers.

## B19 — only-move positions in the live feedback
- Human has exactly one legal move → no analysis A, no glyph (the move was the best).
- Opponent's reply is forced → analysis B evaluates the position *after* the forced reply
  (human to move), with a mate/draw short-cut when that position is already over.

## Files
```
src/games.ts                MOD  level, mode; statsFrom(records)
src/game-controller.ts      MOD  level in buildRecord; B19 in startPreMoveAnalysis / evaluateHumanMove
src/main.ts                 MOD  mode annotation before saving
src/ui/games-dialog.ts      MOD  Bilance section
src/styles/app.css          MOD
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. A finished game at level 3 appears in `Bilance` on the `3 · …` line with the right
   column; a campaign game on the `Kampaň` line; an endgame-training game nowhere; a
   pasted PGN nowhere; old records (no `level`) in `celkem` only.
2. Per-opponent table counts the same games by the opponent's name.
3. B19: a forced human move gets no glyph and triggers no analysis A; a forced reply is
   evaluated from the position after it (UCI log shows the post-reply FEN).
4. `npm run build`; no debug code; security checklist (new fields validated on read:
   `level` integer 1–6, `mode` one of three; text via `textContent`).

## DoD results (executed 2026-09-13)

Dev server, in-app pane, temporary hooks (`debugLoadFen`, `debugHumanMove`, `debugPlies`,
UCI log) — removed; grep empty. Fresh IndexedDB.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Bilance rows | PASS | Level-3 win (fool's mate as black) → `3 · Koza | 1 : 0 : 0`; campaign stalemate → `Kampaň | 0 : 1 : 0`; endgame-training mate → not listed; `celkem | 1 : 1 : 0`. Old records without `level` → `starší partie (bez úrovně)` row (by construction, none in the fresh DB); PGN records skipped by `source` |
| 2 | Per opponent | PASS | `žížaly | 0 : 1 : 0`, `kravky | 1 : 0 : 0` — the training opponent (myšky) absent |
| 3 | B19 | PASS | `k7/8/8/8/8/8/1r6/K7 w` (only `Kxb2`): no `go` before the move, no glyph. `7k/7p/6p1/8/8/8/8/RK6 w`, `Ra8+` with the forced `Kg7`: analysis B ran on `R7/6kp/6p1/… w` (the post-reply FEN), glyph null (a fine move) |
| 4 | Build / debug / security | PASS | `tsc` strict clean; grep empty; checklist run recorded |

Deviations: (a) the campaign's own hook ignores games that did not start from the
initial position (they are training), which the harness's `debugLoadFen` games trip —
real campaign games always start from the initial position; (b) the `indexedDB.open`
timeout was added after the harness got the database stuck behind a pending delete —
the app then never initialised its piece sets, which a user could hit with two tabs.
