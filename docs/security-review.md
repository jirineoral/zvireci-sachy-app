# Security and vulnerability review

First run: 2026-09-13, at source commit `df7f45c` (Phase 4 shipped, Phase 5 planned).
Last full run: **2026-09-27** (pre-release review of `origin/main..main`: lessons, relay
hardening, analytics opt-out, e-mail exposure). Recurring: the
checklist at the end is re-run at the end of every phase and this date line is updated;
findings that change get a new dated entry, everything else stays. The sections C1–C8
below describe the state at their own date; the **threat model** is kept current.

## Threat model, as it actually is (2026-09-17)

A static site on GitHub Pages (`zvirecisachy.cz`, DNS on Cloudflare, DNS-only) with:
- **no accounts, no payments, no cookies, no profile of anyone**; the player's data lives
  in the browser — `localStorage` `skm.*` keys (piece family/animal/opponent/colour,
  difficulty, move feedback, undo limit, intro, piece drop, campaign, endgames, puzzles,
  chess.com username, the friend-game seat token, lesson progress `skm.lessons`, the
  diploma name `skm.diplomaName` only while „Zapamatuj si moje jméno“ is ticked, the
  analytics opt-out `skm.noAnalytics`), `sessionStorage` `skm.introShown`,
  IndexedDB `skm` (own piece sets, saved games);
- **one third-party script**: Cloudflare Web Analytics on the public build (page views
  and visits per day; no cookie, no visitor id; the beacon strips `#` and `?` before it
  posts — verified against the beacon's source on 2026-09-17, re-check on version bumps);
- **one server component**: the friend-game relay `hra.zvirecisachy.cz` (`worker/`,
  Cloudflare Worker + one Durable Object per game) — random room id, random seat token,
  SAN moves, deleted 24 h after the last message; IPs are visible to Cloudflare at the
  edge for the socket's lifetime, we keep no logs;
- **two user-triggered external reads**: chess.com's public API (a username) and
  Lichess's broadcast API (a tournament id);
- **one external form**: Google Forms for feedback, opened in a new tab.

Inputs the code processes that it did not write itself: the engine's UCI text, the
manifests under `public/`, PGN/JSON from chess.com and Lichess, the other seat's SAN
moves through the relay, uploaded images, and whatever a curious user types into
storage. What can realistically go wrong: (1) a compromised npm package in the bundle or
on the build/deploy machine (which also holds the Cloudflare OAuth token in
`~/.wrangler`); (2) something private pushed to a public repo; (3) a change that quietly
adds an external request or an unsafe DOM sink; (4) abuse of the relay (floods, seat
takeover, a peer sending garbage). Severity scale: **high** = exploitable now with real
impact, **medium** = real weakness that needs a second mistake to matter, **low** =
hygiene, **info** = confirmed clean or a note.

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
gh api -X PUT repos/jirineoral/zvireci-sachy-app/vulnerability-alerts
```
```powershell
gh api -X PUT repos/jirineoral/zvireci-sachy-app/automated-security-fixes
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
img-src 'self' data: blob:; connect-src 'self' https://api.chess.com https://lichess.org;
worker-src 'self'; base-uri 'none'; form-action 'none'
```

*Current policy (2026-09-17, `csp()` in `vite.config.ts`):* `connect-src 'self'
https://api.chess.com/pub/ https://lichess.org/api/broadcast/ wss://hra.zvirecisachy.cz`,
plus on the public build (`--mode pages`) `script-src … https://static.cloudflareinsights.com`
and `connect-src … https://cloudflareinsights.com`.

*(Phase 15: `https://api.chess.com` — the public, unauthenticated chess.com Published-Data
API used by the import in `Partie`. Phase 16: `https://lichess.org` — the public Broadcast
API behind `Turnaje`. Both are read-only GETs; `blob:` in `img-src` came with the user
piece sets.)*

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

*2026-09-17:* this section records the 2026-09-13 state. What changed since: the public
build posts to `cloudflareinsights.com` (analytics), a friend game opens a WebSocket to
`hra.zvirecisachy.cz`, storage has grown to the keys listed in the threat model plus
IndexedDB and `sessionStorage`. The player-facing summary is `public/soukromi.html`.

Outbound requests observed on `vite preview` during a game with set switching, read from
the browser's request log and `performance.getEntriesByType('resource')`:
`/`, `/assets/index-*.js`, `/assets/index-*.css`, `/engine/stockfish-18-lite-single.js`,
`/engine/stockfish-18-lite-single.wasm` (HEAD pre-check + the worker's GET),
`/piece-sets/sets.json`, `/piece-sets/<id>/pieces.css` and the set PNGs, plus the
`data:image/svg+xml` cburnett pieces. **Every request is same-origin.** No fonts, no CDN,
no analytics, no telemetry; the CSP `connect-src` makes a stray external request fail
loudly instead of silently succeeding. *Phase 15 exception:* when the player uses the
chess.com import, the browser requests `api.chess.com/pub/player/<username>/games/…`
directly — the username (a public handle) is the only thing sent, only on the player's
explicit `Načíst`, and it is remembered in `skm.chesscom` for convenience.

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
   (`git grep -n getItem -- src`), and after a test game `Object.keys(localStorage)` and
   `sessionStorage` show only `skm.*` keys; IndexedDB `skm` holds only `userSets` and `games`.
5. **Outbound requests** — DevTools Network during one game on `vite preview` (or the
   Pages URL): every request same-origin except the documented ones (analytics beacon on
   the public site; the relay during a friend game; chess.com/Lichess on the player's
   action); the CSP console shows no violation.
6. **CSP with the engine** — on `vite preview` *and* on the Pages URL after deploying:
   status line without "engine nedostupný", the engine answers a move, a badge renders.
   Any new asset type (font, external image, inline style) must be reflected in
   `vite.config.ts` deliberately, never by adding `'unsafe-inline'`.
7. **Published tree** — `git ls-files` in the Pages repo shows one JS and one CSS bundle,
   `engine/` (3 files), `piece-sets/`, `puzzles/`, `splash/`, `index.html`, `soukromi.html`,
   `THIRD-PARTY-NOTICES.txt`, `CNAME`, `.nojekyll`, `README.md`, `LICENSE-GPL-3.0.txt` —
   nothing else. Deploy only through `scripts/publish-pages.mjs`.
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

### 2026-09-13 — Phase 15 (chess.com import)
CSP `connect-src` widened to exactly `https://api.chess.com` (verified in the built app:
the API answers 200, `https://example.com` is refused by the policy). Username validated
`/^[A-Za-z0-9_-]{1,50}$/` and URL-encoded; archive URLs accepted only under
`https://api.chess.com/pub/`; every game's PGN parsed by chess.js through the existing
`recordFromPgn`, other fields reduced to bounded strings/numbers; all text via
`textContent`. New key `skm.chesscom` (the username). 1 `npm audit` 0 · 2 grep empty ·
3–4 as above · 5–6 on Pages after the deploy · 7 tree unchanged · 8 nothing new.

### 2026-09-13 — Phase 16 (tournament broadcasts)
CSP `connect-src` gains `https://lichess.org` (verified in the built app: the search
answers 200, `https://example.com` is refused). Tour/round ids validated
`/^[A-Za-z0-9]{8}$/` before being put in a URL; names/locations reduced to trimmed
strings ≤ 120 chars; round PGN split per game, comments stripped from the movetext,
each game parsed by chess.js via `recordFromPgn`; all text via `textContent`; no images
from Lichess. Nothing stored. 1 `npm audit` 0 · 2 grep empty · 3–4 as above · 5–6 on Pages
after the deploy · 7 tree unchanged · 8 nothing new.

### 2026-09-13 — Phase 17 (game end) + B7 (two players)
No new storage keys (`skm.color` accepts one more value, `two`, validated on read); no
network; text via `textContent`; CSS animations only. 1 `npm audit` 0 · 2 grep empty ·
3–8 unchanged.

### 2026-09-14 — domain, licence, publication
Site moved to https://zvirecisachy.cz (GitHub Pages custom domain; `zvireci-sachy.cz` is a
redirect site in `jirineoral/zvireci-sachy-redirect`); the build base is `/`. Source
repository renamed to `zvireci-sachy-app` and released under GPL-3.0 (`LICENSE`), artwork
excluded (`LICENSE-ARTWORK.md`). The sabre-toothed squirrel (a recognisable film
character) was replaced by a plain squirrel before publication; the other 18 characters
were reviewed on the contact sheets — generic cartoon animals, no known characters.
CSP unchanged. 1 `npm audit` 0 · 2 grep empty · 3–8 unchanged.

### 2026-09-14 — independent review (second Claude Code session, no prior knowledge of this file)

Requested by the owner after publication; findings reviewed and acted on here. The
reviewer verified independently: 0 vulnerabilities, no secrets in the full history, no
stale bundles/sourcemaps on Pages, CSP as in `vite.config.ts` with 0 violations during a
game on the live site, storage validation, PGN only via chess.js, upload via sniff +
canvas, CSSOM for user sets, GPL text of the engine published.

**Fixed:**
- D1 — the footer feedback link was dead since deployment (`.feedback` also matched the
  feedback `<select>`); now `a.feedback-link`. Regression: the DoD of that change only
  checked the built JS, not the rendered `href`.
- D2 — `plies[].glyph` from IndexedDB reached chessground's `innerHTML` (SVG badge)
  without validation; `isPlyData` now whitelists the glyph and bounds the SAN strings,
  and `glyphBadge` refuses anything outside `GLYPH_CLASS`. Only the user's own database
  could carry it and CSP blocks scripts, but it broke the "textContent only" invariant.
- D3 — GitHub: Dependabot alerts + security updates, secret scanning + push protection
  enabled on the source repo; Actions disabled on all three repos (no workflows exist).
- D5 — footer now says that the feedback link opens a Google Form and what is
  prefilled (build stamp, OS + browser; the screen resolution was dropped); "vyplň ho s
  rodičem".
- D6 — cburnett (CC BY-SA 3.0) attribution in the app's footer, not only in the README.
- D7 — `docs/`: the local path, the child's age and a diminutive removed; the two U10
  players' names in the Phase 16 results shortened to initials (HEAD only — see below).
- D8 — `scripts/__pycache__` untracked and ignored.
- D9 — `copy-engine.mjs` verifies sha256 of both engine files against pinned digests.
- N2 — `connect-src` narrowed to `https://api.chess.com/pub/` and
  `https://lichess.org/api/broadcast/`; `<meta name="referrer" content="no-referrer">`.
- N6 — build stamp uses the commit date → the build is deterministic per commit.
- N7 — README "open item" sentence removed.
- N8 — `isGameRecord`/`isUserSet` bound name lengths and ply counts; image upload limit
  8 MB (the decode happens before the pixel check).

**Not done, deliberately:**
- N1 clickjacking / `frame-ancestors`: needs response headers, i.e. a CDN in front of
  Pages. No accounts, nothing to click-jack; revisit with the first server component.
- N3 branch ruleset: a single maintainer who force-pushes on purpose (history rewrites);
  "block deletion" alone is not worth a rule. Actions are disabled instead.
- N4 third-party names (chess.com usernames, Lichess tour names) shown unfiltered: known,
  bounded in length, Lichess broadcasts are moderated; accepted for a pilot.
- N9 repo size (source sheets ~60 MB): accepted; LFS would complicate `npm ci` for
  contributors more than it helps.

**Owner's decisions — all closed 2026-09-14:**
- D4 — both domains verified in GitHub Settings → Pages (TXT
  `_github-pages-challenge-jirineoral` = `70787b18…fd35a` for zvirecisachy.cz,
  `6ebe447d…9d7a` for zvireci-sachy.cz at Forpsi; the owner clicked Verify himself —
  GitHub refuses that POST from an automated browser, "You can't perform that action at
  this time"). `protected_domain_state` = `verified` on both Pages sites.
- D7 history — rewritten with `git filter-repo --replace-text` (path, age, diminutive,
  minors' names) and force-pushed; `git log --all -p` finds none of them.
- D5 form — the Google Form's intro now names the controller, the purpose, the optional
  e-mail's use, how to ask for deletion, and asks under-15s to fill it in with a parent.
- N5 — the `člověk` queen is the author's own face with feminine features, not another
  person; no consent issue.

**Corrections to earlier statements in this document:** the source repo is public since
2026-09-14 (C2, C5 said private); `assets/source/*.png` are therefore public too (C2);
the absolute path in `docs/phase-1-plan.md` existed from the first commit (C2 claimed
none); C3's "no external value can reach the badge" was untrue for saved records since
Phase 9 (D2); C7's storage list is a Phase 1 snapshot — the current keys are the
`skm.*` set listed per phase above plus IndexedDB `skm` (`userSets`, `games`), and imported
games carry other players' real names; the 2026-09-14 "18 generic animals" line should
read 17 animals plus `člověk`, a stylised likeness of the author only — every piece,
the queen included, is the author's own face (confirmed by the owner on 2026-09-17; the
earlier "and a second person" here was wrong).

### 2026-09-14 — Phase 18 (whole-sheet cutting in the browser)
The sheet goes through the same gate as single pieces (`decodeImageData`: size ≤ 8 MB,
PNG/JPEG signature sniffed, decoded to a ≤ 1800 px canvas, ≤ 40 Mpx); the cutter works on
`ImageData` only and every output piece is re-encoded by the canvas (`imageDataToPng`) —
the uploaded bytes never reach CSS or storage. No new key, no network. 1 `npm audit` 0 ·
2 grep empty · 3–8 unchanged.

### 2026-09-14 — pilot P1–P3
New key `skm.undoLimit` (`0`/`3`/`unlimited`, validated on read); legend text static; no network. 1 `npm audit` 0 · 2 grep empty · 3–8 unchanged.

### 2026-09-17 — Phase 19 (captured pieces) + Cloudflare (DNS, Web Analytics)
Phase 19 is pure rendering from the position (no storage, no network). **DNS** for
`zvirecisachy.cz` moved from Forpsi to Cloudflare (Free plan), records identical, **DNS
only — no proxy**: GitHub Pages keeps issuing and enforcing the certificate exactly as
before; Cloudflare sees DNS queries, never the HTTP traffic. **Web Analytics** — the first
and only third-party script: `static.cloudflareinsights.com/beacon.min.js`, injected into
the public build only (`--mode pages`; not the dev site, not local builds), with the two
hosts added to `script-src` / `connect-src`. Cloudflare's beacon sets no cookie and keeps
no visitor identifier; the dashboard shows page views and "visits" per day (a visit =
a page view without a same-site referrer), which is what the owner asked for: daily
distinct-ish reach, nothing per person. The site token in `vite.config.ts` is public by
design (it is in every page's HTML). Threat-model line "no analytics, no third-party
scripts" above is superseded by this entry. 1 `npm audit` 0 · 2 grep empty · 3 CSP
verified on the Pages URL (beacon loads, POST to cloudflareinsights.com allowed, engine
plays, zero violations) · 4–8 unchanged.

### 2026-09-17 — Phase 20 (play with a friend): the first server component
The GATE was opened by the owner for exactly this. What runs where:
- **Relay** `worker/` — a Cloudflare Worker + one Durable Object per game at
  `hra.zvirecisachy.cz`. It accepts a WebSocket at `/r/<12 base32 chars>`, validates
  message shape and turn order (not chess rules — both browsers run chess.js), stores the
  SAN list and two seat tokens, forwards moves, and deletes everything 24 h after the last
  message (DO alarm). Limits: 200-byte messages, 10 messages/s per socket, 1000 plies,
  two seats (a third connection gets `full` and is closed). Observability/logs **off** in
  `wrangler.toml`; no KV, no D1, nothing outside the room.
- **What the relay sees**: the room id (random, made in the host's browser, in the link's
  *fragment* so it never reaches the Pages host, referrers or Web Analytics), a random
  seat token per browser (`sessionStorage` `skm.friend`, gone with the tab), SAN moves,
  and — at the edge, for the socket's lifetime — the two IP addresses. No names, no
  accounts, no cookies. That is the whole personal-data surface; the footer says so
  ("při hře s kamarádem projdou tahy přes náš server a do 24 hodin po partii se smažou").
- **Client**: `connect-src` gains `wss://hra.zvirecisachy.cz` only; everything from the
  socket is parsed as JSON, type-checked and applied through chess.js (`applyRemoteMove`
  refuses out-of-turn / illegal SANs, the controller refuses the human's own out-of-turn
  moves even if the board did not). All text through `textContent`.
- **Abuse**: rooms are unguessable (60 bits) and two-seat; there is no text channel, so
  nothing can be said; a flood closes the socket. Cost at our scale is zero (Workers
  Free); a Paid plan would only be needed at thousands of games a day.
- Local DoD (two tabs, in-app browser): moves both ways, wrong turn refused by board,
  controller and room, reload/reconnect resumes, third player refused, checkmate saved on
  both sides as `friend`, rematch swaps colours, disconnect shown, `Nová hra` leaves.
1 `npm audit` 0 (app) / 0 (worker) · 2 grep empty · 3 CSP on the dev site with the real
relay · 4–8 unchanged.

### 2026-09-17 — colleague review of Phase 20 (independent agent, no prior context), round 1
Findings and what was done (commit refs in git):
- **High — seat lost when the link is opened in a fresh tab** (token in `sessionStorage`,
  seats never freed). Fixed: the seat token lives in `localStorage` `skm.friend` with a
  24 h expiry (one room; cleared on `Odejít`); the room frees a seat on `{t:'leave'}`
  and lets a new token take a seat whose player has had no socket for 60 s; the room id
  leaves the address bar as soon as it is read (a reload rejoins from storage).
- **Medium — `peer:false` after a replaced socket.** Fixed: the room reports a seat
  offline only when no other socket holds it.
- **Medium — no resync; a bad SAN from the other seat could brick the host.** Fixed:
  every message from the room is shape-checked (`isServerMessage`); a refused remote
  move or an `error` triggers a reconnect and the room's `state` re-syncs the board; the
  replay in `startRemoteGame` runs on a scratch `Chess` first and a refused list ends the
  game with `Hra je poškozená — začni novou.`
- **Medium — relay abuse floor.** Fixed in the Worker: `Origin` allowlist (the app's own
  origins only), the 24 h alarm is set only after a valid `hello`/message, `ply` must be
  an integer, a seated socket cannot `hello` with another token. Per-IP limiting stays
  with Cloudflare (a Rate Limiting rule on `hra.zvirecisachy.cz` — owner's dashboard
  action, see the open items). Residual risk documented: Workers Free = 100 000
  requests/day for everyone.
- **Low** — friend games no longer count toward a campaign; a finished friend game is
  not recorded twice on reload; message length is documented as characters; `friendWs()`
  accepts `ws://` only for the dev server.
- **Legal** — root `package.json` gains `"license": "GPL-3.0-or-later"` (worker aligned),
  copyright lines in README and `LICENSE-ARTWORK.md`; `THIRD-PARTY-NOTICES.txt` ships
  with the site (chess.js BSD text, chessground, cburnett, Lichess, Stockfish) and is
  linked from the footer; `LICENSE-ARTWORK.md` now lists `docs/*.png` and says `worker/`
  is program; the consent line for real faces is in the `Vlastní figurky` dialog; a
  player-facing privacy notice `public/soukromi.html` (controller, what goes where,
  rights) is linked from the footer; the footer says "do 24 hodin od posledního tahu".
- **Docs** — threat model rewritten to the current state (above), C4/C7 annotated,
  checklist 4/5/7 updated, BACKLOG R10 marked "built, on the dev site", README stale
  paragraphs fixed, Phase 20 DoD table present.
- *All closed 2026-09-17:* the Cloudflare Rate Limiting rule for `hra.zvirecisachy.cz`
  (30 requests / 10 s per IP → block 10 s, zone ruleset `http_ratelimit`); the share sheet on a real phone (owner's test, Phase 20 DoD 7); the `člověk` set shows the author
  only (no second person); the privacy page's contact stays the feedback form (owner's
  decision — no e-mail address in the public code).

### 2026-09-17 — colleague review round 2 (at `7bafbef`)
Round-1 items confirmed closed by the reviewer; branch judged safe to merge. New findings
from the round-1 changes, fixed before publishing:
- **Medium — a `full` answer left the stored session in place**, so `rejoin()` replayed
  the refused room on every load for 24 h. Fixed: `full` (and a `policy` close) clears
  the session.
- **Medium — 60 s reclaim + a phone in the background = seat takeover by a second
  link-holder, silently.** Fixed: the window is 10 minutes (the same device rejoins at
  once through its stored token; the window only serves another device), the room
  remembers displaced tokens and answers them `full` with `taken: true` → "Tvoje místo u
  stolu mezitím zabral někdo jiný, kdo měl odkaz."
- **Low–Medium — shared PC**: a rejoin without a link happens only when the session was
  live within the last 2 hours (`seen`, refreshed on every `state`/move); `Odejít`
  clears it. The 24 h token still serves a link opened again.
- **Low** — `startRemoteGame` nulls the previous record and names the sides
  (`onRemoteStart`) before pre-building the record of an already finished game.
- Notes taken: `soukromi.html` no longer says "jen" (lists the technical fields; "od
  poslední aktivity"); the Origin allowlist comment says it is an embedding filter, not
  authentication; plan decision 7 corrected; DoD rows 2/3 re-run with the new flow.

### 2026-09-17 — colleague review round 3 (at `cd5829b`): final verdict
All round-1/2 findings confirmed closed; **"safe to merge and to publish to the public
site"**. Two Low notes fixed in `7d81fba` (the stored session is touched on the player's
own moves and on `peer` events so a host who waits long is still rejoined; `displaced`
survives a rematch; README says "Worker first, then the site" for message-shape changes).
Open owner items carried in the round-1 entry; the Cloudflare Rate Limiting rule on
`hra.zvirecisachy.cz` is the one to do first (the only mitigation for the Free-plan daily
request ceiling).

### 2026-09-17 — owner's question: can the friend links be abused (phishing)?
The link is `https://zvirecisachy.cz/#hra=<12 base32 chars>`; the app reads exactly those
characters (regex) and nothing else from the URL — no redirects, no rendering of URL
content, no downloads; CSP as above. Cases considered: (1) a look-alike domain — generic
phishing; there is nothing on this site to steal or to type (no login, no payment, no
in-app form), so a copy could only show a child other content — the same risk as any
link, not specific to the game; the redirect domain `zvireci-sachy.cz` is ours;
(2) a genuine link forwarded to a stranger — they can take the free seat or a seat left
for 10 min; the impact is "a stranger plays chess with the child": no chat, no names, only
SAN-shaped strings pass (≤ 10 chars, regex + chess.js); the displaced player is told,
`Odejít` ends it; (3) guessing a link — 60 bits, ids never listed; (4) malware via the
link — no. Conclusion: justified as a general concern, low in this design. Cheap
improvements filed under R11: `og:title`/`og:image` so the WhatsApp/SMS preview shows
the real site's branding, and one sentence ("odkaz posílej jen tomu, s kým chceš hrát")
in the bar or on the privacy page. *Done the same evening:* `og:*` tags + `public/og.jpg`
(a static image, same origin, no script) and the sentence in the friend bar.


### 2026-09-26 — owner opt-out from Web Analytics (`#bezmereni`)
The beacon is no longer a `<script>` tag in the HTML; `src/analytics.ts` (our own bundle)
appends the same tag at start-up, public build only (`__CF_BEACON_TOKEN__` is empty
elsewhere). Opening the site with `#bezmereni` stores `skm.noAnalytics = 1` and the beacon
is not loaded in that browser (footer shows "bez měření"); `#mereni` removes the key. Both
fragments are handled on load and on `hashchange`, then stripped from the address bar with
`replaceState`, so a copied link cannot carry them. Purpose: the owner's testing stops
counting as visits. No new host, CSP unchanged (the script and POST hosts are the same);
`script-src` still has no `'unsafe-inline'` because the tag is created from the bundle.
Verified on `vite preview` of a `--mode pages` build with the token swapped for zeros:
beacon injected by default, absent after `#bezmereni` (also typed into an open tab), back
after `#mereni`; no CSP violations.

### 2026-09-26 — friend game: reliability and protocol hardening (branch `fix-friend`)
Reviewer findings (confirmed) and what changed. **Deploy the Worker first, then the site**
(the new client pings; an old relay would close a ping with `policy`).
- **Relay validates moves with chess.js.** A regex-valid but illegal SAN (`zz`, `Ke5`…)
  used to be stored and broke the room for both players. The DO now plays every move on
  a chess.js position (cached in memory, rebuilt from `sans` after hibernation); an
  illegal move gets `{t:'error', msg:'illegal move'}` to the sender only, nothing is
  stored or forwarded. The stored/forwarded SAN is chess.js's own spelling. chess.js
  comes from the app's root dependencies (same 1.4.0 as the browsers; the bundler finds
  it walking up from `worker/`). Bundle 96 KiB / 21 KiB gzip.
- **Relay message shape.** `JSON.parse` results that are not a plain object (`null`,
  numbers, arrays) used to throw in the DO (`msg.t` of null); now closed with 1008
  `policy`. Field types are checked before use (`hello.token` string, `hello.pref` one of
  w/b/random, `move.san` string, `move.ply` number → otherwise `error`/`policy`).
- **Close reasons split.** 1008 `rate` = the 10 msg/s flood guard (transient: the client
  reconnects after ≥ 3 s and keeps its seat); 1008 `policy` = not the protocol. The
  client no longer wipes the stored seat on `policy` (it is not a ban; a reload rejoins)
  and says `Server spojení ukončil. Načti stránku znovu — hra na tebe počká.`
- **Keep-alive without waking the DO.** `setWebSocketAutoResponse('{"t":"ping"}' →
  '{"t":"pong"}')`; the client pings every 25 s and reconnects when no message arrives
  within 10 s (4 s after the page becomes visible again); `online` reconnects at once.
  Half-open sockets (iOS background, Wi-Fi → LTE) are now detected. A ping with other
  spacing reaches the DO and is answered there (no close).
- **No lost moves.** A move of ours is *pending* (kept in the stored session, so it
  survives a reload) until the room is known to have it: the friend answers it, or a
  `state` contains it. A `state` one ply short gets the move sent again (the room checks
  turn, ply and legality as for any move); a refused or superseded one is dropped and the
  board follows the room. While a pending move waits the bar says `…připojuju…`. A mate
  played on a dead socket now reaches the room instead of existing only in the local
  record.
- **Rematch state.** `leave` (and a seat reclaimed by a new token) drops that seat's
  rematch offer, so a newcomer is never pulled into a rematch they did not ask for.
  `state` gains `rematch: Seat[]` (who has asked for this game) so an offer made while the
  peer was away is shown when they come back. Additive field: the deployed client's shape
  check ignores unknown fields; the new client accepts `state` with or without it.
- **Storage.** The seat token falls back to `sessionStorage` when `localStorage` is
  blocked or throws (rejoin after a reload in the same tab still works). Same content,
  same 24 h / 2 h rules; still no name, no cookie.
- **UX.** `Kamarád` no longer ends the game at once: it shows `Pošli kamarádovi odkaz. Kdo
  ho má, může si sednout ke stolu.` with `Vytvořit odkaz` (asks first when a game is under
  way), which creates the room and copies the link; the status line says `Čekám na
  kamaráda…` until the friend first arrives. `Odejít` is two-step (`Opravdu odejít?`,
  resets after 4 s).
- **Compatibility of the new Worker with the deployed client:** yes — extra `state` field
  ignored; `pong` only answers pings the old client never sends; `rate` is an unknown
  reason to the old client, which therefore reconnects (better than the old wipe);
  `error` for an illegal move triggers the old client's resync. Rooms that already hold
  an illegal SAN stay broken (they were before), and expire in 24 h.
- Tested against `wrangler dev --local` with node WebSocket clients (protocol level) and
  with the real `friend.ts` + `friend-panel.ts` under a DOM shim (two players): normal game
  to mate; null/number/array/illegal/typed-wrong messages; half-open socket → pong timeout
  → reconnect → pending resent; pending across a reload; `online`; rate close → rejoin with
  the seat; policy close → note, reload rejoins; rematch offered while the peer is away,
  cleared by `leave`, newcomer not auto-rematched; two-step `Odejít`.

### 2026-09-26 — Phase 21a (lessons)
- **New localStorage key `skm.lessons`**: `{done, tests, badges}` (id → `true`) and
  `teacher` (`owl` | `animal`). Read defensively like `skm.puzzles`/`skm.endgames`: any
  unparsable or wrongly shaped value → defaults; `done` keeps only ids of shipped lessons,
  `tests`/`badges` only `[a-z0-9-]{1,40}`, at most 200 keys each; storage errors are
  caught. `skm.puzzles` gains `theme` (kept only when it is a known tag of the Czech map).
- **No network.** Lessons are code in the bundle; no fetch, no new host, CSP unchanged.
  The course map's teacher picture is the same-origin character image already used by the
  campaign.
- **DOM: textContent only.** Lesson panel and course map build every node with
  `createElement` + `textContent`; no `innerHTML`. The only markup string that reaches
  chessground is the constant star SVG in `src/ui/lesson-board.ts` (never built from
  data), like the glyph badge in `board-bridge.ts`; shape labels go through chessground's
  own SVG text. `check:lessons` also rejects `<`/`>` in lesson texts.
- **Board ownership.** `board-bridge.ts` now exposes the chessground `Api`; only the lesson
  board uses it, while the controller is in lesson mode (no board sync, no engine). The
  lesson board takes over chessground's `after`/`select` handlers and restores them on
  leaving; any other mode (`Nová hra`, puzzle, ending, friend link, loaded game) ends
  lesson mode through `onLessonEnd` before the board is synced again.
- **Nothing is sent**: no names, no progress; the diploma name (21b) will stay local.

### 2026-09-26 — Phase 21b (lessons: mini-games, level test, diploma)
- **Diploma name (the only personal datum in the app).** Typed in the diploma dialog,
  rendered with `textContent` only; control, zero-width and bidi-override characters are
  stripped and the length capped at 40 (`src/lessons/diploma.ts`). Never sent: no fetch,
  not in any URL, not in analytics. Stored in `localStorage['skm.diplomaName']` only while
  „Zapamatuj si moje jméno“ is ticked; unticking removes it. A stored value is re-cleaned
  on read.
- **Printing** clones the sheet (DOM nodes, no HTML strings) into a body-level container
  shown only under `@media print`; the teacher avatar is the same-origin piece image or an
  emoji. No new host, CSP unchanged.
- **Progress** gains `tests.l1` / `badges.l1` (same id pattern and key cap as before).
- **Mini-games** run a local move picker (no worker, no engine); nothing new is loaded.

### 2026-09-27 — pre-release review of `origin/main..main` (at `f3bb3d3`)
Scope: the 48 local commits since the last public release (review fixes, relay chess.js
validation / ping / rematch-in-state / close reasons, friend client, analytics opt-out,
Czech notation + PGN mapping, `compat.js`, the lessons feature with course map, lesson
board, diploma and puzzle theme filter), plus the owner's new Cloudflare Email Routing
address and "can a stranger reach a child". Method: code read of every new sink and input,
the checklist-3 grep widened to `outerHTML`, `document.write`, `eval`, `new Function`,
`on…` attributes, `href =`, `window.open`, `target`; `npm audit --omit=dev` (app and
`worker/`); both builds inspected (`dist/` and a `--mode pages` build); history grepped for
secrets and e-mail addresses; the dev-site Pages working copy grepped for the contact address.

**Findings**
- **Medium — the Email Routing address is in the public source repository.** `docs/BACKLOG.md`
  named it (pushed in `00c9aa6`, 2026-09-26), and the two local commits `6b186d8` / `cc0edb8`
  (added to and reverted from `soukromi.html`) carry it in their diff *and* subject line.
  Never on the live site or the dev site (both builds and the dev Pages repo's history:
  0 hits). Fixed in HEAD (`6c6cbec`, the BACKLOG line no longer names it); the history is
  the owner's call — see *owner items*.
- **Low — owner's personal Gmail hard-coded** in `scripts/push-pages.mjs` (public repo).
  Fixed (`6c6cbec`): the script commits with the machine's git identity. The same address
  is the author e-mail of every commit in the public repo (GitHub serves it in `.patch`
  views) — see *owner items*.
- **Low — chessground renders shape `label.text` with `innerHTML`** (`svg.js`, `renderLabel`),
  while `src/ui/lesson-board.ts` said "SVG text (no HTML)". Labels are lesson constants, so
  nothing was reachable; escaped anyway (`18a7ed3`) to keep "no data string becomes markup".
- **Low — the privacy page did not list lesson progress and the diploma name** among the
  data kept in the browser. Fixed (`d892859`).
- **Low (not fixed)** — `pgnFromCzech` runs on the pasted text before the 200 kB cap in
  `recordFromPgn`; its split regex can go quadratic on a multi-MB paste of unbalanced `[`.
  Self-inflicted only (the child's own paste, own tab).
- **Info — the relay** (`worker/src/index.ts`): Origin allowlist, room id 60 bits and seat
  token 100 bits from `crypto.getRandomValues` (unbiased: 256 % 32 = 0), 200-char / 10 msg/s
  / 1000-ply limits, non-object JSON and wrongly typed fields closed with `policy`, every
  move played on chess.js before it is stored or forwarded, storage wiped 24 h after the
  last valid message, nothing stored for a socket that never sends a valid `hello`,
  observability off. Stored per room: two seat tokens, up to 4 displaced tokens, the SAN
  list, the game number, rematch seats — nothing about a person. **There is no text
  channel**: the only peer-originated data a child's browser shows is a SAN (regex +
  chess.js) and booleans/seat letters; `error.msg` goes to the console only. A stranger can
  reach a child only by holding the link (60 bits, never listed) and can then only play
  chess — unchanged from the 2026-09-17 analysis. Idle sockets that never `hello` are
  bounded by the Cloudflare per-IP rate limit rule.
- **Info — DOM sinks**: `innerHTML` only in the constant panel template (`src/main.ts`, no
  interpolation) and chessground's `customSvg` (validated glyphs, the constant star); every
  new lesson / course-map / diploma node is `createElement` + `textContent`; the diploma
  name is cleaned (controls, zero-width, bidi overrides stripped, 40 chars) and never sent;
  printing is a DOM clone. `compat.js` builds its message with text nodes and CSSOM styles.
  No `eval`, `new Function`, `document.write`, `on…` attributes or data-built `href`s (the
  feedback link is a constant plus `encodeURIComponent`).
- **Info — CSP** unchanged and without `'unsafe-inline'` in the app: `script-src 'self'
  'wasm-unsafe-eval'` (+ `static.cloudflareinsights.com` on the public build), `connect-src`
  as recorded, `base-uri`/`form-action 'none'`. `soukromi.html` has its own static policy with
  `style-src 'unsafe-inline'` and **no script source at all** (`default-src 'none'`) —
  acceptable for a script-free page. The beacon loads without SRI (Cloudflare updates it);
  it is the one third-party script with page access — accepted since 2026-09-17.
- **Info — outbound / leaks**: `no-referrer` on both pages; the friend room id only in the
  fragment and removed on read; `#bezmereni`/`#mereni` removed on read; `og:*` static;
  footer links `noopener`. `dist/`: no source maps, no debug hooks, only the expected files;
  the only e-mail in it is the chess.js copyright line in `THIRD-PARTY-NOTICES.txt`
  (required by its licence).
- **Info — dependencies/secrets**: `npm audit --omit=dev` 0 (app) / 0 (worker); no new
  dependency; no token/key patterns in the new commits; `worker/.gitignore` covers
  `.wrangler/` and `.dev.vars`.

**Owner items (nothing changed online from here)**
1. *Before pushing `main`*: drop the two net-zero commits whose subject and diff carry the
   address (`6b186d8`, `cc0edb8`): `git rebase --onto 2f0981e cc0edb8 main`, then
   `git log -G "[a-z]+@zvirecisachy[.]cz" origin/main..main` must list only `6c6cbec` (its diff removes the line that `00c9aa6` already pushed). Optional: remove it from the pushed
   history as in D7 (`git filter-repo --replace-text`, force-push). Caveat: the routed local part is the
   first address spammers guess on any domain, so keeping it out of the repo only stops
   scraping; if spam arrives, route a non-guessable local part instead and drop the current one.
2. Commit identity: `git config --global user.email <id>+jirineoral@users.noreply.github.com`
   and GitHub → Settings → Emails → "Keep my email addresses private" + "Block command line
   pushes that expose my email". Past commits keep the Gmail (rewrite only if it matters).
3. DNS (Cloudflare, `zvirecisachy.cz`) — anti-spoofing for a domain that never sends mail:
   - keep the Email Routing MX records and its SPF TXT at `@`
     (`v=spf1 include:_spf.mx.cloudflare.net ~all` — Cloudflare's forwarding relies on it);
   - add TXT `_dmarc` = `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s` (no `rua` with a
     personal address; Cloudflare's DMARC Management can supply one if reports are wanted).
     Receivers then reject mail *claiming to be from* `@zvirecisachy.cz` or any subdomain;
     forwarding to the owner is unaffected (forwarded mail keeps the original From domain).
   - `zvireci-sachy.cz` (Forpsi; sends and receives nothing): MX `0 .` (null MX, RFC 7505),
     TXT `@` = `v=spf1 -all`, TXT `_dmarc` = `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s`.
4. Carried: deploy order Worker first, then the site (2026-09-26 entry).

Checklist: 1 `npm audit` 0/0 · 2 grep empty at HEAD, bundle clean · 3 sinks as above (one
hardened) · 4 new keys `skm.lessons`, `skm.diplomaName`, `skm.noAnalytics` validated/cleaned
on read · 5–6 not re-run in a browser in this review (no network or CSP change since the
2026-09-26 verification; re-run on the Pages URL after the deploy) · 7 `dist/` holds only
the expected files · 8 GPL text ships. `npx tsc --noEmit`, `npm run build`,
`npm run test:lessons` (141 passed) green after the fixes. Verdict: **safe to release** once
owner item 1 is done (or consciously skipped); items 2–3 are hardening that can follow.

### 2026-09-27 — sound effects (branch `feat-sounds`)
- **New same-origin media, no new host.** Ten short `.ogg`/`.m4a` files (≈ 50 kB total)
  under `public/sounds/`, synthesised from scratch by `scripts/make-sounds.py` (stdlib
  `wave`/`math` sine waves and filtered noise; ffmpeg transcodes to Opus/AAC when present,
  else plain WAV) — own work, no third-party audio, no `THIRD-PARTY-NOTICES` entry needed.
- **No CSP change.** `src/sounds.ts` loads them with `fetch()` + `decodeAudioData` (never
  an `<audio>`/`<video>` element), so the relevant directive is `connect-src`, not
  `media-src` — and `connect-src 'self' …` already covers a same-origin path. `media-src`
  would only be needed if a future change added `<audio src>`/`<video src>` playback,
  which falls back to `default-src 'none'` (blocked) without it.
- **Fails silently by design.** `initSounds`/`play()` wrap every step (AudioContext
  creation, fetch, decode, `start()`) in `try/catch`; a blocked AudioContext, a 404, an
  undecodable format or an old browser without Web Audio all just mean no sound, never a
  thrown error. Nothing plays before the first `pointerdown`/`keydown` (autoplay rules;
  also keeps the intro splash silent), and `play()` re-checks the `Zvuky` setting
  (`skm.sounds`, garbage → default on) on every call.
- **New localStorage key `skm.sounds`**: `'on'`/`'off'` only meaningfully read (anything
  else including garbage defaults to on), same pattern as `skm.pieceDrop`/`skm.intro`.
- **Nothing is sent.** Sound choice/volume never leaves the browser; no analytics event,
  no new fetch target beyond the same-origin sound files.
- `npx tsc --noEmit`, `npm run build`, `npm run test:lessons` (141 passed) green. Verified
  in a browser (dev server, port 5185): the ten files fetch and decode after the first
  click (network tab all 200), no console errors across page load / gesture / setting
  toggle / reload-persistence / a played move and engine reply / a new piece-drop start.
  Not yet merged to `main` or deployed.

### 2026-09-28 — installable PWA, step 1 of R12 (branch `agent-afa6e22a274acd8ca`)
- **What changed.** `public/manifest.webmanifest` (name/short_name "Zvířecí šachy",
  `start_url`/`scope` `/`, `display: standalone`, icons); five PNG icons under
  `public/icons/` generated deterministically from artwork already in the repo
  (`public/piece-sets/animals/kuzlata/light/K.png`, the white goat king) by
  `scripts/make-icons.py` — no new artwork, no third-party asset; iOS meta tags and
  `<link rel=manifest>` in `index.html`. A hand-written service worker: the source is a
  template (`scripts/sw-template.js`); `scripts/build-sw.mjs` runs after `vite build` in
  every build script (`build`, `build:pages`, `build:dev-site`), fills in a cache-version
  hash (sha256 of the precached files' own contents) and the precache URL list from the
  finished `dist/`, and writes `dist/sw.js` — so the worker's own bytes change on every
  deploy that changes the shell, which is what makes the browser's built-in update check
  (it byte-diffs `sw.js` on navigation) actually fire. Registration is one line in
  `src/main.ts` calling `registerServiceWorker()` (`src/pwa.ts`), gated on
  `import.meta.env.PROD` so `vite` (dev server) never registers one.
- **Why hand-written, not vite-plugin-pwa/Workbox.** The caching need here is small and
  fixed (one app shell to precache, three runtime strategies for everything else) and the
  HEAD-pre-check and cross-origin exclusions below are easiest to get right — and to keep
  right when they matter for safety — in a worker whose entire logic is one screen of
  code the owner can read, rather than behind a generated Workbox bundle. No new
  dependency.
- **What is precached vs. cached-on-use, and why.** `npm run build:pages` on this branch:
  the app shell (`index.html`, the one JS bundle ~439 kB / ~139 kB gzip, one CSS bundle
  ~51 kB / ~12 kB gzip, `compat.js`, `manifest.webmanifest`, the 5 icons, `soukromi.html`,
  `THIRD-PARTY-NOTICES.txt`, and the ~21 kB Stockfish *loader* script) is **13 files,
  ~968 kB total** — precached on install, so the app shell and the ability to *start* an
  engine search work with zero prior visits. The Stockfish **`.wasm` is 7.0 MB** — far too
  big to add to every install's first download for a feature most sessions won't touch in
  the first minute — so it is fetched and cached the first time an engine is actually
  created (cache-first afterwards). Piece sets (~15 MB total across all characters),
  lessons, puzzles (~427 kB) and splash images are likewise cached only as each is opened
  (stale-while-revalidate) — a fresh install does not silently download tens of MB.
  Consequence, stated plainly: the *very first* offline session can open the app and play
  in two-player mode and against the engine immediately, but a character/lesson/puzzle
  band never opened online yet will show the app's own existing graceful-degradation
  message ("that side shows the built-in pieces" etc.) instead of loading — expected and
  observed in testing (see below), not a bug.
- **HEAD pre-check safety.** The fetch handler's first check is `if (request.method !==
  'GET') return;` — HEAD (and everything but GET) is never intercepted and always reaches
  the real network, so `src/engine.ts`'s wasm content-length pre-check keeps seeing the
  real response in every online case, exactly as before this change.
- **A real bug found and fixed while testing offline play**, in `src/engine.ts`
  (`precheckWasm`): the function's single `try/catch` treated *any* thrown error the same
  way, including a plain `fetch()` rejection with no network at all (`TypeError: Failed to
  fetch`) — offline, this permanently disabled the engine for that page load (silent
  fallback to two-player, same code path as a genuinely missing file). Split the fetch
  call into its own `try`: a network-level failure (not a timeout) now makes the
  pre-check resolve — proceed, offline is not "the file is wrong" — while a server that
  *did* answer with the wrong thing (bad status, an SPA-fallback HTML page, a wrong
  content-length) still throws exactly as before. `npx tsc --noEmit` clean; behaviour
  verified live (below). This is a genuine behavioural change to existing code, scoped to
  the one function; the deliberate fail-closed cases are untouched.
- **Cross-origin exclusion.** The fetch handler's second check is `if (url.origin !==
  self.location.origin) return;` before any caching logic runs — chess.com, the Lichess
  broadcast API, the friend relay WebSocket (not interceptable by a service worker's fetch
  event at all — WebSocket upgrades don't go through it — but excluded for clarity anyway)
  and the Cloudflare Analytics beacon are all passed straight through, untouched, exactly
  as without a service worker.
- **Updates without the player clearing anything.** The cache name is
  `skm-cache-<version>`; `activate` deletes every `skm-cache-*` that isn't the current
  one. The page never auto-swaps a waiting worker in: `src/pwa.ts` shows a small banner
  ("Je tu nová verze hry" / "Obnovit") and only posts `SKIP_WAITING` when the player
  clicks it, then reloads once `controllerchange` fires — never mid-game on its own.
  Verified live: deployed v1, confirmed offline behaviour, then rebuilt (a genuinely
  different bundle hash) with the server back up — the banner appeared, clicking it
  reloaded onto the new worker, and `caches.keys()` showed only the new cache name (the
  old one gone).
- **CSP.** Added `manifest-src 'self'` — `default-src 'none'` would otherwise block the
  browser from fetching `manifest.webmanifest`. `worker-src 'self'` (already present)
  covers registering the service worker itself; no other directive changed.
- **Verified** (branch `agent-afa6e22a274acd8ca`, `npm run build:pages` + `npx vite
  preview`, real Chrome via the Claude-in-Chrome extension — the sandboxed built-in
  browser tool in this environment refuses all `navigator.serviceWorker.register()` calls
  with an opaque error and was not usable for this): manifest fetches and parses (4
  icons, correct name); service worker installs and activates; **offline** (verified by
  killing the preview server process, not just DevTools' network throttle, i.e. a harder
  test) — a full reload still renders the complete app (splash, board, settings) from
  cache; a *new game against the engine actually plays* offline end to end (engine opened
  as white and played `1. e4`, the player answered `1...g5`, the engine replied `2. d3`
  locally, all with the HTTP server dead); the update banner appears for a second,
  content-different build and reloads cleanly onto it with the old cache removed. A
  character not previously opened while online correctly fails to load its stylesheet
  offline and falls back to the built-in piece set (existing app behaviour, not new).
  **Not verified**: real installability prompts / home-screen behaviour on an actual
  Android/iOS device (no such device in this environment); the maskable icon's rendering
  under Android's actual adaptive-icon mask (only inspected the source PNG); the
  dev-site (`build:dev-site`) build was not separately smoke-tested beyond confirming its
  npm script also runs `build-sw.mjs`. `npx tsc --noEmit` and `npm run check:lessons` /
  `npm run test:lessons` were run after the `engine.ts` change; see the commit for their
  result. Not merged to `main`, not deployed anywhere.
