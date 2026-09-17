# Phase 19 — Captured pieces and material balance beside the board (plan, rev. 1)

Pilot feedback P5 (form, 2026-09-14): "nemám přehled, kolik a jaké figurky mi soupeř
vyhodil a vice versa — na chess.com vidím, že vedu +3". Each spectator king gets a tray
of the pieces its side has captured and, when ahead, the material difference.

## Decisions (veto in review)
1. **Where:** inside each `.spectator` row, between the king and the speech bubble. The
   row is already a `.cg-wrap`, so the tray's `<piece class="pawn black">` elements are
   drawn by the active piece set with no new CSS per set.
2. **What is "captured"** (`src/material.ts`, pure): pieces present in the game's start
   position (`startFen()`) and missing from the shown position, per colour, clamped at 0
   — so an endgame training shows only what was taken during the training, a promotion
   is a pawn lost (the extra queen does not become a negative capture). Order in the tray:
   pawns, knights, bishops, rooks, queens. **Balance** = material on the board (P 1, N 3,
   B 3, R 5, Q 9), the leading side shows `+N`; equal → nothing.
3. **When:** every render — play, two players, review (the reviewed ply's position),
   puzzles, training, loaded games. A tray with nothing captured and no lead is empty
   (no placeholder). It hides with the king after a win/loss (same `visibility`).
4. **Layout:** pieces 24 px overlapping by 8 px (15 pieces ≈ 250 px), `+N` in bold after
   them; the bubble shrinks (`min-width: 0`) rather than the row overflowing. On phones
   20 px pieces.
5. No setting, no storage, no controller state: derived from the position each render.

## Files
```
src/material.ts            NEW  capturedMaterial(start, shown) → { captured: {w,b}, balance }
src/ui/spectators.ts       MOD  tray rendering (textContent / element API only)
src/game-controller.ts     MOD  passes the shown position + startFen to renderSpectators
src/main.ts                MOD  markup: <div class="captured"></div> in both spectators
src/styles/app.css         MOD
README.md, docs/BACKLOG.md MOD
```

## Definition of Done
1. `1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5 6.Nxf7 Kxf7` → white's tray: pawn,
   black's tray: pawn + knight, black `+2`; equal material shows nothing.
2. Undo removes the last capture from the tray; new game clears both.
3. Review: stepping through a saved game changes the trays with the ply.
4. Endgame training from a FEN starts with empty trays; balance shows the real material
   (e.g. K+Q vs K → `+9` on the trainee's side).
5. Promotion: the promoted pawn shows as a lost pawn in the other side's tray; the
   balance counts the queen.
6. Win/loss: the opponent's tray disappears with the king; `Rozbor` brings both back.
7. Piece set switch mid-game restyles the tray pieces (same `.cg-wrap` mechanism).
8. Mobile width (375 px): trays fit, no horizontal overflow.
9. `npm run build`; no debug code; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty.

## DoD results (executed 2026-09-17)

Dev server, in-app pane, two-player mode for the move sequences; moves through a
temporary `debugHumanMove` hook (removed before commit).

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Capture sequence | PASS | after 6…Kxf7: black's tray `pawn, knight` + `+2`, white's `pawn, pawn`, no lead; after 5…Nxd5 both trays one pawn, nothing shown as lead |
| 2 | Undo / new game | PASS | undo of Kxf7 → black's tray `pawn`, white `+1`; new game → both trays hidden |
| 3 | Review | PASS | loaded 20-ply game: ply 0 empty, ply 10 pawn/pawn, ply 20 `pawn, knight, bishop, queen +7` vs `pawn ×3, knight, bishop`; back to ply 0 → empty |
| 4 | Training from FEN | PASS | K+Q vs K: both trays empty, `+9` on the trainee's side |
| 5 | Promotion | PASS | `k7/4P3/…` e8=Q → black's tray `pawn` (white), white `+9` |
| 6 | Win / loss | PASS | Rh8# → top spectator `spectator-gone`, its tray `visibility: hidden`; `Rozbor` → both visible |
| 7 | Set switch | PASS | `hlavy` → `klasicke`: the tray pieces' `background-image` changed from the kůzlata PNG to the bundled SVG |
| 8 | Mobile | PASS | 375 px: 20 px pieces, `scrollWidth === clientWidth` on the row, bubble shrinks beside a five-piece tray |
| 9 | Build / hygiene | PASS | `tsc` strict clean; hooks removed; grep empty at HEAD |

Deviation / found on the way: **the P3 settings did not persist** — `FEEDBACK_STORAGE_KEY`
and `UNDO_LIMIT_STORAGE_KEY` were `const`s declared *after* the controller construction
that reads them, so the read threw (temporal dead zone), the `catch` returned the default
and a stored `zapnuto` / `bez omezení` was ignored on every reload (before P3 the same
bug kept the feedback always on). Fixed by moving the two keys above the construction.
