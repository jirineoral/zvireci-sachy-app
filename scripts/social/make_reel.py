"""Longer 9:16 social video (Reel / Short, ~30-45 s) built from a JSON scene list, so captions stay on
screen long enough to be read (owner's wish 2026-11-22: "videa trochu delší než shorts, aby si je
člověk stihl přečíst").

usage: python -I make_reel.py <spec.json> <out.mp4>

spec = {
  "style": "xmas" | "green",            # background: fir green with snow dots, or the approved green
  "scenes": [
    {"title": "…", "text": "…",         # big caption (1-3 lines) + smaller line under it
     "images": ["a.png", …],             # one image, or several shown in turn (slideshow) under the same caption
     "per_image": 1.6,                   # seconds per image in a slideshow (default 1.6)
     "dur": 5.0}                         # optional minimum; the reading time rule can make it longer
  ],
  "end_card": true                       # append the approved owl end card (4 s)
}
Reading time per scene: max(dur, 2.0 + 0.4 s per word of title+text, slideshow length) + the 0.4 s fade.
Scenes change through a short fade to black, so two captions never overlap.
Safe zones: top 250 px (platform bar), bottom 420 px (caption/buttons), right 130 px (YouTube buttons),
so the card is centred at x = 475 and at most 820 px wide.
Music: own synthesis via make_music.py (no third-party material), mixed at volume 0.55.
"""
import json, os, random, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_music import music  # noqa: E402

CHESS = r"C:\00 JIRI\000 PROJECTS\A - AI Tooling Experiments\Chess"
END = os.path.join(CHESS, r"assets\social\tyden-2026-09-28\1-zviratka\story-konec.jpg")
BOLD, REG = r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"
W, H, FPS, FADE = 1080, 1920, 30, 0.4
TOP, BOTTOM, CX, MAXW = 250, 420, 475, 820


def background(style):
    a, b = ((30, 92, 50), (14, 50, 28)) if style == "xmas" else ((76, 175, 80), (31, 95, 34))
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(p + (q - p) * t) for p, q in zip(a, b)))
    if style == "xmas":
        snow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(snow)
        rnd = random.Random(7)
        for _ in range(140):
            x, y, r = rnd.randrange(W), rnd.randrange(H), rnd.choice([2, 3, 3, 4, 5])
            sd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rnd.randrange(40, 110)))
        bg = Image.alpha_composite(bg.convert("RGBA"), snow).convert("RGB")
    return bg


def wrap(d, text, font, maxw):
    lines, cur = [], ""
    for w in text.split(" "):  # split on plain spaces only, so U+00A0 keeps Czech one-letter words with the next word
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def frame(style, title, text, img_path):
    bg = background(style)
    d = ImageDraw.Draw(bg)
    y = TOP
    size = 84
    tf = ImageFont.truetype(BOLD, size)
    tl = wrap(d, title, tf, 900)
    while len(tl) > 3 and size > 56:
        size -= 4
        tf = ImageFont.truetype(BOLD, size)
        tl = wrap(d, title, tf, 900)
    for line in tl:
        d.text((CX - d.textlength(line, font=tf) / 2, y), line, font=tf, fill="white")
        y += size + 14
    if text:
        y += 10
        sf = ImageFont.truetype(REG, 56)
        for line in wrap(d, text, sf, 860):
            d.text((CX - d.textlength(line, font=sf) / 2, y), line, font=sf, fill=(255, 236, 179))
            y += 68
    y += 40
    if img_path:
        img = Image.open(img_path).convert("RGB")
        max_h = H - BOTTOM - y
        scale = min(MAXW / img.width, max_h / img.height)
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=28, fill=255)
        bg.paste(img, (CX - img.width // 2, y + (max_h - img.height) // 2), mask)
    return bg


def main(spec_path, out):
    spec = json.load(open(spec_path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(spec_path))
    style = spec.get("style", "xmas")
    tmp = tempfile.mkdtemp()
    clips = []  # (png, seconds)
    for i, s in enumerate(spec["scenes"]):
        words = len((s.get("title", "") + " " + s.get("text", "")).split())
        imgs = [os.path.join(base, p) for p in s.get("images", [])] or [None]
        per = s.get("per_image", 1.6)
        need = max(s.get("dur", 0), 2.0 + 0.4 * words, per * len(imgs) if len(imgs) > 1 else 0) + FADE  # fade time is not reading time
        each = need / len(imgs)
        for k, p in enumerate(imgs):
            f = os.path.join(tmp, f"s{i:02d}_{k:02d}.png")
            frame(style, s.get("title", ""), s.get("text", ""), p).save(f)
            clips.append((f, each, k == 0))
    if spec.get("end_card", True):
        clips.append((END, 4.0, True))
    # Build: within a scene hard cuts between slideshow images, crossfade between scenes.
    inputs, fc, prev, t = [], [], None, 0.0
    for n, (f, sec, new_scene) in enumerate(clips):
        inputs += ["-loop", "1", "-t", f"{sec + FADE:.3f}", "-i", f]
        fc.append(f"[{n}:v]scale={W}:{H},fps={FPS},setsar=1,format=yuv420p[v{n}]")
        if prev is None:
            prev, t = f"v{n}", sec
            continue
        dur = FADE if new_scene else 0.15
        fc.append(f"[{prev}][v{n}]xfade=transition={'fadeblack' if new_scene else 'fade'}:duration={dur}:offset={t - dur:.3f}[x{n}]")
        prev, t = f"x{n}", t + sec - dur
    total = t
    wav = os.path.join(tmp, "music.wav")
    music(wav, total + 0.5)
    inputs += ["-i", wav]
    a = len(clips)
    fc.append(f"[{a}:a]atrim=0:{total:.3f},volume=0.55,afade=t=in:d=0.4,afade=t=out:st={total - 1.2:.3f}:d=1.2[au]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(fc),
                    "-map", f"[{prev}]", "-map", "[au]", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                    "-t", f"{total:.3f}", out], check=True)
    print(out, f"{total:.1f} s, {len(clips)} clips")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
