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
1. `1.e4 d5 2.exd5 Qxd5 3.Nc3 Qxd2+ 4.Qxd2` → white's tray: pawn + queen, black's: pawn +
   pawn; nobody leads (+0 hidden)… then check the queen exchange shows `+0` → nothing;
   after `4…Nf6 5.Qd8+`?? not needed — instead: `1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5
   5.exd5 Nxd5 6.Nxf7 Kxf7` → white tray: pawn, black tray: pawn + knight, black `+3`.
2. Undo removes the last capture from the tray; new game clears both.
3. Review: stepping through a saved game changes the trays with the ply.
4. Endgame training from a FEN starts with empty trays; balance shows the real material
   (e.g. K+Q vs K → `+9` on the trainee's side).
5. Promotion: a pawn promoting shows as a lost pawn on the other side; balance +8 for
   the promoting side (queen 9 − pawn 1).
6. Win/loss: the opponent's tray disappears with the king; `Rozbor` brings both back.
7. Piece set switch mid-game restyles the tray pieces (same `.cg-wrap` mechanism).
8. Mobile width (375 px): trays fit, no horizontal overflow.
9. `npm run build`; no debug code; `git grep -e SKM_DEBUG -e debugLoadFen HEAD -- src` empty.
