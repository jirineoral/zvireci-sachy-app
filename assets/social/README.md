# Social media assets

Made 2026-09-24 from the project's own artwork (`assets/source/frogs.png`, `public/splash/splash.jpg`)
and screenshots of the live site (mobile, 412 px wide at 2.625×). Same licence as the other
artwork (`LICENSE-ARTWORK.md`).

| File | Where | Size |
|---|---|---|
| `profilovka.png` | Facebook page picture | 720×720 |
| `cover.jpg` | Facebook cover | 1640×624 |
| `yt-profilovka.png` | YouTube avatar | 800×800 |
| `yt-banner.jpg` | YouTube banner (safe area 1546×423 in the middle) | 2560×1440 |
| `1-intro.jpg`, `2-partie.jpg`, `3-kampan.jpg` | screenshots for posts | — |

Handles: facebook.com/zvirecisachy · youtube.com/@zvirecisachy · Instagram pending.

## Music in the videos (2026-10-25)

Own work, no licence needed: a quiet C–Am–F–G pluck loop synthesised in Python (stdlib only) by a
Claude Code session on 2026-09-27 (commit `63fa425`). Generator: `scripts/social/make_music.py`
(recovered unchanged; its output matches the audio of `1-zviratka.mp4`, sample correlation 0.99993). No samples, no music library, no AI music
generator. Provenance, which video has which audio track, and licence notes:
[docs/PROMPTS.md › Hudba ve videích](../../docs/PROMPTS.md#hudba-ve-videích-na-sítě-zjištěno-2026-10-25).

How videos get made (no routine does it yet, `RUTINA-NAVRH.md` is only a proposal):

1. An interactive session screenshots the live site and builds the story image with
   `scripts/social/make_story.py`.
2. `python -I scripts/social/make_short.py <story.jpg> <headline> <out.mp4>` makes the 9.5 s Short
   (story + approved end card) and takes the audio from
   `tyden-2026-09-28/1-zviratka/1-zviratka.mp4`. Keep that file; it is the music master.
3. Review by the `social-content-review` skill, the owner's OK, then scheduling (`PUBLIKACE-LOG.md`).

Never add music downloaded from the internet. Use this track or the platform's own library at upload time.

## Facebook bio (≤ 101 chars)

Šachy se zvířecími figurkami. Bez registrace, pro děti napořád zdarma. Hraj na zvirecisachy.cz

## First post / YouTube description

Zvířecí šachy jsou tady! 🐸♟️

Šachy, kde místo obyčejných figurek hrají žáby, kůzlata, kočky, žížaly a další zvířecí týmy.

• počítačový soupeř od úplných začátků až po velmistra
• kampaň: poraz postupně všech 18 zvířátek
• úlohy a koncovky na trénink
• hra s kamarádem přes odkaz

Bez registrace, běží v prohlížeči na mobilu i počítači. Pro děti napořád zdarma.

👉 https://zvirecisachy.cz
