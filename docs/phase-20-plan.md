# Phase 20 — Play with a friend over a link (R10, variant B: relay) — plan, rev. 1

The owner opened the GATE on 2026-09-17 for exactly this: the first — and only — server
component, a **Cloudflare Worker with one Durable Object per game** that relays moves
between two browsers. No accounts, no names, no persistence beyond the game itself.
Everything else in the app stays as it is: no login, nothing sent unless the child
presses `Hrát s kamarádem`.

## Why relay, not P2P (decided with the owner)
WebRTC would keep moves off any server, but ~15–20 % of home/mobile networks need a TURN
relay anyway, the introduction needs a signalling server regardless, and the code is
three times larger. A WebSocket relay works on every network, reconnects trivially
(the Durable Object holds the move list), and costs the same: nothing at our scale
(Workers Free: 100 000 requests/day; a game is ~100 messages).

## Decisions (veto in review)
1. **Server = `worker/`**, a separate folder with its own `package.json` (only
   `wrangler` + `@cloudflare/workers-types` as dev dependencies; the app's
   `package.json` gains nothing). ~150 lines of TypeScript:
   `GET /r/<id>` upgrades to a WebSocket and hands it to the Durable Object `Room(<id>)`.
   The room keeps `{ sans: string[], startFen, seats: {w, b} }` in DO storage, accepts
   `{t:'move', san}` only from the seat whose turn it is, validates nothing about chess
   (the clients do, both run chess.js; a bad SAN is rejected by the receiver and the
   room is marked broken) and broadcasts. Messages: `hello` (seat assignment: first
   socket = host, colours by the host's preference; the second = guest; a third is
   refused), `state` (full move list on connect/reconnect), `move`, `rematch`
   (proposal + acceptance, colours swap), `left` (the other socket closed). A room
   idles out **24 h** after the last message (DO alarm deletes storage). Hibernating
   WebSockets so an idle game costs no duration.
2. **Room id** = 12 chars from `crypto.getRandomValues` (base32, 60 bits), generated in
   the **host's browser**, never by the server — the server cannot enumerate rooms.
   The link is `https://zvirecisachy.cz/#hra=<id>`: a fragment, so it never reaches the
   Pages host, referrers or Web Analytics.
3. **Hostname `hra.zvirecisachy.cz`** as a Workers custom domain (Cloudflare creates the
   proxied record; needs the zone active). CSP: `connect-src` gains
   `wss://hra.zvirecisachy.cz`. Until the zone is active, development uses the
   `*.workers.dev` URL from `.env.local` (`VITE_FRIEND_WS`), never committed.
4. **Client** (`src/friend.ts` + `src/ui/friend-dialog.ts`): `Hrát s kamarádem` button
   in the panel → dialog: `Vytvořit hru` (link + `Kopírovat` + `Sdílet…` via
   `navigator.share` where it exists — the WhatsApp/SMS chooser on phones) and the
   waiting line `Čekám na kamaráda…`; opening a `#hra=` link joins, shows `Hraješ
   s kamarádem — máš černé` and the board. Each player keeps their **own** piece set and
   settings (the child sees their animals, the friend theirs); the move feedback and
   the engine are off in this mode; undo is off (no take-backs against a human over a
   link — a rematch instead); the game is saved with `mode: 'friend'` and kept out of
   `Bilance`.
5. **Controller**: a `remote` mode next to `twoPlayer`: `movableColor` = the seat's
   colour, `maybeStartEngine` skipped, `handleUserMove` also emits the SAN through
   `options.onHumanMove`, and a public `applyRemoteMove(san)` (chess.js validates;
   an illegal SAN → `console.error` + the room is left with a clear status line).
6. **Disconnect**: the socket reconnects with backoff (1, 2, 4… 30 s) and re-syncs from
   `state`; the status line says `Kamarád je odpojený…` after 5 s without them, the
   board stays; closing the tab ends the game for the other side after the same delay.
7. **Nothing personal**: the Worker sees the two IPs (Cloudflare edge, not logged by us —
   `wrangler` observability off), the room id and SANs. No cookies, no ids in storage
   beyond the current room in `sessionStorage` (`skm.friendRoom`, for a reload). This is
   the whole GDPR surface and it is recorded in `docs/security-review.md`.
8. **Abuse**: rooms are unguessable and two-seat; a message over 200 bytes or over 10
   messages/s closes the socket; no text channel exists, so nothing can be said.

## Files
```
worker/wrangler.toml, worker/package.json, worker/src/index.ts   NEW  the relay
src/friend.ts              NEW  room id, WebSocket client, reconnect, message types
src/ui/friend-dialog.ts    NEW  create / share / join / status
src/game-controller.ts     MOD  remote mode, applyRemoteMove, onHumanMove
src/main.ts                MOD  button, dialog wiring, #hra= on load
src/games.ts               MOD  mode 'friend'
vite.config.ts             MOD  CSP connect-src (wss)
src/styles/app.css         MOD
README.md, docs/BACKLOG.md, docs/security-review.md   MOD
```

## Definition of Done
1. Two browsers (in-app pane + Chrome): host creates a game, guest opens the link,
   both boards show the same position after every move; a move out of turn or for the
   wrong colour is impossible (board), and one forged over the socket is refused by the room.
2. Reload on either side mid-game → the position and turn come back from `state`.
3. Close the guest's tab → the host sees `Kamarád je odpojený…` within ~5 s; reopen the
   link → the game continues.
4. Checkmate → both sides get the game end (kings react per side), the game is saved
   on both with `mode: 'friend'`; `Odveta` swaps colours and starts a new game.
5. A third browser opening the link is refused with a clear message.
6. Engine, feedback and undo stay off in the mode; leaving the mode (`Nová hra` alone)
   restores the normal game against the computer.
7. Phone width: dialog and `Sdílet…` usable (share sheet on a real phone: owner's check).
8. Worker: `wrangler deploy` from `worker/`; free-plan usage after a test day visible
   in the dashboard; observability (logs) off.
9. `npm run build`; no debug code; grep empty; security checklist + the new entry.

## Explicitly NOT in this phase
Chat, clocks, spectators, more than two players, saving rooms, accounts, P2P.
