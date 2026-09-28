# U1 — UI review and redesign proposal

**Status: phase 1 implemented on a branch (not merged, not published), see §11.** This is backlog item U1 (docs/BACKLOG.md).

- **Reviewed against:** the live build `b128b2e` (https://zvirecisachy.cz/#bezmereni) and the source at `c08a665`, on 2026-09-28.
- **Revision:** the draft was revised after an adversarial review (§10 lists what changed).
- **How to implement:** in small steps (§7). Check each step in the browser and try it with the owner's son.

## 0. Summary

There is too much on the first screen, and nothing tells a first-time user what to do. The
features themselves are good: lessons, puzzles, endings, campaign, friend game, review. But each
one added a button, a panel or a setting at the same level. The result:

- **36 visible controls on the main screen:**
  - 10 `<select>`s;
  - 9 buttons of equal weight;
  - 2 disclosures;
  - 14 footer links.
- **The first step is hidden.**
  - Phone: "Hrát!" is at y≈1093. The layout viewport is 812 px, and the real visible height is smaller because of the browser's own bars.
  - Laptop: "Hrát!" is clipped at the fold (y 734–775 at 1366×768).
- **Half of the games start "dead".**
  - The default colour is `náhodně`.
  - If the child gets black, nothing happens until they find and press "Hrát!". A non-reader cannot read that word.
- **After any start, the phone page stays scrolled away from the board.** This happens after "Hrát!", Úlohy, Koncovky, Kampaň and lesson start.
- **Panels come in three styles:** modal dialogs, inline panels below the still-open settings, and the course map.
- **"Zpět" means four things:**
  - undo;
  - a lesson step back;
  - leave a panel;
  - cancel the friend link.
- **Opening Úlohy, Koncovky or Kampaň mid-game throws the game away without asking.**
- **Nothing above the fold tells a parent the site is safe.** Social and credit links are one tap from the child.

**The proposal: board first, one clear action, kid features one tap away, adult and online things
in a small menu.**

1. **"▶ Hrát" is drawn on the empty middle of the board** before the game. It is always in the first viewport, and it is the only start control.
2. **Six picture tiles for the modes:** Lekce, Úlohy, Koncovky, Kampaň, Kamarád, Moje partie. A tile resumes where the child left off.
3. **Settings go into a sheet with four groups:** Hra, Pomocníci, Vzhled, Zvuk. The most-used values sit on a chip above the tiles.
4. **One panel template**, with fixed "◀ Zpět" (top-left) and "Dál ▶" (bottom-right).
5. **A "☰ Pro rodiče" menu** for chess.com/PGN import, Turnaje, Vlastní figurky, privacy and links.

No existing `skm.*` value changes meaning. New defaults reach only genuinely new users (§8.1).

## 1. Method and evidence

- **Inventory.** I used Playwright (playwright-core driving the installed Edge) against the live site.
  - Viewports: 375×812 with touch, and 1366×768.
  - Output: each control's position and size, plus full-page screenshots of the main screen and all 7 panels.
  - The phone numbers are layout-viewport numbers. Real phones show less (§6.1).
- **Persona reviews.** Independent Opus reviewers clicked through the live site as three people:
  - (a) a 6–8-year-old who cannot read yet, on a phone;
  - (b) a 10-year-old club beginner, on a phone and a laptop;
  - (c) a parent on a laptop, checking safety, privacy and simplicity.

  Each persona was reviewed twice, once in an earlier run and once in this one, and the findings agree. The full reports and screenshots stay in the session scratchpad. The key evidence (measured px, code lines) is quoted in §2.
- **Adversarial review.** A separate Opus reviewer attacked the draft for simplicity, lost features, mobile fit and facts. See §10.
- **Code check.** I read these files:
  - `src/main.ts`: the template (lines 40–133) and the settings fold (lines 994–1035);
  - `src/game-controller.ts`: the pre-game gate `started` (line 200) and the "Hrát!" label (line 1332);
  - `src/ui/*`, `src/styles/*`, `src/piece-sets.ts`, `src/db.ts`, `src/difficulty.ts`, `src/puzzles.ts`.
- **Before screenshots**, in `docs/u1/`:
  - `before-desktop-main.jpg`: the laptop's first screen.
  - `before-mobile-endgames-full.jpg`: the whole Koncovky page on a phone, 1915 px tall. The panel is under 10 open settings.
  - `before-mobile-lesson.jpg`: lesson 1 on a phone. The board has scrolled off, and five buttons sit under the owl.

![Laptop, first screen](u1/before-desktop-main.jpg)

## 2. Findings

**Severity:** **B** blocker (the user cannot proceed), **M** major, **m** minor.
**Who** (the personas who hit it): a = non-reader, b = 10-year-old, c = parent.

| # | Sev | Who | Screen / element | Evidence | Problem |
|---|-----|-----|------------------|----------|---------|
| F1 | B | a,b,c | Main: "Hrát!" plus `Barva: náhodně` | Phone y=1093; laptop y=734–775. Pre-game gate `started` (game-controller.ts:200): as black nothing moves until "Hrát!"; as white, the first move starts the game. Taps on the board as black do nothing, even after 8 s. | For a non-reader, about half the games never start. |
| F2 | M | a,b,c | After "Hrát!", Úlohy, Koncovky "Hrát", Kampaň "Hrát", lesson start (phone) | scrollY 458–837 after these starts; the board is up to 644 px above the viewport. The only `scrollIntoView` calls in the code are for the confirm bar, dialogs and the move list. On the laptop, Koncovky shows only board ranks 1–3. | The engine's first move, the piece drop and the lesson stars all happen off-screen. |
| F3 | M | a,b,c | Main: "⚙ Nastavení" open by default | 10 selects, 32 px tall, no hints (main.ts:53–66). | The first screen is a form, and the labels are jargon: "Hodnocení tahů", "Nástup figurek", "Intro", "Tahy zpět". |
| F4 | M | b | Úlohy / Koncovky / Kampaň opened mid-game | `confirmDiscard` guards only Nová hra, lessons and the colour change (main.ts:206, 467, 713). Puzzles and endings start at once (main.ts:308, 387), and Kampaň "Hrát" calls `newGame()` unguarded. After "Zpět do hry" the move count is 0. | One curious tap loses a game in progress, and "Zpět do hry" promises the opposite. |
| F5 | M | a,b | The word "Zpět" | Undo "Zpět (3)"; lesson "◀ Zpět", "Zpět do lekcí", "Zpět do hry"; dialogs use "Zavřít". Kamarád's cancel "Zpět" (y 1212) is 47 px above the undo "Zpět (3)" (y 1259). A disabled "Zpět (2)" stays visible in Úlohy and Koncovky. | One word means undo, step back, leave and cancel. |
| F6 | M | b | Panel placement | Lekce, Kampaň, Partie and Turnaje are modal dialogs. Úlohy, Koncovky and Kamarád are inline. Koncovky starts with 0 moves, so `syncPanels` reopens Nastavení: the panel lands at y≈1093 and the page is 1915 px tall. Úlohy keeps it closed, so its panel is at y≈650. | Every mode behaves differently. |
| F7 | M | a,b | Mode buttons | 7 text-only buttons (main.ts:100–106), all the same weight. "Vzdát" and "Rozbor" take slots in the same grid, so the others move around. | There is no hierarchy and no pictures, and the layout shuffles. |
| F8 | M | a | Reading | No speech anywhere. Lesson level 1 has 61 "show" steps and 26 "choose" steps with text answers. The owl, the status and the confirm bar ("Opravdu…?", at the page bottom) are text only. | A non-reader needs a parent for every lesson step. |
| F9 | M | c | Trust information | The privacy text is at y≈991 on the laptop and y≈1330 on the phone, 12.8 px, grey. "reklam" appears nowhere. "nic o tobě neukládáme" next to "všechno zůstává v tomhle prohlížeči" reads as a contradiction. | The parent's first question ("Is it safe? Are there ads?") is not answered on the first screen. |
| F10 | M | a,c | Footer links | "Sleduj nás: Facebook · YouTube · Instagram" plus 7 credit links (main.ts:114–123). The credit links open in the same tab. | The child is one tap from YouTube or Instagram. Leaving through a credit link loses the game. |
| F11 | M | a,c | Kamarád | The green "Vytvořit odkaz" (112×28) creates a room with one tap (friend-panel.ts:298). "pošli jen tomu, s kým chceš hrát" appears only after the link exists. Kamarád and Turnaje look like offline features. | One curious tap creates a real online room, and online features are not marked. |
| F12 | M | c,b | Continuity | After a reload the move list is empty. The only guard is a `beforeunload` prompt (main.ts:966), which is unreliable on mobile, where Android also kills background tabs. | A game in progress is lost. |
| F13 | M | b,c | Beginner defaults | Obtížnost 3 is Skill 0 at depth 2, so it takes every hanging piece (difficulty.ts:31). Úlohy defaults to the "lehké (1000–1399)" band (puzzles.ts:95), with a first puzzle rated about 1325. | A real beginner loses fast and is given puzzles that are too hard. |
| F14 | M | b | Move quality on the phone | The board badge and the king's bubble exist, but only while "Hodnocení tahů" is on (the default is off). In Rozbor the ?!/? marks live in the "Tahy" list, which is folded to one 31 px line on the phone. There is no count and no legend (the labels exist in `GLYPH_LABEL`, feedback.ts). | "How good were my moves?" is the 10-year-old's main question. |
| F15 | M | a | Lekce course map | A 3 700–4 400 px list. The only exit, "Zavřít", is at the bottom (course-map.ts:54). There is no way to jump to a level. "Úroveň 2" starts 1211 px down. | A child gets stuck in a long text list. |
| F16 | m | a,b | Small targets | Lessons: "Začít" 51×30 next to "Tohle umím" 84×28. Koncovky ladder buttons 1–7 are 30×28. The selects are 32 px tall. | A stray tap skips a lesson or picks the wrong ladder step. |
| F17 | m | a | Intro | "Příště bez intra" (115×32) sits right under "HRÁT" (y 760 vs 686–750). | A near miss switches the intro off for good. |
| F18 | m | a | Whose turn | "Na tahu: bílý" is text. The spectator kings animate only at the end (jump, sit, nod). | A non-reader can't tell whose turn it is while the computer thinks. |
| F19 | m | b | Rematch | "Nová hra" returns to the setup screen, the settings unfold and the phone scrolls away again. "Soupeř: náhodně" picks a new animal each time. | There is no one-tap rematch against the same opponent. |
| F20 | m | b,c | Progress | Four separate counters: Lekce "0 z 18", Kampaň "Poraženo 0 z 18", Úlohy "Vyřešeno 0 z …", Koncovky "Zvládnuto 0 z 81". The diploma is only mentioned inside the level test. | There is no overview and no visible goal. |
| F21 | m | b,c | Labels | "Hraju za" vs "Barva" are confused. The Obtížnost names change with the animal ("3 · Koza" vs "3 · Žabka") and say nothing about strength. Two-player mode is hidden in Barva. | It is hard to tell what a setting does. |
| F22 | m | c | "Vlastní figurky…" | It sends the user to external image generators (user-sets-dialog.ts:117). | An adult task sits among the child's settings. |
| F23 | m | a | Kampaň with "Klasické" pieces | A `window.alert` text (main.ts:830). | A non-reader cannot read it. |
| F24 | m | all | Visual system | 283 hex literals (80 distinct). Only the board uses tokens (`--board-light/dark`). Text is mostly 0.8–0.85 rem. Dark theme only. | The bright illustrated intro clashes with the dark grey app, and there is no base for bigger kids' type. |

**What works well (keep):**
- **Lekce:**
  - "Nic není zamčené";
  - "Tohle umím";
  - the choice of trainer (Sova or your own animal);
  - clear levels;
  - the level test with badge and "Diplom 🖨".
- **Tone and safety nets:**
  - the blame-free tone ("Nevadí, z chyb se učíme");
  - the kid-voice king bubbles;
  - two-step confirmations ("Opravdu vzdát?").
- **Pieces:**
  - animal pieces that are easy to tell apart;
  - move dots when a piece is tapped;
  - sounds;
  - the king's end-of-game animations;
  - the star tasks.
- **Úlohy, Koncovky and Kampaň:**
  - Úlohy: 41 themes with counts, and "Nápověda".
  - Koncovky: ladders with a "Rada" hint.
  - Kampaň: the campaign bar and "Další: …" after a win.
- **Records:** Partie's win/draw/loss table by level and by opponent, and "zanalyzováno".
- **Privacy:**
  - soukromi.html ("Zkráceně" box, 24 h relay deletion, no names, chat or accounts);
  - `#bezmereni`;
  - nothing third-party loads until the user asks.
- **Big board:** on both widths.

## 3. Information architecture

### 3.1 What lives where

| Level | Content | Why |
|-------|---------|-----|
| **Always visible** | The board, with "▶ Hrát" on it before the game. The action row: game controls in a game, and "Odveta" / "Rozbor" after it. The settings chip. Six mode tiles: Lekce, Úlohy, Koncovky, Kampaň, Kamarád, Moje partie. The top bar: 🔊 sound, ⚙ settings, ☰ menu. One trust line. | What a child uses in every session. |
| **One tap: ⚙ Nastavení sheet** | The four groups (§5). | Changed rarely, by the parent or the 10-year-old. |
| **One tap: ☰ "Pro rodiče a pokročilé"** | Načíst partie (chess.com / PGN), Turnaje (Lichess broadcasts), Vlastní figurky, Soukromí a bezpečí, Napiš nám, O aplikaci a licence (credits and the social links). | Adult or online things, and links that leave the site. |
| **Removed from the main screen** | The long privacy paragraph, the credits and the social links. | Moved to ☰, soukromi.html and "O aplikaci". |

- **Control count on the main screen:** 36 → about 13 (1–3 action buttons, 6 tiles, 3 icons, the chip, the trust link).
- **Moje partie stays a kid tile.** It holds the child's own saved games, the win/draw/loss table and Rozbor. Only the import moves to ☰.
- **Nothing is lost.** Every current feature keeps a place:

| Feature | Moves to |
|---------|----------|
| "Jak poznat figurky?" | a "?" on the chip |
| Two-player mode | a Barva option, shown as 👥 on the chip |
| Campaign bar | stays above the action row while a campaign game runs |
| Review ⏮◀▶⏭, "Analyzovat partii", eval bar | stay in the Rozbor state |

### 3.2 First step (Lekce vs Hrát)

- The board stays the landing screen.
- While lessons are not started (`skm.lessons` absent or empty), the Lekce tile is first and highlighted, with a "Začni tady" badge.
- This needs no extra screen and no new key.
- The alternative, a one-time chooser, is open question Q1.

### 3.3 Pre-game fix (F1)

- **Where the button goes.** Before the game, a big green "▶ Hrát" is drawn over the empty middle ranks of the board. Ranks 3–6 are always empty in the start position, so it covers no piece.
  - It is in the first viewport on every phone.
  - As white, the child can still just move; the button then disappears.
  - It pulses gently, respecting `prefers-reduced-motion`.
- **What the owl says (text, later voice):** „Klepni na zelené tlačítko a hra začne.“
- **Default colour for genuinely new users:** bílá (Q3), with the new-user rule in §8.1.
- **The gate stays.** Its purpose is to let the child pick the animal and colour before the engine moves. The overlay only makes the gate visible.

### 3.4 Taps per journey (before → after)

| Journey | Now | Proposed |
|---------|-----|----------|
| Non-reader, first game as black | Scroll past 10 selects, read "Hrát!" (in practice fails) | 1 tap on the board button |
| Returning 10-year-old: next puzzle | 1 (Úlohy starts at once) + scroll to the board | 1 (the tile resumes the last band or theme and scrolls to the board). The picker is under "Seznam" in the panel header. |
| Change difficulty before a game | Open or scroll to settings + 2 | 1–2 (◀ 1 ▶ stepper on the chip) |
| Mute mid-game | 3 (unfold settings, select, option) | 1 (🔊 in the top bar) |
| Rematch | Nová hra + scroll + Hrát! + scroll | 1 ("Odveta", same opponent and settings) |
| Parent: "Is it safe?" | Scroll to the footer + read 60 words | Read the trust line in the first viewport; 1 tap to Soukromí |
| Play with a friend | 3 | 4. The extra tap is a deliberate safety step (Q7). |

## 4. One panel template

Every mode uses the same structure, whether it is showing a list or running on the board.

```
┌───────────────────────────────────────┐
│ ◀ Zpět        Úlohy      Seznam   3/10 │  header: back always top-left, title, list, progress
├───────────────────────────────────────┤
│  body: cards / owl bubble / hint       │
├───────────────────────────────────────┤
│ [ Nápověda ]                [ Dál ▶ ]  │  footer: secondary left, primary right, ≥ 48 px
└───────────────────────────────────────┘
```

- **Tiles resume.** A tile opens the mode where the child left off and starts at once, the way Úlohy does today. "Seznam" in the header opens the list: lesson levels, puzzle bands and themes, ending ladders, campaign animals.
- **Placement.**
  - Phone (below 900 px), list view: a full-screen sheet over the page.
  - Phone, on the board: a compact bar right under the board.
  - Laptop: the side panel.
  - On every start the board is scrolled into view (F2). On the laptop the board column is sticky.
- **Building blocks.** Build on `<dialog>.showModal()` for the focus trap, Esc and focus return. Keep the existing fallback for browsers without `<dialog>` (main.ts:136). Backdrop tap closes it.
- **Fixed words:**

| Meaning | Label | Replaces |
|---------|-------|----------|
| Leave this screen, one level up | **◀ Zpět** (always top-left) | "Zavřít", "Zpět do lekcí", "Zpět do hry" |
| Next step, item or position | **Dál ▶** (always bottom-right, primary colour) | "Další úloha", "Další pozice" |
| Take back a move | **↶ Vrátit tah (3)** (hidden in puzzles and endings) | "Zpět (3)" |
| A lesson step back | **◀ Krok zpět** | "◀ Zpět" in lessons |
| Cancel an action | **Zrušit** | the friend panel's "Zpět" |

- **Leaving a game.** Leaving a mode while a game is in progress asks with the existing `confirmDiscard` (F4), or offers autosave (item 14).
- **Tohle umím.** "Tohle umím" stays, in the lesson's secondary slot, away from "Začít".
- **Course map.** Levels become collapsible sections, or tabs "1 2 3 4 5", each showing its goal: „Zkouška → odznak a diplom“.

## 5. Settings

### 5.1 Grouping and defaults

The selects become toggles, segmented buttons and picture lists, all at least 44 px tall. The segmented buttons use `role=radiogroup`. Stored keys and values stay the same; only the control changes.

| Group | Setting (label) | Control | Key (unchanged) | Default for new users (§8.1) | Now |
|-------|-----------------|---------|-----------------|------------------------------|-----|
| **Hra** | Moje zvířátko | picture list | `skm.animal` | kůzlata | same |
| | Soupeř | picture list + 🎲 náhodně | `skm.opponent` | 🎲 | same |
| | Barva | bílá · černá · 🎲 · dva hráči | `skm.color` | **bílá** (Q3) | náhodně |
| | Obtížnost | ◀ n ▶ stepper, with the animal picture and a strength word | `skm.difficulty` | **1** (Q5) | 3 |
| **Pomocníci** | Hodnocení tahů | toggle | `skm.moveFeedback` | vypnuto (Q5) | same |
| | Vrátit tah | žádné · 3× · bez omezení | `skm.undoLimit` | 3× | same |
| | Předčítání (new, §6.3) | toggle | new `skm.speak` | vypnuto until piloted | — |
| **Vzhled** | Figurky | picture list of all families, including your own sets | `skm.pieceFamily` | Hlavy | same |
| | Úvodní animace | toggle | `skm.intro` | zapnuto | same |
| | Nástup figurek | toggle | `skm.pieceDrop` | zapnuto | same |
| **Zvuk** | Zvuky | toggle, mirrored by 🔊 in the top bar | `skm.sounds` | zapnuto | same |

- **Chip.** The Hra group appears as a one-line chip above the tiles. Example: „[kůzle] proti [kráva] · bílé · ◀ 1 ▶ · ✎ · ?“. In two-player mode it shows 👥 instead of the opponent. During a campaign game, difficulty shows as locked, with the reason as a tooltip.
- **Vlastní figurky.** "Vlastní figurky…" (creating sets) moves to ☰. Choosing an existing custom set stays in Figurky.
- **No automatic fold.** The sheet no longer opens and folds itself with the move count (main.ts:994–1035). It is opened on purpose and closed with ◀ Zpět.

### 5.2 Texts (Czech, proposed)

- **Group headings:** Hra, Pomocníci, Vzhled, Zvuk.
- **Hints** (one line, 0.9 rem):
  - Hodnocení tahů: „Po každém tahu tvoje zvířátko řekne, jestli byl dobrý.“
  - Vrátit tah: „Kolikrát smíš v jedné partii vzít tah zpět.“
  - Nástup figurek: „Na začátku figurky nastoupí na šachovnici.“
- **Obtížnost strength words:** 1–2 „nejlehčí“, 3–4 „střední“, 5–6 „těžká“, 7 „pro dospělé“.

## 6. Mobile layout, read-aloud, visuals

### 6.1 Height budget (real viewports, portrait)

The layout is computed from app.css: 12 px padding, 48 px spectator rows, 4 px gaps, plus a proposed 44 px top bar.

| Device (visible height with browser chrome) | Board | "▶ Hrát" on the board | Trust line | Tiles |
|---------------------------------------------|-------|-----------------------|------------|-------|
| Small Android 360×640 (≈ 560 px) | 336 px, y 104–440 | ≈ y 230–290 ✔ | ≈ y 495–515 ✔ | below the fold, 1 scroll |
| iPhone SE 375×667 (≈ 550–600 px) | 351 px, y 104–455 | ✔ | ≈ y 510–530 ✔ | below the fold |
| iPhone 12–15 390×844 (≈ 660–750 px) | 366 px | ✔ | ✔ | first row visible |

- Use `dvh` units, not `vh`.
- **Landscape phones** (for example 812×375) currently get the narrow layout, with a 560 px board in a 375 px viewport. Switch to the two-column layout whenever the viewport is wider than it is tall, with board = `min(55vw, 100dvh − 16px)`.

### 6.2 Wireframes

**Before, phone** (layout viewport 375×812, measured):

```
y=0    ┌─────────────────────┐
  64   │       BOARD 351     │
 415   │ own avatar          │
 480   │ Zvířecí šachy       │
 530   │ ▼ ⚙ Nastavení       │
       │ 10 selects (32 px)  │  ← Barva misaligned
 812 ══╪═════ fold ═════════ │  (real phones: fold at ≈ 560–650)
 949   │ [Vlastní figurky…]  │
1093   │ [Hrát!] [Zpět (3)]  │  ← primary action
1142   │ 7 grey text buttons │
1330   │ privacy paragraph   │
1546   │ FB · YT · IG        │
1573   │ 9 credit links      │
1649   └─────────────────────┘
```

**After, phone, before the game:**

```
     ┌─────────────────────┐
  0  │[logo] Zvířecí šachy 🔊 ⚙ ☰│  44 px
 48  │ opponent avatar     │
104  │ ♜♞♝♛♚♝♞♜            │
     │                     │
     │   [  ▶  HRÁT  ]     │  on the empty ranks 3–6
     │                     │
     │ ♙♙♙♙♙♙♙♙            │
440  │ own avatar          │
495  │ Zdarma · bez reklam · bez registrace · Soukromí │
≈560 ╞═════ fold (360×640) ═╡
     │ [kůzle] vs [kráva] · bílé · ◀1▶ ✎ ? │  chip
     │ [Lekce ★Začni tady] [Úlohy]   │  tiles 2 per row, ≥ 64 px,
     │ [Koncovky]   [Kampaň]         │  picture + one word
     │ [Kamarád 🌐] [Moje partie]    │
     └─────────────────────┘
```

**After, phone, in the game:** the button over the board is gone. Under the own avatar:
`Na tahu: ty` plus a glow on the king whose turn it is, then `[↶ Vrátit tah (3)] [Vzdát]`.
The chip is hidden and the tiles stay below. The move list is a fold under the action row.

**After, phone, after the game:**
`[↻ Odveta] [Rozbor] [Nová hra ✎]`. Rozbor shows ⏮◀▶⏭, "Analyzovat partii", the summary
„2 nepřesnosti · 1 chyba“ with a legend, and the unfolded move list with the marks.

**After, laptop 1366×768:**

```
┌──────────────────────────────────────────────────────────────┐
│ [logo] Zvířecí šachy (nejen) pro děti    Zdarma · bez reklam · Soukromí   🔊 ⚙ ☰ │
├───────────────────────────────┬──────────────────────────────┤
│                               │ Na tahu: ty (bílé)           │
│   BOARD 560 (sticky column)   │ [kůzle] vs [kráva] · ◀1▶ ✎ ? │
│   pre-game: [ ▶ HRÁT ] on it  │ [Lekce★] [Úlohy] [Koncovky]  │
│                               │ [Kampaň] [Kamarád🌐] [Partie]│
│                               │ ── in a mode: the panel (§4) │
│                               │ ── in a game: action row +   │
│                               │    move list                 │
└───────────────────────────────┴──────────────────────────────┘
```

Everything shown fits inside 768 px.

### 6.3 Targets, type, icons

- **Sizes.** Every tap target is at least 44 px; primary buttons are 56 px. Body text is at least 1 rem, secondary text at least 0.875 rem.
- **Icons.** Use inline SVG or the app's own animal art for icons, marked `aria-hidden`, and keep the text label. Do not use emoji.
  - Emoji render differently on Android, Windows and iOS; for example 🧩 shows as tofu on Android before version 9.
  - Screen readers read emoji names aloud.
  - The emoji in this document are placeholders.

### 6.4 Read-aloud (F8)

- **Button.** A read-aloud button, with the owl or 🗣 icon (not 🔊, which is the sound toggle), sits on the owl bubble and the status line.
- **Pilot: `speechSynthesis` with `lang='cs-CZ'`.** Known pitfalls:
  - `getVoices()` is empty until `voiceschanged` fires.
  - iOS speaks only after a user gesture.
  - Czech voices depend on the OS language packs.
  - Chess notation ("Sa5", "e4") has to be rewritten into words before speaking.
- **Voice check.** Show the button only when a Czech voice is listed. Which of the target phones ship a Czech voice is **unverified**: check the son's phone and an iPhone before deciding.
- **Recorded audio** for the level-1 lessons is the fallback (Q4).
- **Bigger step.** Let "choose" steps be answered by tapping the square on the board instead of reading text answers.

### 6.5 Visual system (F24)

1. **Tokens, no visible change.** Introduce CSS custom properties first: colour (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--primary`, `--danger`), spacing and type. Replace the hex literals with them. This builds on the existing `--board-light/dark`.
2. **Optional day theme.** Then, if wanted, add a warmer, lighter "day" theme that matches the intro illustrations and follows `prefers-color-scheme` (Q6).

## 7. Prioritised change list

**Effort:** S ≤ 2 h, M ≈ ½–1 day, L ≈ 2–3 days, XL ≈ 4–6 days. Each includes a browser check. There is no UI test suite today; see item 0a.

### 0. Groundwork (before anything that changes defaults or layout)

| # | Change | Why | Effort |
|---|--------|-----|--------|
| 0a | A Playwright smoke suite (playwright-core is already used for this review). Cover: start as white or black, each mode start with the board in view, reload, and a storage fixture with every `skm.*` key set, asserting that the UI reflects it. | This is the safety net for items 11, 12 and 16. | M |
| 0b | New-user detection and migration via a `skm.uiVersion` marker (§8.1). | Defaults must not change for existing users. | S |

### Quick wins

| # | Change | Fixes | Effort |
|---|--------|-------|--------|
| 1 | Scroll the board into view on every start: Hrát, Úlohy, Koncovky "Hrát", Kampaň "Hrát", lesson start and each task step. Make the board column sticky on the laptop. | F2 | S |
| 2 | Guard Úlohy, Koncovky and Kampaň with the existing `confirmDiscard` when a game is in progress. Hide undo in puzzles and endings. | F4, F5 | S |
| 3 | Show "▶ Hrát" over the empty middle of the board before the game. The "Hrát!" in the button grid goes. | F1 | S–M |
| 4 | Default Barva bílá for new users (needs 0b) | F1 | S |
| 5 | Settings start folded for returning users (who have `skm.uiVersion`). Add 🔊 next to the board. | F3 | S |
| 6 | Trust line near the top: „Zdarma · bez reklam · bez registrace · Soukromí“. Add "bez reklam" to soukromi.html. Fix the contradictory footer sentence. | F9 | S |
| 7 | Fold the credits and FB/YT/IG into „O aplikaci a licence“ (later ☰). Open every external link in a new tab. | F10 | S |
| 8 | Kamarád: before creating the link, show „Odkaz pošli jen kamarádovi, kterého znáš. Bez chatu a bez jmen, jen tahy. Smaže se do 24 hodin.“ and a confirm step (Q7). Rename the cancel to „Zrušit“. Add a 🌐 badge on Kamarád and Turnaje. | F11, F5 | S |
| 9 | Targets of at least 44 px: selects, lesson buttons, Koncovky ladder. Space "Začít" away from "Tohle umím" and "Příště bez intra" away from "HRÁT". Fix the "Barva" alignment. | F16, F17 | S |
| 10 | Course map: a sticky „◀ Zpět“ at the top, close on backdrop tap, level jump or collapse | F15 | S–M |
| 11a | Picture icons on the mode buttons (SVG or animal art) | F7 | S–M |

### Medium

| # | Change | Fixes | Effort |
|---|--------|-------|--------|
| 12 | Settings sheet with four groups, toggles and a stepper, hints, and the chip | F3, F21 | L |
| 13 | ☰ "Pro rodiče a pokročilé"; six tiles including Moje partie; the game-controls row is separate from the tiles | F7, F10, F22 | M |
| 14 | Autosave the game in progress. New key `skm.currentGame`: FEN, moves, settings and campaign context. Offer „Pokračovat v rozehrané partii“. Friend games are not autosaved: they already rejoin via `skm.friend`. Puzzles, endings and lessons have their own progress. | F12 | M–L |
| 15 | Unify the words (§4 table) across lessons, puzzles, endings, campaign, friend and the dialogs | F5 | M |
| 16a | Rozbor: a mark summary with a legend from `GLYPH_LABEL`, and the move list unfolded | F14 | M |
| 16b | One-tap „Odveta“ against the computer (the friend game already has one, friend-panel.ts:82) | F19 | S–M |
| 16c | Glow on the king whose turn it is. Replace the Kampaň `alert` with an in-app card with a picture. | F18, F23 | S |
| 16d | Beginner defaults for new users: level 1, puzzle band "začátečník" (Q5) | F13 | S + test on a low-end phone |
| 16e | Read-aloud pilot (§6.4) | F8 | M |

### Bigger refactors

| # | Change | Fixes | Effort |
|---|--------|-------|--------|
| 17 | One panel component (§4) for lessons, puzzles, endings, campaign and friend; retire the three styles | F6, F5 | XL (after 0a) |
| 18 | "Můj postup" card: lessons, campaign, puzzles, endings, the next diploma goal, and the note "only in this browser" | F20 | M |
| 19 | CSS tokens and type scale, then the optional day theme | F24 | M + M |
| 20 | Lessons: answer "choose" steps on the board | F8 | L |

**Recommended order:**
1. 0a, 0b.
2. Quick wins 1–3 (the biggest effect, and safe).
3. The remaining quick wins in one or two small PRs, each tried with the son.
4. 14 (autosave).
5. 12 + 13 (the new main screen).
6. 17.
7. The rest as it fits.

## 8. Risks and constraints

### 8.1 Defaults and existing users

Settings are written only when they are changed. The writes are at main.ts:907/925/972, sounds.ts:57 and piece-drop.ts:37. This means a returning child who never touched Barva has **no** `skm.color`. So "key absent" does **not** mean "new user".

**Rule:** on load, if `skm.uiVersion` is absent, decide which case applies.

- **Existing user.** There is any `skm.*` localStorage key other than `skm.noAnalytics` (which `#bezmereni` writes), or any record in IndexedDB `games`.
  - Write the current effective values for the keys whose default changes: `skm.color=random`, `skm.difficulty=3` (as stored today), and the puzzle band in `skm.puzzles`.
  - Then set `skm.uiVersion=2`.
- **New user.** None of the above exists.
  - Set `skm.uiVersion=2` and use the new defaults.
- Without the marker, a new user who plays one game would later look like an existing user.

### 8.2 Storage inventory (must keep names and formats)

- **localStorage, live (18):**
  - settings: `difficulty`, `moveFeedback`, `undoLimit`, `intro`, `pieceDrop`, `sounds`, `animal`, `opponent`, `color`, `pieceFamily`;
  - progress: `lessons`, `campaign`, `puzzles`, `endgames`;
  - other: `friend`, `diplomaName`, `chesscom`, `noAnalytics`.
- **localStorage, legacy:** `skm.pieceSetId`, migrated once to `pieceFamily` and removed (piece-sets.ts:127). The migration must stay.
- **sessionStorage:** `skm.introShown` (intro.ts:14).
- **IndexedDB `skm` v2:** stores `userSets` and `games`, unchanged.
- **New keys (additive only):** `skm.uiVersion`, `skm.speak`, `skm.currentGame`.

### 8.3 Other risks

- **Friend game and relay.** The protocol does not change. `#hra=` deep links must still open the friend bar (main.ts:1040). The autosave must not interfere with `rejoin()`.
- **Tests.** The repo has `check:lessons`, `check:endgames` and `test:lessons`, but no UI tests. Item 0a comes first. Item 17 moves the view layer only; the lesson, puzzle and endgame logic modules and their scripts must pass unchanged.
- **Accessibility.**
  - Sheets use `showModal()`.
  - Segmented controls use a radiogroup.
  - The status line keeps `aria-live`.
  - The pulse respects `prefers-reduced-motion`, as the spectator animations already do (app.css:85).
- **Performance.** Keep "Hodnocení tahů" off by default: it adds engine searches on every move (game-controller.ts:1095) on the single-thread engine. Test on a low-end Android before changing that.
- **Muscle memory.** The son and the pilot kids know the current layout. Ship the quick wins first, and watch one real session before the big move (Q11).
- **Analytics.** The Cloudflare beacon and `#bezmereni` are unaffected.
- **Do less.** Each new toggle (read-aloud, parent confirmation) is a new setting. Add only what replaces something.

## 9. Open questions for the owner (each with a proposed default)

**Owner decision 2026-09-28: all proposed defaults accepted ("beru defaulty").**

| # | Question | Proposed default |
|---|----------|------------------|
| Q1 | First visit: land on Lekce or Hrát? | **Hrát (the board)**, with the Lekce tile first and highlighted „Začni tady“ until the first lesson is done. No extra chooser screen. |
| Q2 | Move Turnaje and the chess.com import to „Pro rodiče a pokročilé“? | **Yes for Turnaje and the import.** Saved games and the win/draw/loss table stay a kid tile, „Moje partie“. |
| Q3 | Default colour bílá instead of náhodně? | **Yes, bílá for new users only** (§8.1). „🎲 náhodně“ stays an option. With the button on the board, black is no longer a dead end either. |
| Q4 | Owl read-aloud: `speechSynthesis` cs-CZ or recorded audio? | **speechSynthesis pilot first**, shown only when a Czech voice exists. Record audio for level-1 lessons only if the voice is poor on the son's phone. |
| Q5 | Beginner defaults for new users? | **Difficulty 1** (now 3) and **puzzle band „začátečník“** (now „lehké“). **Hodnocení tahů stays off** because of engine cost and tone; it gets a hint in Pomocníci instead. |
| Q6 | Dark only, or a light „day“ theme? | **Tokens first**, then a light theme that follows the system setting. Dark stays. |
| Q7 | Parent gate for online features? | **Only a confirm card before „Vytvořit odkaz“**: „Hraješ s kamarádem, kterého znáš? Odkaz mu pošli s rodičem.“ with [Vytvořit odkaz] / [Zrušit]. No gate on ☰, because the social links move into a sub-page („O aplikaci“), not its first level. |
| Q8 | Autosave the game in progress? | **Yes** (a new, additive key; not for friend games). |
| Q9 | Campaign: lock opponents until the previous one is beaten (now all 18 are open and reorderable with ▲▼)? | **Keep them open** (like "Nic není zamčené"), but highlight the next unbeaten opponent, dim the beaten ones, and put ▲▼ behind „Upravit pořadí“ to stop accidental reordering. |
| Q10 | Keep Kamarád as a first-level tile for non-readers? | **Yes**, with the Q7 confirm card and the 🌐 badge. Playing with a known friend is a kid feature. |
| Q11 | How to tell pilot users about the new layout? | A one-time owl bubble „Něco jsme přestavěli — hrát se začíná tady ▶“, shown when `skm.uiVersion` is first written for an existing user. |

## 10. Adversarial review: what changed after it

An independent Opus reviewer checked the draft against the code. Accepted changes:

- **Defaults for existing users.** "Key absent = new user" was wrong, so it is replaced by the `skm.uiVersion` rule (§8.1).
- **Phone viewports.** The draft's phone wireframe assumed an 812 px visible height. It is now budgeted for real viewports (§6.1). "▶ Hrát" moved onto the board, and landscape is covered.
- **Moje partie.** It stays a kid tile instead of going to the parent menu.
- **States and features in the wireframes.** The game-over and review states, the campaign bar, custom sets in Figurky, the piece legend and two-player mode now all have a place.
- **Tiles.** They resume at once, so a puzzle is still one tap.
- **Facts corrected:**
  - `skm.pieceSetId` is legacy.
  - `skm.introShown` is in sessionStorage.
  - The board badge and king bubble exist for move feedback.
  - The end-of-game king animations exist.
  - `--board-*` tokens exist.
  - Level 3 is Skill 0 at depth 2.
  - Line references fixed (game-controller.ts:200, main.ts:136, 1040).
- **Test gate.** No UI test suite exists, so item 0a (Playwright smoke plus a storage fixture) is now the gate.
- **Read-aloud.** It no longer uses 🔊, and the speechSynthesis pitfalls are noted.
- **Icons.** Emoji are replaced by SVG or animal art, for rendering and screen readers.
- **Move feedback default.** It stays off (engine cost and tone), so Q5 changed.
- **Effort.** Word unification is now M, the panel refactor XL, and autosave was promoted and specified.
- **Added:** Q10 (Kamarád tile), Q11 (pilot users) and F23 (the campaign `alert`).

## 11. Implementation status

**Phase 1** (2026-09-28, branch `worktree-agent-ad44c08748ea874de`, not merged, not published). Order as in §7: 0a, 0b, then quick wins.

| Item | State | Where |
|------|-------|-------|
| 0a Playwright smoke suite | Done. `npm run test:ui` builds, serves `dist/` with `vite preview` and drives the installed Edge (playwright-core). 11 checks: new-user defaults and ▶ Hrát at 1366×768, 375×812, 360×640; board in view after Hrát, Úlohy, Koncovky, Kampaň, lesson; a fixture with every `skm.*` setting (first load + reload, start as black); existing users by one key or by a saved game only; the mid-game confirmation; the Kamarád card. | `scripts/test-ui.mjs`, `scripts/ui-harness.mjs` |
| 0b `skm.uiVersion` | Done, rule of §8.1. Existing users: old values frozen only where absent. Nothing stored is overwritten; IndexedDB is only read (a count of `games`, 2.5 s timeout = decide next visit). Code defaults unchanged. | `src/ui-version.ts` |
| 1 Board into view on every start | Done: Hrát, Úlohy, Koncovky, Kampaň, lesson start, lesson steps played on the board (reading steps do not scroll, so `Dál ▶` stays under the finger), Rozbor. Settings fold on every start; an ending no longer reopens them. Laptop: sticky board column. | `main.ts` `revealBoard` / `onBoardStart` |
| 2 Guards, undo hidden | Done. Úlohy, Koncovky, Kampaň use `confirmDiscard` (also for a friend game). Undo hidden in puzzles and endings. | `main.ts` `mayLeaveGame` |
| 3 ▶ Hrát on the board | Done. "Nová hra" steps aside in the pre-game. While a piece is picked up the button is see-through, so white can move to e4/d4. | `game-controller.ts`, `app.css` |
| 4, 16d Beginner defaults | Done for new users: bílá, obtížnost 1, band začátečník. | `ui-version.ts` |
| 6 Trust line | Done: „Zdarma · bez reklam · bez registrace · Soukromí“ under the title; soukromi.html says „zdarma, bez reklam“; footer sentence fixed. | |
| 8 Kamarád card, 🌐 | Done: safety card with [Vytvořit odkaz] / [Zrušit]; globe (inline SVG) on Kamarád and Turnaje. Relay and worker untouched. | `friend-panel.ts` |
| 15 (part) Words | "↶ Vrátit tah (N)", "◀ Krok zpět", "Zrušit". **Deviation:** the exits are "Konec úloh", "Konec koncovek", "Konec lekcí" and "Seznam lekcí" instead of "◀ Zpět": without the panel header (item 17) two "◀" buttons would sit in one lesson panel, and "Konec" is honest (it never returned to the discarded game). Revisit with item 17. | |

**Not in phase 1 (next):**
- 5 settings folded for returning users + 🔊 by the board; 7 credits/social links into „O aplikaci“, external links in a new tab; 9 44 px targets and spacing; 10 course-map sticky „◀ Zpět“; 11a picture icons; Q11 one-time owl note for pilot users.
- 14 autosave (`skm.currentGame`, „Pokračovat v rozehrané partii“) — §7 orders it after the quick wins.
- 12 + 13 new main screen (tiles, settings sheet with chip, ☰ Pro rodiče), 16a–c, 16e read-aloud, 17 one panel component, 18–20.