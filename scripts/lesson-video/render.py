"""Lesson video: renderer. Called by build.mjs; not meant to be run by hand.

  python render.py frames <timeline.json> <format> <workdir>   board/card stills + ffmpeg concat list
  python render.py audio  <timeline.json> <workdir>            narration + music bed -> mix.wav
  python render.py poster <timeline.json> <format> <out.jpg>   title card as a JPG poster
  python render.py qc     <timeline.json> <format> <video.mp4> <out.jpg>  contact sheet

Everything is drawn from the timeline (lesson data + measured narration lengths), so a frame
shows exactly the board state its timestamp belongs to: there is no screen recording.
"""
import hashlib
import json
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
PIECES = os.path.join(REPO, 'public', 'piece-sets', 'animals')
OWL_AVATAR = os.path.join(REPO, 'public', 'lessons', 'sova.webp')
OWL_CARD = os.path.join(REPO, 'assets', 'source', 'sovi_trenerka.png')
FONTS = r'C:\Windows\Fonts'
FPS = 30

SIZES = {'9x16': (1080, 1920), '16x9': (1920, 1080)}

BOARD_LIGHT = (0xdc, 0xe6, 0xf0)
BOARD_DARK = (0x8f, 0xa3, 0xbd)
BG_TOP, BG_BOT = (34, 48, 60), (20, 29, 38)
CARD_TOP, CARD_BOT = (76, 175, 80), (27, 94, 32)
INK = (28, 36, 49)
BUBBLE = (247, 247, 242)
GOOD = (46, 125, 50)
MUTED = (176, 190, 204)
# chessground's default brushes
BRUSH = {'green': (21, 120, 27), 'red': (136, 32, 32), 'blue': (0, 48, 136), 'yellow': (230, 143, 0)}
SHAPE_ALPHA = 0.78
LAST_MOVE = (155, 199, 0, 105)


def font(size, weight='bold'):
    name = {'bold': 'segoeuib.ttf', 'regular': 'segoeui.ttf', 'black': 'seguibl.ttf', 'semibold': 'seguisb.ttf'}[weight]
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        path = os.path.join(FONTS, 'arialbd.ttf' if weight != 'regular' else 'arial.ttf')
    return ImageFont.truetype(path, size)


def gradient(size, top, bot):
    w, h = size
    t = np.linspace(0, 1, h)[:, None]
    col = (np.array(top)[None, :] * (1 - t) + np.array(bot)[None, :] * t).astype(np.uint8)
    return Image.fromarray(np.repeat(col[:, None, :], w, axis=1), 'RGB')


def circle_crop(im, s):
    im = im.convert('RGB').resize((s, s), Image.LANCZOS)
    m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    return im, m.resize((s, s), Image.LANCZOS)


def centered(d, text, fnt, cx, y, fill):
    w = d.textlength(text, font=fnt)
    d.text((cx - w / 2, y), text, font=fnt, fill=fill)


def wrap(d, text, fnt, width):
    lines, line = [], ''
    for word in text.split():
        cand = f'{line} {word}'.strip()
        if d.textlength(cand, font=fnt) <= width or not line:
            line = cand
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


# ---------------------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------------------
class Board:
    def __init__(self, size, white, black):
        self.size = size
        self.q = size / 8
        self.white, self.black = white, black
        self._pieces = {}
        self._base = None

    def piece(self, ch):
        if ch not in self._pieces:
            folder = os.path.join(PIECES, self.white, 'light') if ch.isupper() else os.path.join(PIECES, self.black, 'dark')
            im = Image.open(os.path.join(folder, f'{ch.upper()}.png')).convert('RGBA')
            s = round(self.q)
            self._pieces[ch] = im.resize((s, s), Image.LANCZOS)
        return self._pieces[ch]

    def xy(self, sq, orientation):
        f = ord(sq[0]) - 97
        r = int(sq[1]) - 1
        if orientation == 'black':
            f, r = 7 - f, 7 - r
        return f * self.q, (7 - r) * self.q

    def center(self, sq, orientation):
        x, y = self.xy(sq, orientation)
        return x + self.q / 2, y + self.q / 2

    def base(self, orientation):
        key = ('base', orientation)
        if key not in self._pieces:
            im = Image.new('RGB', (self.size, self.size), BOARD_LIGHT)
            d = ImageDraw.Draw(im)
            q = self.q
            for f in range(8):
                for r in range(8):
                    if (f + r) % 2 == 0:  # a1 dark
                        sq = f'{chr(97 + f)}{r + 1}'
                        x, y = self.xy(sq, orientation)
                        d.rectangle([round(x), round(y), round(x + q) - 1, round(y + q) - 1], fill=BOARD_DARK)
            self._pieces[key] = im
        return self._pieces[key].copy()

    def coords(self, im, orientation):
        # drawn last, over the pieces, as chessground does
        d = ImageDraw.Draw(im)
        q = self.q
        cf = font(max(16, round(q * 0.27)), 'bold')  # bigger than the app: read on a phone
        files = 'abcdefgh' if orientation == 'white' else 'hgfedcba'
        ranks = '87654321' if orientation == 'white' else '12345678'
        for i in range(8):
            d.text((i * q + q - q * 0.06, self.size - q * 0.04), files[i], font=cf, fill=INK, anchor='rd', stroke_width=2, stroke_fill=(255, 255, 255))
            d.text((q * 0.06, i * q + q * 0.03), ranks[i], font=cf, fill=INK, anchor='lt', stroke_width=2, stroke_fill=(255, 255, 255))

    def star(self, d, sq, orientation):
        x, y = self.xy(sq, orientation)
        pts = [(50, 14), (60, 39), (87, 40), (66, 57), (73, 83), (50, 68), (27, 83), (34, 57), (13, 40), (40, 39)]
        poly = [(x + px / 100 * self.q, y + py / 100 * self.q) for px, py in pts]
        d.polygon(poly, fill=(255, 212, 59, 245), outline=(184, 134, 11, 255), width=max(2, round(self.q * 0.03)))

    def arrow(self, d, a, b, color, orientation, occupied=()):
        q = self.q
        x0, y0 = self.center(a, orientation)
        x1, y1 = self.center(b, orientation)
        dx, dy = x1 - x0, y1 - y0
        dist = math.hypot(dx, dy)
        if dist < 1:
            return
        ux, uy = dx / dist, dy / dist
        # keep the children's pieces visible: start/stop at the edge of an occupied square
        if a in occupied:
            x0, y0 = x0 + ux * q * 0.32, y0 + uy * q * 0.32
        if b in occupied:
            x1, y1 = x1 - ux * q * 0.3, y1 - uy * q * 0.3
        w = q * 10 / 64 * 1.15
        head_len, head_w = w * 2.6, w * 3.6
        tip_x, tip_y = x1 - ux * q * 0.12, y1 - uy * q * 0.12
        bx, by = tip_x - ux * head_len, tip_y - uy * head_len
        px, py = -uy, ux
        hw = w / 2
        d.polygon([(x0 + px * hw, y0 + py * hw), (bx + px * hw, by + py * hw), (bx - px * hw, by - py * hw), (x0 - px * hw, y0 - py * hw)], fill=color)
        d.ellipse([x0 - hw, y0 - hw, x0 + hw, y0 + hw], fill=color)
        d.polygon([(tip_x, tip_y), (bx + px * head_w / 2, by + py * head_w / 2), (bx - px * head_w / 2, by - py * head_w / 2)], fill=color)

    def ring(self, d, sq, color, orientation):
        x, y = self.xy(sq, orientation)
        lw = max(4, round(self.q * 0.085))
        pad = lw / 2 + self.q * 0.03
        d.ellipse([x + pad, y + pad, x + self.q - pad, y + self.q - pad], outline=color, width=lw)

    def render(self, view, moving=None, t=0.0, hide=()):
        """view: placement/orientation/highlights/shapes/stars. moving: [(ch, from, to)] drawn at t."""
        o = view.get('orientation', 'white')
        im = self.base(o).convert('RGBA')
        hl = Image.new('RGBA', im.size, (0, 0, 0, 0))
        hd = ImageDraw.Draw(hl)
        for h in view.get('highlights', []):
            x, y = self.xy(h['sq'], o)
            hd.rectangle([round(x), round(y), round(x + self.q) - 1, round(y + self.q) - 1], fill=LAST_MOVE)
        im.alpha_composite(hl)
        d = ImageDraw.Draw(im)
        for s in view.get('stars', []):
            self.star(d, s, o)
        for sq, ch in placement_squares(view['placement']):
            if sq in hide:
                continue
            x, y = self.xy(sq, o)
            im.alpha_composite(self.piece(ch), (round(x), round(y)))

        occupied = {sq for sq, _ in placement_squares(view['placement']) if sq not in hide}
        shapes = view.get('shapes', [])
        if shapes:
            layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            for s in shapes:
                c = BRUSH.get(s.get('brush') or 'green', BRUSH['green']) + (255,)
                if s.get('to'):
                    self.arrow(ld, s['from'], s['to'], c, o, occupied)
                else:
                    self.ring(ld, s['from'], c, o)
            a = layer.getchannel('A').point(lambda v: int(v * SHAPE_ALPHA))
            layer.putalpha(a)
            im.alpha_composite(layer)
        for ch, a, b in moving or []:  # the moving piece rides above its arrow
            xa, ya = self.xy(a, o)
            xb, yb = self.xy(b, o)
            e = t * t * (3 - 2 * t)
            im.alpha_composite(self.piece(ch), (round(xa + (xb - xa) * e), round(ya + (yb - ya) * e)))
        self.coords(im, o)
        return im.convert('RGB')


def placement_squares(placement):
    out = []
    for i, row in enumerate(placement.split('/')):
        f = 0
        for ch in row:
            if ch.isdigit():
                f += int(ch)
            else:
                out.append((f'{chr(97 + f)}{8 - i}', ch))
                f += 1
    return out


def piece_at(placement, sq):
    for s, ch in placement_squares(placement):
        if s == sq:
            return ch
    return None


# ---------------------------------------------------------------------------------------
# Layouts
# ---------------------------------------------------------------------------------------
LAYOUT = {
    # 9:16 keeps the board and the bubble clear of the Shorts/Reels UI (top ~150 px, bottom ~300 px, right ~90 px)
    # full-width board (24 px margins); title/step above it below the top ~150 px, the bubble
    # ends above the bottom ~260 px caption zone; only the lowest board ranks at the far right
    # can sit beside the Shorts action rail (it covers x > ~990 from y ~1100).
    '9x16': dict(header=(540, 150), counter=(540, 214), board=(36, 270, 1008), owl=(36, 1318, 136),
                 bubble=(196, 1310, 1044, 1680), brand=None, compact=True, sizes=(56, 54, 52, 50, 48, 46, 44, 42, 40, 38)),
    '16x9': dict(header=(1470, 70), counter=(1470, 150), board=(60, 60, 960), owl=(1090, 250, 140),
                 bubble=(1250, 236, 1860, 900), brand=(1470, 1000)),
}


class Renderer:
    def __init__(self, fmt, tl):
        self.fmt = fmt
        self.W, self.H = SIZES[fmt]
        self.L = LAYOUT[fmt]
        self.tl = tl
        self.board = Board(self.L['board'][2], tl['white'], tl['black'])
        self.bg = gradient((self.W, self.H), BG_TOP, BG_BOT)
        s = self.L['owl'][2]
        self.owl = circle_crop(Image.open(OWL_AVATAR), s)

    # -- cards ------------------------------------------------------------------------
    def card(self, which):
        img = gradient((self.W, self.H), CARD_TOP, CARD_BOT)
        d = ImageDraw.Draw(img)
        cx = self.W / 2
        portrait = self.fmt == '9x16'
        s = 340 if portrait else 300
        owl, m = circle_crop(Image.open(OWL_CARD), s)
        les = self.tl['lesson']
        if which == 'title':
            lines = [
                ('Zvířecí šachy', font(64 if portrait else 58, 'bold'), (232, 245, 233)),
                (f'Lekce {les["number"]}: {les["title"]}', font(88 if portrait else 84, 'black'), (255, 255, 255)),
                (f'Úroveň {les["level"]} · {les["levelTitle"]}', font(46 if portrait else 44, 'regular'), (200, 230, 201)),
            ]
        else:
            lines = [
                ('zvirecisachy.cz', font(88 if portrait else 84, 'black'), (255, 255, 255)),
                ('Zdarma · bez registrace', font(50 if portrait else 46, 'regular'), (232, 245, 233)),
                ('na mobilu i počítači', font(50 if portrait else 46, 'regular'), (232, 245, 233)),
                ('Obrázky vytvořené s pomocí AI.', font(32 if portrait else 30, 'regular'), (200, 230, 201)),
            ]
        # shrink the big line if it would not fit
        maxw = self.W - (160 if portrait else 300)
        fixed = []
        for text, f, col in lines:
            while d.textlength(text, font=f) > maxw and f.size > 30:
                f = ImageFont.truetype(f.path, f.size - 4)
            fixed.append((text, f, col))
        gap = 34
        total = s + 60 + sum(f.size + gap for _, f, _ in fixed)
        y = (self.H - total) / 2
        img.paste(owl, (round(cx - s / 2), round(y)), m)
        y += s + 60
        for text, f, col in fixed:
            centered(d, text, f, cx, y, col)
            y += f.size + gap
        return img

    # -- lesson frame -----------------------------------------------------------------
    def bubble(self, img, d, b, think=None):
        x0, y0, x1, y1max = self.L['bubble']
        pad = 30
        width = x1 - x0 - 2 * pad
        chips = b.get('chips') or []
        feedback = b.get('feedback')
        # fit: largest text size whose block fits the bubble area
        for size in self.L.get('sizes', (46, 44, 42, 40, 38, 36, 34, 32, 30, 28)):
            f = font(size, 'semibold')
            ff = font(size, 'bold')
            # compact (9:16): once the answer is shown, the bubble holds the answer only
            lines = [] if (feedback and self.L.get('compact')) else wrap(d, b['text'], f, width)
            flines = wrap(d, feedback, ff, width) if feedback else []
            lh = round(size * 1.28)
            h = pad * 2 + lh * len(lines)
            if flines:
                h += (round(size * 0.5) if lines else 0) + lh * len(flines)
            if chips:
                h += round(size * 0.6) + round(size * 1.7)
            if think is not None and not chips:  # with buttons the timer sits in their row
                h += round(size * 0.5) + lh + 22
            if y0 + h <= y1max:
                break
        y1 = y0 + h
        ox, oy, os_ = self.L['owl']
        # tail towards the owl
        ty = oy + os_ * 0.45
        d.polygon([(x0 + 2, ty - 18), (x0 - 26, ty + 4), (x0 + 2, ty + 22)], fill=BUBBLE)
        d.rounded_rectangle([x0, y0, x1, y1], radius=28, fill=BUBBLE)
        y = y0 + pad
        for ln in lines:
            d.text((x0 + pad, y), ln, font=f, fill=INK)
            y += lh
        if flines:
            y += round(size * 0.5) if lines else 0
            for ln in flines:
                d.text((x0 + pad, y), ln, font=ff, fill=GOOD)
                y += lh
        if chips:
            y += round(size * 0.6)
            cx = x0 + pad
            chh = round(size * 1.7)
            cf = font(round(size * 0.95), 'bold')
            for c in chips:
                tw = d.textlength(c['label'], font=cf)
                cw = tw + size * 1.4
                ok = c['state'] == 'correct'
                d.rounded_rectangle([cx, y, cx + cw, y + chh], radius=chh // 2, fill=GOOD if ok else (255, 255, 255),
                                    outline=GOOD if ok else (150, 160, 175), width=4)
                d.text((cx + cw / 2, y + chh / 2), c['label'], font=cf, fill=(255, 255, 255) if ok else INK, anchor='mm')
                cx += cw + size * 0.5
            if think is not None:
                bx0, bx1, by = cx + size * 0.3, x1 - pad, y + chh / 2 - 8
                d.rounded_rectangle([bx0, by, bx1, by + 16], radius=8, fill=(222, 226, 232))
                if think > 0:
                    d.rounded_rectangle([bx0, by, bx0 + (bx1 - bx0) * think, by + 16], radius=8, fill=(255, 193, 7))
            y += chh
        if think is not None and not chips:
            y += round(size * 0.5)
            d.text((x0 + pad, y), 'Přemýšlej…', font=ff, fill=(90, 100, 115))
            bx0 = x0 + pad + d.textlength('Přemýšlej…', font=ff) + 24
            bx1 = x1 - pad
            by = y + lh / 2 - 8
            d.rounded_rectangle([bx0, by, bx1, by + 16], radius=8, fill=(222, 226, 232))
            if think > 0:
                d.rounded_rectangle([bx0, by, bx0 + (bx1 - bx0) * think, by + 16], radius=8, fill=(255, 193, 7))

    def frame(self, view, moving=None, t=0.0, hide=(), think=None):
        img = self.bg.copy()
        d = ImageDraw.Draw(img)
        L = self.L
        hx, hy = L['header']
        centered(d, view.get('header', ''), font(54 if self.fmt == '9x16' else 50, 'bold'), hx, hy, (255, 255, 255))
        if view.get('counter'):
            centered(d, view['counter'], font(36 if self.fmt == '9x16' else 34, 'regular'), L['counter'][0], L['counter'][1], MUTED)
        bx, by, bs = L['board']
        if view.get('board'):
            bim = self.board.render(view['board'], moving, t, hide)
            # soft frame around the board
            d.rounded_rectangle([bx - 10, by - 10, bx + bs + 10, by + bs + 10], radius=16, fill=(12, 18, 24))
            img.paste(bim, (bx, by))
        ox, oy, os_ = L['owl']
        img.paste(self.owl[0], (ox, oy), self.owl[1])
        d.text((ox + os_ / 2, oy + os_ + 10), 'Sova', font=font(30, 'regular'), fill=MUTED, anchor='mt')
        if view.get('bubble'):
            self.bubble(img, d, view['bubble'], think)
        if L['brand']:
            centered(d, 'zvirecisachy.cz', font(30, 'regular'), L['brand'][0], L['brand'][1], MUTED)
        return img


# ---------------------------------------------------------------------------------------
# frames -> concat list
# ---------------------------------------------------------------------------------------
def cmd_frames(tl_path, fmt, work):
    tl = json.load(open(tl_path, encoding='utf-8'))
    r = Renderer(fmt, tl)
    fdir = os.path.join(work, fmt, 'frames')
    os.makedirs(fdir, exist_ok=True)
    entries = []  # (path, frames)
    cache = {}

    def emit(key_obj, draw, frames):
        key = hashlib.sha1(json.dumps([fmt, key_obj], sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]
        path = os.path.join(fdir, f'{key}.png')
        if key not in cache:
            if not os.path.exists(path):
                draw().save(path, compress_level=1)
            cache[key] = path
        if entries and entries[-1][0] == path:
            entries[-1] = (path, entries[-1][1] + frames)
        else:
            entries.append((path, frames))

    for seg in tl['segments']:
        for shot in seg['shots']:
            n = shot['frames']
            if n <= 0:
                continue
            k = shot['kind']
            if k == 'card':
                emit(['card', shot['card'], tl['lesson']], lambda: r.card(shot['card']), n)
            elif k == 'still':
                emit(['still', shot['view']], lambda: r.frame(shot['view']), n)
            elif k == 'think':
                steps = max(1, round(n / (FPS * 0.25)))
                done = 0
                for i in range(steps):
                    m = round(n * (i + 1) / steps) - done
                    done += m
                    p = (i + 1) / steps
                    emit(['think', shot['view'], round(p, 3)], lambda p=p: r.frame(shot['view'], think=p), m)
            elif k == 'anim':
                before = shot['view']['board']
                moving = [(piece_at(before['placement'], mv['from']), mv['from'], mv['to']) for mv in shot['moves']]
                hide = tuple([mv['from'] for mv in shot['moves']])
                for i in range(n):
                    t = (i + 1) / (n + 1)
                    emit(['anim', shot['view'], shot['moves'], i, n], lambda t=t: r.frame(shot['view'], moving, t, hide), 1)
            else:
                raise SystemExit(f'unknown shot kind {k}')

    lst = os.path.join(work, fmt, 'concat.txt')
    with open(lst, 'w', encoding='utf-8') as fh:
        fh.write('ffconcat version 1.0\n')
        for path, frames in entries:
            fh.write(f"file '{path.replace(os.sep, '/')}'\nduration {frames / FPS:.6f}\n")
        fh.write(f"file '{entries[-1][0].replace(os.sep, '/')}'\n")
    total = sum(f for _, f in entries)
    print(f'frames {fmt}: {len(cache)} unique stills, {total} frames ({total / FPS:.2f} s)')


# ---------------------------------------------------------------------------------------
# audio: narration placed by the timeline + a generated music bed
# ---------------------------------------------------------------------------------------
SR = 44100


def read_wav(path):
    with wave.open(path, 'rb') as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if sw != 2:
        raise SystemExit(f'{path}: expected 16-bit PCM')
    a = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        x = np.arange(0, len(a) * SR / sr) * sr / SR
        a = np.interp(x, np.arange(len(a)), a).astype(np.float32)
    return a


def music_bed(seconds):
    """A gentle 4-chord pluck loop (C, Am, F, G), 96 bpm, own synthesis (as the social posts)."""
    n = int(SR * seconds)
    buf = np.zeros(n + SR * 4, dtype=np.float64)
    beat = 60 / 96
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
    f = lambda m: 440 * 2 ** ((m - 69) / 12)
    kp = np.arange(int(SR * 0.6))
    env_p = np.exp(-kp / (SR * 0.18))
    kb = np.arange(int(SR * beat * 4))
    env_b = np.exp(-kb / (SR * 0.9))
    t, bar = 0.0, 0
    while t < seconds:
        ch = chords[bar % 4]
        for i in range(8):
            fr = f(ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + 12)
            s = int((t + i * beat / 2) * SR)
            buf[s:s + len(kp)] += 0.16 * env_p * (np.sin(2 * np.pi * fr * kp / SR) + 0.3 * np.sin(4 * np.pi * fr * kp / SR))
        s = int(t * SR)
        fr = f(ch[0] - 12)
        buf[s:s + len(kb)] += 0.12 * env_b * np.sin(2 * np.pi * fr * kb / SR)
        t += beat * 4
        bar += 1
    buf = buf[:n]
    j = np.arange(n)
    fade = np.minimum(1, np.minimum(j / (SR * 0.5), (n - j) / (SR * 2.0)))
    return (buf * fade).astype(np.float32)


def cmd_audio(tl_path, work):
    tl = json.load(open(tl_path, encoding='utf-8'))
    total = tl['totalFrames'] / FPS
    n = int(round(total * SR))
    voice = np.zeros(n, dtype=np.float32)
    for v in tl['voices']:
        a = read_wav(v['wav'])
        s = int(round(v['start'] * SR))
        e = min(n, s + len(a))
        voice[s:e] += a[: e - s]
    mix = voice * tl['audio']['voiceGain'] + music_bed(total) * tl['audio']['musicGain']
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = mix * min(1.0, 0.95 / peak)
    out = os.path.join(work, 'mix.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype('<i2').tobytes())
    print(f'audio: {len(tl["voices"])} narration clips, {total:.2f} s -> {out}')


def cmd_poster(tl_path, fmt, out):
    tl = json.load(open(tl_path, encoding='utf-8'))
    Renderer(fmt, tl).card('title').save(out, quality=86, optimize=True)
    print('poster', out)


# ---------------------------------------------------------------------------------------
# QC contact sheet: frames extracted from the FINAL video at every annotation moment
# ---------------------------------------------------------------------------------------
def cmd_qc(tl_path, fmt, video, out):
    tl = json.load(open(tl_path, encoding='utf-8'))
    moments = []
    for seg in tl['segments']:
        for shot in seg['shots']:
            if shot['kind'] in ('still', 'think') or (shot['kind'] == 'card'):
                if shot['frames'] <= 0:
                    continue
                f0 = shot['start'] + min(2, shot['frames'] - 1)
                moments.append((f0, seg, shot))
    tmp = os.path.join(os.path.dirname(out), f'_qc_{fmt}')
    os.makedirs(tmp, exist_ok=True)
    for fn in os.listdir(tmp):
        os.remove(os.path.join(tmp, fn))
    tile_w = 300 if fmt == '9x16' else 480
    sel = '+'.join(f'eq(n\\,{m[0]})' for m in moments)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'select={sel},scale={tile_w}:-2', '-fps_mode', 'passthrough',
                    os.path.join(tmp, 'f%04d.png')], check=True)
    files = sorted(os.listdir(tmp))
    if len(files) != len(moments):
        print(f'WARNING qc: {len(files)} frames extracted for {len(moments)} moments')
    tiles = [Image.open(os.path.join(tmp, fn)).convert('RGB') for fn in files]
    th = tiles[0].height
    cap_h = 150
    cols = 6 if fmt == '9x16' else 4
    rows = math.ceil(len(tiles) / cols)
    sheet = Image.new('RGB', (cols * (tile_w + 8) + 8, rows * (th + cap_h + 8) + 8), (18, 18, 18))
    d = ImageDraw.Draw(sheet)
    f1, f2 = font(17, 'bold'), font(15, 'regular')
    voices = {v['segment']: v for v in tl['voices']}
    for i, (tile, (f0, seg, shot)) in enumerate(zip(tiles, moments)):
        x = 8 + (i % cols) * (tile_w + 8)
        y = 8 + (i // cols) * (th + cap_h + 8)
        sheet.paste(tile, (x, y))
        v = voices.get(seg['id'])
        head = f"t={f0 / FPS:.2f}s  {seg['id']} [{shot['kind']}]"
        d.text((x, y + th + 4), head, font=f1, fill=(255, 235, 59))
        yy = y + th + 26
        if v:
            d.text((x, yy), f"voice {v['start']:.2f}–{v['end']:.2f}s", font=f2, fill=(129, 212, 250))
            yy += 19
            for ln in wrap(d, v['screen'], f2, tile_w)[:5]:
                d.text((x, yy), ln, font=f2, fill=(230, 230, 230))
                yy += 18
    sheet.save(out, quality=85)
    for fn in files:
        os.remove(os.path.join(tmp, fn))
    os.rmdir(tmp)
    print(f'qc {fmt}: {len(tiles)} moments -> {out}')


if __name__ == '__main__':
    cmd, *a = sys.argv[1:]
    {'frames': cmd_frames, 'audio': cmd_audio, 'poster': cmd_poster, 'qc': cmd_qc}[cmd](*a)
