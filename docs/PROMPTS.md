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
