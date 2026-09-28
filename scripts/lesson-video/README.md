# Lesson videos

A deterministic pipeline that turns one lesson of the app (`src/lessons/level*.ts`) into a
narrated explainer video. One run per lesson id; the cost per lesson is machine time only
(no LLM, no network).

```
node scripts/lesson-video/build.mjs l1-vez                     # one lesson
node scripts/lesson-video/build.mjs l1-sachovnice l1-vez l1-strelec --out D:\videos
node scripts/lesson-video/build.mjs --list                     # all lesson ids
node scripts/lesson-video/build.mjs l1-vez --dry-run           # storyboard + narration text only (no TTS, no video)
```

Options: `--out DIR` (default `%TEMP%\zvirecisachy-lesson-videos`, or `LESSON_VIDEO_OUT`),
`--formats 9x16,16x9`, `--animal kuzlata` (white pieces, also the `{věž}` text expansion),
`--opponent zabky` (black pieces), `--crf 27`, `--keep-work` (keep frames, WAVs and
`timeline.json`), `--python`, `--pwsh`.

Never write the outputs into the repository. Nothing here uploads or publishes anything.

## Prerequisites

- Node 24 (the lesson data is TypeScript, imported through `scripts/ts-hooks.mjs`) and
  `npm ci` (chess.js).
- **ffmpeg + ffprobe** on `PATH` (tested with 8.1, libx264 + native AAC).
- **Python 3** with **Pillow** and **numpy** (`pip install pillow numpy`).
- **PowerShell 7** (`pwsh`) and the Windows Czech voice **Microsoft Jakub**
  (Settings → Time & language → Speech → add Czech). Windows PowerShell 5.1 only sees the
  "Desktop" SAPI voices, so the pipeline runs `tts.ps1` under `pwsh`.
- Fonts: Segoe UI (Windows); Arial is the fallback.

## What it does

1. **Storyboard** (`storyboard.mjs`): reads the lesson, resolves the `{piece}` placeholders as
   the app does (`resolveText`, default character `kuzlata`), adapts them for a video
   (`videoText`: „Klikni…“ sentences are dropped, „u tebe kůzle“ becomes „tady kůzle“) and
   turns every step into segments:
   - `show`: the owl's text, the step's own arrows/circles/stars.
   - `move` / `collect` / `choose` tasks: **question** (the step's text; for text answers the
     options are shown as buttons and read aloud) → **think** pause (3 s, 4.5 s for multi-move
     `collect` tasks; a "Přemýšlej…" progress bar) → **solution**. Nothing that gives the answer away is drawn before the
     solution segment: question and pause show only the step's own shapes (which by the
     lesson contract never spoil) and the answer circles in neutral blue.
   - Solutions: `move` — green arrow on the position before the move, a 0.4 s slide
     animation (castling moves the rook, en passant removes the pawn), then the position
     after the move with the last-move highlight and the owl's success text. If that text
     talks about an attack (`napadá`, `útok`, `vidlička`, `šach`, `hrozí`), red arrows to
     every enemy piece the moved piece attacks are added. `collect` — the shortest path over
     all stars (BFS on the lesson geometry, respecting `maxMoves`), each move with arrow +
     animation, stars disappear when taken. `choose` — the correct button/circle turns
     green; for a square answer that exactly one piece can reach, its move arrow; for a
     "can the piece reach the star?" question answered *Ano*, the path to the star.
   - A `show` step in a real position whose text mentions check/attack (and has no arrows
     of its own) gets red arrows from the checking pieces to the king.
   - Every derived arrow is verified: chess.js (`move`, `attackers`, `moves`) for legal
     positions, `src/lessons/geometry.ts` for king-less diagrams. The checks are listed in
     `<id>-script.txt`.
   - `mini` steps (the mini-games) are shown with their text plus "Tuhle hru si zahraj
     v aplikaci." — the games are played against a random mover, so there is no fixed
     solution to show.
2. **Narration** (`tts.ps1`): SAPI, voice Jakub, rate −1, 44.1 kHz mono. The narration text
   is the on-screen text passed through `pronounce.mjs` (TTS only): `e4` → „é čtyři“,
   `Jf3` → „jezdec na ef tři“, `Dxh7` → „dáma bere há sedm“, `c8D` → „cé osm v dámu“,
   „sloupec d“ → „sloupec dé“, `O-O` → „krátká rošáda“, „od 1 do 8“ → „od jedné do osmi“, … WAVs are cached in
   `<out>/_cache/tts` by a hash of voice + rate + text, so re-runs only synthesise changed
   lines.
3. **Timeline** (`build.mjs`): measured WAV lengths → frame-exact (30 fps) segment and shot
   lengths. Both the frames and the audio are placed from this one timeline, so a voice line
   and the arrows it talks about can never drift apart (the realtime screen recording of the
   hand-made v2 video drifted by up to 9 s).
4. **Frames** (`render.py frames`): the board is drawn from the data with the app's piece
   art (`public/piece-sets/animals/<id>/{light,dark}`), the app's board palette and
   chessground's brush colours; the owl (`public/lessons/sova.webp`) and its speech bubble.
   Only the distinct stills are rendered (≈140 per lesson) and fed to ffmpeg's concat
   demuxer with their durations; move animations are single frames.
5. **Audio** (`render.py audio`): narration + a generated music bed (own synthesis, as in
   the social posts, gain 0.056), then two-pass `loudnorm` (target −16 LUFS / −1.5 dBTP;
   the pilot lands at ≈ −17.2 LUFS on every lesson because the speech pauses force the
   dynamic mode) → AAC 96 kb/s mono.
6. **Encode**: H.264 High, CRF 27, `-tune stillimage`, keyframe at least every 5 s,
   `+faststart`. ≈ 1.6 MB per minute.
7. **Poster + QC**: the title card as JPG poster per format; a contact sheet per format with
   a frame extracted **from the final MP4** at every still (each annotation moment), labelled
   with its time, the segment, and the narration line playing in it.

## Outputs (`<out>/<lesson-id>/`)

| file | |
|---|---|
| `<id>-16x9.mp4` | 1920×1080, in-app player and YouTube |
| `<id>-9x16.mp4` | 1080×1920, Shorts / Reels and phones in portrait: full-width board (24 px margins), title/step above it (below the top ~150 px), the owl's bubble below it with large text ending above the bottom ~240 px; once the answer is shown the bubble holds the answer only. Only the lowest ranks at the far right can sit beside the Shorts action rail. |
| `<id>-poster-16x9.jpg`, `<id>-poster-9x16.jpg` | poster frames (title card) |
| `<id>-contact-16x9.jpg`, `<id>-contact-9x16.jpg` | QC contact sheets |
| `<id>-script.txt` | timeline: narration (screen + TTS text), arrows per shot, rule checks |

## Checking a batch

1. `--dry-run` every new lesson and read the `tts:` lines — the pronunciation map is small
   and new notation in a lesson text may need a rule in `pronounce.mjs`.
2. Look at the contact sheets: the arrows must match the narration line next to them and no
   solution may appear in a `-q` or `-think` tile.
3. Listen to at least the first video of a batch (SAPI prosody cannot be checked from text).

## Known limitations

- The owl's texts are written for the interactive lesson („Klikni na něj.“, „Teď ty!“); the
  video shows the answer after the pause instead of waiting for a click.
- Only `accept[0]` of a move step is shown when several moves are correct (listed in the
  script as "other accepted").
- The attack arrows are a heuristic on the success text; a text about an attack by a piece
  other than the moved one gets no arrow.
- The notation lesson (`Šachový zápis`) talks *about* notation; there `Jf3` is read as a
  move („jezdec na ef tři“), not letter by letter.
