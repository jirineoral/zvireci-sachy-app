"""Build a 9:16 YouTube Short (~9.5 s) from a story image + headline + the approved end card.

usage: python -I make_short.py <story.jpg> <headline> <out.mp4>
Music bed: the own quiet track from the approved 2026-09-28 short (1-zviratka.mp4).
"""
import subprocess, sys, tempfile, os
from PIL import Image, ImageDraw, ImageFont

CHESS = r"C:\00 JIRI\000 PROJECTS\A - AI Tooling Experiments\Chess"
END = os.path.join(CHESS, r"assets\social\tyden-2026-09-28\1-zviratka\story-konec.jpg")
MUSIC = os.path.join(CHESS, r"assets\social\tyden-2026-09-28\1-zviratka\1-zviratka.mp4")
FONT = r"C:\Windows\Fonts\arialbd.ttf"

story, headline, out = sys.argv[1], sys.argv[2], sys.argv[3]
tmp = tempfile.mkdtemp()

# Headline in the upper padding, below the platform's top bar (safe zone ~250 px).
first = story  # empty headline: the story already carries its title (make_story.py)
if headline:
    img = Image.open(story).convert("RGB").resize((1080, 1920))
    d = ImageDraw.Draw(img)
    size = 84
    font = ImageFont.truetype(FONT, size)
    while d.textlength(headline, font=font) > 960 and size > 50:
        size -= 4
        font = ImageFont.truetype(FONT, size)
    w = d.textlength(headline, font=font)
    x, y = (1080 - w) / 2, 270
    pad = 28
    d.rounded_rectangle((x - pad, y - pad, x + w + pad, y + size + pad), radius=28, fill=(46, 125, 50))
    d.text((x, y), headline, font=font, fill="white")
    first = os.path.join(tmp, "first.jpg")
    img.save(first, quality=92)

S1, S2, FADE = 6.0, 4.0, 0.5
total = S1 + S2 - FADE
fc = (
    f"[0:v]scale=2160:3840,zoompan=z='min(zoom+0.0006,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    f":d={int(S1*30)}:s=1080x1920:fps=30,setsar=1[a];"
    f"[1:v]scale=1080:1920,fps=30,setsar=1,trim=duration={S2}[b];"
    f"[a][b]xfade=transition=fade:duration={FADE}:offset={S1-FADE},format=yuv420p[v];"
    f"[2:a]atrim=0:{total},afade=t=in:d=0.4,afade=t=out:st={total-1.2}:d=1.2[au]"
)
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-loop", "1", "-t", str(S1), "-i", first,
    "-loop", "1", "-t", str(S2), "-i", END,
    "-i", MUSIC,
    "-filter_complex", fc, "-map", "[v]", "-map", "[au]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart", "-t", str(total), out,
], check=True)
print(out)
