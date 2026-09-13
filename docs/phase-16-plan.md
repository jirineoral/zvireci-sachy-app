# Phase 16 — Tournament broadcasts via Lichess (R7, the server-free part) (plan, rev. 1)

## Investigation result (the backlog asked for it before assuming)
- **chess-results.com**: no API, ASPX pages, no CORS → a proxy would be needed → **GATE**.
  Not done; recorded as parked.
- **Lichess Broadcast API** (`lichess.org/api/broadcast/…`): public, unauthenticated,
  `Access-Control-Allow-Origin: *` on the listing, the search, the tour and the round
  PGN (verified with curl 2026-09-13). Coverage checked by searching: it **does** carry
  Czech events — *Czech Rapid Youth Championship 2026* (U10/U12/U14/U20, Česká Třebová —
  the tour even links its chess-results standings), *Czech Open Pardubice*, *šachy.cz
  Extraliga*, *Ostravský koník*, *Olomouc Chess Summer*, the Czech championships in
  Brno, České Budějovice festival. It does **not** carry regional youth events or club
  leagues ("krajský", "mládež" → nothing). So: national youth and open events yes,
  regional ones no. That is the honest limit and the app will say so in the dialog.

## Decisions (veto in review)
1. **`Turnaje` dialog**: a search box (`Hledej turnaj`, e.g. "Czech"), results
   (name, place, dates), → the tour's rounds (finished / running / upcoming), → the
   round's games (White × Black, result or `hraje se`), `Otevřít` → the review. One
   dialog, three levels, `← zpět` between them.
2. **Data path**: search/tour JSON validated to bounded strings and 8-char ids; the round
   PGN (`/api/broadcast/round/{id}.pgn`, all games of the round) split on game boundaries
   and each game parsed by the existing `recordFromPgn` (chess.js). Games without moves
   yet are listed but not openable.
3. **Running rounds refresh** while the round view is open (every 30 s, one request); a
   game opened in the review is a snapshot — reopen it to see new moves. Live following
   *inside* the review is left for a later phase (needs a "replace record, keep the cursor"
   path in the controller).
4. **CSP**: `connect-src` gains `https://lichess.org`. No images from Lichess (`img-src`
   unchanged; tour photos are not shown).
5. Nothing is stored (no new key).

## Files
```
src/lichess.ts              NEW  search, tour, round PGN → records
src/ui/broadcasts-dialog.ts NEW
src/main.ts, src/styles/app.css, vite.config.ts  MOD
README.md, docs/BACKLOG.md, docs/security-review.md  MOD
```

## Definition of Done
1. `Turnaje` → search "Czech" → results incl. the youth championship → rounds → a
   round's games → `Otevřít` shows the game in the review with the players' names.
2. A round that has not started lists no games with a Czech message; a running round
   (if any at test time) shows `hraje se` and refreshes.
3. Garbage / unexpected JSON → Czech error, dialog usable; CSP in the built app allows
   `lichess.org` and still blocks other hosts.
4. 375 px: fits. `npm run build`; no debug code; security checklist.
