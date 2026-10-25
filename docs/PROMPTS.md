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

## Původ hudby v social videích a lekčních videích

Doplněno 2026-10-25 na základě licenčního auditu (`licence-zvireci-sachy.md`, bod E, v repu brain). Rozlišuji, co je
**doložené** (soubor, kód, commit), a co je **vyvozené** nebo **neznámé**.

**Doloženo**
- Hudba není samostatný soubor. Je jen v audiostopě `assets/social/tyden-2026-09-28/1-zviratka/1-zviratka.mp4`
  (AAC 44,1 kHz mono, 11,3 s). Stejná stopa je v `2-lekce.mp4` a `3-kamarad.mp4` téhož týdne.
  `scripts/social/make_short.py` ji bere z `1-zviratka.mp4` (`ffmpeg -i`, ořez `atrim`, `afade`); tak má hudbu
  každý short v `tyden-2026-10-19/`, `tyden-2026-10-26/` a `tyden-2026-11-02/`.
- Vznik: 2026-09-27, commity `c6d92e4`, `86ba21c`, `63fa425` (finální stopa, popis „music bed“). Autor commitů
  Jiří, ve všech `Co-Authored-By: Claude Opus 5.5`, tedy session Claude Code na Jiřího zadání. `REVIEW.md` týdne
  28. 9. ji nazývá „vlastní tichá hudba“.
- Způsob výroby: **vlastní syntéza kódem, bez samplů a bez AI hudebního generátoru.** Audiostopa odpovídá funkci
  `music_bed()` ve `scripts/lesson-video/render.py` (commit `105a5bb`, 2026-09-28; docstring „own synthesis, as the
  social posts“): arpeggio akordů C, Am, F, G, 96 bpm, sinusovky s exponenciálním útlumem (Python + numpy, výstup
  přes ffmpeg/libx264, v souboru `Lavc62.28.100`). Ověřeno rozborem zvuku: výšky tónů po osminách (C5 E5 G5 E5 C5 G5
  E5 G5, pak A4/C5/E5, F4/A4/C5, G4/B4/D5, basový tón C3) souhlasí s tím, co kód generuje, ve všech třech videích.
- Stejná funkce dělá podkres lekčních videí (`musicGain` 0,056, `scripts/lesson-video/build.mjs`). Hlas „Sova čte
  nahlas“ hudbu neobsahuje.
- V repu není žádná zmínka o AI hudebním generátoru, knihovně hudby ani stock zdroji (hledáno podle názvů služeb).

**Neznámé (nevím, ověř si)**
- Skript, který hudbu vyrobil pro videa z 27. 9., **v gitu není** (verze `music_bed()` z 28. 9. je nejbližší
  doložená). Mohl zůstat jen v lokální složce Chess nebo v některém worktree. Přesný skript a verze numpy: nevím.
- Licenční prohlášení pro hudbu v repu chybí (u zvuků je v `scripts/make-sounds.py` prohlášeno „own work, GPL-3.0“).
  Třetí strana se podle výše uvedeného nepodílela, takže se nevztahují licenční ani uživatelské podmínky žádného
  hudebního nástroje. Zda je čistě strojově napsaný a generovaný výstup chráněný autorským dílem podle českého práva
  (§ 2 zák. 121/2000 Sb.): nevím, ověř si (stejná otázka jako u AI artworku). Postup akordů C–Am–F–G je běžný.
- Zda YouTube nebo Facebook u publikovaných videí hlásí shodu v Content ID / Rights Manageru: neověřeno. Zkontrolovat
  ve YouTube Studiu (sloupec Copyright) a v Meta Business Suite.

**Pravidlo do doložení:** hudbu z `1-zviratka.mp4` v nových videích nepoužívat (závěr auditu). Znamená to nespouštět
`make_short.py` a nerenderovat lekční videa, dokud Jiří původ nepotvrdí.
