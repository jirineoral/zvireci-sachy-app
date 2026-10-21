# Progress — batch 2026-09-28 (owner: "1, 2, 3, 4 pojďme") — DONE

All four items merged to main and deployed to production 2026-09-28 (~21:45):
main 58f09df, Pages commit 2acf936, bundle index-BeC7_B7P.js. Verified live: SW registers,
manifest, read-aloud audio fetch+decode from R2 under prod CSP/CORS, no console errors.

| # | Item | Merge |
|---|------|-------|
| 1 | PWA (hand-written SW; caches shell / engine / runtime; update banner reloads own tab only) | a90ad38 |
| 2 | Sova čte nahlas — audio L1–5 (1226 texts, 79 MB) on R2 `lesson-audio/`, bundled manifest, CORS | f577566 (squash) + 58f09df |
| 3 | L6 lessons (14) + review fixes + masculine-form lint; l3-ctverec text | eb23bdd |
| 4 | Promotion dialog keeps pawn; undo disabled at engine's ply 0 | 2717def |

Owner decisions: UCI_Elo PARKED (BACKLOG, 7428ee6). Checks on main: check:lessons 85/570 0 errors,
test:lessons 186, test:ui 17.

## Open / follow-ups
- L6 has no read-aloud audio (owner asked for 2–5): `node scripts/lesson-audio/build.mjs --levels 6` + `node scripts/r2-upload.mjs`.
- Audio manifest (120 KB) in the main bundle (+~50 KB gzip) → lazy chunk or hash-set.
- One unreproduced "🔊 did nothing once" during agent testing.
- Not verified: install on real Android/iOS, Safari audio, L6 by a strong player (lessons 3–8).

- 2026-10-21 social audit 12.–25. 10.: weeks 12–18 published on FB/IG/YT (verified), 19–25 empty, no prepared content; nothing published this run. See assets/social/audit-2026-10-21.md.
- 2026-10-21 social queue 22. 10.-7. 11. (8 posts, FB/IG/YT Shorts) in assets/social/tyden-2026-10-19, -10-26, -11-02; reviewed (4 Opus + re-check); awaiting owner yes per week (SCHVALENI-2026-10-22.md). Routine proposal RUTINA-NAVRH.md, not created. Builders: scripts/social/.
