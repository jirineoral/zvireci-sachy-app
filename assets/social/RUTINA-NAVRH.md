# Návrh: týdenní rutina „Zvířecí šachy – týden na sítích“ (NEZALOŽENO, čeká na Jiřího ano)

Cíl: každý týden vychází stejný obsah na YouTube Shorts, Facebook stránce a Instagramu, a Jiří k tomu dělá jediné rozhodnutí: „ano“ k celému týdnu.

## Kdy a jak běží

- **Neděle 20:00** (Auto režim, Claude Code rutina v tomto repu).
- **1. Připraví týden.**
  - Vezme 2–3 témata z fronty `assets/social/FRONTA.md`: seznam funkcí aplikace, které ještě nebyly na sítích, a nové funkce z gitu za poslední týden.
  - Vyfotí živý web (`#bezmereni`), vyrobí `feed` (4:5), `story` (9:16) a `short` (9:16, 9,5 s, schválená závěrečná karta a hudba) a napíše `TEXTY.md`.
  - Výstup uloží do `assets/social/tyden-RRRR-MM-DD/`.
- **2. Nechá to zkontrolovat:** povinné review podle skillu `social-content-review` (vizuál, čeština, fakta proti živé aplikaci, bezpečnost), opraví nálezy a pustí re-check.
- **3. Pošle Jiřímu jeden push:** „Schválit týden od X? (3 příspěvky, přehled: odkaz)“. Přehled se vejde na jednu obrazovku (`SCHVALENI.md`): den, čas, téma, náhled.
- **4. Po Jiřího „ano“ naplánuje všechny tři kanály** (Claude in Chrome, Jiřího osobní profil):
  - **YouTube:** Studio → Schedule. Funguje a je ověřené 13. 10.
  - **Facebook:** Meta Business Suite Plánovač. Hned potom otevře záložku Scheduled a ověří, že tam příspěvky opravdu jsou (MBS bývá nespolehlivé).
  - **Instagram:** dokud není propojený s MBS, vytvoří jednorázové rutiny na přesné časy. Ty příspěvek vydají přímo přes instagram.com (postup je v `tyden-2026-10-12/INSTAGRAM-PLAN.md`, fungovalo 15.–18. 10.).
- **5. Po termínu zkontroluje všechny tři kanály** (stejně jako `audit-2026-10-21.md`) a zapíše výsledek do `PUBLIKACE-LOG.md`. Co chybí, nahlásí pushem.

## Pojistky

- Bez týdenního „ano“ nic nevyjde (publikace je červená akce).
- Strop 85 % týdenního limitu.
- Když Chrome nebo přihlášení nefungují, rutina se nepřihlašuje sama, jen pošle push.

## Co to potřebuje od Jiřího

1. „Ano“ k založení rutiny.
2. Jednorázové přepnutí rutiny i jednorázových IG rutin na Auto, pokud to UI nepřevezme samo.
3. Volitelné: propojit Instagram s Meta Business Suite z aplikace Instagram na iPhonu. Odpadly by pak jednorázové IG rutiny.

## Riziko

Fronta témat dojde. Po těchto 8 příspěvcích (22. 10.–7. 11.) zbývá málo nevyužitých funkcí. Rutina pak potřebuje novinky z vývoje hry, nebo opakování starších témat s novým snímkem. Jiří by měl rozhodnout, jestli opakování jsou v pořádku.
