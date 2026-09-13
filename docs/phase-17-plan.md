# Phase 17 — Game end: win / loss / draw for the child's king (B9, B16, B18) (plan, rev. 1)

## What this is and is not
B9's storyboard (goat headbutt / frog tongue, cross-faded panels) exists for two of
nineteen characters and every other one would need new artwork — content, not code, so
**not** done here. What the library already has for every character is its king image
and its noise (`sound`), and B18 fixes the rule: after a loss the opponent's animal does
not appear; the win shows only the winner. That is implementable now with CSS on the two
spectator kings, so this phase ships the *behaviour* of B9/B16/B18 without the panels;
the panels can replace the CSS animation later without touching the rule.

## Decisions (veto in review)
1. **Outcome from the child's point of view** once a played game is over (not in the
   review, not in a puzzle, not for a loaded record): `win` / `loss` / `draw`.
2. **Win:** the opponent's king disappears (B18: "the victory animation shows only the
   winner"); the child's king jumps three times (`king-jump`, 1.5 s) and shouts its
   victory cry — B16 resolved as the character's own noise (`sound`) plus a line from a
   small `ENDINGS.win` table ("Kvák! Vyhrál jsem! To byla partie.").
3. **Loss:** the opponent's king disappears; the child's king slumps (`king-sit`: sinks,
   tilts, 1.2 s, stays down) and says one quiet line from `ENDINGS.loss` ("Prohrál jsem.
   Sundávám korunu… Dáme si to znovu?") — no gloating anywhere on the screen. `Nová hra`
   is the "play again".
4. **Draw:** both kings stay and nod once (`king-nod`); the child's king: "Remíza. Podáme
   si ruce?".
5. **`Rozbor`** brings both kings back (the child chose to analyse; the review's
   commentary is unchanged — the mated king's "Prohrál jsem…" lines are its own voice).
6. Spectators are hidden with `visibility`, not `display`, so the board does not move.
   `prefers-reduced-motion` → no motion, texts only. Nothing is stored.

## Files
```
src/commentary.ts           MOD  ENDINGS table
src/ui/spectators.ts        MOD  outcome → classes, hidden opponent
src/game-controller.ts      MOD  outcome in render()
src/styles/app.css          MOD  keyframes
docs/BACKLOG.md             MOD  B9/B16/B18 status
```

## Definition of Done
1. Win (checkmate delivered): opponent spectator invisible, own king has `king-jump`,
   bubble starts with the character's noise; `Rozbor` shows both kings again.
2. Loss (mated): opponent invisible, own king `king-sit`, quiet bubble; nothing from the
   opponent anywhere on the screen (bubble hidden too).
3. Draw (stalemate): both visible, `king-nod`, draw line.
4. `Nová hra` resets classes and visibility; the board's position on the page is the
   same before and after (rect measured). `npm run build`; no debug code.

## DoD results (executed 2026-09-13)

Dev server, in-app pane, temporary `debugLoadFen`/`debugHumanMove` (removed; grep empty).
Playing black (kůzlata) against oslíci.

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Win | PASS | Fool's mate: opponent spectator `visibility: hidden`, own king `king black king-jump` (animation running), bubble `Mééé! Vyhrál jsem! To byla partie!`; `Rozbor` → both visible, review commentary as before |
| 2 | Loss | PASS | `1.Kh8?? Ra8#`: opponent hidden, no opponent bubble, own king `king-sit`, `Au. Byla to dobrá partie, i když ne pro mě. Ještě jednou?` |
| 3 | Draw | PASS | Stalemate: both visible, `king-nod`, `Půl bodu pro každého. Odveta?` |
| 4 | Reset / layout / build | PASS | `Nová hra` → classes and visibility back; board `top` 64 px before, during and after; `tsc` clean; grep empty |

Deviation: none from the plan; the storyboard panels (B9) stay unbuilt, as stated at the top.
