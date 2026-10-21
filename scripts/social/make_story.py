"""Story (9:16) or feed (4:5) frame in the approved 2026-09-28 style: green gradient, title + subtitle on
top, the app screenshot as a rounded card.
usage: python -I make_story.py <shot.jpg> <title> <subtitle> <out.jpg> [story|feed]"""
import sys
from PIL import Image, ImageDraw, ImageFont

shot, title, subtitle, out = sys.argv[1:5]
mode = sys.argv[5] if len(sys.argv) > 5 else "story"
W, H = (1080, 1920) if mode == "story" else (1080, 1350)
TOP = 260 if mode == "story" else 56          # story: below the platform's top bar
BOTTOM = 330 if mode == "story" else 48       # story: keep caption/button zone free
top, bottom = (76, 175, 80), (31, 95, 34)
bg = Image.new("RGB", (W, H))
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / (H - 1)
    d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))

def fit(text, path, size, maxw):
    f = ImageFont.truetype(path, size)
    while d.textlength(text, font=f) > maxw and size > 36:
        size -= 2
        f = ImageFont.truetype(path, size)
    return f, size

tf, ts = fit(title, r"C:\Windows\Fonts\arialbd.ttf", 84 if mode == "story" else 76, 980)
d.text(((W - d.textlength(title, font=tf)) / 2, TOP), title, font=tf, fill="white")
sf, ss = fit(subtitle, r"C:\Windows\Fonts\arial.ttf", 50 if mode == "story" else 46, 980)
d.text(((W - d.textlength(subtitle, font=sf)) / 2, TOP + ts + 26), subtitle, font=sf, fill=(232, 245, 233))

card_top = TOP + ts + 26 + ss + (60 if mode == "story" else 44)
max_w = 860 if mode == "story" else 980
max_h = H - BOTTOM - card_top
img = Image.open(shot).convert("RGB")
scale = min(max_w / img.width, max_h / img.height)
img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
mask = Image.new("L", img.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=28, fill=255)
y = card_top + (max_h - img.height) // 2 if mode == "feed" else card_top
bg.paste(img, ((W - img.width) // 2, y), mask)
bg.save(out, quality=92)
print(out, img.size, card_top)
