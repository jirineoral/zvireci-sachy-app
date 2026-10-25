# Prompty pro figurky

Jediná kopie promptu, který aplikace nabízí tlačítkem „Zkopírovat prompt“ (`src/prompts.ts`
čte tenhle soubor při buildu a bere z něj blok označený `prompt`). Uprav text tady, ne v kódu.

## Jak s tím pracovat

- Funguje v ChatGPT, Copilotu i v čemkoli, co pohání DALL·E nebo podobný model. Prompt je
  anglicky, protože generátory obrázků drží anglické zadání spolehlivěji.
- Před vložením nahraď `{ZVÍŘE}` (např. `a fox`, `a hedgehog`) a `{PALETA}` (např.
  `cream and warm orange`).
- Výsledkem je **jeden obrázek se dvěma řadami po šesti hlavách** — nahoře tmavá varianta
  (černé figurky), dole světlá (bílé) — přesně rozložení knihovny (`docs/vlastni-sada.md`,
  šablona `docs/sada-sablona.png`, hotový příklad `assets/source/animals/veverky.png`).
  Takový obrázek nám můžeš poslat a přibude do knihovny pro všechny.
- Pro vlastní sadu jen u sebe rozřež obrázek na dvanáct souborů (`wK wQ wR wB wN wP bK bQ bR
  bB bN bP`) v libovolném editoru (PNG s průhledným nebo jednobarevným pozadím) a nahraj je
  v dialogu „Vlastní figurky…“. Aplikace si každý soubor sama zmenší na 256×256.
- Zvířata, věci, roboti — cokoli. **Obličeje skutečných lidí ne**, pokud nemáš jejich
  souhlas (u dětí souhlas rodičů).
- Prompt je záměrně **kumulativní**: generátory si minulé zadání nepamatují, takže každá
  úprava („jen změň barvu“) musí znovu obsahovat všechno — jinak přijdeš o mitru střelce
  nebo o věž na hlavě.

Pro celý list (obě řady v jednom obrázku, rozložení knihovny) viz `docs/vlastni-sada.md`.

## Prompt

```prompt
A character sheet for a children's chess set: TWO horizontal rows of six busts of {ZVÍŘE} on a plain, uniform white background, all twelve the same size, the same viewing angle, evenly spaced, nothing overlapping, nothing cut off at the edges, head-and-shoulders only.
Both rows, left to right: PAWN, ROOK, KNIGHT, BISHOP, QUEEN, KING. Each bust is the same character wearing the piece's traditional marker so the role is unmistakable even when small: the pawn has a plain collar and no headgear; the rook wears a grey stone castle tower as a hat; the knight wears a medieval helmet with a red plume; the bishop wears a tall bishop's mitre with a cross; the queen wears a golden crown with red jewels; the king wears a taller golden crown topped with a cross AND holds a golden sceptre.
TOP ROW = DARK VARIANT: the character's fur/skin in dark tones (charcoal, deep brown or dark grey), used as the black pieces. BOTTOM ROW = LIGHT VARIANT: the very same six busts, same poses and markers, fur/skin in {PALETA} (light, pale tones) with small warm accents, used as the white pieces.
Style: cute cartoon, bold dark outlines, soft cel shading, friendly faces. No text, no letters, no labels, no watermarks, no frame, no ground shadows, no extra objects.
```

## Poznámky k původním sadám

Kůzlata a žabky (fáze 3–4) vznikly ze stejného zadání s doplňkem „a goat kid“ / „a frog“
a s krémovou (kůzlata) resp. zelenou (žabky) paletou; první listy byly celé figurky na
podstavcích, od fáze 4 jen hlavy („busts, head and shoulders“), protože na mobilu vyplní
políčko líp. Král dostal žezlo kvůli rozlišitelnosti na 40 px. Zbylých sedmnáct postav
(fáze 6) je stejný prompt s jiným zvířetem, generovaný uživatelem; přesné znění per zvíře
se nearchivovalo.

## Hudba ve videích na sítě (zjištěno 2026-10-25)

Je hudba ve videích vlastní, nebo z licence? Je **vlastní,
syntetizovaná kódem**, ne z knihovny ani z AI generátoru hudby. Ověřeno z přepisu session,
která ji vyrobila, z commitů a z ffprobe zvukových stop.

**Kdo, kdy, čím**
- Vznikla 2026-09-27 kolem 11:20 v Claude Code session v tomto repu (model Claude Opus 5.5), při opravách po review příspěvků na týden od 28. 9. (nález
  „videa nemají zvuk“). Commit `63fa425`.
- Generátor: funkce `music()` ve skriptu `make_posts.py` ve scratchpadu té session. Skript
  se necommitnul, funkce je proto 2026-10-25 beze změny obnovena z přepisu té session do
  [scripts/social/make_music.py](../scripts/social/make_music.py). Kontrola 2026-10-25:
  `python -I scripts/social/make_music.py out.wav 11.3` dá stopu, která se se zvukem
  `1-zviratka.mp4` shoduje na 99,99 % (korelace vzorků 0,99993), tedy tutéž hudbu. Python 3.13 jen se
  standardní knihovnou (`math`, `wave`, `struct`): čtyři akordy C, Am, F, G, 96 bpm, rozložené
  akordy ze sinusovek s vyšší harmonickou a doznívající obálkou, pod tím basový tón. Žádné
  samply, žádné stažené soubory. Mix a kódování přes ffmpeg 8, AAC 128 kb/s mono.
- Stejný algoritmus je v repu jako `music_bed()` ve
  [scripts/lesson-video/render.py](../scripts/lesson-video/render.py) (port do numpy, delší
  dozvuk na konci), podklad pod lekčními videi.

**Která videa co mají**

| Videa | Zvuk |
|---|---|
| `tyden-2026-09-28/*/*.mp4` (3 videa, zveřejněná od 28. 9.) | hudba vygenerovaná zvlášť pro každé video funkcí `music()` |
| 5 Shorts nahraných na YouTube 13. 10. (kampaň, sova, koncovky, úlohy, rozbor) | žádná hudba, tichá stopa (`anullsrc`); podle přepisu session, která je 13. 10. vyrobila, soubory v repu nejsou |
| `tyden-2026-10-19/26/11-02/short-*.mp4` (8 Shorts, fronta 22. 10.–7. 11.) | stopa převzatá z `1-zviratka.mp4` skriptem [scripts/social/make_short.py](../scripts/social/make_short.py) |
| lekční videa (`scripts/lesson-video/`, v appce) | `music_bed()` + vyprávění hlasem Microsoft Jakub (Windows SAPI) |

**Licence pro YouTube a Facebook**
- Hudbu nikdo třetí nevlastní: je to výstup kódu napsaného Claudem a spuštěného u nás.
  Spotřebitelské podmínky Anthropicu (účinné od 8. 10. 2025, oddíl 4) převádějí na uživatele
  všechna práva k výstupům, „if any“: https://www.anthropic.com/legal/consumer-terms
- Python a ffmpeg si na výstupy nic nenárokují; jejich licence (PSF, LGPL/GPL) se týkají šíření
  samotného softwaru: https://ffmpeg.org/legal.html
- Sled akordů C–Am–F–G je běžný a sám o sobě chráněný není.
- Jestli hudba vytvořená AI je autorské dílo podle českého práva (a tedy jestli ji autor projektu „vlastní“),
  nevím, ověř si. Pro zveřejnění to nevadí, protože hudba nepatří nikomu jinému.
- Že by ji Content ID na YouTube nebo Rights Manager na Facebooku chybně označil za cizí,
  nevím, ověř si. Kdyby takový nárok přišel, podává se spor s odkazem sem.
- Licenci hlasu Microsoft Jakub pro veřejné šíření nahrávek (lekční videa) jsem neověřoval,
  nevím, ověř si. To je samostatná otázka, hudby se netýká.
