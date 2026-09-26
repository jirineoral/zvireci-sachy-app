/**
 * Comic-strip commentary for the post-game review (Phase 5B). Pure data: template lists
 * per situation, filled in by `review.ts` and rendered with `textContent` only.
 *
 * Tone rules (binding for anyone adding lines):
 *  - The reader is a ten-year-old club player who may have just lost. Funny, never
 *    humiliating: mistakes are framed as "next time", ideally with the better move.
 *  - Sarcasm is aimed at the opponent's pieces, never at the child.
 *  - Frog/goat puns welcome; `{zvuk}` is the speaker's own noise (Mééé! / Kvák!).
 *  - Correct Czech with diacritics; one or two short sentences; at most ~90 characters
 *    after substitution so the bubble never covers the board on a 360 px phone.
 *  - Placeholders: {san} the move as written, {better} the engine's better move (only in
 *    inaccuracy/mistake/blunder lines), {captured} the captured piece in the accusative
 *    ("pěšce", "dámu"), {zvuk} the speaker's noise, {bolest} the speaker's "ouch" noise
 *    (reactions to losing a piece).
 *  - `mate`, `stalemate` and the draw lines are said by whoever made the last move — also
 *    the engine's king when the child lost — so they stay side-neutral: no gloating.
 */

export type Situation =
  | 'mate'
  | 'stalemate'
  | 'draw'
  | 'drawRepetition'
  | 'drawMaterial'
  | 'drawFifty'
  | 'brilliant'
  | 'great'
  | 'interesting'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'promotion'
  | 'castle'
  | 'enPassant'
  | 'queenCapture'
  | 'bigCapture'
  | 'capture'
  | 'check'
  | 'firstMove'
  | 'quiet';

/** Accusative names of captured pieces for "{captured}". */
export const CAPTURED_ACCUSATIVE: Record<string, string> = {
  p: 'pěšce',
  n: 'jezdce',
  b: 'střelce',
  r: 'věž',
  q: 'dámu',
  k: 'krále',
};

/** Voice of a king when the piece set gives none (classic pieces). */
export const DEFAULT_VOICE = { sound: 'Hm!', hurt: 'Au!' } as const;

/** What the king of the side to move says before the first move (ply 0). */
export const OPENING: readonly string[] = [
  'Tak jdeme na to! Sleduju každý tah, nic mi neuteče.',
  'Partie začíná. {zvuk} Drž mi palce… nebo tlapky, kopýtka, křidýlka!',
  'Šachovnice připravená, figurky nastoupily. Kdo první mrkne, prohrává!',
  'Rozbor partie! Já komentuju, ty koukáš. Dohoda?',
  'Před prvním tahem je vždycky nejvíc napětí. Slyšíš to ticho?',
  'Tohle bude parádní příběh. Šipkou doprava ho přehraješ tah po tahu.',
  '{zvuk} Královská porada skončila, teď už mluví jen tahy.',
  'Všichni na místech? Pěšci vepředu, král vzadu — jako vždycky. Jedeme!',
];

export const TEMPLATES: Record<Situation, readonly string[]> = {
  mate: [
    'Mat! {san} a je hotovo. {zvuk}',
    '{san} — mat! Král nemá kam utéct.',
    'Mat po {san}. Dobrá partie!',
    '{san} — mat. Konec partie.',
    'A je to! {san} znamená mat. {zvuk}',
    'Mat po {san}. Kdo by to byl řekl na začátku partie?',
    '{san} — poslední tah partie. Díky za hru!',
    '{san} — šach a mat! Všechny dveře i okna jsou zavřené.',
  ],
  stalemate: [
    'Pat! Po {san} nemá soupeř žádný povolený tah. Remíza — půl bodu pro každého.',
    'Soupeř není v šachu, ale nemá žádný povolený tah — to je pat.',
    'Pat: král není v šachu, ale nemůže se pohnout on ani žádná jeho figurka.',
    'Pat! Nikdo nevyhrál, nikdo neprohrál.',
    '{san} — pat. Pozor, když má soupeřův král moc málo místa!',
    'Pat! Půl bodu je taky bod… teda půlka bodu.',
    'Po {san} je pat: soupeř nemůže táhnout, a přitom není v šachu. Remíza.',
    '{zvuk} Pat. Příště nechám soupeřovu králi víc místa.',
  ],
  draw: [
    'Remíza po {san}. Podáme si ruce.',
    '{san} a je remíza. Spravedlivé rozdělení bodu.',
    'Remíza po {san}. Oba králové si můžou jít odpočinout.',
    'Půl na půl. Příště to bude celý bod, uvidíš.',
    '{san} — remíza. Někdy je to nejlepší, co se dá vytěžit.',
    'Nerozhodně! Nikdo nevyhrál, nikdo neprohrál.',
    'Remíza. {zvuk} Žádný poražený, žádný vítěz, jen dobrý zápas.',
  ],
  drawRepetition: [
    'Remíza! Po {san} je na šachovnici potřetí stejná pozice.',
    'Potřetí to samé! {san} a je remíza opakováním.',
    '{san} — trojí opakování pozice. Remíza, podáme si ruce.',
    'Točíme se v kruhu. Potřetí stejná pozice — remíza. {zvuk}',
  ],
  drawMaterial: [
    'Remíza! Po {san} už nikdo nemá dost figur na mat.',
    '{san} a materiál nestačí na mat ani jedné straně. Remíza.',
    'Zbylo nás tu málo. Mat už dát nejde — remíza.',
    'Po {san} už mat nikdo nedá. Podáme si ruce. {zvuk}',
  ],
  drawFifty: [
    'Remíza podle pravidla 50 tahů. Tak dlouho nikdo nic nesebral!',
    '{san} — padesát tahů bez braní a bez tahu pěšcem. Remíza.',
    'Po {san} je remíza: padesát tahů se nebralo a pěšci stáli.',
    'Pravidlo 50 tahů! {zvuk} Remíza, podáme si ruce.',
  ],
  brilliant: [
    '{san}!! Obětuju a nebojím se. Tohle byl tah snů!',
    'Brilantní! {san} obětuje figuru a soupeř to ještě nevidí.',
    '{san}!! Tomuhle se říká královská oběť. {zvuk}',
    'Neuvěřitelné! {san} vypadá jako chyba, ale je to past.',
    '{san}!! Odvaha se vyplácí. Soupeř právě polkl návnadu.',
    'Oběť jako z učebnice: {san}!! Za chvíli bude jasno.',
    '{san}!! Kdo to viděl, ten to nezapomene.',
    'Brilantní tah {san}! Dávám figuru a beru partii.',
  ],
  great: [
    '{san}! Jediný správný tah a našel se. Skvěle!',
    'Skvělé! {san} byla jediná záchrana a sedla.',
    '{san}! Přesně tohle bylo potřeba. Nic jiného by nefungovalo.',
    'Jediný tah, který drží pozici: {san}. A je tady!',
    '{san}! Tenhle tah by našel jen málokdo. {zvuk}',
    'Výborně! {san} — jehla v kupce sena a našla se.',
    '{san}! Soupeř myslel, že má vyhráno. Nemá.',
    'Přesný jako hodinky: {san}! Jediná cesta a šlo se po ní.',
  ],
  interesting: [
    '{san}!? Zajímavé! Dávám materiál a doufám v protihru.',
    'Odvážné: {san}!? Není to nejlepší, ale nuda to rozhodně není.',
    '{san}!? Oběť, která stojí za zamyšlení. Uvidíme.',
    'Zajímavý nápad, {san}. Soupeř se teď musí pořádně soustředit.',
    '{san}!? Někdo tomu říká riziko, já tomu říkám zábava.',
    'Hm, {san}!? Šachy nejsou účetnictví, materiál není všechno.',
    '{san}!? Kreativní! Motor by hrál jinak, ale tohle má šťávu.',
    'Oběť {san}!? Trochu hazard, trochu umění.',
  ],
  inaccuracy: [
    '{san}?! Malá nepřesnost. Příště zkus {better}.',
    'Hm, {san} není úplně ono. Lepší bylo {better}.',
    '{san}?! Nic hrozného, jen kousek pozice utekl. {better} bylo přesnější.',
    'Drobnost: {san}. Silnější by bylo {better}.',
    '{san}?! Skoro dobře. Mistr by sáhl po {better}.',
    'Nepřesnost {san}. Pamatuj si {better}, to je ten správný nápad.',
    '{san}?! Malá odbočka z hlavní cesty. Hlavní cesta: {better}.',
    'Ušlo to, ale {better} bylo lepší. Malé věci dělají velké hráče.',
  ],
  mistake: [
    '{san}? Tohle bolí. Příště zkus {better}, ten by je pěkně překvapil.',
    'Auvajs, {san}. Lepší bylo {better}. Zapamatuj si to!',
    '{san}? Soupeřovy figurky se právě zaradovaly. {better} by je umlčelo.',
    'Chyba: {san}. Nevadí, z chyb se učíme — {better} příště.',
    '{san}? Hmm, tohle jsem neplánoval. {better} byla cesta.',
    'Tady se to zadrhlo: {san}. Správně bylo {better}.',
    '{san}? Pozice se trochu naklonila. {better} by ji držel rovně.',
    'Chyba {san}, ale ještě není konec! Příště {better}.',
  ],
  blunder: [
    '{san}?? Au! Tohle byla hrubka. Příště {better} a bude klid.',
    'Ouha, {san}?? Soupeř nevěří svému štěstí. Lepší bylo {better}.',
    '{san}?? Velká chyba, ale i mistři je dělají. Zapamatuj si {better}.',
    'Ne ne ne, {san}?? Tohle stálo hodně. {better} by nás zachránilo.',
    '{san}?? Zavřel jsem oči. Příště {better}, slibuju, že to jde.',
    'Hrubka {san}. Stává se! Správný tah byl {better}.',
    '{san}?? Soupeřovy figurky tančí. {better} by je zastavilo.',
    'Tohle nebylo ono: {san}?? Ale hlavu vzhůru, {better} příště.',
  ],
  promotion: [
    '{san} — proměna! Z pěšce je najednou velké zvíře.',
    'Pěšec došel na konec a proměnil se: {san}! {zvuk}',
    '{san}! Malý pěšec, velká kariéra.',
    'Proměna {san}. Takhle se z pěšce stane hvězda.',
    '{san} — pěšec dorazil až na poslední řadu. Zasloužené povýšení!',
    'Koruna pro pěšce: {san}! Kdo by to do něj řekl.',
    '{san}! Nová figura na šachovnici. Soupeř se nestačí divit.',
    'Proměna! {san} mění celou partii.',
  ],
  castle: [
    'Rošáda {san}. Král do bezpečí, věž do hry. Dva tahy v jednom!',
    '{san} — král se schoval za pěšce. Chytré.',
    'Rošáda! Král si našel útulný domeček.',
    '{san}. Nejdřív bezpečí krále, potom útok. Tak se to má dělat.',
    'Rošáda {san}. Král skočil o dvě pole a věž ho přeskočila. Jako v tanci!',
    '{san} — král v bunkru, věž připravená. {zvuk}',
    'Rošáda! Nejlepší tah pro klidný spánek krále.',
    '{san}. Král je v bezpečí a může začít ta pravá zábava.',
  ],
  enPassant: [
    '{san} — braní mimochodem! Tenhle trik zná jen málokdo.',
    'En passant! {san} sebralo pěšce, který myslel, že proklouzl.',
    '{san} — mimochodem! Pěšec chtěl utéct a nevyšlo mu to.',
    'Braní mimochodem {san}. Nejzvláštnější pravidlo šachu v akci!',
    '{san}! Soupeřův pěšec: „Cože, to se smí?“ Smí.',
    'En passant! {san} — tohle pravidlo umí překvapit i dospělé.',
    '{san} — mimochodem. Pěšec skočil o dva a stejně ho chytili.',
    'Braní mimochodem! {san}. Pravidla znát se vyplácí. {zvuk}',
  ],
  queenCapture: [
    '{san} — beru dámu! Největší úlovek partie.',
    'Dáma je moje! {san}. Soupeř právě přišel o nejsilnější figuru.',
    '{san}! Sbohem, dámo. Bez tebe to bude pro soupeře těžké.',
    'Dáma dolů! {san} — a šachovnice je najednou mnohem klidnější.',
    '{san}! Soupeřova dáma odchází. {zvuk}',
    'Beru dámu: {san}. Tohle je jako vyhrát celý poklad.',
    '{san}! Devět bodů materiálu v jednom tahu. Paráda!',
    'Dáma pryč po {san}. Soupeřův král se najednou cítí sám.',
  ],
  bigCapture: [
    '{san} — beru {captured}! Pořádný kus materiálu.',
    'Velký úlovek: {san}. Soupeř přišel o {captured} a bude mu chybět.',
    '{san}! {zvuk} To byl těžký kalibr.',
    'Beru {captured} tahem {san}. Tohle se počítá!',
    '{san} — a je o jednu velkou figuru míň. Soupeř to pocítí.',
    'Těžká figura padla: {san}. Materiál se přiklání na naši stranu.',
    '{san}! Tohle byl důležitý zásah.',
    'Po {san} má soupeř o {captured} míň. A o starost víc.',
  ],
  capture: [
    '{san} — beru {captured}. Každý kousek se počítá.',
    'Ňam! {san} a beru {captured}.',
    '{san}. O jednoho protivníka míň na šachovnici.',
    'Beru {captured}: {san}. Materiál, materiál!',
    '{san} — malý úlovek, ale úlovek.',
    'Sebral jsem {captured} tahem {san}. {zvuk}',
    '{san}! Soupeř právě přišel o pomocníka.',
    'Braní {san}. Šachovnice se pomalu vyprazdňuje.',
    '{san} — {captured} posílám do krabice.',
    'Beru! {san}. Kdo neuhne, ten dostane.',
    '{san}. Tahle výměna se mi líbí.',
    'Křup! {san}. Beru {captured} a jdu dál.',
  ],
  check: [
    '{san} — šach! Králi, uhni!',
    'Šach po {san}. Soupeřův král se musí hýbat, ať chce, nebo ne.',
    '{san}! Šach. Král soupeře nemá klid ani na chvilku.',
    'Šach! {san} — a soupeř má o starost víc.',
    '{san} — šach. Tohle soupeřova koruna nesnáší.',
    'Šach! Po {san} musí král řešit, co teď. {zvuk}',
    '{san}, šach! Někdy stačí krále jen trochu popostrčit.',
    'Šach po {san}. Král utíká, ale kam?',
  ],
  firstMove: [
    '{san} — a jedeme! Můj první tah.',
    'Začínáme: {san}. Teď se ukáže, kdo má lepší plán.',
    '{san}. První krok je za mnou.',
    'První tah: {san}. Odsud může vzniknout cokoliv.',
    '{san}! Figurky se probouzejí. {zvuk}',
    'Můj první tah: {san}. Tak schválně.',
    '{san} — první krok dlouhé cesty.',
    'Úvodní tah {san}. Soupeř už přemýšlí.',
  ],
  quiet: [
    '{san}. Klidný tah, ale i klidné tahy staví domy.',
    '{san} — vyvíjím figury. Než začne bitva, musí být všichni na místě.',
    'Přemýšlím… {san}. Zlepšuju pozici kousek po kousku.',
    '{san}. Nic dramatického, jen dobré šachy.',
    'Tichý tah {san}. Někdy je nejlepší tah ten, kterého si nikdo nevšimne.',
    '{san} — připravuju půdu. Trpělivost, přijde i akce.',
    '{san}. Držím pozici pevně jako kozel skálu… nebo žába leknín.',
    'Manévr {san}. Figury se přesouvají na lepší místa.',
    '{san}. Klid před bouří?',
    'Solidní {san}. Základy musí být pevné.',
    '{san} — malý krok pro figuru, velký pro pozici.',
    'Hraju {san}. Uvidíme, co na to soupeř. {zvuk}',
  ],
};

/** The *other* king's reaction to the human's blunder or brilliancy. */
export const REACTIONS = {
  blunder: [
    'Uf, to jsem nečekal! Beru, ale ty se ještě vrátíš do hry, uvidíš.',
    'Tohle se mi hodí. Příště mi to tak lehké neudělej!',
    'Dárek? Díky. Ale nevzdávej to, hraješ dobře.',
    'Cože? To se smí? Beru všemi deseti… ale partie ještě neskončila!',
    'Ups, tohle ti uteklo. Stane se i mistrům. Hraj dál!',
    'To je pro mě dobrá zpráva. Ale ty to ještě můžeš otočit. {zvuk}',
    'Tohle jsem nečekal. Najdi, co bylo lepší — příště to zahraješ ty.',
    'Beru si to. Nedělej si hlavu, každý někdy něco přehlédne.',
  ],
  brilliant: [
    'Cože?! To bylo… vlastně krásné. Mrzí mě to, ale klobouk dolů.',
    'Au. Tohle jsem neviděl. Kdo tě to naučil?',
    'Hmpf. Krásný tah. Nemám radost, ale musím uznat.',
    'To bylo zákeřné! A skvělé. Zase zákeřné. {zvuk}',
    'Moje figurky se zastavily a tleskají. Zrádci.',
    'Tak takhle vypadá oběť. Poznamenávám si to.',
    'Nehraje se tu náhodou proti mistrovi?',
    'Sedím tady s otevřenou pusou. Krásné.',
  ],
  captured: [
    '{bolest} To bolelo.',
    '{bolest} Tahle figurka mi bude chybět.',
    'Viděl jsem to, a stejně jsem neuhnul. {bolest}',
    'Nevadí, mám jich víc… snad.',
    '{bolest} Tak to byl podraz.',
    'Kdo to počítá? Já, bohužel. {bolest}',
    'Pomsta bude sladká!',
    'Hej! Tu figurku jsem měl rád.',
    '{bolest} Kam jsem se to díval?',
    'No počkej, to ti vrátím!',
    'Ach jo. Další do krabice.',
    'To nebylo moc kamarádské. {bolest}',
    'Škoda, bojovala statečně.',
    '{bolest} Dobře, zapisuju si to.',
    'Hmm, tohle jsem měl pohlídat.',
    'Jedna padla, ostatní drží. Hrajeme dál!',
  ],
  mated: [
    'Prohrál jsem. Ale příště? Příště to bude jiné!',
    'Mat. Dobrá partie, gratuluju. {zvuk}',
    'Nemám kam jít. Klobouk dolů, byla to čestná bitva.',
    'Sklonil jsem korunu. Vyhrál lepší.',
    'Tak tohle bolelo. Ale hrálo se krásně.',
    'Mat! Musím uznat, tohle bylo zasloužené.',
    'Padám. Ale koruna zůstává, odveta bude!',
    'Gratuluju. Naučil jsem se toho dneska hodně.',
  ],
} as const;

/** Puzzle mode (Phase 10): the child's king after a correct / a wrong move. */
export const PUZZLE_BUBBLES = {
  correct: [
    '{zvuk} Správně! Pokračuj.',
    '{zvuk} Přesně tak! A dál?',
    '{zvuk} Ano! Ještě kousek.',
    '{zvuk} Trefa! Jedeme dál.',
    '{zvuk} Paráda, to sedí. Další tah?',
  ],
  wrong: [
    'Hm… to ne. Zkus to znovu.',
    'Tudy cesta nevede. Zkus jiný tah.',
    'Skoro! Ale ještě ne. Podívej se znovu.',
    'To není ono. Co šachy a braní?',
    'Ne, ne. Zkus to jinak — třeba ti pomůže nápověda.',
  ],
} as const;

/**
 * Game end (Phase 17 / B9, B16, B18): the child's king speaks; the opponent is not on
 * the screen after a win or a loss. `{zvuk}` = the character's own noise (B16's victory
 * cry). The loss lines are quiet on purpose — no gloating anywhere.
 */
export const ENDINGS = {
  win: [
    '{zvuk} Vyhrál jsem! To byla partie!',
    '{zvuk} Mat! Koruna zůstává doma.',
    '{zvuk} Hurá! Kdo je tu král? Já!',
    '{zvuk} Vítězství! Tohle si budu pamatovat.',
    '{zvuk} Jo! Ještě jednu? Klidně hned.',
  ],
  loss: [
    'Prohrál jsem. Sundávám korunu… Dáme si to znovu?',
    'Tentokrát ne. Odpočinu si a příště to bude jiné.',
    'Au. Byla to dobrá partie, i když ne pro mě. Ještě jednou?',
    'Nevadí. Každý král občas prohraje. Nová hra?',
    'Tak tohle bolelo. Ale už vím, co příště udělám jinak.',
  ],
  draw: [
    'Remíza. Podáme si ruce?',
    'Nerozhodně! Nikdo nespadl z trůnu.',
    'Půl bodu pro každého. Odveta?',
    '{zvuk} Remíza! Tahle partie byla vyrovnaná.',
    'Nikdo nevyhrál, nikdo neprohrál. Dáme další?',
    'Remíza — a koruna mi zůstává na hlavě. Ještě jednu?',
  ],
} as const;
