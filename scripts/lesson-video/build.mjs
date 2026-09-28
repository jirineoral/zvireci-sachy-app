// Lesson video pipeline: one run per lesson id.
//   node scripts/lesson-video/build.mjs l1-vez [more ids…] [--out DIR] [--formats 9x16,16x9]
//   node scripts/lesson-video/build.mjs --list
//   node scripts/lesson-video/build.mjs l1-vez --dry-run      (storyboard + narration only)
// See scripts/lesson-video/README.md. Nothing is uploaded or published.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStoryboard, listLessons } from './storyboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const VOICE = 'Microsoft Jakub';
const RATE = -1;

// ---- args ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const OUT = resolve(opt('out', process.env.LESSON_VIDEO_OUT ?? join(tmpdir(), 'zvirecisachy-lesson-videos')));
const FORMATS = opt('formats', '9x16,16x9').split(',').filter(Boolean);
const WHITE = opt('animal', 'kuzlata');
const BLACK = opt('opponent', 'zabky');
const CRF = opt('crf', '27');
const PYTHON = opt('python', process.env.PYTHON ?? 'python');
const PWSH = opt('pwsh', process.env.PWSH ?? 'pwsh');
const DRY = flag('dry-run');
const KEEP = flag('keep-work');
const LIST = flag('list');

if (LIST) {
  for (const l of listLessons()) console.log(`${l.id.padEnd(28)} level ${l.level} #${String(l.number).padStart(2)}  ${l.title}`);
  process.exit(0);
}
const ids = args.filter((a) => !a.startsWith('--'));
if (!ids.length) {
  console.error('usage: node scripts/lesson-video/build.mjs <lesson-id…> [--out DIR] [--formats 9x16,16x9] [--dry-run] [--list]');
  process.exit(2);
}
for (const f of FORMATS) if (!['9x16', '16x9'].includes(f)) throw new Error(`unknown format ${f}`);

// ---- helpers ------------------------------------------------------------------------
function run(cmd, argv, { quiet = false, capture = false } = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit', maxBuffer: 64 << 20 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${argv.slice(0, 3).join(' ')}… exited ${r.status}\n${r.stderr ?? ''}`);
  return r;
}

/** Duration of a PCM WAV from its header. */
function wavSeconds(path) {
  const b = readFileSync(path);
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = b.readUInt32LE(off + 16);
    if (id === 'data') return size / byteRate;
    off += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${path}`);
}

const frames = (s) => Math.round(s * FPS);

function timeline(sb, durations, wavOf) {
  let cursor = 0;
  const voices = [];
  for (const seg of sb.segments) {
    seg.start = cursor;
    const fixed = seg.shots.filter((s) => !s.fill).reduce((n, s) => n + (s.frames = frames(s.dur)), 0);
    const fill = seg.shots.find((s) => s.fill);
    let total = fixed;
    if (fill) {
      const leadF = frames(seg.voiceLead ?? 0);
      const voiceF = seg.voice ? Math.ceil(durations.get(seg.voice.tts) * FPS) : 0;
      const need = seg.voice ? leadF + voiceF + frames(seg.tail ?? 0) : 0;
      total = Math.max(need, frames(seg.minDur ?? 0), fixed + FPS);
      fill.frames = total - fixed;
      if (seg.voice) {
        const start = (cursor + leadF) / FPS;
        voices.push({ segment: seg.id, wav: wavOf(seg.voice.tts), start, end: start + durations.get(seg.voice.tts), screen: seg.voice.screen, tts: seg.voice.tts });
      }
    }
    let t = cursor;
    for (const s of seg.shots) {
      s.start = t;
      t += s.frames;
    }
    seg.frames = total;
    cursor += total;
  }
  return { voices, totalFrames: cursor };
}

function fmtTime(f) {
  const s = f / FPS;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}

function scriptText(sb, tl) {
  const lines = [`${sb.lesson.id} — Lekce ${sb.lesson.number}: ${sb.lesson.title} (úroveň ${sb.lesson.level})`, `duration ${fmtTime(tl.totalFrames)}`, ''];
  for (const seg of sb.segments) {
    lines.push(`[${fmtTime(seg.start)}–${fmtTime(seg.start + seg.frames)}] ${seg.id} (${seg.kind})`);
    const v = tl.voices.find((x) => x.segment === seg.id);
    if (v) {
      lines.push(`  voice ${v.start.toFixed(2)}–${v.end.toFixed(2)} s`);
      lines.push(`  screen: ${v.screen}`);
      if (v.tts !== v.screen) lines.push(`  tts:    ${v.tts}`);
    }
    for (const s of seg.shots) {
      const b = s.view?.board;
      if (!b) continue;
      const arrows = b.shapes.filter((x) => x.to).map((x) => `${x.from}->${x.to}(${x.brush})`);
      const rings = b.shapes.filter((x) => !x.to).map((x) => `${x.from}(${x.brush})`);
      const parts = [];
      if (arrows.length) parts.push(`arrows ${arrows.join(' ')}`);
      if (rings.length) parts.push(`rings ${rings.join(' ')}`);
      if (b.stars.length) parts.push(`stars ${b.stars.join(' ')}`);
      if (s.kind === 'anim') parts.push(`moves ${s.moves.map((m) => `${m.from}-${m.to}`).join(' ')}`);
      lines.push(`  ${fmtTime(s.start)} ${s.kind}${parts.length ? ': ' + parts.join('; ') : ''}`);
    }
    for (const n of seg.notes ?? []) lines.push(`  check: ${n}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---- main ---------------------------------------------------------------------------
const cacheDir = join(OUT, '_cache', 'tts');
mkdirSync(cacheDir, { recursive: true });

for (const id of ids) {
  const t0 = Date.now();
  const sb = buildStoryboard(id, { animal: WHITE });
  const dir = join(OUT, id);
  const work = join(dir, 'work');
  mkdirSync(work, { recursive: true });

  // 1. narration (SAPI), cached by voice + rate + text
  const wavOf = (text) => join(cacheDir, `${createHash('sha1').update(`${VOICE}|${RATE}|${text}`).digest('hex').slice(0, 20)}.wav`);
  const texts = [...new Set(sb.segments.filter((s) => s.voice).map((s) => s.voice.tts))];
  if (DRY) {
    const fake = new Map(texts.map((t) => [t, Math.max(1.2, t.length / 13)]));
    const tl = timeline(sb, fake, wavOf);
    console.log(scriptText(sb, tl));
    console.log('(dry run: narration lengths estimated)');
    continue;
  }
  const jobs = join(work, 'tts-jobs.json');
  writeFileSync(jobs, JSON.stringify(texts.map((text) => ({ text, out: wavOf(text) })), null, 1), 'utf8');
  // PowerShell 7 (pwsh) sees the OneCore voices such as Jakub; Windows PowerShell 5.1 may not.
  run(PWSH, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(HERE, 'tts.ps1'), '-JobsPath', jobs, '-Voice', VOICE, '-Rate', String(RATE)]);
  const durations = new Map(texts.map((t) => [t, wavSeconds(wavOf(t))]));

  // 2. timeline (frame-exact) — frames and audio are both placed from it
  const tl = timeline(sb, durations, wavOf);
  const tlPath = join(work, 'timeline.json');
  writeFileSync(tlPath, JSON.stringify({ ...sb, fps: FPS, white: WHITE, black: BLACK, audio: { voiceGain: 1.0, musicGain: 0.056 }, ...tl }, null, 1), 'utf8');
  writeFileSync(join(dir, `${id}-script.txt`), scriptText(sb, tl), 'utf8');

  // 3. audio: mix -> two-pass EBU R128 loudness normalisation (-16 LUFS, -1.5 dBTP) -> AAC
  run(PYTHON, [join(HERE, 'render.py'), 'audio', tlPath, work]);
  const mix = join(work, 'mix.wav');
  const LN = 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const p1 = run('ffmpeg', ['-hide_banner', '-nostats', '-i', mix, '-af', `${LN}:print_format=json`, '-f', 'null', '-'], { capture: true });
  const m = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf('{'), p1.stderr.lastIndexOf('}') + 1));
  const ln2 = `${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const audio = join(work, 'audio.m4a');
  run('ffmpeg', ['-v', 'error', '-y', '-i', mix, '-af', `${ln2},aresample=44100`, '-c:a', 'aac', '-b:a', '96k', '-ac', '1', audio]);

  // 4. video per format: stills (+ short move animations) -> H.264, + audio, faststart
  const results = [];
  for (const fmt of FORMATS) {
    run(PYTHON, [join(HERE, 'render.py'), 'frames', tlPath, fmt, work]);
    const mp4 = join(dir, `${id}-${fmt}.mp4`);
    run('ffmpeg', [
      '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(work, fmt, 'concat.txt'), '-i', audio,
      '-map', '0:v', '-map', '1:a', '-vf', `fps=${FPS},format=yuv420p`, '-fps_mode', 'cfr',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-tune', 'stillimage', '-profile:v', 'high', '-level', '4.1',
      '-x264-params', 'keyint=150:min-keyint=15', '-c:a', 'copy', '-t', (tl.totalFrames / FPS).toFixed(3),
      '-movflags', '+faststart', '-metadata', `title=Zvířecí šachy – Lekce ${sb.lesson.number}: ${sb.lesson.title}`, mp4,
    ]);
    const poster = join(dir, `${id}-poster-${fmt}.jpg`);
    run(PYTHON, [join(HERE, 'render.py'), 'poster', tlPath, fmt, poster]);
    const sheet = join(dir, `${id}-contact-${fmt}.jpg`);
    run(PYTHON, [join(HERE, 'render.py'), 'qc', tlPath, fmt, mp4, sheet]);
    const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4], { capture: true });
    const dur = parseFloat(probe.stdout);
    const mb = statSync(mp4).size / 1e6;
    results.push({ fmt, mp4, dur, mb, perMin: mb / (dur / 60) });
  }
  if (!KEEP) rmSync(work, { recursive: true, force: true });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  for (const r of results) console.log(`${id} ${r.fmt}: ${r.dur.toFixed(1)} s, ${r.mb.toFixed(2)} MB (${r.perMin.toFixed(2)} MB/min) -> ${r.mp4}`);
  console.log(`${id}: done in ${secs} s`);
}
