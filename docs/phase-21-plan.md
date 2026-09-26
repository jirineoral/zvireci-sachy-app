# Phase 21 — Lessons: a teaching path (R6) (plan, rev. 0 — draft for the owner)

The owner's goal (2026-09-26): Zvířecí šachy become a **teaching platform**, not only a
place to play. A child who does not know how the knight moves should be able to start
here and walk, lesson by lesson, to the point where puzzles, endgames and the campaign
make sense. Browser-only, no account (the principle stays), Czech.

## What already exists and becomes part of the path
- **Play** against seven levels, the **campaign** (18 opponents), **move feedback** (P8).
- **Úlohy** — 3 200 puzzles in four bands; **Koncovky** — 17 engine-checked endgames.
- **Rozbor** — any game analysed move by move.

Lessons add the missing piece in front of all that: *explanation + guided practice*, and
each lesson ends by pointing to the right existing exercise ("teď si zkus 5 úloh z pásma
Začátečník", "Koncovka: Dáma a král proti králi").

## Decisions proposed (veto in review)
1. **Levels** (the owner's R6 list): Úplný začátečník → Začátečník → Mírně pokročilý →
   Středně pokročilý → Pokročilý → Expert → Mistr. **This phase ships the first two.**
   They are rules and basic tactics: content that can be verified mechanically. Levels 3+
   need a reviewer who plays well (see Risks) and come later.
2. **A lesson = 4–8 short steps.** Each step is one board position plus two or three
   sentences, spoken in a bubble by a teacher character, and optionally one task:
   - `show` — text and arrows/highlighted squares only, `Dál`.
   - `move` — "zahraj tah": one or more accepted moves; a wrong move gets a short hint
     and the board resets. Checked by chess.js (and `isCheckmate()` for mate tasks),
     never by guessing.
   - `collect` — the Lichess-learn classic: move one piece to eat all the stars/pawns on
     the board; teaches how a piece moves without any opponent.
   - `choose` — pick one of 2–3 answers ("je to šach, mat, nebo pat?").
3. **Positions and texts are code** (`src/lessons/*.ts`, like `endgames.ts`), not a
   fetched file: reviewed in git, type-checked, tested.
4. **Automatic checks before anything ships** (a script in `scripts/`): every FEN legal,
   every accepted move legal, every "mate" task really mate, every `collect` solvable,
   and for tactic tasks Stockfish confirms the accepted move is the best one by a clear
   margin (so there is no second equally good answer the child gets told off for).
5. **Progress** in `localStorage['skm.lessons']` (`{ done: { id: true } }`); a course map
   shows ticks, the next recommended lesson is highlighted. Nothing locks anything — a
   child who can already play goes straight to the campaign.
6. **UI:** a `Lekce` button next to `Úlohy` / `Koncovky` → course map (levels, lessons,
   ticks) → the lesson runs on the main board with the panel under the status (the same
   place as puzzles/endgames); `Zpět do hry` leaves.

## Curriculum draft — levels 1 and 2 (for the owner's review)

**1 · Úplný začátečník** (how the game works)
1. Šachovnice — bílé pole vpravo dole, řady, sloupce, jména polí (a1…h8)
2. Věž · 3. Střelec · 4. Dáma · 5. Král · 6. Jezdec · 7. Pěšec (`collect` in each)
8. Braní — kdo koho může vzít, figury se neskáčou (kromě jezdce)
9. Šach — co to je a tři způsoby, jak z něj ven (uhnout, zakrýt, vzít)
10. Mat — konec hry; mat v jednom tahu (5 úloh)
11. Pat — když nejde táhnout a není šach; proč je to remíza
12. Rošáda — kdy smí a kdy ne
13. Proměna pěšce · 14. Braní mimochodem
15. Kolik figury stojí (1-3-3-5-9) a proč nedávat figuru zadarmo

**2 · Začátečník** (first ideas)
1. Nechráněná figura — než táhneš, podívej se, co visí
2. Vidlička (jezdec, pěšec, dáma)
3. Vazba · 4. Dvojitý útok · 5. Odtažný šach
6. Mat na poslední řadě
7. Mat dámou a králem → Koncovky
8. Mat věží a králem → Koncovky
9. Zahájení — tři pravidla: střed, vývin, rošáda (+ co nedělat: brzy dáma, stejná figura 2×)
10. Šachový zápis — jak číst `Jf3`, `exd5`, `O-O` (so the move list and Rozbor make sense)
11. Jak si rozebrat vlastní partii (Rozbor + hodnocení tahů)

Each lesson closes with a pointer to practice: puzzles of the right band, an endgame, or
"zahraj si proti Kůzleti a zkus použít vidličku".

## Risks
- **Teaching something wrong** is the costliest failure (R6 note). Mitigation: rules
  lessons are checked mechanically (decision 4); every text is read by the owner before
  it ships; from level 3 on, a strong player reviews the content before it is written into
  code — AI drafts, a human signs off.
- **Text for ten-year-olds:** short sentences, "ty", no jargon without an example. The
  son is the test reader.
- **Scope:** ~26 lessons × ~6 steps ≈ 150 positions. Split: 21a = engine (lesson runner,
  step types, progress, course map) + the first 3 lessons end to end; 21b = the rest of
  level 1; 21c = level 2.

## Open questions for the owner
1. Who teaches? A fixed teacher character (e.g. the owl from the splash — not a piece set, a new drawing), or the animal the child plays?
2. Who reviews the chess content from level 3 on (a coach, a club player)?
3. Does the curriculum above match what you want the first two levels to cover?
4. Should lessons count toward anything visible (a badge / a line in `Bilance`), or stay
   plain ticks?

## Files (21a)
```
src/lessons/types.ts, src/lessons/level1.ts   NEW  step model, first lessons
src/lessons/progress.ts                       NEW  skm.lessons
src/ui/lesson-panel.ts, src/ui/course-map.ts  NEW
src/game-controller.ts                        MOD  startLesson (position, allowed moves, no engine)
src/main.ts, src/styles/app.css               MOD  button, wiring
scripts/check-lessons.mjs                     NEW  mechanical checks (decision 4)
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```
