# Phase 12 — Piece drop at game start (R9) (plan, rev. 1)

Status of the prerequisite, as the backlog asked to report: the Phase 8 landing animation
is intro-only (overlay pieces over the plate image, `src/intro/`). It is **not** extracted;
R9 gets its own small module that animates chessground's real `piece` elements, which is
what the backlog's "must end exactly where the real board is" requires anyway. Nothing
leaves the browser.

## Decisions (veto in review)
1. **When:** on `Hrát!` (the pre-game → playing transition), i.e. after the child picked
   the character and the colour. The pieces that are already on the board jump to their
   start pose (above the board, small, transparent) and rain into the starting position;
   the far side (opponent) lands first, the near side last. Playing white and simply
   making a move (no `Hrát!`) starts the game without the drop, as today.
2. **How:** Web Animations API on each `.board piece` element: keyframes prepend a
   `translateY(-60vh) scale(0.6)` to the element's own chessground `transform` (read
   from the inline style), 450 ms with a squash-and-settle at the end, per-piece delay
   0–450 ms by board row plus a little jitter → **≈ 0.9 s total**. No overlay, no second
   set of images; when the animation ends the element is exactly where chessground put it.
3. **Engine and board wait:** the controller gets `onGameStart(color): DropHandle | null`
   in its options; while the handle is pending the board is locked (`movableColor` null)
   and the status reads `Figurky nastupují…`; when it settles, `afterPositionChange()`
   runs — the engine opens only then. `newGame()` / `startPuzzle()` cancel a pending drop.
4. **Skip:** the first `pointerdown` or `keydown` anywhere finishes every animation at
   once (`Animation.finish()` → pieces snap into place, promise resolves). Reduced motion
   → no motion at all, the announcement alone shows for 0.8 s.
5. **Announcement:** `.announce` over the board during the drop: `KŮZLATA vs. HADI`
   (names of the two sides, uppercase, human first), second line `soupeř 7 z 18` in the
   campaign; fades out with the last landing. Pair families / no library: colours instead
   (`BÍLÉ vs. ČERNÉ`).
6. **Setting** `Nástup figurek` (zapnuto/vypnuto) next to `Intro`, `localStorage
   ['skm.pieceDrop']`, default on.

## Files
```
src/ui/piece-drop.ts        NEW  dropPieces(board, announceEl, text): DropHandle; setting read/write
src/game-controller.ts      MOD  onGameStart option, `starting` flag, cancel on transitions
src/main.ts, src/styles/app.css  MOD  announce element, setting select, wiring
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. `Nová hra` → `Hrát!`: pieces rain into the starting position, ≈ 1 s, and end exactly
   where chessground has them (transforms equal before/after); the announcement shows
   the two characters; playing black, the engine's first move arrives only after the drop.
2. Playing white: the board is locked during the drop and accepts a move right after.
3. A click during the drop ends it at once; `Nová hra` during the drop cancels it and the
   next `Hrát!` drops again.
4. Setting off → no drop, no announcement, engine opens at once; the setting persists;
   `prefers-reduced-motion` → announcement only.
5. Campaign: announcement carries `soupeř n z 18`.
6. Mobile 375 px: announcement fits the board width.
7. `npm run build`; no debug code; security checklist (announcement text via
   `textContent`, no new storage beyond one boolean key).

## DoD results (executed 2026-09-13)

Caveat that applies to every visual item: neither the in-app pane nor a background Chrome
tab renders frames for this session (`requestAnimationFrame` never fires, the document
timeline stands still), so the animation could only be observed at its start pose and at
its end, never in flight — **please watch one drop yourself.** Everything else is
measured from the DOM.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Drop + announcement + engine waits | PASS (motion by construction) | 32 pieces get a start pose of `translateY(-60vh) scale(0.6)` prepended to their chessground transform, opacity 0; after the drop every inline transform is byte-identical to before; announcement `KŮZLATA VS. HADI`; status `Figurky nastupují…`; playing black, `1.d4` arrived at **958 ms** after `Hrát!` (drop 930 ms + search) |
| 2 | White locked / free after | PASS | `movableColor` null during the drop (status text), `Na tahu: bílý` and a movable board right after |
| 3 | Skip / cancel | PASS | A `pointerdown` ended the drop at once (status `Na tahu: černý`, announcement hidden, no piece animation left); `Nová hra` during the drop cancelled it and returned to the pre-game state |
| 4 | Setting / reduced motion | PASS / by code path | `vypnuto` → no animation, no announcement, engine moved at once; `skm.pieceDrop = off` persisted. Reduced motion: the `matchMedia` branch skips every piece animation and shows the announcement for 0.8 s — not driven (no emulation in the harness) |
| 5 | Campaign line | PASS | `KŮZLATA VS. ŽÍŽALY` / `soupeř 1 z 18` |
| 6 | Mobile 375 px | PASS | Announcement 170 × 69 px centred on a 331 px board, `font-size` 25.6 px |
| 7 | Build / debug / security | PASS | `tsc` strict clean; grep empty; checklist run recorded |

Deviations: a forwards-filled announcement animation piled up per game until it was
cancelled instead of finished (fixed); the intro's landing code was not extracted
(decision at the top of this plan).
