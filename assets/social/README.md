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

## Music in the videos – provenance (added 2026-10-25, licence audit item E)

**Status: origin documented, rights not confirmed by the owner. Do not use this music in new videos until he does.**
Full write-up with evidence: `docs/PROMPTS.md`, section "Původ hudby v social videích a lekčních videích".

| | |
|---|---|
| File | no separate file; the track lives in the audio stream of `tyden-2026-09-28/1-zviratka/1-zviratka.mp4` (AAC 44.1 kHz mono, 11.3 s); same track in `2-lekce.mp4`, `3-kamarad.mp4` |
| Used by | `scripts/social/make_short.py` (reads `MUSIC` = that MP4) → all shorts in `tyden-2026-10-19/`, `tyden-2026-10-26/`, `tyden-2026-11-02/`; lesson videos via `music_bed()` in `scripts/lesson-video/render.py` |
| How made | own synthesis in code (Python + numpy, ffmpeg): plucked arpeggio C–Am–F–G, 96 bpm. Verified by audio analysis against `music_bed()`; no samples, no library, no AI music generator found in the repo |
| By whom / when | Claude Code session (Claude Opus 5.5, per `Co-Authored-By`) at the owner's request, 2026-09-27 (commits `c6d92e4`, `86ba21c`, `63fa425`) |
| Licence | no statement in the repo for the music (sound effects have one in `scripts/make-sounds.py`: own work, GPL-3.0). No third-party tool or terms involved. Copyright status of purely machine-generated output under Czech law: not verified |
| Not known | the script that produced the 2026-09-27 track is not in git (only the 2026-09-28 `music_bed()`); whether YouTube/Facebook Content ID flags the published videos |

### How the shorts are made (process, from the files in this folder)

1. Topics come from the app's features not yet shown (`RUTINA-NAVRH.md` describes the weekly flow; the routine itself is not set up).
2. Screenshot of the live site (`shot-*.jpg`) → `scripts/social/make_story.py` makes `story-*.jpg` (9:16) and `feed-*.jpg` (4:5) in the green style approved 2026-09-28.
3. `scripts/social/make_short.py <story.jpg> <headline> <out.mp4>` builds the 9.5 s short: story image with Ken Burns zoom, crossfade to the approved end card (`tyden-2026-09-28/1-zviratka/story-konec.jpg`, with the AI note), music bed cut from `1-zviratka.mp4`. The script has hardcoded Windows paths (`C:\00 JIRI\...\Chess`), so it runs only on the owner's machine.
4. Texts per network in `TEXTY.md`, review per skill `social-content-review` (`REVIEW*.md`), owner approval (`SCHVALENI-*.md`).
5. Scheduling and publishing in YouTube Studio, Meta Business Suite and instagram.com; the result is logged in `tyden-2026-10-12/PUBLIKACE-LOG.md`.
