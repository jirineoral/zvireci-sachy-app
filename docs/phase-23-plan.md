# Phase 23 — Endgame trainer restructure (plan, rev. 1)

Request (owner's 10-year-old): endgames grouped by category → type → ~7 positions of
increasing difficulty, with progress per position, instead of one flat grouped `<select>`
of 17 items.

## Structure

`Endgame` gets `typeId` (which type it belongs to) and `order` (1..7, increasing
difficulty within the type) instead of the old `group`. Two new lookup tables:

```
EndgameCategory { id, title }
EndgameType     { id, categoryId, title }
```

4 categories, 12 types, kept ids (all 17 existing positions slot in unchanged so
`skm.endgames` progress and the lesson `practice: [{ kind: 'endgame', id }]` pointers
keep working):

- **Maty** — Dáma a král (`kq`) · Věž a král (`kr`) · Dvě věže (`rr`) · Dva střelci
  (`bb`) · Střelec a jezdec — pro odvážné (`kbn`)
- **Pěšcové koncovky** — Král a pěšec (`kp-win`, `kp-far`, `race`, `kp-draw`) ·
  Pravidlo čtverce (`square`) · Průlom (`prulom-1`, `prulom-2`, new)
- **Věžové koncovky** — Lucena (`lucena`) · Philidor (`philidor`) · Věž proti pěšci
  (`rvp`, `rvp2`)
- **Dáma proti pěšci** — single type (`qvbp`, `qvp`, `qvap`)

Most types have 1–4 positions today, not the full 7 the request asks for — writing and
tablebase/engine-verifying ~60 more natural-looking positions is out of scope for this
pass (see Open items below). The two new `Průlom` positions replace an empty type (there
was no breakthrough example before).

## UI (`src/ui/endgame-panel.ts`)

Exported `EndgamePanel` interface (`open`, `close`, `current`, `onGameRecord`) is
unchanged — `main.ts` needs no edit beyond what's already wired. Inside: three selects
instead of one grouped list — kategorie → typ → position grid. The grid shows one button
per position (1..N) with a ✓ once solved; the goal/hint/message/progress rows are as
before. On success, `Další pozice` advances to the next unsolved position in the type (or
stays put with a "hotovo" message on the last one) in addition to `Znovu`.

## Verification (`scripts/check-endgames.mjs`, `npm run check:endgames`)

For every FEN: legal via chess.js, side to move === `human`, no pawns on ranks 1/8,
not already checkmate/stalemate. Then, by piece count:
- **≤ 7 pieces**: query `https://tablebase.lichess.ovh/standard?fen=…`; `category` must
  be `win` (human side to move, `goal: 'win'`) or `draw`/`win` (`goal: 'draw'`); print
  `dtm`/`dtz`.
- **> 7 pieces**: `node_modules/stockfish/bin/stockfish-18-lite-single.js` at depth ≥ 20;
  win needs `score cp ≥ 400` or a mate score; draw needs `|score cp| ≤ 150` or a
  provable draw goal (the existing draws in the table were already within that band).
  No tablebase DTM in this case — the script prints the centipawn score instead and
  notes "(engine eval, no DTM)".

Exits non-zero on any failure; used as a pre-merge gate like `check:lessons`.

## Open items (not done in this pass)

- Only `Průlom` got new positions; the other thin types (Dáma a král, Věž a král, Dvě
  věže, Lucena, Philidor: 1 position each) still need ~5 more each, authored and verified
  the same way, to reach "~7 per type".
- `Dva střelci` / `Střelec a jezdec` only have 1 position each too; more steps of
  increasing difficulty (king further from the corner, more spread-out pieces) would
  need hand-authoring since tablebases only rank by DTM, not by "looks natural for a kid".
