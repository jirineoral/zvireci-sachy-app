# Security and vulnerability review

First run: 2026-09-13, at source commit `df7f45c` (Phase 4 shipped, Phase 5 planned).
Recurring: the checklist at the end is re-run at the end of every phase and the date line
above is updated; findings that change get a new dated entry, everything else stays.

## Threat model, as it actually is

A static site on GitHub Pages: no backend, no accounts, no payments, no analytics, no
third-party scripts, no data of the player beyond three `localStorage` keys
(`skm.pieceFamily`, `skm.animal`, `skm.moveFeedback` — since Phase 5A; `skm.pieceSetId`
before) that contain a piece-set family id, an animal id and `on`/`off`. Everything the page loads
comes from its own origin; the only "input" the code processes that it did not write itself
is the engine's UCI text, a hand-written `sets.json`, and whatever a curious user types into
`localStorage`. What can realistically go wrong: (1) a compromised or malicious npm package
ends up in the shipped bundle or runs on the build machine; (2) something that should stay
private gets pushed to the public Pages repository; (3) a future change quietly adds an
external request or an unsafe DOM sink. The review below is sized to that. Severity
scale used: **high** = exploitable now with real impact, **medium** = real weakness that
needs a second mistake to matter, **low** = hygiene, **info** = confirmed clean or a note.

## C1 — Dependencies

| Finding | Severity | Evidence / fix |
|---|---|---|
| `npm audit`: 0 vulnerabilities (info/low/moderate/high/critical all 0) | info | Run at `df7f45c` against the committed lockfile |
| Runtime vs build-time split is clean | info | Runtime (shipped): `chess.js 1.4.0` (BSD-2), `@lichess-org/chessground 10.1.1` (GPL-3.0-or-later), `stockfish 18.0.8` (GPL-3.0, copied verbatim, not bundled). Build-time only: `vite 8.3.0`, `typescript 7.0.2`. Nothing else in `package.json`; all versions pinned exactly |
| No git/tarball/unscoped-typosquat sources | info | All 64 `resolved` entries in `package-lock.json` point at `registry.npmjs.org`; the three runtime names are the canonical ones (`chessground` unscoped is the deprecated predecessor and is *not* used) |
| `package-lock.json` committed | info | Yes, tracked since Phase 1 |
| Pages build does not run `npm ci` — it runs on the developer machine | low | There is no CI: `npm run build:pages` is executed locally and the output committed to the Pages repo. The lockfile is honoured because the local `node_modules` was installed from it, but nothing enforces a clean install. **Recommendation, not applied:** either keep it manual and run `npm ci` before every publish (now documented in README "Publishing"), or move the publish to a GitHub Actions workflow — a judgement call about where the build runs, left to you |
| Dependabot alerts and security updates are **off** on both repos | low | `GET /repos/…/vulnerability-alerts` → 404 on `sach-kvak-mek` and `sach-kvak-mek-web`; `automated-security-fixes.enabled = false`; no `.github/dependabot.yml`. **Recommendation, not applied** (account/repo setting): enable alerts on the source repo only — the Pages repo has no `package.json`, so there is nothing to scan there. Expected noise: with five pinned dependencies and no transitive sprawl, a handful of alerts per year, mostly in `vite`/`esbuild`. Commands, one per block: |

```powershell
gh api -X PUT repos/jirineoral/sach-kvak-mek/vulnerability-alerts
```
```powershell
gh api -X PUT repos/jirineoral/sach-kvak-mek/automated-security-fixes
```

Optional `.github/dependabot.yml` for version (not only security) updates, weekly, npm
only — there are no GitHub Actions to keep fresh. Not added; it changes how upgrades
arrive and you may prefer the current pin-by-hand policy.

## C2 — What is published

| Finding | Severity | Evidence / fix |
|---|---|---|
| Secrets in either history | info — none | Full `git log --all -p` of both repos grepped for token/key/password patterns (`ghp_`, `github_pat_`, `AKIA…`, `BEGIN … PRIVATE KEY`, `sk-…`, `.env`, `api_key`, `secret`, `password`): only false positives (the UCI "tokens" array in `engine.ts`, `import.meta.env.BASE_URL`). No `.env` file ever added |
| Personal data in history | info | The commit author e-mail is in every commit of both repos (normal; the Pages repo is private, the site does not expose git). No absolute personal paths in tracked content; `scripts/publish-pages.mjs` takes the Pages path as an argument for that reason |
| Ignored-but-committed files | info — none | `git log --all --diff-filter=A --name-only` intersected with every `.gitignore` pattern: empty. `public/engine/`, `dist/`, `node_modules/`, `.claude/`, `_debug/` never entered the history |
| **Stale bundles published**: five superseded `assets/index-*.js` / three `.css` from earlier builds were live on Pages | low (fixed) | Cause: every deploy copied `dist/` *over* the Pages working copy. None of the stale bundles contained debug hooks (grepped for `SKM_DEBUG`, `debugLoadFen`, `__SKM`, `[uci`), so exposure was "old versions of the same app". Fix: `scripts/publish-pages.mjs` removes the build output before copying (`df7f45c`); the Pages repo now holds exactly one build (`4c96580` → cleaned in the following Pages commit) |
| Source maps / debug hooks in `dist/` | info — none | No `.map` files (Vite default `sourcemap: false`); `grep -c "SKM_DEBUG\|debugLoadFen\|uci >" dist/assets/*.js` = 0 |
| Contents of the published tree | info | `index.html`, one JS + one CSS bundle, `engine/{stockfish-18-lite-single.js,.wasm,LICENSE-GPL-3.0.txt}`, `piece-sets/sets.json`, `piece-sets/CONTRACT.md`, `piece-sets/{farm,farm-busts,farm-busts-inverse}/*.png` + `pieces.css`. Nothing else. Two things worth knowing: `piece-sets/CONTRACT.md` is public because it lives under `public/` (harmless documentation; move it to `docs/` if you prefer — not done, several docs reference its path); `farm-busts-inverse/` is published although not yet selectable (Phase 5A) |
| `assets/source/*.png` (the AI-generated sheets) | info — deliberate | They are in the **private** source repo only. The Pages repo receives `dist/`, which contains the *extracted* 256×256 pieces — those are public by necessity. The full sheets are not published |
| Both repos private, site public | info — as intended | `gh repo view` → `PRIVATE` for both; Pages `build_type: legacy`, branch `main`, path `/`, HTTPS enforced |

## C3 — Untrusted-shaped data reaching the DOM and URLs

| Finding | Severity | Evidence |
|---|---|---|
| `innerHTML` | info — clean | Exactly one assignment in `src/`: the static panel template in `src/main.ts` (a constant string, no interpolation). Set names go through `new Option(name, id)` (text nodes); SAN and glyphs through `textContent`/`append`; the promotion dialog uses `createElement` + `setAttribute('aria-label')`. The board badge is an SVG string passed to chessground's `customSvg`, built only from a fixed glyph union and a fixed colour map — no external value can reach it. Nothing to change |
| Stylesheet `href` from a set id | info — clean | `validateEntry()` rejects any `id` not matching `/^[a-z0-9-]+$/` before a URL is ever built; the URL is `${BASE_URL}piece-sets/${id}/pieces.css`. A stored id is only used via `sets.find(s => s.id === storedId)` — an unknown or malformed value never reaches URL construction (warns, falls back to the first entry) |
| `localStorage` reads | info — clean | `skm.pieceSetId`: matched against the loaded manifest (above). `skm.moveFeedback`: `!== 'off'` → anything else, any type, any length means the default (on). Difficulty and side are not persisted. Reads are wrapped in `try/catch` for blocked storage. Phase 5A adds `skm.pieceFamily` / `skm.animal`; the plan requires the same validate-or-default treatment (DoD 5) |
| Engine output | info — clean | The `bestmove` token goes only to `applyEngineMove()` → `chess.move({from,to,promotion})` inside `try/catch`; a rejected move logs and disables the engine. `info` lines are parsed into numbers and UCI strings for the classifier; PV moves reach `chess.move()` in `sacrificeOf()` (also `try/catch`). No engine string is ever written into markup |

## C4 — Content Security Policy

Applied (`42bb1a4`), as a `<meta http-equiv="Content-Security-Policy">` injected into the
**production** HTML by a small Vite plugin (`vite.config.ts`). It is not present in the dev
server, which injects CSS through `<style>` elements and would require `'unsafe-inline'`.

```
default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';
img-src 'self' data:; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'
```

- `'wasm-unsafe-eval'` is the loose part and it is unavoidable: Stockfish is a WebAssembly
  module compiled in the worker (`WebAssembly.instantiateStreaming`). Without it the
  engine fails and the app silently becomes two-player. It permits wasm compilation only,
  not JavaScript `eval`. No `blob:` is needed — the glue script fetches the `.wasm` from
  its own URL, and the worker is created from a same-origin script.
- `img-src data:` is needed for the built-in cburnett set (SVG data URIs in the bundled CSS).
- No inline `<script>`, no inline `style=""` attributes exist; chessground and the app set
  styles through the CSSOM (`el.style.transform = …`), which CSP does not restrict.
- `frame-ancestors` cannot be set from a `<meta>` tag; if click-jacking ever matters, a
  hosting with headers is required. It does not matter for a chess board.

Verification (required by the brief — a CSP that silently kills the engine is worse than
none): on `vite preview` (localhost:4173) with the policy active, a game was played
against the engine (`1.e4 d6 2.Nf3 Bg4 3.Ng5?? Bxd1`, plus a second game with `Qh5?!`
showing the badge), the piece set switched farm → cburnett → farm-busts, move feedback
on. Zero CSP violations. A positive control confirmed enforcement: an injected inline
`style` attribute and an `https://example.com` image both raised `securitypolicyviolation`.
The same check on the Pages URL is recorded in the checklist run below.

## C5 — GitHub configuration

- No GitHub Actions in either repo; Pages builds "legacy" from `main` of the Pages repo
  with `.nojekyll`. Nothing to pin, no `permissions:` to minimise, no secrets exist.
- Visibility: both repositories private, the Pages site public — as intended (temporary,
  for testing by the player; `gh api -X DELETE repos/jirineoral/sach-kvak-mek-web/pages`
  switches it off).
- Branch protection: none on either `main`. Conscious choice for a single-author project
  where every commit is made and reviewed in the same session; fine as it is.

## C6 — Licensing (open item)

Done (`a01acaa`): the GPL-3.0 text is copied by `scripts/copy-engine.mjs` into
`public/engine/LICENSE-GPL-3.0.txt`, so it ships next to the engine binaries on every
build; the panel footer credits Stockfish (upstream), stockfish.js (packaging),
chessground and chess.js with links; README "Engine" carries the same attribution.

Not resolved, deliberately: whether the GPL reaches the app's own code. `docs/BACKLOG.md`
B6 records the separate-process argument for the engine (Worker + UCI text over
`postMessage`) as defensible but unsettled, and adds the point this review turned up:
`@lichess-org/chessground` is GPL-3.0-or-later and is **bundled into** the app's
JavaScript, which is a plainer linking case than the engine. The Pages README's sentence
"the application code is licensed under the GPL-3.0 as a consequence of its dependencies"
is therefore a statement of intent, not a finding. Decide (B6) before the site is shared
beyond the family; releasing the app under GPL-3.0 costs nothing here.

## C7 — Privacy

Outbound requests observed on `vite preview` during a game with set switching, read from
the browser's request log and `performance.getEntriesByType('resource')`:
`/`, `/assets/index-*.js`, `/assets/index-*.css`, `/engine/stockfish-18-lite-single.js`,
`/engine/stockfish-18-lite-single.wasm` (HEAD pre-check + the worker's GET),
`/piece-sets/sets.json`, `/piece-sets/<id>/pieces.css` and the set PNGs, plus the
`data:image/svg+xml` cburnett pieces. **Every request is same-origin.** No fonts, no CDN,
no analytics, no telemetry; the CSP `connect-src 'self'` now makes a stray external
request fail loudly instead of silently succeeding.

Storage: exactly `skm.pieceSetId` and `skm.moveFeedback` after a full session (checked via
`Object.entries(localStorage)`); nothing in `sessionStorage`, no cookies, no IndexedDB.
Neither value is personal.

## Recurring checklist (end of every phase, ~10 minutes)

Run from the repo root; PowerShell, one command per block.

1. **Dependencies** — `npm audit` clean; `git diff HEAD~N -- package.json` shows only
   intended, exactly-pinned changes.
```powershell
npm audit
```
2. **Leftover debug** — grep empty at HEAD, and the built bundle is free of it:
```powershell
git grep -e SKM_DEBUG -e debugLoadFen -e __SKM HEAD -- src
```
```powershell
Select-String -Path dist\assets\*.js -Pattern "SKM_DEBUG|debugLoadFen|uci >" -Quiet
```
3. **DOM sinks** — any new `innerHTML`/`insertAdjacentHTML`/`setAttribute('style'|'href')`
   must take only constants or validated values:
```powershell
git grep -n -e innerHTML -e insertAdjacentHTML -e "setAttribute(" -- src
```
4. **Storage** — every `getItem` is validated against an allowed set with a default
   (`git grep -n getItem -- src`), and after a test game `Object.keys(localStorage)` shows
   only `skm.*` keys.
5. **Outbound requests** — DevTools Network during one game on `vite preview` (or the
   Pages URL): every request same-origin; the CSP console shows no violation.
6. **CSP with the engine** — on `vite preview` *and* on the Pages URL after deploying:
   status line without "engine nedostupný", the engine answers a move, a badge renders.
   Any new asset type (font, external image, inline style) must be reflected in
   `vite.config.ts` deliberately, never by adding `'unsafe-inline'`.
7. **Published tree** — `git ls-files` in the Pages repo shows one JS and one CSS bundle,
   `engine/` (3 files), `piece-sets/`, `index.html`, `.nojekyll`, `README.md`,
   `LICENSE-GPL-3.0.txt` — nothing else. Deploy only through `scripts/publish-pages.mjs`.
8. **Licences** — a new dependency's licence is named in README; GPL text still ships
   (`dist/engine/LICENSE-GPL-3.0.txt` exists).

## Checklist runs

### 2026-09-13 — first run, at `df7f45c`
1 clean (0 vulnerabilities) · 2 clean · 3 clean (one constant template) · 4 clean
(two keys) · 5 clean (all same-origin) · 6 localhost PASS and Pages PASS (after the deploy of `df7f45c`:
`<meta>` CSP present, engine answered `1.e4 d6 2.Qh5? e5`, `?` badge rendered, zero
`securitypolicyviolation` events, the only resource origin is `https://jirineoral.github.io`,
`engine/LICENSE-GPL-3.0.txt` → 200, the old bundle `index-Au1RDG7G.js` → 404) · 7 clean after `publish-pages.mjs` (stale bundles removed) ·
8 GPL text ships, footer live.

### 2026-09-13 — end of Phase 5, at `2fcaeca` (+ CSS fix)
1 `npm audit` 0 · 2 grep empty at HEAD · 3 sinks unchanged (the constant template in
`main.ts`; the piece-set `href` still built only from a validated id; the four new review
files use `textContent` only — `git grep innerHTML` over them empty) · 4 `getItem` reads
are `skm.pieceFamily` (matched against the manifest), `skm.animal` (matched against the
fixed list), `skm.moveFeedback` (`!== 'off'`), legacy `skm.pieceSetId` (matched, then
removed); garbage values (10 kB string, unknown animal) fall back with `console.warn` ·
5 Pages: single origin `https://jirineoral.github.io`, zero `securitypolicyviolation` ·
6 Pages: CSP present, engine answered `1.e3 e6`, spectators and review render · 7 Pages
tree: one JS, one CSS, `engine/` ×3, `piece-sets/` (3 sets + inverse), `index.html`,
`.nojekyll`, `README.md`, `LICENSE-GPL-3.0.txt` · 8 `dist/engine/LICENSE-GPL-3.0.txt`
present, no new dependency.

### 2026-09-13 — end of Phase 6, at `a20e8a6`
1 `npm audit` 0, no dependency change · 2 grep empty at HEAD · 3 sinks unchanged; the new
character stylesheets are `<link href>`s built from ids validated by `/^[a-z0-9-]+$/`
(`animals.json` entries and `sets.json` `library`), never from storage directly; the
`<html>` classes are built from the same validated ids · 4 new keys `skm.opponent`
(`random` | validated id) and `skm.color` (`random` | `w` | `b`) fall back with
`console.warn`; garbage tested (unknown id, unknown colour, 10 kB string) · 5 Pages:
single origin `https://jirineoral.github.io`, zero `securitypolicyviolation` after a
move against the engine (`1.e4 d5`) · 6 Pages: CSP present, engine answers, character
stylesheets load under `style-src 'self'` · 7 Pages tree: one JS, one CSS, `engine/` ×3,
`piece-sets/` (library 19 × 12 PNG + `pieces.css`, `farm`, `sets.json`, `CONTRACT.md`),
`index.html`, `.nojekyll`, `README.md`, `LICENSE-GPL-3.0.txt` — 272 files · 8 GPL text
ships; the new artwork is AI-generated by the user (B13's licensing note still applies).

### 2026-09-13 — MVP release (user piece sets)
New surface, reviewed on purpose: uploaded images. Bytes are sniffed for the PNG/JPEG
signature (SVG and everything else rejected before decoding, whatever the extension or
`File.type`), decoded with `createImageBitmap`, capped (20 MB, 40 Mpx), redrawn into a
256×256 canvas and re-encoded — only the canvas PNG is stored (IndexedDB `skm/userSets`)
and shown, via `URL.createObjectURL` in a **constructed** stylesheet (CSSOM, unaffected by
`style-src 'self'`); CSP `img-src` gains `blob:`. Records read back from IndexedDB are
shape-checked (`isUserSet`); a blob tampered with through devtools would still only be
rendered as a CSS background image (no script execution in image contexts). New sinks:
`sheet.insertRule` with object URLs and role names from constants, `el.style.backgroundImage`
for thumbnails — no user-controlled string reaches either beyond the object URL. Set names
render through `textContent` / `new Option`. `navigator.clipboard.writeText` only writes.
1 `npm audit` 0 · 2 grep empty · 3 sinks as above · 4 keys unchanged (`skm.pieceFamily`
may now be a `user-<id>`, validated against the loaded families) · 5–6 on Pages after the
deploy: single origin, zero violations, engine answers · 7 tree unchanged in kind ·
8 licence text ships, AI-artwork line in the footer.

### 2026-09-13 — Phase 8 (intro + splash)
New loads: `splash/plate.jpg`, `splash/splash.jpg` and the piece PNGs of the drawn
characters — same-origin files (`img-src 'self'`) or our own object URLs from stored user
sets (`blob:`), revoked when the intro ends. Per-piece positions are custom properties set
via the CSSOM from constants; all text (`ŠACH KVÁK MEK!!!`, `HRÁT`, `Příště bez intra`) is
`textContent`. New storage: `skm.intro` (`on`|`off`, anything else = on) and
`sessionStorage['skm.introShown']`. No new dependency, no inline style/script, CSP unchanged.
1 `npm audit` 0 · 2 grep empty · 3–4 as above · 5–6 on Pages after the deploy · 7 tree +
`splash/` (2 files) · 8 unchanged.

### 2026-09-13 — Phase 9 (saved games, PGN, whole-game analysis)
New input: pasted PGN. It is parsed by chess.js only (`loadPgn`, `strict: false`, 200 kB
cap), player names are trimmed to 60 chars and rendered through `textContent`, moves are
re-validated by replay before a record is opened. New IndexedDB store `games` (DB v2);
records are shape-checked on read. No new network use, no new sink, CSP unchanged.
1 `npm audit` 0 · 2 grep empty · 3 sinks as above · 4 storage keys unchanged ·
5–6 on Pages after the deploy · 7 tree unchanged in kind · 8 unchanged.

### 2026-09-13 — rename
The Pages repository `sach-kvak-mek-web` was renamed to `zvireci-sachy`; the site now lives
at https://jirineoral.github.io/zvireci-sachy/ (the old URL is not redirected — accepted).
Same origin, so the players' `localStorage` and IndexedDB carry over. The source repository
keeps its name. Checklist items referring to the old name apply unchanged.

### 2026-09-13 — Phase 10 (puzzles)
New static data: `public/puzzles/puzzles.json` (3 200 rows from the CC0 Lichess database,
built by `scripts/build-puzzles.py`). Rows are validated on load (id `/^[A-Za-z0-9]{3,12}$/`,
UCI pattern, numeric rating) and replayed through chess.js before a puzzle is shown; all
text via `textContent`. New key `skm.puzzles` (JSON, validated: known band, id pattern,
numeric attempts, capped). No engine use in puzzle mode, no new sink, CSP unchanged.
1 `npm audit` 0 · 2 grep empty · 3–4 as above · 5–6 on Pages after the deploy · 7 tree +
`puzzles/` · 8 CC0 source recorded in the file and the README.

### 2026-09-13 — Phase 11 (campaign)
New key `skm.campaign` (JSON, validated: ids filtered against the loaded library, order
completed from the default list, loss counts finite/positive/capped). Character images in
the campaign grid are `<img>` elements with a same-origin URL built from a validated
library id (`characterImage`); all text via `textContent`; `window.confirm` for the reset.
No new network source, no engine change beyond option values from the existing table, CSP
unchanged. 1 `npm audit` 0 · 2 grep empty · 3–4 as above · 5–6 on Pages after the deploy ·
7 tree unchanged · 8 no new third-party material.

### 2026-09-13 — Phase 12 (piece drop)
New key `skm.pieceDrop` (`on`/`off`). The announcement text is built from library names
and campaign numbers and set via `textContent`; the animations read only the pieces'
own inline `transform`. No new source, sink or network use, CSP unchanged.
1 `npm audit` 0 · 2 grep empty · 3–4 as above · 5–6 on Pages after the deploy · 7 tree
unchanged · 8 nothing new.

### 2026-09-13 — Phase 13 (endgame training)
New key `skm.endgames` (JSON, validated: only known ids kept). Positions are constants
in `src/endgames.ts`, loaded through chess.js; all text via `textContent`. No new
network use, no new sink, CSP unchanged. 1 `npm audit` 0 · 2 grep empty · 3–4 as above ·
5–6 on Pages after the deploy · 7 tree unchanged · 8 nothing new.

### 2026-09-13 — Phase 14 (record per level, B19)
`GameRecord` gains optional `level` (integer 1–6) and `mode` (`play|campaign|training`),
both validated in `isGameRecord`; the statistics are computed from validated records and
rendered through `textContent`. Hardening found on the way: `indexedDB.open` queued
behind a pending delete/upgrade in another tab fires no event — the app now falls back to
memory after 4 s instead of never initialising the piece sets. No new network use, CSP
unchanged. 1 `npm audit` 0 · 2 grep empty · 3–4 as above · 5–6 on Pages after the deploy ·
7 tree unchanged · 8 nothing new.
