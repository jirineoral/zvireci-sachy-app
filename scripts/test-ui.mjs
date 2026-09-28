/**
 * UI smoke suite (U1 item 0a): the built app (`vite preview` of dist/) in the installed Edge
 * via playwright-core. Run with `npm run test:ui` (builds first). Each test gets a fresh
 * browser context, i.e. empty storage = a genuinely new user unless a fixture is seeded.
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
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
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

// ---------------------------------------------------------------------------------------

const only = process.argv[2];
const server = await startPreview();
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
