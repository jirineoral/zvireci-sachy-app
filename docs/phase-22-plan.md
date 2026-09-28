# Phase 22 — Lessons, levels 3–7 (plan, rev. 0)

Owner (2026-09-26): continue the teaching path up to „Mistr“; implementation by cheaper
agents where they cope, review by Opus. Format, step types, checks and the reviewer
checklist are those of Phase 21 (`docs/phase-21-plan.md`). Curriculum below was designed
by a reviewer agent in the role of a club/junior coach (Stappenmethode ≈ steps 2–6+,
mapped from memory, not web-checked).

## Findings in the data (before content)
- Puzzle tags without a Czech label (no filter): xRayAttack, bodenMate, hookMate,
  dovetailMate, blindSwineMate, operaMate, epauletteMate → add to `THEME_NAMES` where a
  lesson points to them, otherwise point to `mate` / `mateIn2`.
- Tags with no puzzles: smotheredMate, mateIn5; no „overloading“ tag (use `deflection` /
  `capturingDefender`). Thin: mateIn1 above začátečník, skewer (13–21 per band), enPassant (7).
- **Endgame tasks from level 4 on need a tablebase check** (accept every move keeping the
  win/draw) — Stockfish's „no other move within the margin“ does not fit pawn and rook
  endings. Authoring-time only (e.g. the Lichess tablebase API from `check-lessons.mjs`),
  never at runtime.
- Missing endgame ids for levels 6–7: Vančura, Réti, Saavedra, J/S vs pěšec, D vs V,
  pevnosti.

## Generation order (by how mechanically checkable)
1. **Level 3 — all** (tactics with big margins, mates, existing endgames).
2. **Level 4 — lessons 1–7 and 12.**
3. **Level 5 — lessons 1, 2, 9, 10**; then 4, 6, 7 (definitional „choose“, text review needed).
4. Last, after the tablebase checker + new endgame ids: L4 9–11, L5 3, 5, 8, 11, 12, all of L6–L7.

**Strong-player review (~2000+) before shipping:** L5 structure lessons (4, 6, 7), every
classic-game attribution (players, year, moves), every tablebase lesson, L7 1, 5, 6,
the Czech-heritage studies, the ⚑ terms (pick one each and add to the text lint).

## Curriculum (goal · tasks · practice)
Play levels: 4 Skokan, 5 Ropucha, 6 Žabí král, 7 Velmistr (names vary by character).

**Úroveň 3 — Mírně pokročilý** (practice mostly band lehké)
1. Odstranění obránce — take the only guard · `capturingDefender`
2. Přetížení — one defender, two jobs · `deflection`
3. Odlákání — force the defender away (back rank, blocker of a passer; Morphy's Opera game 16.Db8+! deflects the Jd7 blocker — moved here from Vlákání in the coach review) · `deflection`
4. Vlákání — lure king/queen onto a bad square (Légal; king lured onto a fork square) · `attraction`
5. Rentgen (skewer) — attack a piece standing in front of a more/less valuable one · `skewer`
6. Chycená figurka — no escape squares (knight on the rim, Noemova archa; the Sa7 trap was dropped: a sound child-level position did not hold up) · střední `trappedPiece`
7. Mezitah — insert a stronger move before recapturing (Elephant trap) · `intermezzo`
8. Matové obrazce I — dušený, Anastáziin, arabský · `anastasiaMate` / `arabianMate`
9. Matové obrazce II — Bodenův, epoletový, poslední řada s obětí · `mateIn2`
10. Mat 2. tahem — search order šachy, braní, hrozby; a quiet first move · `mateIn2`
11. Opozice · endgames `kp-win`, `kp-draw`
12. Pravidlo čtverce a závod pěšců · endgames `square`, `race`
13. Zkouška úrovně 3

**Úroveň 4 — Středně pokročilý** (lehké/střední)
1. Uvolnění (clearance) · `clearance`   2. Přerušení (interference) · `interference`
3. Mlýn (Torre–Lasker 1925) · `discoveredCheck`   4. Dvojšach a odtažný útok (Réti–Tartakower 1910) · `doubleCheck`
5. Řecký dar (Sxh7+, Jg5+, Dh5 — when it works) · `kingsideAttack`   6. Tichý tah · těžší `quietMove`
7. Mat 3. tahem, kandidátní tahy · `mateIn3`   8. Záchrana: věčný šach a pat (Evans–Reshevsky 1963) · `defensiveMove`
9. Klíčová pole a vzdálená opozice · `kp-far` (tablebase)   10. Trojúhelník, nevýhoda tahu (tablebase)
11. Průlom (a5 b5 c5 vs a7 b7 c7: b6!) · `advancedPawn` (tablebase)   12. Věž a dáma proti pěšci · `rvp`, `rvp2`, `qvbp`, `qvp`, `qvap`
13. Zkouška úrovně 4

**Úroveň 5 — Pokročilý** (střední)
1. Lucenova pozice (stavba mostu) · `lucena`   2. Philidorova pozice · `philidor`
3. Věž za volného pěšce (Tarraschovo pravidlo; tablebase)   4. Izolovaný, zdvojený, opožděný pěšec (choose)
5. Volný pěšec: krytý a vzdálený (tablebase)   6. Dobrý a špatný střelec (choose)
7. Slabé pole a forpost (choose, pawn geometry)   8. Dvě věže na sedmé řadě · `rookEndgame`
9. Mat dvěma střelci · `bb`   10. Slavné kombinace (Anderssen 1851, Lasker–Bauer 1889) · `sacrifice`
11. Nestejnobarevní střelci a pevnost (tablebase)   12. Oběť kvality (concrete, big margin) · `sacrifice`
13. Zkouška úrovně 5

**Úroveň 6 — Expert** (těžší) — mat 4. tahem; poslední řada a přetížení (pokročilé);
Rétiho studie; Lasker–Reichhelm 1901; Saavedrova pozice (podproměna); Vančurova pozice;
jezdec/střelec proti pěšci; mat střelcem a jezdcem (`kbn`); obranný tah; chycená figura
a tichý tah; vzájemná nevýhoda tahu; rozbor vlastní partie II; zkouška.

**Úroveň 7 — Mistr** (těžší; heavy review) — Byrne–Fischer 1956 17…Se6!!; dáma proti
věži; V+P proti V (krátká a dlouhá strana); pevnost; výměna do vyhrané pěšcovky;
profylaxe jako konkrétní tah; studie českých skladatelů (Réti, Prokeš, Fritz);
mat 4.–5. tahem; útok na krále (oběti na g7/h7/f7); mezitah v propočtu; dáma proti
pěšci na 7. řadě (výjimky c/f/a/h); velmistrovská partie + Rozbor; zkouška.

## Czech terms (⚑ = usage varies — pick one, add to the lint)
Tactics: dvojný útok · vidlička · vazba · rentgen ⚑ (= skewer here; x-ray = „útok/obrana
přes figuru“) · odtažný útok/šach · dvojšach · mlýn · přetížení · odlákání · vlákání ⚑ ·
odstranění obránce ⚑ · uvolnění pole/linie · přerušení · zablokování · mezitah · tichý tah ·
oběť, oběť kvality · chycená figura · podproměna · desperádo · věčný šach · kandidátní tahy ·
propočet. Avoid „zamezení“ as a title (use profylaxe).
Mates: dušený · Anastáziin (chosen spelling, linted: „Anastáziin mat“) · arabský · Bodenův · epoletový · na poslední řadě · Légalův ·
řecký dar ⚑.
Endings: opozice (přímá, vzdálená, diagonální) · klíčová pole ⚑ · trojúhelník/triangulace ·
nevýhoda tahu ⚑ (teach „zugzwang“ too) · vzájemná nevýhoda tahu · pravidlo čtverce ·
Lucenova pozice, stavba mostu · Philidorova pozice ⚑ (never „obrana“) · Vančurova pozice ·
Rétiho studie · Saavedrova pozice · Tarraschovo pravidlo · pevnost · průlom ·
nestejnobarevní střelci ⚑.
Structure: volný pěšec (krytý, vzdálený) · izolovaný · zdvojení pěšci · opožděný ⚑ ·
visící pěšci · pěšcová většina · pěšcový řetěz · slabé pole ⚑ · forpost ⚑ ·
dobrý/špatný střelec · dvojice střelců · otevřený/polootevřený sloupec · sedmá řada.

## Progress (checkpoint, 2026-09-28)
- **Done:** tablebase checker (`scripts/tablebase.mjs`, cache `scripts/tablebase-cache.json`;
  `check-lessons.mjs`: `tablebase` completeness, audit of every ≤ 7-piece move task from
  level 4 on with `tbNarrow`, choose facts `outcome` / `tbmoves`; `node
  scripts/check-lessons.mjs <id-prefix>` for quick runs). L4 lessons 8–11 (záchrana,
  klíčová pole, trojúhelník, průlom) + L4 test; L5 lessons 3, 5, 8, 11, 12 + L5 test; L5
  reordered to the plan's order.
- **Done (review):** test-lesson-runner cases; adversarial review (Opus, club player /
  junior coach role, tools: tablebase, Stockfish) — 3 errors (a wrong "forced" reply, a
  misdescribed outside-passer idea, „vyhru“ → „výhru“, now linted) and 15 wording/pedagogy
  points fixed. Evans–Reshevsky verified against chessgames.com (gid 1252040).
- **Owner decisions (2026-09-28):** the exchange-sacrifice lesson keeps the desperado Vxd4
  opening (owner indifferent). Key squares of 5th/6th-rank pawns and of rook pawns: yes,
  teach them later — add a lesson in L6. No strong player is available for now, so the
  planned strong-player read (tablebase lessons, Evans–Reshevsky, L5 structure lessons 4, 6,
  7) stays open; the Opus club-player review is the substitute until then.
- **L6 (2026-09-28, on branch, awaiting owner review):** `src/lessons/level6.ts`, 13 lessons +
  test, wired into `course.ts` (level title „Expert“, badge `l6`, diploma as before). Lessons:
  1 Mat 4. tahem · 2 Poslední řada a přetížení · 3 Klíčová pole: daleký a krajní pěšec (the
  owner's follow-up) · 4 Rétiho studie · 5 Korespondující pole (Lasker–Reichhelm) ·
  6 Saavedrova pozice · 7 Vančurova pozice · 8 Jezdec a střelec proti pěšci · 9 Mat střelcem a
  jezdcem · 10 Obranný tah · 11 Chycená figurka II (+ tichý tah) · 12 Vzájemná nevýhoda tahu
  (trébuchet) · 13 Rozbor vlastní partie II · 14 Zkouška úrovně 6 (11 tasks, pass 9).
  Decisions: the coach's curriculum order kept, the key-squares lesson inserted as 3 (right
  after the tactics, before the studies that use it); „Chycená figurka“ (not „figura“) as in L3
  and the puzzle theme label; Lasker–Reichhelm taught as *korespondující pole* (the coach's
  „vzdálená opozice“ does not explain it: the winning line 1.Kb1 Kb7 2.Kc1 Kc7 3.Kd1 is not
  opposition); no new Koncovky ids yet (Réti, Saavedra, Vančura, minor piece vs pawn stay
  lesson-only; practice points to existing endgames and puzzle themes).
  Checker additions: `best` takes an optional `depth` (Lasker–Reichhelm needs 24; at 18
  Stockfish rates Ka2 within 30 cp of Kb1); new choose fact `keysquares`, computed by an exact
  K+P vs K bitbase (`scripts/kpk.mjs`, retrograde, < 1 s). The bitbase confirms the taught key
  squares: 2nd–4th rank three squares two ranks ahead; 5th rank six (e5: d6 e6 f6 d7 e7 f7);
  6th rank six (d6: c7 d7 e7 c8 d8 e8) except the b/g pawn (b6: a7 b7 a8 b8 — stalemate);
  rook pawn a6: b7 b8 (the strict test fails further back only because the black king
  catches or blocks the pawn — the lesson teaches b7/b8 with the pawn safe).
- **Next:** L7 (not started).

## Level tests (same rules as L1/L2: no hints, one attempt, ~10 tasks, ≤2 mistakes)
- L3: odstranění obránce · přetížení (choose) · odlákání · vlákání · rentgen · mezitah ·
  named mate pattern (choose) · mate in 2 ×2 · kdo má opozici (choose) · chytí král pěšce (choose).
- L4: uvolnění · přerušení · mlýn/dvojšach · řecký dar funguje? · tichý tah · mat 3. tahem ·
  záchrana věčným šachem/patem · klíčové pole · průlom · věž proti pěšci (shipped as dáma
  proti pěšci: the king step — the rook-check task had no unique answer). 10 tasks, pass 8.
- L5 (shipped 2026-09-28): Lucena (most) · Philidor (choose) · Tarrasch (choose) · izolovaný
  pěšec · vzdálený volný pěšec (kdo vyhraje) · špatný střelec · dvě věže na sedmé (mat 2.
  tahem) · mat dvěma střelci · oběť (mat 2. tahem) · nestejnobarevní střelci (kdo vyhraje) ·
  oběť kvality. 11 tasks, pass 9.
- L6 (2026-09-28, on branch): mat 4. tahem · poslední řada (odlákání) · klíčové pole pěšce na
  6. řadě · Réti (mirrored) · podproměna (Saavedra mirrored) · Vančura (choose, tbmoves) ·
  jezdec proti pěšci (kdo vyhraje) · roh pro mat S+J (choose) · obranný tah · vzájemná
  nevýhoda tahu (kdo vyhraje) · chycená dáma. 11 tasks, pass 9. The coach review's list is
  kept except „distant opposition (move)“ (Lasker–Reichhelm needs a 9-piece engine check; the
  key-square task replaces it).
- L6 open doubts for a strong player: the wording of the *why* in Lasker–Reichhelm (taught as
  korespondující pole, kid-level); Vančura's „bílý král se před šachy nemá kam schovat“
  (Wikipedia's explanation, not a tablebase fact); „Střelci obvykle stačí hlídat jedno pole“;
  the rook-pawn key squares b7/b8 are taught with the pawn safe (the strict bitbase test does
  not hold when the black king catches or blocks the pawn).
- L7: see the coach review (session 2026-09-26, subagent transcript; recorded in this plan's
  curriculum and test lines) — to be written when that level is.
