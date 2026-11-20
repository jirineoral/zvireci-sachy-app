/**
 * UI smoke suite (U1 item 0a): the built app (`vite preview` of dist/) in the installed Edge
 * via playwright-core. Run with `npm run test:ui` (builds first). Each test gets a fresh
 * browser context, i.e. empty storage = a genuinely new user unless a fixture is seeded.
 *
 * `node scripts/test-ui.mjs --devsite` runs the seasonal (theme switch) tests against a dev-site build
 * (`vite build --mode devsite --outDir dist-devsite`), where the Christmas characters are available all
 * year; `npm run test:ui` does both. The plain run skips them: out of season there is no theme switch.
 *
 * Nothing here talks to the friend relay: the Kamarád test only opens and cancels the card.
 */
import { startPreview, launchBrowser, newPage } from './ui-harness.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** Top / bottom of an element relative to the viewport, and the viewport height. */
function rectOf(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, vh: window.innerHeight };
  }, selector);
}

/** The whole board is on screen (waits out the smooth scroll). */
async function assertBoardInView(page, label) {
  let r = null;
  for (let i = 0; i < 20; i++) {
    r = await rectOf(page, '.board');
    if (r && r.top >= -1 && r.bottom <= r.vh + 1) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label}: board not in view (${JSON.stringify(r)})`);
}

async function visible(page, selector) {
  return page.locator(selector).first().isVisible();
}

async function plies(page) {
  return page.locator('.move-list li > span.san').count();
}

/** Clicks a square (white at the bottom unless `black`). */
async function clickSquare(page, square, black = false) {
  const box = await page.locator('.board').boundingBox();
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = black ? 7 - file : file;
  const row = black ? rank : 7 - rank;
  const size = box.width / 8;
  await page.mouse.click(box.x + (col + 0.5) * size, box.y + (row + 0.5) * size);
}

/** A click-click move; waits until ▶ Hrát (if shown) lets the second tap through. */
async function move(page, from, to) {
  await clickSquare(page, from);
  await page.waitForFunction(() => {
    const b = document.querySelector('.board-start');
    return !b || b.hidden || b.classList.contains('see-through');
  });
  await clickSquare(page, to);
}

async function load(page, url) {
  await page.goto(url);
  // The piece sets (and with them the first real game) are ready once the side select is filled.
  await page.waitForFunction(() => document.querySelectorAll('select.side option').length > 0 && document.querySelector('select.animal option') !== null);
  await page.waitForTimeout(300);
}

const storageOf = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

// ---------------------------------------------------------------------------------------

test('new user, desktop 1366×768: beginner defaults, ▶ Hrát on the board, start', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop');
  await load(page, url);
  assert((await storageOf(page, 'skm.uiVersion')) === '2', 'uiVersion marker not written');
  assert((await page.inputValue('select.side')) === 'w', 'new user colour is not bílá');
  assert((await page.inputValue('select.difficulty')) === '1', 'new user difficulty is not 1');
  assert(JSON.parse(await storageOf(page, 'skm.puzzles')).band === 'zacatecnik', 'new user puzzle band is not začátečník');
  assert(await visible(page, '.board-start'), '▶ Hrát not shown before the game');
  const btn = await rectOf(page, '.board-start');
  assert(btn.bottom <= btn.vh, '▶ Hrát below the fold');
  assert(!(await visible(page, '.buttons .new-game')), 'Nová hra shown in the pre-game');
  await page.click('.board-start');
  await page.waitForSelector('.board-start', { state: 'hidden' });
  assert(!(await page.locator('details.settings').evaluate((d) => d.open)), 'settings not folded after Hrát');
  await assertBoardInView(page, 'after Hrát');
  // As white: a move, the engine's answer, the take-back label.
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list li > span.san').length >= 2, null, { timeout: 20000 });
  const undo = (await page.textContent('.buttons .undo')) ?? '';
  assert(/^↶ Vrátit tah/.test(undo), `undo label is "${undo}"`);
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('new user, phone 375×812: ▶ Hrát in the first viewport, board in view after start', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'mobile');
  await load(page, url);
  const btn = await rectOf(page, '.board-start');
  assert(btn && btn.bottom <= 640, `▶ Hrát too low on a phone (${JSON.stringify(btn)})`);
  await page.evaluate(() => window.scrollTo(0, 600)); // the child scrolled down to the settings
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('.board-start').click());
  await assertBoardInView(page, 'phone after Hrát');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('small phone 360×640: ▶ Hrát above the real fold (≈560 px)', async ({ browser, url }) => {
  const { page, context } = await newPage(browser, 'smallPhone');
  await load(page, url);
  const btn = await rectOf(page, '.board-start');
  assert(btn && btn.bottom <= 560, `▶ Hrát at ${JSON.stringify(btn)}`);
  const trust = await rectOf(page, '.trust');
  assert(trust && trust.top < trust.vh * 1.2, `trust line far down (${JSON.stringify(trust)})`);
  await context.close();
});

const FIXTURE = {
  'skm.color': 'b',
  'skm.difficulty': '5',
  'skm.moveFeedback': 'on',
  'skm.undoLimit': 'unlimited',
  'skm.intro': 'off',
  'skm.pieceDrop': 'off',
  'skm.sounds': 'off',
  'skm.animal': 'kocky',
  'skm.opponent': 'had',
  'skm.pieceFamily': 'hlavy',
  'skm.christmas': 'off', // stored Standardní: the saved characters stay in force inside the season too
  'skm.puzzles': JSON.stringify({ band: 'stredni', theme: null, solved: {} }),
  'skm.lessons': JSON.stringify({ done: [] }),
};

test('existing user (every setting stored): nothing changes, survives a reload; black starts', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop', { local: FIXTURE });
  await load(page, url);
  const check = async (when) => {
    assert((await storageOf(page, 'skm.uiVersion')) === '2', `${when}: uiVersion not written`);
    for (const [k, v] of Object.entries(FIXTURE)) assert((await storageOf(page, k)) === v, `${when}: ${k} changed to ${await storageOf(page, k)}`);
    assert((await page.inputValue('select.side')) === 'b', `${when}: colour`);
    assert((await page.inputValue('select.difficulty')) === '5', `${when}: difficulty`);
    assert((await page.inputValue('select.feedback')) === 'on', `${when}: feedback`);
    assert((await page.inputValue('select.undo-limit')) === 'unlimited', `${when}: undo limit`);
    assert((await page.inputValue('select.intro-setting')) === 'off', `${when}: intro`);
    assert((await page.inputValue('select.drop-setting')) === 'off', `${when}: piece drop`);
    assert((await page.inputValue('select.sound-setting')) === 'off', `${when}: sounds`);
    assert((await page.inputValue('select.animal')) === 'kocky', `${when}: animal`);
    assert((await page.inputValue('select.opponent')) === 'had', `${when}: opponent`);
  };
  await check('first load');
  await load(page, url); // reload
  await check('after reload');
  // Black: before, nothing happened until the child found `Hrát!`; now the board button starts it.
  await page.click('.board-start');
  await page.waitForFunction(() => document.querySelectorAll('.move-list li > span.san').length >= 1, null, { timeout: 20000 });
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('existing user with one unrelated key: old defaults kept (náhodně, 3, lehké)', async ({ browser, url }) => {
  const { page, context } = await newPage(browser, 'desktop', { local: { 'skm.sounds': 'on' } });
  await load(page, url);
  assert((await page.inputValue('select.side')) === 'random', 'colour changed for an existing user');
  assert((await page.inputValue('select.difficulty')) === '3', 'difficulty changed for an existing user');
  assert((await storageOf(page, 'skm.color')) === 'random', 'old colour not frozen');
  assert(JSON.parse(await storageOf(page, 'skm.puzzles')).band === 'lehke', 'old puzzle band not frozen');
  await context.close();
});

test('existing user known only by a saved game (IndexedDB): old defaults kept', async ({ browser, url }) => {
  const { page, context } = await newPage(browser, 'desktop');
  await page.goto(`${url}soukromi.html`);
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('skm', 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('userSets', { keyPath: 'id' });
          db.createObjectStore('games', { keyPath: 'id' }).createIndex('playedAt', 'playedAt');
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('games', 'readwrite');
          tx.objectStore('games').put({ id: 'test-1', playedAt: Date.now(), startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', sans: ['e4'], result: '*', humanColor: 'w', white: 'a', black: 'b', plies: [null], source: 'app', level: 3 });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await load(page, url);
  assert((await page.inputValue('select.side')) === 'random', 'colour changed for a user with saved games');
  assert((await page.inputValue('select.difficulty')) === '3', 'difficulty changed for a user with saved games');
  assert((await storageOf(page, 'skm.uiVersion')) === '2', 'uiVersion not written');
  await context.close();
});

test('mid-game Úlohy asks first; "Ne" keeps the game, "Ano" starts a puzzle (no undo, board in view)', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'mobile');
  await load(page, url);
  await move(page, 'e2', 'e4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list li > span.san').length >= 2, null, { timeout: 20000 });
  const before = await plies(page);
  await page.click('.buttons .puzzles');
  await page.waitForSelector('.confirm-bar');
  await page.click('.confirm-bar .confirm-no');
  await page.waitForTimeout(300);
  assert((await plies(page)) === before, 'the game was thrown away after "Ne"');
  assert(!(await visible(page, '.puzzle-panel')), 'puzzle panel opened after "Ne"');
  await page.click('.buttons .puzzles');
  await page.click('.confirm-bar .confirm-yes');
  await page.waitForSelector('.puzzle-panel:not([hidden])');
  await page.waitForFunction(() => /Úloha|Vyřešeno|To není/.test(document.querySelector('.status')?.textContent ?? ''), null, { timeout: 15000 });
  assert(!(await visible(page, '.buttons .undo')), 'undo shown in a puzzle');
  assert((await page.textContent('.puzzle-leave')) === 'Konec úloh', 'puzzle leave label');
  await assertBoardInView(page, 'puzzle start');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('Koncovky start (phone): panel, no undo, settings folded, board in view', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'mobile');
  await load(page, url);
  await page.click('.buttons .endgames');
  await page.waitForSelector('.endgame-panel:not([hidden])');
  await page.waitForTimeout(400);
  assert(!(await visible(page, '.buttons .undo')), 'undo shown in an ending');
  assert(!(await page.locator('details.settings').evaluate((d) => d.open)), 'settings open in an ending');
  await assertBoardInView(page, 'endgame start');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('Kampaň start (phone): game on at once, campaign bar, board in view', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'mobile');
  await load(page, url);
  await page.click('.buttons .campaign');
  await page.waitForSelector('dialog.campaign-dialog[open] .campaign-play');
  await page.click('dialog.campaign-dialog[open] .campaign-play');
  await page.waitForSelector('.campaign-bar:not([hidden])');
  await page.waitForSelector('.board-start', { state: 'hidden' });
  await assertBoardInView(page, 'campaign start');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('lesson start (phone): lesson panel, board in view, "◀ Krok zpět"', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'mobile');
  await load(page, url);
  await page.click('.buttons .lessons');
  await page.waitForSelector('dialog.course-map[open] .course-start');
  await page.click('dialog.course-map[open] .course-start');
  await page.waitForSelector('.lesson-panel:not([hidden])');
  await assertBoardInView(page, 'lesson start');
  assert((await page.textContent('.lesson-prev')) === '◀ Krok zpět', 'lesson step-back label');
  assert(!(await visible(page, '.board-start')), '▶ Hrát shown in a lesson');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('Kamarád: safety card with Vytvořit odkaz / Zrušit (no room is created)', async ({ browser, url }) => {
  const { page, context } = await newPage(browser, 'desktop');
  await load(page, url);
  await page.click('.buttons .friend');
  await page.waitForSelector('.friend-bar.friend-card:not([hidden])');
  const text = (await page.textContent('.friend-bar .friend-text')) ?? '';
  assert(/kterého znáš/.test(text) && /24 hodin/.test(text), `card text: ${text}`);
  assert((await page.textContent('.friend-bar .friend-cancel')) === 'Zrušit', 'cancel label');
  assert(await visible(page, '.friend-bar .friend-create'), 'no Vytvořit odkaz');
  await page.click('.friend-bar .friend-cancel');
  await page.waitForSelector('.friend-bar', { state: 'hidden' });
  await context.close();
});

test('▶ Hrát never stays see-through after the pre-game is set up again', async ({ browser, url }) => {
  const { page, context } = await newPage(browser, 'desktop');
  await load(page, url);
  await clickSquare(page, 'g1'); // a knight picked up
  await page.waitForSelector('.board-start.see-through');
  await page.selectOption('select.side', 'b'); // a new pre-game
  await page.waitForTimeout(300);
  assert(!(await page.locator('.board-start').evaluate((b) => b.classList.contains('see-through'))), 'button stuck see-through');
  await page.click('.board-start', { timeout: 3000 });
  await page.waitForSelector('.board-start', { state: 'hidden' });
  await context.close();
});

test('short laptop viewport 1280×600: the whole stage is reachable (no sticky board hiding rank 1)', async ({ browser, url }) => {
  const { page, context } = await newPage(browser, 'desktop');
  await page.setViewportSize({ width: 1280, height: 600 });
  await load(page, url);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 150));
  await page.waitForTimeout(200);
  const r = await rectOf(page, '.stage');
  assert((await page.locator('.stage').evaluate((s) => getComputedStyle(s).position)) !== 'sticky', 'stage sticky on a short viewport');
  assert(r.top < 0, `stage did not scroll with the page (${JSON.stringify(r)})`);
  await context.close();
});

test('mid-game Kampaň asks first; Konec koncovek reopens the settings', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop');
  await load(page, url);
  await move(page, 'e2', 'e4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list li > span.san').length >= 2, null, { timeout: 20000 });
  await page.click('.buttons .campaign');
  await page.click('dialog.campaign-dialog[open] .campaign-play');
  await page.waitForSelector('.confirm-bar');
  await page.waitForTimeout(100);
  assert(await page.evaluate(() => document.activeElement?.classList.contains('confirm-no')), 'focus not on „Ne, hrát dál“');
  await page.click('.confirm-bar .confirm-no');
  assert((await plies(page)) >= 2, 'game lost after "Ne"');
  assert(!(await visible(page, '.campaign-bar')), 'campaign started after "Ne"');
  await page.click('.buttons .endgames');
  await page.click('.confirm-bar .confirm-yes');
  await page.waitForSelector('.endgame-panel:not([hidden])');
  await page.click('.endgame-panel .puzzle-leave');
  await page.waitForTimeout(300);
  assert(await page.locator('details.settings').evaluate((d) => d.open), 'settings folded after Konec koncovek');
  assert(await visible(page, '.board-start'), '▶ Hrát missing after Konec koncovek');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

/** Opens the course map and starts the lesson whose title matches `title` exactly. */
async function startLesson(page, title) {
  await page.click('.buttons .lessons');
  await page.waitForSelector('dialog.course-map[open]');
  await page.click(`dialog.course-map[open] .course-start[aria-label="Začít: ${title}"]`);
  await page.waitForSelector('.lesson-panel:not([hidden])');
}

test('lesson video (mobile, portrait): ▶ Video opens the 9x16 clip, ✕ Zavřít returns focus', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'mobile');
  await load(page, url);
  await startLesson(page, 'Věž');
  assert(await visible(page, '.lesson-video-btn'), '▶ Video button missing for l1-vez');
  assert(/^▶ Video/.test((await page.textContent('.lesson-video-btn')) ?? ''), 'button label does not start with ▶ Video');
  await page.click('.lesson-video-btn');
  await page.waitForSelector('.video-player-dialog[open]');
  const src = await page.getAttribute('.video-player-video', 'src');
  const poster = await page.getAttribute('.video-player-video', 'poster');
  assert(src === 'https://videa.zvirecisachy.cz/lesson-video/l1-vez/l1-vez-9x16.mp4', `unexpected portrait src: ${src}`);
  assert(poster === 'https://videa.zvirecisachy.cz/lesson-video/l1-vez/l1-vez-poster-9x16.jpg', `unexpected portrait poster: ${poster}`);
  await page.click('.video-player-close');
  await page.waitForSelector('.video-player-dialog[open]', { state: 'hidden' });
  assert(await page.evaluate(() => document.activeElement?.classList.contains('lesson-video-btn')), 'focus did not return to ▶ Video');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('lesson video (desktop, landscape): ▶ Video opens the 16x9 clip; Escape closes it', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop');
  await load(page, url);
  await startLesson(page, 'Věž');
  await page.click('.lesson-video-btn');
  await page.waitForSelector('.video-player-dialog[open]');
  const src = await page.getAttribute('.video-player-video', 'src');
  assert(src === 'https://videa.zvirecisachy.cz/lesson-video/l1-vez/l1-vez-16x9.mp4', `unexpected landscape src: ${src}`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.video-player-dialog[open]', { state: 'hidden' });
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('lesson video: the level test (Zkouška) never gets a ▶ Video button', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop');
  await load(page, url);
  await startLesson(page, 'Zkouška úrovně 1');
  assert(!(await visible(page, '.lesson-video-btn')), '▶ Video button shown for the level test');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

// ---------------------------------------------------------------------------------------

const themeTests = [];
const themeTest = (name, fn) => themeTests.push({ name, fn });

const optionValues = (page, selector) => page.$$eval(`${selector} option`, (os) => os.map((o) => o.value));
const SEASONAL_IDS = ['kapri', 'pernicci', 'jezulatka', 'andele', 'certi', 'ovecky', 'ozdoby', 'darecky', 'jedlicky', 'cukrovi'];
const isSeasonal = (id) => SEASONAL_IDS.includes(id);
const htmlHas = (page, cls) => page.evaluate((c) => document.documentElement.classList.contains(c), cls);

themeTest('theme switch: Vánoční shows only seasonal characters, Standardní only ordinary ones; each theme keeps its own choice', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop');
  await load(page, url);
  await page.evaluate(() => (document.querySelector('details.settings').open = true));
  assert(await visible(page, '.christmas-setting'), 'theme switch hidden on the dev site');
  assert((await page.textContent('.christmas-setting')).trim().includes('Vánoce'), 'label is not "Vánoce"');
  assert((await page.getAttribute('input.christmas', 'role')) === 'switch' && (await page.getAttribute('input.christmas', 'type')) === 'checkbox', 'theme control is not a checkbox switch');
  // Default: Vánoční, kapri, a fir-green board, only seasonal characters.
  assert((await page.isChecked('input.christmas')), 'default theme is not Vánoční');
  assert((await page.inputValue('select.animal')) === 'kapri', 'default Christmas player is not kapri');
  assert(await htmlHas(page, 'skm-xmas-board'), 'no fir-green board in the Christmas theme');
  const xmasAnimals = await optionValues(page, 'select.animal');
  const xmasOpponents = (await optionValues(page, 'select.opponent')).filter((v) => v !== 'random');
  assert(xmasAnimals.length > 0 && xmasAnimals.every(isSeasonal), `Christmas player picker has ordinary characters: ${xmasAnimals}`);
  assert(xmasOpponents.length > 0 && xmasOpponents.every(isSeasonal), `Christmas opponent picker has ordinary characters: ${xmasOpponents}`);
  await page.selectOption('select.animal', 'andele');
  // Standardní: ordinary characters only, normal board, own remembered choice.
  await page.uncheck('input.christmas');
  assert((await storageOf(page, 'skm.christmas')) === 'off', 'skm.christmas not "off" for Standardní');
  assert(!(await htmlHas(page, 'skm-xmas-board')), 'fir-green board stays in the standard theme');
  const stdAnimals = await optionValues(page, 'select.animal');
  assert(stdAnimals.length > 0 && !stdAnimals.some(isSeasonal), `standard player picker has seasonal characters: ${stdAnimals}`);
  assert((await optionValues(page, 'select.opponent')).every((v) => !isSeasonal(v)), 'standard opponent picker has seasonal characters');
  await page.selectOption('select.animal', 'kocky');
  await page.selectOption('select.opponent', 'had');
  // Back to Vánoční: the Christmas choice is restored, the standard keys are untouched.
  await page.check('input.christmas');
  assert((await storageOf(page, 'skm.christmas')) === 'on', 'skm.christmas not "on" for Vánoční');
  assert((await page.inputValue('select.animal')) === 'andele', 'Christmas player choice not restored');
  assert((await page.inputValue('select.opponent')) === 'random', 'Christmas opponent preference not random');
  assert((await storageOf(page, 'skm.animal')) === 'kocky' && (await storageOf(page, 'skm.animal.xmas')) === 'andele', 'per-theme storage keys wrong');
  await page.uncheck('input.christmas');
  assert((await page.inputValue('select.animal')) === 'kocky' && (await page.inputValue('select.opponent')) === 'had', 'standard choices not restored');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

themeTest('theme switch: a stored on/off from the earlier switch carries over (off = Standardní)', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop', { local: { 'skm.christmas': 'off', 'skm.animal': 'kocky' } });
  await load(page, url);
  assert(!(await page.isChecked('input.christmas')), 'stored "off" is not Standardní');
  assert((await page.inputValue('select.animal')) === 'kocky', 'standard player not kept');
  assert(!(await htmlHas(page, 'skm-xmas-board')), 'fir-green board despite Standardní');
  // An old seasonal character in skm.animal was the Christmas choice: it moves to the Christmas theme.
  const old = await newPage(browser, 'desktop', { local: { 'skm.animal': 'certi' } });
  await load(old.page, url);
  assert((await old.page.inputValue('select.animal')) === 'certi', 'legacy seasonal choice not kept in Vánoční');
  await old.page.uncheck('input.christmas');
  assert((await old.page.inputValue('select.animal')) === 'kuzlata', 'standard player does not fall back to the default');
  assert(errors.length === 0 && old.errors.length === 0, `page errors: ${errors.concat(old.errors).join(' | ')}`);
  await old.context.close();
  await context.close();
});

themeTest('theme switch: a theme change mid-game keeps the running characters and the player select stays filled; the theme row is first', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop', { local: { 'skm.color': 'w' } });
  await load(page, url);
  await page.evaluate(() => (document.querySelector('details.settings').open = true));
  assert((await page.evaluate(() => document.querySelector('.settings .controls label').className)).includes('christmas-setting'), 'Téma is not the first setting');
  await page.click('.christmas-setting', { position: { x: 8, y: 8 } });
  assert(!(await page.isChecked('input.christmas')), 'tapping the label text does not toggle the switch');
  await page.check('input.christmas');
  await page.click('.board-start');
  await page.waitForSelector('.board-start', { state: 'hidden' });
  await move(page, 'e2', 'e4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list li > span.san').length >= 1);
  await page.evaluate(() => (document.querySelector('details.settings').open = true)); // starting a game folds the settings
  const before = await page.evaluate(() => [...document.documentElement.classList].filter((c) => /^skm-(white|black)-/.test(c)).join());
  await page.uncheck('input.christmas');
  const after = await page.evaluate(() => [...document.documentElement.classList].filter((c) => /^skm-(white|black)-/.test(c)).join());
  assert(before === after, `running characters changed: ${before} -> ${after}`);
  assert((await page.inputValue('select.animal')) !== '', 'player select went blank mid-game');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

themeTest('theme switch: the campaign works in Vánoční (standard character plays, ordinary opponent)', async ({ browser, url }) => {
  const { page, context, errors } = await newPage(browser, 'desktop', { local: { 'skm.animal': 'kocky' } });
  await load(page, url);
  assert((await page.isChecked('input.christmas')), 'not in the Christmas theme');
  await page.click('.buttons .campaign');
  await page.waitForSelector('dialog.campaign-dialog[open] .campaign-play');
  await page.click('dialog.campaign-dialog[open] .campaign-play');
  await page.waitForSelector('.campaign-bar:not([hidden])');
  await page.waitForSelector('.board-start', { state: 'hidden' });
  const classes = await page.evaluate(() => [...document.documentElement.classList].filter((c) => /^skm-(white|black)-/.test(c)));
  assert(classes.length === 2 && classes.every((c) => !isSeasonal(c.replace(/^skm-(white|black)-/, ''))), `campaign characters are not ordinary: ${classes}`);
  assert(classes.some((c) => c.endsWith('-kocky')), `campaign does not play with the standard-theme character: ${classes}`);
  const opponent = await page.inputValue('select.opponent');
  assert(opponent !== 'random' && !isSeasonal(opponent), `campaign opponent is "${opponent}"`);
  assert(await page.locator('select.animal').isDisabled(), 'player picker not locked during the campaign');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
});

test('season: the theme switch and the Christmas characters appear inside the season only', async ({ browser, url }) => {
  const out = await newPage(browser, 'desktop', { date: '2026-10-15' });
  await load(out.page, url);
  assert(!(await visible(out.page, '.christmas-setting')), 'theme switch shown outside the season');
  assert(!(await htmlHas(out.page, 'skm-xmas-board')), 'Christmas board outside the season');
  const inn = await newPage(browser, 'desktop', { date: '2026-12-15' });
  await load(inn.page, url);
  await inn.page.evaluate(() => (document.querySelector('details.settings').open = true));
  assert(await visible(inn.page, '.christmas-setting'), 'theme switch hidden inside the season');
  assert((await inn.page.isChecked('input.christmas')), 'default theme inside the season is not Vánoční');
  assert(out.errors.length === 0 && inn.errors.length === 0, `page errors: ${out.errors.concat(inn.errors).join(' | ')}`);
  await out.context.close();
  await inn.context.close();
});

const devsite = process.argv.includes('--devsite');
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (devsite) tests.splice(0, tests.length, ...themeTests);
const selected = tests.filter((t) => !only || t.name.includes(only));
if (selected.length === 0) {
  console.error(`UI smoke: no test matches "${only}"`);
  process.exit(1);
}
const server = await startPreview(devsite ? 'dist-devsite' : 'dist');
const browser = await launchBrowser();
let failed = 0;
try {
  for (const t of tests) {
    if (only && !t.name.includes(only)) continue;
    const started = Date.now();
    try {
      await t.fn({ browser, url: server.url });
      console.log(`  ✓ ${t.name} (${Date.now() - started} ms)`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${t.name}\n      ${err instanceof Error ? err.message : err}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(failed === 0 ? `\nUI smoke: all ${only ? 'selected' : tests.length} passed` : `\nUI smoke: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
