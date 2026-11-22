# Vánoční kampaň Zvířecích šachů, 1. 12. 2026 – 6. 1. 2027

Stav: návrh z 22. 11. 2026, nic není naplánované ani zveřejněné. Navazuje na `../PLAN-2026-12.md` (adventní hádanky a pravidla, Jiřího „1 ano“) a na nasazení vánočních postav: na produkci jsou od 22. 11., ve hře se samy objeví 1. 12. a zmizí po 6. 1.

Jiřího zadání (22. 11.): „můžeš kdyžtak začít chystat social media kampaň na Vánoční téma. Videa trochu delší, než byly shorts, aby si je třeba i člověk stihl přečíst“.

## Nový formát videa

Dosavadní Shorts měly 9,5 s: jeden snímek s titulkem a karta se sovou. Nový formát (`scripts/social/make_reel.py`):

- délka 30–40 s, 9:16, stejné video na YouTube Shorts, Facebook Reels a Instagram Reels;
- 5–7 scén, každá s jedním velkým titulkem (84 px) a nanejvýš jedním kratším řádkem (56 px);
- **čas na čtení:** každá scéna je na obrazovce aspoň 2 s + 0,4 s na každé slovo titulku (titulek o 8 slovech tedy 5,2 s), slideshow ve scéně běží pod stejným titulkem;
- snímky jen ze živého webu zvirecisachy.cz (mobil 412 px, datum v prohlížeči nastavené na prosinec, aby byly vidět vánoční postavy);
- vánoční pozadí: tmavě jedlově zelené s tečkami sněhu; hudba vlastní (`make_music.py`); na konci schválená karta se sovou a „Obrázky vytvořené s pomocí AI“;
- bezpečné zóny: nahoře 250 px, dole 420 px, vpravo 130 px pro tlačítka YouTube.

## Kalendář

Časy Europe/Prague. Příspěvky 1–5 z `PLAN-2026-12.md` (29. 11., 2. 12., 6. 12., 9. 12., 13. 12.) jsou už naplánované a zůstávají beze změny.

| # | Den a čas | Co | Video | Stav |
|---|---|---|---|---|
| V1 | **Út 1. 12., 18:00** | Vánoční postavy jsou tu: vypínač Vánoce, 10 postav, losování „za koho hraju“, perníčci proti kaprům | `1-figurky/1-figurky-reel.mp4` (38 s) | vyrobeno, po review, čeká na Jiřího ano k vydání |
| 6 | St 16. 12., 18:00 | Pat není výhra (pravidlo ze sovy) | delší video: pozice, otázka, vysvětlení ve 3 krocích | k výrobě do 6. 12. |
| 7 | Ne 20. 12., 9:30 | Adventní hádanka 4 na vánoční šachovnici | delší video: úloha, „najdeš to?“, odpočet, odkaz na řešení v popisku | k výrobě |
| 8 | St 23. 12., 18:00 | Šachy s babičkou: dva hráči u jednoho displeje nebo Kamarád přes odkaz | delší video: jak začít partii ve dvou, vánoční postavy | k výrobě |
| 9 | Čt 24. 12., 9:30 | Veselé Vánoce od zvířátek a vánočních postav | krátké přání 20 s: galerie postav, „Veselé Vánoce“ | k výrobě |
| 10 | Ne 27. 12., 9:30 | Sváteční hádanka 5 | jako 7 | k výrobě |
| 11 | St 30. 12., 18:00 | Předsevzetí 2027: jedna úroveň lekcí se sovou a diplom | delší video: mapa lekcí, diplom | k výrobě |
| 12 | Čt 31. 12., 9:30 | PF 2027 | obrázek, bez videa | k výrobě |

Instagram o svátcích dál podle `PLAN-2026-12.md` (24.–31. 12. jen FB a YouTube, IG jeden příspěvek 23. 12. 9:30), protože IG publikují lokální rutiny.

## Co se nemění

Hry zdarma, žádná monetizace, hlas sovy beze změny, YouTube „pro děti“, skrytá slova v komentářích, žádné jméno, věk ani fotka dítěte, hádanky nevyzývají děti psát do komentářů. Každý balíček projde skillem `social-content-review` a naplánuje se až po Jiřího ano.
