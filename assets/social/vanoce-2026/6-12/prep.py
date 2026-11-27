"""Prepares the pictures and reel specs for December posts 6-12 from the live-site screenshots.
usage: python -I prep.py <dir with raw screenshots>   (writes shots/*, *.json, pf-2027.jpg, ig-svatky.jpg)"""
import json, os, random, sys
from PIL import Image, ImageDraw, ImageFont

RAW = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
V1 = os.path.join(HERE, "..", "1-figurky", "shots")
BOLD, REG = r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"
BG = (43, 43, 43)


def raw(n):
    return Image.open(os.path.join(RAW, n + ".png")).convert("RGB")


def save(im, n):
    im.save(os.path.join(SHOTS, n + ".png"))


# puzzle 7: hide the captured-material strip next to the top avatar
p = raw("pz7")
bg = p.getpixel((p.width - 20, 20))
ImageDraw.Draw(p).rectangle((135, 0, 520, 130), fill=bg)
save(p, "pz7")
save(raw("pz10"), "pz10")

# lesson "Pat a remizy": board without the speech panel, for the question and the 3-step explanation
q = raw("pat4-q")
board = q.crop((0, 0, q.width, 1335))
save(board, "pat-board")
# red rings on the squares the black king cannot use (g8, g7, h7), in the app's own board geometry
from PIL import Image as I
arr = board.load()
w = board.width
light = lambda c: c[0] > 220 and c[1] > 210
row = 200
xs = [x for x in range(w) if light(arr[x, row]) or (arr[x, row][1] > arr[x, row][0] + 20)]
left, right = xs[0], xs[-1] + 1
col = left + 6
ys = [y for y in range(60, 1335) if light(arr[col, y]) or (arr[col, y][1] > arr[col, y][0] + 20)]
top = ys[0]
cell = (right - left) / 8
print("board", left, right, top, cell)
over = board.copy().convert("RGBA")
ring = Image.new("RGBA", over.size, (0, 0, 0, 0))
d = ImageDraw.Draw(ring)
for f, r in ((6, 8), (6, 7), (7, 7)):
    x, y = left + f * cell, top + (8 - r) * cell
    d.ellipse((x + 8, y + 8, x + cell - 8, y + cell - 8), outline=(200, 40, 40, 255), width=11)
save(Image.alpha_composite(over, ring).convert("RGB"), "pat-board-rings")
save(raw("pat5"), "pat-avoid")
save(raw("pat2"), "pat-lesson")

t = raw("two-settings")
save(t.crop((0, 0, t.width, 410)), "two-settings")
for i in range(5):
    save(raw(f"two-{i}"), f"two-{i}")
save(raw("friend"), "friend")
m = raw("dip-map")
save(m.crop((0, 0, m.width, 1232)), "dip-map")
save(raw("dip"), "dip")

for n in ("galerie.png", "c-draw-1.png", "c-draw-2.png", "c-draw-4.png", "c-draw-5.png"):
    Image.open(os.path.join(V1, n)).convert("RGB").save(os.path.join(SHOTS, n))


def S(title, text="", images=(), **kw):
    s = {"title": title, "images": [f"shots/{i}.png" for i in images]}
    if text:
        s["text"] = text
    s.update(kw)
    return s


def spec(name, scenes, card_top=None):
    d = {"style": "xmas", "scenes": scenes, "end_card": True}
    if card_top:
        d["card_top"] = card_top
    json.dump(d, open(os.path.join(HERE, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)


spec("6-pat", [
    S("Je to mat, nebo pat?", "Černý je na tahu", ["pat-board"], dur=5),
    S("Tipni si!", images=["pat-board"], countdown=8),
    S("Král není v\u00a0šachu", "Na černého krále teď nic neútočí", ["pat-board"]),
    S("A nemá žádný tah", "Všechna pole kolem něj hlídá dáma", ["pat-board-rings"]),
    S("Je to pat: remíza", "Nikdo nevyhrál a\u00a0nikdo neprohrál", ["pat-board-rings"]),
    S("Máš navrch? Pozor na pat!", "Dej mat, nebo nech soupeři nějaký tah", ["pat-avoid"]),
    S("Víc ti poví sova", "Lekce Pat a\u00a0remízy na zvirecisachy.cz", ["pat-lesson"]),
], card_top=520)

spec("7-hadanka", [
    S("Adventní hádanka 4", "Bílí perníčci táhnou a\u00a0dají mat jedním tahem", ["pz7"], dur=6),
    S("Najdeš mat 1.\u00a0tahem?", images=["pz7"], countdown=15),
    S("Máš ho?", "Řešení je v\u00a0popisku. Další úlohy najdeš na zvirecisachy.cz", ["pz7"], dur=5),
], card_top=575)

spec("8-babicka", [
    S("Šachy s\u00a0babičkou", "U jednoho stolu i\u00a0na dálku", ["two-4"], dur=4),
    S("U\u00a0jednoho displeje", "V\u00a0nastavení „Barva“ vyber „dva hráči“", ["two-settings"]),
    S("Hrajete spolu", "Bez počítače, tah za tahem", ["two-0", "two-1", "two-2", "two-3", "two-4"], per_image=1.3),
    S("Babička je daleko?", "Klepni na Kamarád a\u00a0odkaz jí pošli s\u00a0rodičem", ["friend"]),
    S("Bez chatu a\u00a0bez jmen", "Posílají se jen tahy", ["friend"]),
    S("Zdarma a\u00a0bez registrace", "zvirecisachy.cz", ["two-4"]),
])

spec("9-vanoce", [
    S("Veselé Vánoce!", "přejí Zvířecí šachy", ["galerie"], dur=5),
    S("Hezké chvíle u šachovnice", images=["c-draw-2", "c-draw-4"], per_image=2.0),
    S("A klidné svátky", "celé vaší rodině", ["c-draw-5"], dur=4),
])

spec("10-hadanka", [
    S("Sváteční hádanka 5", "Bílí andílci táhnou a\u00a0dají mat dvěma tahy", ["pz10"], dur=6),
    S("Najdeš mat 2.\u00a0tahem?", images=["pz10"], countdown=25),
    S("Máš ho?", "Řešení je v\u00a0popisku. Další úlohy najdeš na zvirecisachy.cz", ["pz10"], dur=5),
], card_top=575)

spec("11-predsevzeti", [
    S("Předsevzetí na rok 2027", "Projít jednu úroveň lekcí se sovou", ["dip-map"], dur=5),
    S("Úroveň 1 má 18 lekcí", "Od šachovnice po závěrečnou zkoušku", ["dip-map"]),
    S("Po zkoušce diplom", "Jméno na něj napíšeš ty a nikam se neposílá", ["dip"], dur=6),
    S("Zdarma a bez registrace", "zvirecisachy.cz", ["dip"]),
])

# still pictures (4:5) from the published splash art
splash = Image.open(os.path.join(HERE, "..", "..", "..", "..", "public", "splash", "splash.jpg")).convert("RGB")


def card(out, lines):
    im = splash.crop((0, 130, 1024, 1410)).resize((1080, 1350), Image.LANCZOS).convert("RGBA")
    band = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(band)
    rnd = random.Random(7)  # snow over the summer splash art, so the greeting reads as a winter one
    for _ in range(260):
        x, y0, rr = rnd.randrange(1080), rnd.randrange(1350), rnd.choice([3, 4, 4, 5, 6, 8])
        d.ellipse((x - rr, y0 - rr, x + rr, y0 + rr), fill=(255, 255, 255, rnd.randrange(120, 220)))
    h = 46 + sum(size + 18 for _, size, _ in lines)
    d.rounded_rectangle((50, 36, 1030, 36 + h), radius=36, fill=(20, 70, 36, 225))
    y = 62
    for text, size, color in lines:
        f = ImageFont.truetype(BOLD, size)
        d.text((540 - d.textlength(text, font=f) / 2, y), text, font=f, fill=color)
        y += size + 18
    Image.alpha_composite(im, band).convert("RGB").save(os.path.join(HERE, out), quality=92)


card("12-pf-2027.jpg", [("PF 2027", 132, "white"), ("Zvířátka děkují všem, kdo hráli", 50, (255, 236, 179))])
card("ig-svatky.jpg", [("Hezké svátky", 100, "white"), ("a šťastný rok 2027", 72, "white"),
                       ("přejí zvířátka ze Zvířecích šachů", 44, (255, 236, 179))])
print("ok")
