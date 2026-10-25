"""Music bed of the social videos: own synthesis, no samples, no third-party material.

usage: python -I make_music.py <out.wav> <seconds>

Function music() is copied unchanged from the 2026-09-27 session that made the videos of the week
of 28 Sep (commit 63fa425); that script lived only in the session's scratchpad. The videos mixed
this WAV at volume 0.55 and encoded it to AAC 128 kb/s. 1-zviratka.mp4 is the master that
make_short.py reuses. Provenance and licence notes: docs/PROMPTS.md, section "Hudba ve videích".
"""
import math, struct, sys, wave


def music(path, seconds):
    """A gentle 4-chord pluck loop (C, Am, F, G), 96 bpm, own synthesis — no licensing."""
    sr = 44100; beat = 60 / 96; n = int(sr * seconds)
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
    buf = [0.0] * n
    def f(m): return 440 * 2 ** ((m - 69) / 12)
    t = 0.0; bar = 0
    while t < seconds:
        ch = chords[bar % 4]
        for i in range(8):
            note = ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + 12
            start = int((t + i * beat / 2) * sr); dur = int(sr * 0.6); fr = f(note)
            for k in range(dur):
                j = start + k
                if j >= n: break
                buf[j] += 0.16 * math.exp(-k / (sr * 0.18)) * (math.sin(2 * math.pi * fr * k / sr) + 0.3 * math.sin(4 * math.pi * fr * k / sr))
        start = int(t * sr); fr = f(ch[0] - 12)
        for k in range(int(sr * beat * 4)):
            j = start + k
            if j >= n: break
            buf[j] += 0.12 * math.exp(-k / (sr * 0.9)) * math.sin(2 * math.pi * fr * k / sr)
        t += beat * 4; bar += 1
    fade = int(sr * 1.2)
    for j in range(n):
        buf[j] *= min(1, j / (sr * 0.5), (n - j) / fade)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 20000)) for v in buf))


if __name__ == '__main__':
    music(sys.argv[1], float(sys.argv[2]))
