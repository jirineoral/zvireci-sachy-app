# Review advent-2026, balíčky 1–5 (2026-11-19)

Tři nezávislé kontroly (Opus): vizuální, text a fakta, bezpečnost a značka. Bezpečnost a značka bez nálezů (žádné dítě, bez cizí hudby, AI štítek u všech pěti, řešení jen v popisku, plurál „vy“ jako 16. 11.).
Nálezy a opravy:
- Hádanky: nebylo vidět, kdo je na tahu. Podtitul teď říká „bílý na tahu“ (feed, story, Short).
- Shorts: deska sahala do x≈965 a tlačítka YouTube by zakryla sloupec h (král na h5). Deska zúžená na 760 px a posunutá doleva, pravých ~130 px volných (`make_story_short.py`).
- Lekce (2, 4): tlačítko „Přečíst“ vypadalo rozbitě. Skryto před snímkem.
- Hádanky: pruh s materiálem (+1, +2, +12, cizí ikona) skryt na snímcích.
- Post 4: zvýrazněn poslední tah d7–d5, aby bylo vidět, že pěšec právě skočil.
- Text: „táhnout“ místo „skočit“ (dáma), „Až do Vánoc“, doplněno „král ani věž se předtím nesmí pohnout“ (rošáda), „z výchozího pole“ (IG, mimochodem), „mat 2. tahem“, překlep „neptat“.
- Nevyřešeno: nic. Snímky jsou z buildu bf75b99, soupeřova zvířátka vybírá aplikace náhodně.
- Re-check (2026-11-19): prošlo kromě příspěvku 4, kde dole vykukovala půlka tlačítek „Krok zpět“ a „Dál“. Snímky 2 a 4 oříznuté pod bublinou sovy, feed, story a Short přegenerovány; ve všech Shorts navíc posunutý obsah níž (blíž svislému středu).

## 23. 11. 2026 – delší verze videí (YouTube Shorts)

Jiří: Shorts jsou příliš krátké, při hledání matu video po pár vteřinách přeskočí na závěrečnou kartu. Nové verze `reel/*-reel.mp4` (`scripts/social/make_reel.py`): úvod s úlohou, odpočet na přemýšlení (mat 1. tahem 15 s, mat 2. tahy 25 s, rošáda 10 s), pak „řešení je v popisku“; braní mimochodem 28 s s vysvětlením. Review (Opus) + re-check: odpočet bez dvojích čísel, deska se nehýbe, řešení nikde na obrazovce, zalomení titulků opravena. Ve Studiu nahrazeno (staré verze Private).
