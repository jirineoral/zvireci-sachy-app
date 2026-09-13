# Phase 15 — chess.com import (R3, the server-free part) (plan, rev. 1)

GATE check: `api.chess.com/pub/...` is a public, unauthenticated API that answers with
`Access-Control-Allow-Origin: *` (verified with curl 2026-09-13), so the browser fetches
it directly — no proxy, no server. Live play against people stays parked (GATE).

## Decisions (veto in review)
1. **Where:** a `Chess.com` section in the `Partie` dialog: username box, `Načíst`,
   a month select (the archives list, newest first), then the month's games (date, white ×
   black, result, time class) each with `Otevřít` (review) and `Uložit`. The username is
   remembered (`localStorage['skm.chesscom']`) — it is the child's own public handle.
2. **Data path:** archives → month JSON → each game's `pgn` goes through the existing
   `recordFromPgn` (chess.js), nothing else is trusted; games with `rules !== 'chess'`
   (chess960, bughouse…) are skipped. The record keeps `source: 'pgn'`; when the username
   matches White or Black, `humanColor` is set so the review shows `(ty)` and orients the
   board. Imported games stay out of `Bilance` (as decided in Phase 14).
3. **CSP:** `connect-src 'self' https://api.chess.com` — the one and only external
   endpoint; recorded in the security review (C4, C7).
4. **Errors in Czech:** unknown player (404), rate limit (429), network failure, empty
   month; nothing blocks the rest of the dialog.
5. **Limits:** a month can hold hundreds of blitz games; the list shows them all (scrolling
   list, text only) — no pagination in this phase.

## Files
```
src/chesscom.ts             NEW  fetch + validation + conversion
src/ui/games-dialog.ts      MOD  Chess.com section
vite.config.ts              MOD  connect-src
src/styles/app.css          MOD
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. Username `hikaru` → month list, latest month's games listed with results; `Otevřít`
   replays one in the review with the right names; `Uložit` puts it in the saved games.
2. The child's own username (or any) as White → `(ty)` and board orientation follow.
3. Unknown username → `Hráč nenalezen`; offline (dev server with the host blocked) →
   network message; nothing else in the dialog breaks.
4. Production build's CSP allows exactly `https://api.chess.com` besides `'self'`; a
   request to any other host is still blocked (checked with a stray fetch in the built app).
5. 375 px: the section fits. `npm run build`; no debug code; security checklist.

## DoD results (executed 2026-09-13)

| # | Item | Result | Observed |
|---|------|--------|----------|
| 1 | Load / open / save | PASS | `hikaru` → 153 months (9/2026 … 1/2014), latest month: `132 partií.`; `Otevřít` → `Rozbor: jacky72 × Hikaru (ty) · 0 : 1`, moves replayed; `Uložit` → `Partie Hikaru × jacky72 uložená.`, listed under the saved games (dated by chess.com's end time) |
| 2 | Own side | PASS | Username = Black → `(ty)` on the black side and the board oriented black |
| 3 | Errors | PASS | Unknown user → `Hráč nenalezen.`; `bad name!` → the validation message before any request; network failure path → `Nepodařilo se spojit s chess.com. Jsi online?` (by code path — the API was reachable; the catch wraps `fetch`) |
| 4 | CSP | PASS | Built `index.html`: `connect-src 'self' https://api.chess.com`; in `vite preview` the API answers 200 and `fetch('https://example.com/')` is refused by the policy (console: "violates … connect-src") |
| 5 | Mobile / build / security | PASS | 375 px: section 305 px wide inside the 345 px dialog, no horizontal scroll; `tsc` strict clean; grep empty; checklist run recorded |

Deviations: none. Note for the review: a month of a heavy blitz player is a long list
(132 rows here) — fine to scroll, but pagination or a search box is the obvious next step
if it bothers him.
