# Advent 2026 – příspěvky 1–5 pro Facebook, Instagram a YouTube Shorts (koncept, nic není zveřejněno ani naplánováno)

Vyrobeno 2026-11-19 podle `assets/social/PLAN-2026-12.md` (Jiřího „1 ano“). Naplánovat smí až další krok po review; tady jsou jen soubory.
Každý příspěvek: `N-*-feed.jpg` (4:5, Facebook i Instagram), `N-*-story.jpg` (9:16), `N-*-short.mp4` (9:16, 9,5 s, tichá vlastní
hudba z 28. 9. přes `scripts/social/make_music.py`, závěrečná karta se sovou a „Obrázky vytvořené s pomocí AI“), `N-*-shot.jpg`
(zdrojový snímek bez pruhu s materiálem, u lekcí bez tlačítka „Přečíst“, ze živého https://zvirecisachy.cz/#bezmereni, mobil 412 px, build bf75b99 z 12. 11. 2026, pořízeno 19. 11. 2026).
Shorts mají desku zúženou na 760 px a posunutou doleva (pravých ~130 px je volných pro tlačítka YouTube; `make_story_short.py`). Časy Europe/Prague, všechny tři kanály ve stejný čas. Odkaz všude: https://zvirecisachy.cz (ověřeno: web odpovídá HTTP 200, stejná doména jako v `tyden-2026-11-16/TEXTY.md`).

## Nastavení před zveřejněním (beze změny, jako 16. 11.)

- FB a IG: skrytá slova v komentářích `#hra=`, `hra=`, `hra.zvirecisachy`, `zvirecisachy.cz/#`; komentáře s odkazem na hru mazat; dětí se v DM nikdy neptat na jméno, věk ani fotku.
- YouTube: u každého Shortu „Ano, je určeno pro děti“.
- Shorts jsou jen pro YouTube. Kdyby šly i jako Reel na FB/IG, štítek AI vždy ano.
- Hádanky nevyzývají děti psát řešení do komentářů; text říká „zkuste to s rodičem, řešení je níže“. Nikde není jméno, věk, škola ani fotka dítěte.
- Řešení hádanek je jen v popisku (pod tečkami) a v popisu Shortu, nikdy na obrázku ani ve videu.

| # | Den | Čas | Téma | Feed | Short | Štítek AI (FB/IG feed + story) |
|---|---|---|---|---|---|---|
| 1 | Ne 29. 11. | 9:30 | Adventní hádanka 1: mat na jeden tah | `1-hadanka-feed.jpg` | `1-hadanka-short.mp4` | ano |
| 2 | St 2. 12. | 18:00 | Rošáda: kdy ji nesmíš udělat | `2-rosada-feed.jpg` | `2-rosada-short.mp4` | ano |
| 3 | Ne 6. 12. | 9:30 | Adventní hádanka 2: mat na jeden tah (dáma) | `3-hadanka-feed.jpg` | `3-hadanka-short.mp4` | ano |
| 4 | St 9. 12. | 18:00 | Braní mimochodem | `4-mimochodem-feed.jpg` | `4-mimochodem-short.mp4` | ano |
| 5 | Ne 13. 12. | 9:30 | Adventní hádanka 3: mat na dva tahy | `5-hadanka-feed.jpg` | `5-hadanka-short.mp4` | ano |

Rozhodnutí o štítku AI: na všech pěti snímcích jsou kreslená zvířátka z AI sady figurek nebo Sova (obrázky v aplikaci jsou
vygenerované AI), takže štítek „ano“ stejně jako u hádanky 18. 11. Čistý diagram bez zvířátek tu není.

---

## 1. Ne 29. 11., 9:30 – Adventní hádanka 1: mat na jeden tah

Obrázek: `1-hadanka-feed.jpg` · štítek AI: ano
Snímek: úloha Cal8F z Lichess databáze (CC0), obtížnost 888, téma „mat 1. tahem“; na tahu jsou bílá kůzlata. Řešení ověřeno v chess.js: jediný mat je věž d1–h1 (Rh1#).

**Facebook**

> První adventní neděle, první hádanka ♟️🕯️
> Až do Vánoc bude každou adventní neděli jedna šachová hádanka. Dnešní: na tahu jsou bílá kůzlata a mají mat na jeden tah. Najdete ho? Zkuste to s dítětem, než dočtete, a řešení je níže.
> Další úlohy najdete v části Úlohy, téma „mat 1. tahem“.
> 👉 https://zvirecisachy.cz
> .
> .
> .
> Řešení: věž z d1 na h1. Černý král na h5 nemá kam uhnout: pole g4 hlídá bílý král, pole g5 a h4 bílí pěšci, pole h6 věž po sloupci h a na g6 stojí jeho vlastní pěšec.

**Instagram** (popisek; obrázek stejný)

```
První adventní neděle, první hádanka ♟️ Každou adventní neděli bude jedna. Na tahu jsou bílá kůzlata a mají mat na jeden tah. Zkuste to s dítětem. Další úlohy najdete v části Úlohy. Zdarma, bez registrace – web zvirecisachy.cz najdete v profilu.
.
.
Řešení: věž z d1 na h1.
#zvirecisachy #sachy #šachy #sachyprodeti #chess #advent
```

**První komentář**

- Facebook: `Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz`
- Instagram: `Zdarma, bez registrace. Odkaz na web je v profilu.`

**YouTube Shorts** (`1-hadanka-short.mp4`, publikum „pro děti“)

- Název: *Najdeš mat na jeden tah? ♟️ Adventní hádanka 1 #shorts*
- Popis: „Každou adventní neděli jedna šachová hádanka. Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz Obrázky vytvořené s pomocí AI. Řešení: věž z d1 na h1.“

---

## 2. St 2. 12., 18:00 – Pravidlo: Rošáda, kdy ji nesmíš udělat

Obrázek: `2-rosada-feed.jpg` · štítek AI: ano
Snímek: lekce 16 „Rošáda“, krok 7 z 8 (otázka „Smí bílý udělat krátkou rošádu?“, černá věž na f8). Odpověď „Ne“ ověřena v chess.js: v téhle pozici je krátká rošáda nelegální (dlouhá by legální byla, proto se příspěvek ptá jen na krátkou). Odpověď není na obrázku.

**Facebook**

> Rošáda: kdy ji nesmíš udělat? 🏰
> Sova z lekcí se ptá: smí bílý udělat krátkou rošádu, když černá věž stojí na f8? Zkuste to s dítětem, řešení je níže.
> Víc takových krátkých pravidel najdete v části Lekce, úroveň 1.
> 👉 https://zvirecisachy.cz
> .
> .
> .
> Řešení: ne. Při krátké rošádě jde král přes pole f1 a to černá věž napadá. Rošáda nejde, když je král v šachu, když by přešel přes napadené pole nebo skončil v šachu. A král ani ta věž se předtím nesmí pohnout. Napadená věž ale být smí, to dospělí často nevědí.

**Instagram** (popisek; obrázek stejný)

```
Rošáda: kdy ji nesmíš udělat? 🏰 Smí bílý udělat krátkou rošádu, když černá věž stojí na f8? Zkuste to s dítětem. Pravidla vysvětluje Sova v lekcích. Zdarma, bez registrace – web zvirecisachy.cz najdete v profilu.
.
.
Řešení: ne, král by šel přes pole f1, které věž napadá.
#zvirecisachy #sachy #šachy #sachyprodeti #chess
```

**První komentář**

- Facebook: `Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz → tlačítko Lekce`
- Instagram: `Zdarma, bez registrace. Odkaz na web je v profilu.`

**YouTube Shorts** (`2-rosada-short.mp4`, publikum „pro děti“)

- Název: *Kdy nesmíš udělat rošádu? 🏰 #shorts*
- Popis: „Šachové pravidlo se Sovou. Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz Obrázky vytvořené s pomocí AI. Řešení: ne, král by šel přes pole f1, které černá věž napadá.“

---

## 3. Ne 6. 12., 9:30 – Adventní hádanka 2: mat na jeden tah (dáma)

Obrázek: `3-hadanka-feed.jpg` · štítek AI: ano
Snímek: úloha 9X0N3 z Lichess databáze (CC0), obtížnost 986, téma „mat 1. tahem“; na tahu jsou bílá kůzlata, mat dává dáma. Řešení ověřeno v chess.js: jediný mat je dáma d8–g5 (Qg5#).

**Facebook**

> Druhá adventní neděle, druhá hádanka ♟️🕯️
> Dnes má mat na jeden tah dáma. Na tahu jsou bílá kůzlata. Najdete, kam má dáma táhnout? Zkuste to s dítětem a řešení je níže.
> Další úlohy najdete v části Úlohy, téma „mat 1. tahem“.
> 👉 https://zvirecisachy.cz
> .
> .
> .
> Řešení: dáma z d8 na g5. Černý král na h5 nemůže dámu sebrat, protože ji kryje bílý jezdec z f7, a všechna jeho okolní pole dáma hlídá.

**Instagram** (popisek; obrázek stejný)

```
Druhá adventní neděle, druhá hádanka ♟️ Dnes dává mat na jeden tah dáma. Na tahu jsou bílá kůzlata. Zkuste to s dítětem. Další úlohy najdete v části Úlohy. Zdarma, bez registrace – web zvirecisachy.cz najdete v profilu.
.
.
Řešení: dáma z d8 na g5.
#zvirecisachy #sachy #šachy #sachyprodeti #chess #advent
```

**První komentář**

- Facebook: `Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz`
- Instagram: `Zdarma, bez registrace. Odkaz na web je v profilu.`

**YouTube Shorts** (`3-hadanka-short.mp4`, publikum „pro děti“)

- Název: *Najdeš mat na jeden tah? ♟️ Adventní hádanka 2 #shorts*
- Popis: „Každou adventní neděli jedna šachová hádanka. Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz Obrázky vytvořené s pomocí AI. Řešení: dáma z d8 na g5, kryje ji jezdec z f7.“

---

## 4. St 9. 12., 18:00 – Pravidlo: Braní mimochodem

Obrázek: `4-mimochodem-feed.jpg` · štítek AI: ano
Snímek: lekce 17 „Braní mimochodem“, krok 3 z 6, poslední tah d7–d5 zvýrazněn (pěšec e5, černý pěšec právě skočil na d5, zelené kolečko na d6). Braní e5xd6 ověřeno v chess.js (s polem d6 pro braní mimochodem je tah legální).

**Facebook**

> Braní mimochodem: pravidlo, o kterém se u stolu hádá ♟️
> Černý pěšec skočí z výchozího pole o dvě pole a zastaví se hned vedle vašeho pěšce. Smíte ho vzít, jako by šel jen o jedno pole. Ale jen hned v dalším tahu, pak už ne. Sova to vysvětluje v lekci Braní mimochodem.
> Zdarma, bez registrace, na mobilu i počítači.
> 👉 https://zvirecisachy.cz → tlačítko Lekce, úroveň 1

**Instagram** (popisek; obrázek stejný)

```
Braní mimochodem: pravidlo, o kterém se hádají i dospělí ♟️ Soupeřův pěšec skočí z výchozího pole o dvě pole a zastaví se vedle vašeho. Smíte ho vzít, jako by šel jen o jedno pole, ale jen hned v dalším tahu. Sova to vysvětluje v lekcích. Zdarma, bez registrace – web zvirecisachy.cz najdete v profilu.
#zvirecisachy #sachy #šachy #sachyprodeti #chess
```

**První komentář**

- Facebook: `Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz → tlačítko Lekce`
- Instagram: `Zdarma, bez registrace. Odkaz na web je v profilu.`

**YouTube Shorts** (`4-mimochodem-short.mp4`, publikum „pro děti“)

- Název: *Braní mimochodem: pravidlo, o kterém se hádají i dospělí #shorts*
- Popis: „Šachové pravidlo se Sovou. Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz Obrázky vytvořené s pomocí AI.“

---

## 5. Ne 13. 12., 9:30 – Adventní hádanka 3: mat na dva tahy

Obrázek: `5-hadanka-feed.jpg` · štítek AI: ano
Snímek: úloha OpIgO z Lichess databáze (CC0), obtížnost 942, téma „mat 2. tahem“ (mat na poslední řadě, žádná vidlička); na tahu jsou bílá kůzlata. Řešení ověřeno v chess.js: jediný první tah, po kterém je mat vynucený, je Rb8+; černý má jedinou odpověď Ne8 a pak Rxe8#.

**Facebook**

> Třetí adventní neděle, třetí hádanka ♟️🕯️
> Dnes je to mat na dva tahy. Na tahu jsou bílá kůzlata a černý král se schovává za svými pěšci. Najdete první tah, po kterém už mat nejde zastavit? Zkuste to s dítětem a řešení je níže.
> Další úlohy najdete v části Úlohy.
> 👉 https://zvirecisachy.cz
> .
> .
> .
> Řešení: 1. věž z b1 na b8 (šach). Černý musí zakrýt jezdcem z f6 na e8. 2. věž z b8 bere jezdce na e8 a je mat. Král na g8 je zavřený vlastními pěšci f7, g7 a h7.

**Instagram** (popisek; obrázek stejný)

```
Třetí adventní neděle, třetí hádanka ♟️ Dnes mat na dva tahy. Na tahu jsou bílá kůzlata. Najdete první tah? Zkuste to s dítětem. Další úlohy najdete v části Úlohy. Zdarma, bez registrace – web zvirecisachy.cz najdete v profilu.
.
.
Řešení: 1. věž z b1 na b8 (šach), jezdec z f6 na e8, 2. věž bere na e8, mat.
#zvirecisachy #sachy #šachy #sachyprodeti #chess #advent
```

**První komentář**

- Facebook: `Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz`
- Instagram: `Zdarma, bez registrace. Odkaz na web je v profilu.`

**YouTube Shorts** (`5-hadanka-short.mp4`, publikum „pro děti“)

- Název: *Najdeš mat na dva tahy? ♟️ Adventní hádanka 3 #shorts*
- Popis: „Každou adventní neděli jedna šachová hádanka. Zdarma, bez registrace, na mobilu i počítači: https://zvirecisachy.cz Obrázky vytvořené s pomocí AI. Řešení: 1. věž z b1 na b8 (šach), jezdec z f6 na e8, 2. věž bere na e8, mat.“
