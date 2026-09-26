# Phase 21 — Lessons: a teaching path (R6) (plan, rev. 1)

The owner's goal (2026-09-26): Zvířecí šachy become a **teaching platform**, not only a
place to play. A child who does not know how the knight moves starts here and walks,
lesson by lesson, to the point where puzzles, endgames and the campaign make sense.
Browser-only, no account (the principle stays), Czech.

rev. 0 → rev. 1: the owner's answers (below) and a review by an independent reviewer in
the role of a children's chess coach (curriculum order, phrasing, test, checklist).

## Owner's decisions (2026-09-26)
- **Teacher = the child's choice.** The first lesson opens with „Vyber si trenéra“: the
  owl (default — also the brand mascot for social media) or the animal the child plays
  (the son's wish). Switchable any time in the course map.
- **Nothing is locked, everything is skippable.** Progress lives only in the browser and
  can be lost; the child skips by memory. „Tohle umím“ on every lesson marks it done.
- **Badges and a printable diploma per level**, after a short test without hints. The
  child's name for the diploma is typed locally and never leaves the browser.
- **Content review is iterative:** the owner, reviewer agents set up for it, the son, and
  the community's feedback. Ship, collect feedback, iterate.

## What already exists and becomes part of the path
Play (7 levels), the campaign, move feedback, **Úlohy** (3 200 puzzles, 4 bands, Lichess
theme tags), **Koncovky** (17 engine-checked endgames), **Rozbor**. Each lesson ends with a
pointer into them. **Dependency:** pointers like „5 úloh: mat 1. tahem“ need a *theme
filter* in the puzzle picker (today it picks by band only) — part of 21a. Tags available
e.g. mateIn1 97×, fork 576×, pin 150×, backRankMate 133×, hangingPiece 56×.

## Decisions (veto in review)
1. **Levels:** Úplný začátečník → Začátečník → Mírně pokročilý → Středně pokročilý →
   Pokročilý → Expert → Mistr. **This phase ships the first two** (rules and basic tactics,
   mechanically checkable). Levels 3+ later, with a coach in the review loop.
2. **A lesson = 4–8 short steps**; one new idea per step; board position + 2–3 sentences
   in the teacher's bubble + optionally one task:
   - `show` — text, arrows, highlighted squares; `Dál`.
   - `move` — play the move; **every** correct answer is accepted (all mates, all moves
     within the engine margin); a wrong move explains *why* („tvůj král by byl v šachu“,
     „tady by ti vzal dámu“), then resets.
   - `collect` — one piece eats all the stars; teaches movement without an opponent.
   - `choose` — pick one of 2–4 answers (squares or texts).
   - `mini` — a mini-game against a deliberately weak engine with its own win condition
     (pěšcová válka: first to promote or take all pawns; seber všechny pěšce).
3. **Positions and texts are code** (`src/lessons/*.ts`), reviewed in git.
4. **Mechanical checks before shipping** (`scripts/check-lessons.mjs`): every FEN legal
   and consistent (side to move, castling/e.p. rights, no pawns on ranks 1/8, the side
   not to move not in check); every accepted move legal; every mate is mate; the list of
   accepted moves complete (all mates; Stockfish: no other move within the margin); every
   `collect` solvable in the stated number of moves; text lint (sentence length, informal
   „ty“, Czech piece letters, 0-0 not O-O, animal name + chess name in piece lessons).
5. **Progress** in `localStorage['skm.lessons']` (done lessons, passed tests, badges,
   teacher). A course map with ticks; the next lesson highlighted; nothing locked.
6. **UI:** a `Lekce` button → course map → the lesson runs on the main board with the
   panel under the status (like puzzles/endgames); `Zpět do hry` leaves.
7. **Animal skins:** piece lessons always name both („věž — u tebe třeba slon“ resolved
   from the chosen set), so the knowledge transfers to a club board.

## Curriculum (coach-reviewed)

**Úroveň 1 — Úplný začátečník**
1. Šachovnice a cíl hry — jména polí, „bílé pole vpravo dole“, cílem je mat, krále nikdo nebere
2. Věž — rovně, nepřeskakuje (collect s překážkou)
3. Střelec — šikmo, zůstává na své barvě (choose: dojde na hvězdu?)
4. Dáma — věž + střelec, ne jezdec
5. Král — o jedno pole; králové nikdy vedle sebe
6. Jezdec — do L (2 + 1), přeskakuje, přistane na opačné barvě; přeskočením nebere
7. Pěšec — rovně, bere šikmo, první tah o dvě, nikdy zpět, zablokovaný stojí
8. Proměna pěšce — dáma, věž, střelec, jezdec; dvě dámy jsou v pořádku
9. **Minihra: Pěšcová válka**
10. Útok a obrana — napadená × krytá figurka, „co visí?“
11. Kolik figury stojí — 1-3-3-5-9, výhodná a nevýhodná výměna; minihra Seber všechny pěšce
12. Základní postavení a pravidla — dáma na své barvě, bílý začíná, „dotknuto – táhnuto“ (na skutečné šachovnici)
13. Šach — uhnout, zakrýt, vzít; do šachu se táhnout nesmí
14. Mat — šach a žádná pomoc; 5–6 vlastních matů 1. tahem
15. Pat a remízy — pat; trojí opakování, 50 tahů, málo materiálu, dohoda (poslední tři pro zajímavost)
16. Rošáda — po šachu (podmínky ho používají)
17. Braní mimochodem — „zajímavost, klidně přeskoč“
18. Zkouška úrovně 1 → odznak, diplom

**Úroveň 2 — Začátečník**
1. Šachový zápis — K D V S J, pěšec bez písmena, x, +, 0-0 / 0-0-0
2. Co mi hrozí? — rutina před každým tahem: šachy, braní, hrozby
3. Dvojný útok
4. Vidlička (jezdec, pěšec) — až po dvojném útoku
5. Vazba — k králi nesmí táhnout vůbec, k dámě smí, ale přijde o ni
6. Odtažný útok, odtažný šach, dvojšach
7. Mat na poslední řadě (+ „okénko“)
8. Zahájení — střed, vývin, rošáda; ne brzy dámu, ne dvakrát stejnou figurou
9. Pozor na ovčáka — útok na f7/f2 a obrana
10. Mat dvěma věžemi (žebřík) → Koncovky
11. Mat dámou a králem (krabice, pozor na pat) → Koncovky
12. Mat věží a králem — „těžší, klidně přeskoč“ → Koncovky
13. Rozbor vlastní partie — zahraj si proti Kůzleti a otevři Rozbor
14. Zkouška úrovně 2 → odznak, diplom

**Tests** (no hints, one attempt, ~10 tasks, pass 8/10): name a square; knight collect in
N moves; squares the king may not enter; šach / mat / pat / nic in 3 positions; escape a
check where only block/capture works; mate in 1 (L1) / mate in 2 (L2); the free piece /
the best capture; „smí rošádovat?“ with a trap; promotion where a queen stalemates;
L2: fork / pin / back-rank mate, play a move read from notation.

**Exact phrasing for tricky rules** (from the coach review — use verbatim or close):
- Rošáda: „Rošádu smíš udělat, když: král i ta věž se ještě ani jednou nepohnuli; mezi
  nimi nic nestojí; král teď není v šachu, nepřejde přes pole, které soupeř napadá, a
  neskončí v šachu. Král jde o dvě pole k věži a věž přeskočí vedle něj na druhou stranu.
  Věž napadená být smí.“
- Braní mimochodem: „Když soupeřův pěšec skočí o dvě pole a zastaví se hned vedle tvého
  pěšce, můžeš ho vzít, jako by šel jen o jedno pole. Ale jen hned v dalším tahu.“
- Mat × pat: „Mat: král JE v šachu a nic ho nezachrání → konec, vyhrál ten, kdo dal mat.
  Pat: král NENÍ v šachu, ale hráč na tahu nemá žádný povolený tah → remíza.“
- Proměna: „…v dámu, věž, střelce nebo jezdce své barvy – ne v krále ani v pěšce. Můžeš
  mít dvě dámy. Skoro vždy chceš dámu.“

## Reviewer checklist (typical AI-lesson mistakes)
FEN errors (side to move, rights, rank-1/8 pawns, unreachable positions) · second
solutions rejected · wrong rules (castling banned after an earlier check, „věž nesmí být
napadená“, en passant later, pat = prohra, „musíš říct šach“) · anglicised terms
(dvojitý → **dvojný** útok, O-O → 0-0, N/B/R → J/S/V, pěšák → pěšec) · concepts used
before taught · more than one idea per step, long sentences, vykání · arrows that give the
answer away · „špatně“ without why · unnatural pattern positions · animal names without
chess names · a minigame engine too strong to beat · minigame rules mixed with real rules.

## Risks
- **Teaching something wrong** — mitigated by decision 4, the checklist, the owner's read,
  and the feedback loop; a coach before level 3.
- **Scope:** ~32 lessons × ~6 steps ≈ 190 positions.

## Split
- **21a** — engine: step types (show/move/collect/choose; mini later), lesson runner on
  the main board, progress, course map with the teacher picker, the puzzle theme filter,
  `check-lessons.mjs`; content: L1 lessons 1–7 (board + all pieces) end to end.
- **21b** — rest of level 1 incl. the pawn-war minigame, the level test, badge, diploma.
- **21c** — level 2.
- The owl teacher's drawing goes with B9 (images via ChatGPT); until then the owl is
  represented by a placeholder („Sova“ text avatar) or the child's animal.

## Files (21a)
```
src/lessons/types.ts, src/lessons/level1.ts   NEW  step model, first lessons
src/lessons/progress.ts                       NEW  skm.lessons
src/ui/lesson-panel.ts, src/ui/course-map.ts  NEW
src/game-controller.ts                        MOD  startLesson (position, allowed moves, no engine)
src/puzzles.ts, src/ui/puzzle-panel.ts        MOD  theme filter
src/main.ts, src/styles/app.css               MOD  button, wiring
scripts/check-lessons.mjs                     NEW  mechanical checks (decision 4)
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```
