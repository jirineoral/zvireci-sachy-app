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

## Phase 23b — full difficulty ladders (rev. 2)

Follow-up: every type above gets 6–8 positions ordered by difficulty (78 positions total,
up from 19), generated programmatically and tablebase/engine-verified rather than hand
authored, per this recipe (tooling lives in the session scratchpad, not the repo — it's a
one-off authoring aid, not something the app or CI needs):

1. **Mate types** (Dáma a král, Věž a král, Dvě věže, Dva střelci, Střelec a jezdec):
   random legal placement of the king + material for the human side and the lone black
   king, rejecting adjacent kings, a hanging piece (attacker piece a king's move from the
   black king), and positions already in check/mate/stalemate; two bishops are forced onto
   opposite-coloured squares. Query the tablebase for `category: "win"` and `dtm`; keep the
   existing id as one fixed rung and fill the rest evenly spread across the achievable dtm
   range (in plies).
2. **Král a pěšec / Pravidlo čtverce / Věž proti pěšci / Dáma proti pěšci**: same
   random-legal-placement approach with the pawn added (K+P vs K, K+R vs K+P, K+Q vs K+P);
   `kral-pesec`/`vez-pesec`/`dama-pesec-typ` ladders are ordered by dtm (win goal),
   `ctverec` (pravidlo čtverce, draw goal, human plays black) is ordered by the tablebase's
   per-move `category` breakdown — the fraction of legal replies that keep the draw ("safe
   move ratio"): high ratio = forgiving = easy, low ratio = only-move-ish = hard. `kp-draw`
   and `qvap` (the existing draw-goal exceptions) are kept as an extra final "different
   skill" rung rather than folded into the win ladder.
3. **Lucena / Philidor**: these are specific structural motifs, not just "any legal
   5-piece rook ending", so positions are template-varied (pawn file, king/rook offsets)
   around the two known-good patterns instead of placed fully at random. Lucena is ordered
   by dtm; Philidor (draw) by the same safe-move-ratio idea as Pravidlo čtverce.
4. **Průlom** (> 7 pieces, no tablebase): a 3-vs-3 pawn triangle (white pawns one rank
   behind, matching the "sacrifice to open a lane" motif) shifted across file groups, with
   the defending king at varying distance; Stockfish depth 20, ordered by centipawn score
   (a closer defending king scores lower = harder).

Every generated FEN went through the same `scripts/check-endgames.mjs` gate as the
hand-picked ones before being committed (see its output in the commit description / task
report). Titles follow `"<Typ> N/M"` (`"Dva střelci 3/7"`); hints are picked from a
per-type "easy/mid/hard" tier template rather than written per FEN (positions are
procedurally generated, so there's no single fixed square to point a hint at) except for
the two draw-exception tail rungs (`kp-draw`, `qvap`), which reuse their original,
hand-written hints.

## Phase 23c — chess review of the ladders (rev. 3)

A ~2200 player / kids' coach pass over all 78 generated positions (tablebase lines and
per-move breakdowns, Stockfish MultiPV for Průlom). Pure DTM / safe-ratio ordering let
through positions that were true but taught the wrong thing, so the recipe above is
superseded where it clashes with this:

- **Wrong type**: `lucena-1..3` were a mate in 1, a hanging rook and a king-walk (no bridge);
  `philidor-3/5` had the rook en prise with the king in the corner; `ctverec-1..3` were a
  hanging pawn / rook-pawn corner, not a pawn race; all six old `prulom-*` were 3-v-3 pawn
  chains *in contact* (the win was a plain capture, `exd5`), not a sacrificial break;
  `dama-pesec-typ-1/2/4/5` and `vez-pesec-1` had the pawn irrelevant or hanging.
- **Now**: Lucena = bridge steps backwards from "block the check" to the full position;
  Philidor = rook to the 6th → keep it there → drop back when the pawn reaches the 6th →
  only-move check from behind; Pravidlo čtverce = pawn races only, incl. the two-square
  pawn step; Průlom = 2-v-1 breaks, then the classic 3-v-3 `b6!`/`g6!` with the defending
  king ever closer (only one winning move from rung 3 on).
- **Mate types** got real mate-in-1 first rungs (two bishops, bishop + knight), `kr` (king
  already on the edge) moves before the two from-the-centre rungs.
- **Hints** are written per position (several generic tier hints suggested a wrong plan,
  e.g. "don't hurry with the pawn" where only the pawn run wins).
- `check-endgames.mjs`: tablebase requests throttled (≤ 3/s, 60 s back-off on 429), the
  reply count for win goals now counts winning moves only, and > 7-piece win positions are
  proven by a 3-ply lookahead into the tablebase (single-PV Stockfish at depth 20 scored the
  classic `b6!` breakthrough as 0.00).

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
