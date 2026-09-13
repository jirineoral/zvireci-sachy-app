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
 *    ("pěšce", "dámu"), {zvuk} the speaker's noise.
 */

export type Situation =
  | 'mate'
  | 'stalemate'
  | 'draw'
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

export const SOUND: Record<'kuzlata' | 'zabky' | 'none', string> = {
  kuzlata: 'Mééé!',
  zabky: 'Kvák!',
  none: 'Hm!',
};

/** What the king of the side to move says before the first move (ply 0). */
export const OPENING: readonly string[] = [
  'Tak jdeme na to! Sleduju každý tah, nic mi neuteče.',
  'Partie začíná. {zvuk} Držte mi palce… teda kopýtka nebo plovací blány.',
  'Šachovnice připravená, figurky nastoupily. Kdo první mrkne, prohrává!',
  'Rozbor partie! Já komentuju, ty koukáš. Dohoda?',
  'Před prvním tahem je vždycky nejvíc napětí. Slyšíš to ticho?',
  'Tohle bude parádní příběh. Šipkou doprava ho přehraješ tah po tahu.',
  '{zvuk} Královská porada skončila, teď už mluví jen tahy.',
  'Všichni na místech? Pěšci vepředu, král vzadu — jako vždycky. Jedeme!',
];

export const TEMPLATES: Record<Situation, readonly string[]> = {
  mate: [
    'Šach mat! {san} a je hotovo. {zvuk}',
    '{san} — mat! Král soupeře nemá kam utéct. Tohle se bude vyprávět!',
    'Mat! Po {san} soupeř jen zírá. Královská práce.',
    '{san} a soupeřův král padá do sítě. Konec, výhra!',
    'A je to! {san} znamená mat. Můžeme slavit. {zvuk}',
    'Mat po {san}. Kdo by to byl řekl na začátku partie?',
    '{san} — poslední tah partie. Soupeřův král vyvěsil bílou vlajku.',
    'Šach a mat! {san} zavřelo všechny dveře i okna.',
  ],
  stalemate: [
    'Pat! Po {san} nemá soupeř žádný tah. Remíza — půl bodu pro každého.',
    '{san} a je pat. Ještě že jsem byl tak dobře schovaný.',
    'Pat! Nikdo nevyhrál, nikdo neprohrál. Příště to dotáhneme.',
    'Remíza patem po {san}. Soupeřův král stojí a nemůže se pohnout.',
    '{san} — pat. Tohle se stane, když má král moc málo místa.',
    'Pat! Půl bodu je taky bod… teda půlka bodu.',
    'Po {san} je pat. Když už nemá kdo hrát, partie končí remízou.',
    '{zvuk} Pat. Hlavně že jsme se nenechali dát mat.',
  ],
  draw: [
    'Remíza! Po {san} už nikdo nemůže vyhrát. Podáme si ruce.',
    '{san} a je remíza. Spravedlivé rozdělení bodu.',
    'Nerozhodně. Materiál nestačí na mat ani jedné straně.',
    'Remíza po {san}. Oba králové si můžou jít odpočinout.',
    'Půl na půl. Příště to bude celý bod, uvidíš.',
    '{san} — remíza. Někdy je to nejlepší, co se dá vytěžit.',
    'Nerozhodně! Ani jedna armáda dnes nepadla.',
    'Remíza. {zvuk} Žádný poražený, žádný vítěz, jen dobrý zápas.',
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
    '{san}! Malý pěšák, velká kariéra.',
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
    'Rošáda {san}. Král a věž si vyměnili místa jako v tanci.',
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
    '{san}! Královna soupeře odchází. {zvuk}',
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
    'Ňam! {san} a {captured} je pryč.',
    '{san}. O jednoho protivníka míň na šachovnici.',
    'Beru {captured}: {san}. Materiál, materiál!',
    '{san} — malý úlovek, ale úlovek.',
    'Sebral jsem {captured} tahem {san}. {zvuk}',
    '{san}! Soupeř právě přišel o pomocníka.',
    'Braní {san}. Šachovnice se pomalu vyprazdňuje.',
    '{san} — a {captured} jde do krabice.',
    'Beru! {san}. Kdo neuhne, ten dostane.',
    '{san}. Tahle výměna se mi líbí.',
    'Křup! {san}. Beru {captured} a jdu dál.',
  ],
  check: [
    '{san} — šach! Králi, uhni!',
    'Šach po {san}. Soupeřův král se musí hýbat, ať chce nebo ne.',
    '{san}! Šach. Král soupeře nemá klid ani na chvilku.',
    'Šach! {san} — a soupeř má o starost víc.',
    '{san} — šach. Tohle soupeřova koruna nesnáší.',
    'Šach! Po {san} musí král řešit, co teď. {zvuk}',
    '{san}, šach! Někdy stačí krále jen trochu popostrčit.',
    'Šach po {san}. Král utíká, ale kam?',
  ],
  firstMove: [
    '{san} — a jedeme! První tah partie.',
    'Otevírám {san}. Střed šachovnice je nejdůležitější.',
    '{san}. Klasika, která nikdy nezklame.',
    'První tah: {san}. Odsud může vzniknout cokoliv.',
    '{san}! Figurky se probouzejí. {zvuk}',
    'Začínám {san}. Jdeme si pro střed.',
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
    'Cože? To se smí? Beru všema deseti… teda beru!',
    'Děkuju, děkuju! Tohle si zarámuju.',
    'Hihi. Tohle jsem ani nečekal. {zvuk}',
    'Mé figurky tančí radostí. Ještě jednou takhle, prosím!',
    'Vidíte to? Vidíte to všichni? Zapsat!',
    'Hurá! Tomuhle říkám dárek.',
    'To byl tah pro mě! Dneska mám štěstí.',
    'Pssst, nic neříkejte, ať si to nerozmyslí.',
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
