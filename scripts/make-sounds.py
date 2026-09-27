#!/usr/bin/env python
"""
Synthesise the app's sound effects (branch feat-sounds — sound effects for Zvireci sachy).

Licence: own work, same licence as the rest of the code (GPL-3.0, see LICENSE). Every
sample below is generated from scratch with sine/noise math in the Python standard
library — nothing is downloaded, recorded or sampled from a third party, so no
THIRD-PARTY-NOTICES entry is needed for them.

What it makes (all short, soft, child-friendly; never a harsh "wrong answer" buzzer):
  move           - own move: a soft wooden "tock" (filtered noise burst + a low sine thud)
  opponent-move  - the other side's move: the same idea, a touch lower/duller so a child
                   can tell "my move" from "their move" without looking
  capture        - a brighter double tock (two quick tocks, the second a bit higher)
  check          - a gentle two-note rising chime
  win            - a short rising three-note arpeggio (<= 2s)
  loss           - a soft two-note descending phrase - gentle, never mocking
  puzzle-solved  - a little upward sparkle (five quick high notes with fast decay)
  lesson-correct - a cheerful short two-note "ding-ding", brighter than plain check
  lesson-wrong   - a very soft two-note dip - encouraging, NOT a buzzer
  piece-drop     - a soft short "whoosh" thud for when the pieces land at kickoff

Usage (from the repo root):
    python scripts/make-sounds.py

Writes a 16-bit mono WAV per sound into a scratch folder, then - if `ffmpeg` is on
PATH - transcodes each to public/sounds/<name>.ogg (Opus, for Chrome/Firefox) and
public/sounds/<name>.m4a (AAC, the fallback Safari/iOS actually plays) and removes the
WAV. Without ffmpeg the WAV itself is written straight into public/sounds/ so the app
still has *something* to play everywhere (src/sounds.ts tries .ogg, then .m4a, then
.wav, in that order, and silently skips whichever aren't there).

Deterministic: re-running overwrites the same files with the same bytes (no randomness).
"""
from __future__ import annotations

import math
import shutil
import struct
import subprocess
import wave
import zlib
from pathlib import Path

SAMPLE_RATE = 24000
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "public" / "sounds"
SCRATCH_DIR = REPO_ROOT / "public" / "sounds" / "_wav"


def sine(freq: float, t: float, phase: float = 0.0) -> float:
    return math.sin(2 * math.pi * freq * t + phase)


def envelope_adsr(t: float, dur: float, attack: float, decay: float) -> float:
    """A simple attack/exponential-decay envelope, 0..1, silent past `dur`."""
    if t < 0 or t > dur:
        return 0.0
    if t < attack:
        return t / attack if attack > 0 else 1.0
    # Exponential decay to (near) zero over the remaining time.
    rest = dur - attack
    if rest <= 0:
        return 0.0
    k = (t - attack) / rest
    return math.exp(-k * (dur / max(decay, 0.001)))


def lcg_noise(seed: int, n: int) -> list[float]:
    """A tiny linear-congruential PRNG (no numpy / random-module dependency games) -
    white noise in [-1, 1], deterministic for a given seed."""
    out = []
    x = seed & 0xFFFFFFFF
    for _ in range(n):
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        out.append((x / 0x3FFFFFFF) - 1.0)
    return out


def tock(t: float, dur: float, pitch: float, noise: list[float], i: int, brightness: float = 1.0) -> float:
    """One "wooden" percussive hit: a filtered noise click plus a low sine thud."""
    env = envelope_adsr(t, dur, attack=0.002, decay=dur * 0.35)
    click = noise[i] * math.exp(-t / (dur * 0.06)) * 0.55 * brightness
    thud = sine(pitch, t) * env * 0.6
    thud2 = sine(pitch * 2, t) * env * 0.15 * brightness
    return click + thud + thud2


def render(name: str, dur: float, fn) -> None:
    n = int(SAMPLE_RATE * dur)
    noise = lcg_noise(zlib.crc32(name.encode()) & 0xFFFF, n)  # deterministic (unlike hash())
    samples = []
    peak = 0.0001
    raw = []
    for i in range(n):
        t = i / SAMPLE_RATE
        v = fn(t, i, noise)
        raw.append(v)
        peak = max(peak, abs(v))
    # Normalise to a gentle -6 dBFS ceiling (the app also plays everything at low volume
    # by default; headroom here just avoids clipping on the loudest sound in the set).
    target = 0.5
    gain = target / peak
    for v in raw:
        s = max(-1.0, min(1.0, v * gain))
        samples.append(int(s * 32767))

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    path = SCRATCH_DIR / f"{name}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    print(f"  {name:16s} {dur:.2f}s  -> {path.relative_to(REPO_ROOT)}")


# --- the ten sounds --------------------------------------------------------------

def make_move(t, i, noise):
    return tock(t, 0.14, 180, noise, i, brightness=0.8)


def make_opponent_move(t, i, noise):
    return tock(t, 0.16, 140, noise, i, brightness=0.55)


def make_capture(t, i, noise):
    dur = 0.30
    first = tock(t, 0.14, 190, noise, i, brightness=1.0) if t < 0.14 else 0.0
    t2 = t - 0.10
    second = tock(t2, 0.16, 260, noise, i, brightness=1.1) if t2 >= 0 else 0.0
    return first * 0.8 + second * 0.9


def make_check(t, i, noise):
    dur = 0.5
    n1 = 523.25  # C5
    n2 = 659.25  # E5
    e1 = envelope_adsr(t, 0.28, 0.01, 0.12)
    e2 = envelope_adsr(t - 0.16, 0.34, 0.01, 0.14) if t >= 0.16 else 0.0
    return sine(n1, t) * e1 * 0.5 + sine(n2, t - 0.16) * e2 * 0.55


def make_win(t, i, noise):
    notes = [523.25, 659.25, 783.99, 1046.50]  # C5 E5 G5 C6 - a bright little arpeggio
    step = 0.16
    total = 0.0
    for k, f in enumerate(notes):
        t0 = k * step
        tt = t - t0
        if tt < 0:
            continue
        e = envelope_adsr(tt, 0.45, 0.008, 0.16)
        total += sine(f, tt) * e * 0.45 + sine(f * 2, tt) * e * 0.08
    return total


def make_loss(t, i, noise):
    notes = [523.25, 392.00]  # C5 -> G4, a soft gentle sigh, never harsh
    step = 0.22
    total = 0.0
    for k, f in enumerate(notes):
        t0 = k * step
        tt = t - t0
        if tt < 0:
            continue
        e = envelope_adsr(tt, 0.55, 0.02, 0.30)
        total += sine(f, tt) * e * 0.42
    return total


def make_puzzle_solved(t, i, noise):
    notes = [784.0, 987.77, 1174.66, 1567.98, 2093.00]  # G5 B5 D6 G6 C7 - a quick sparkle
    step = 0.05
    total = 0.0
    for k, f in enumerate(notes):
        t0 = k * step
        tt = t - t0
        if tt < 0:
            continue
        e = envelope_adsr(tt, 0.22, 0.004, 0.05)
        total += sine(f, tt) * e * 0.30
    return total


def make_lesson_correct(t, i, noise):
    notes = [659.25, 880.00]  # E5 -> A5, a cheerful little "ding-ding"
    step = 0.11
    total = 0.0
    for k, f in enumerate(notes):
        t0 = k * step
        tt = t - t0
        if tt < 0:
            continue
        e = envelope_adsr(tt, 0.24, 0.006, 0.08)
        total += sine(f, tt) * e * 0.45 + sine(f * 2, tt) * e * 0.06
    return total


def make_lesson_wrong(t, i, noise):
    # Soft and encouraging: two low, quiet notes a whole tone apart, long soft decay -
    # explicitly NOT a buzzer (no dissonance, no fast attack, low volume).
    notes = [349.23, 311.13]  # F4 -> Eb4
    step = 0.16
    total = 0.0
    for k, f in enumerate(notes):
        t0 = k * step
        tt = t - t0
        if tt < 0:
            continue
        e = envelope_adsr(tt, 0.32, 0.03, 0.22)
        total += sine(f, tt) * e * 0.30
    return total


def make_piece_drop(t, i, noise):
    dur = 0.22
    env = envelope_adsr(t, dur, attack=0.02, decay=dur * 0.4)
    whoosh = noise[i] * env * 0.35
    thud = sine(110, t) * envelope_adsr(t, dur, attack=0.01, decay=dur * 0.3) * 0.4
    return whoosh + thud


SOUNDS: list[tuple[str, float, object]] = [
    ("move", 0.16, make_move),
    ("opponent-move", 0.18, make_opponent_move),
    ("capture", 0.32, make_capture),
    ("check", 0.52, make_check),
    ("win", 1.05, make_win),
    ("loss", 0.80, make_loss),
    ("puzzle-solved", 0.45, make_puzzle_solved),
    ("lesson-correct", 0.38, make_lesson_correct),
    ("lesson-wrong", 0.52, make_lesson_wrong),
    ("piece-drop", 0.24, make_piece_drop),
]


def transcode(name: str) -> bool:
    """ffmpeg WAV -> ogg (opus) + m4a (aac) in public/sounds/, deletes the WAV. False if ffmpeg is missing."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    wav = SCRATCH_DIR / f"{name}.wav"
    ogg = OUT_DIR / f"{name}.ogg"
    m4a = OUT_DIR / f"{name}.m4a"
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "28k", "-vbr", "on", str(ogg)],
        check=True,
    )
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "40k", str(m4a)],
        check=True,
    )
    return True


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Synthesising {len(SOUNDS)} sound effects into {SCRATCH_DIR.relative_to(REPO_ROOT)} ...")
    for name, dur, fn in SOUNDS:
        render(name, dur, fn)

    have_ffmpeg = shutil.which("ffmpeg") is not None
    print(f"\nffmpeg on PATH: {'yes' if have_ffmpeg else 'no'}")
    total_bytes = 0
    for name, _dur, _fn in SOUNDS:
        if have_ffmpeg:
            transcode(name)
            (SCRATCH_DIR / f"{name}.wav").unlink(missing_ok=True)
            for ext in ("ogg", "m4a"):
                p = OUT_DIR / f"{name}.{ext}"
                if p.exists():
                    total_bytes += p.stat().st_size
        else:
            # No ffmpeg: ship the WAV itself as the only (larger) format.
            src = SCRATCH_DIR / f"{name}.wav"
            dst = OUT_DIR / f"{name}.wav"
            src.replace(dst)
            total_bytes += dst.stat().st_size
    if SCRATCH_DIR.exists() and not any(SCRATCH_DIR.iterdir()):
        SCRATCH_DIR.rmdir()

    print(f"Total in public/sounds/: {total_bytes / 1024:.1f} kB")
    for p in sorted(OUT_DIR.iterdir()):
        if p.is_file():
            print(f"  {p.name:24s} {p.stat().st_size / 1024:6.2f} kB")


if __name__ == "__main__":
    main()
