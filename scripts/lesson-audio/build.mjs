// "Sova čte nahlas" — deterministic pre-recorded narration for the lesson panel (docs/BACKLOG.md,
// U1). Reuses the lesson-video pipeline's TTS call (scripts/lesson-video/tts.ps1, Windows SAPI,
// Czech voice "Microsoft Jakub") and its notation pronunciation (src/lessons/pronounce.ts, the
// single source also re-exported by scripts/lesson-video/pronounce.mjs).
//
//   node scripts/lesson-audio/build.mjs                    # pilot: level 1 only
//   node scripts/lesson-audio/build.mjs --levels 1,2,3     # more levels (additive: existing
//                                                           # files are never touched)
//   node scripts/lesson-audio/build.mjs --dry-run          # list extracted texts, no TTS
//   node scripts/lesson-audio/build.mjs --report-only      # size report only, no TTS
//   node scripts/r2-upload.mjs                             # then upload OUT_DIR to R2
//
// What it does:
//  1. Walks the requested levels' lessons (src/lessons/level*.ts via course.ts) and, per step,
//     extracts every *static* text a child sees: the step's own text, and (as far as they are
//     fixed strings, not the runner's dynamically composed explanations) success/explain text,
//     `wrongDefault`, and the `wrong`/`wrongExplain` maps' values; plus the lesson's outro and
//     a level test's `failOutro`.
//  2. Resolves `{piece}` placeholders the same way the app and the video pipeline do
//     (`resolveText`, default character "kuzlata") and normalises notation for speech
//     (`pronounce`) — the exact string that is spoken. The app looks up the same normalised
//     string at runtime (src/lessons/voice.ts), so a step read with a different piece set than
//     "kuzlata" only speaks where the resolved text happens to match (see README notes).
//  3. Content-addressed output: the file name is `sha1(voice|normalised text).slice(0,16)` —
//     an unchanged text is never re-synthesised, and any text edit produces a new file the next
//     run picks up automatically. `src/lessons/audio-manifest.json` (small, committed, imported
//     straight into the JS bundle — no runtime fetch, no CDN invalidation for it) maps the
//     normalised text to its hash. The binaries themselves are NOT committed: they go to
//     `scripts/lesson-audio/out/` (gitignored) and from there to Cloudflare R2
//     (`scripts/r2-upload.mjs`), served from https://videa.zvirecisachy.cz/lesson-audio/.
//  4. Encodes small: Opus .ogg (speech-tuned, mono, low bitrate) + an .m4a (AAC) fallback for
//     Safari/iOS, same idea as scripts/make-sounds.py / src/sounds.ts.
//
// Never uploads or publishes anything itself (r2-upload.mjs is the separate, explicit step);
// nothing here needs a server (GATE, docs/BACKLOG.md) — R2 is object storage the owner set up
// and approved (docs/BACKLOG.md, 2026-09-28).
import '../ts-hooks.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { COURSE } = await import('../../src/lessons/course.ts');
const { resolveText } = await import('../../src/lessons/text.ts');
const { pronounce } = await import('../../src/lessons/pronounce.ts');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const VOICE = 'Microsoft Jakub';
const RATE = -1; // fixed: the hash is voice+text only (no rate), so a rate change needs a manual cache-bust
const ANIMAL = 'kuzlata'; // same default character as the video pipeline (storyboard.mjs)
/** Gitignored: binaries live here, then go to R2 (scripts/r2-upload.mjs); never committed. */
const OUT_DIR = join(HERE, 'out');
/** Small and committed: text -> hash, imported straight into the bundle (src/lessons/voice.ts). */
const MANIFEST_PATH = join(REPO_ROOT, 'src', 'lessons', 'audio-manifest.json');
const PWSH = process.env.PWSH ?? 'pwsh';

// Mirrors runner.ts's SUCCESS_DEFAULT / COLLECT_DONE_DEFAULT (same duplication the video
// pipeline's storyboard.mjs already makes — these two literals are not exported).
const SUCCESS_DEFAULT = 'Výborně!';
const COLLECT_DONE_DEFAULT = 'Všechny hvězdy jsou tvoje!';

// ---- args -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const LEVELS = opt('levels', '1')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean);
const DRY = flag('dry-run');
const REPORT_ONLY = flag('report-only');

// ---- text extraction --------------------------------------------------------------------

/**
 * Every static text a child can see on one step (dynamic, per-move explanations excluded).
 * `isTest` (the lesson has a `test`): a `choose` step there never shows its plain `explain` or
 * `wrongExplain`/`wrongDefault` (runner.ts's `settleTest`, one attempt only) — it always shows
 * `Správně! ${explain}` or `Tohle ne. ${explain}`, so those are the composed strings to record.
 */
function stepTexts(step, isTest) {
  const texts = [step.text];
  if (step.kind === 'move') {
    texts.push(step.success ?? SUCCESS_DEFAULT, step.wrongDefault);
    if (step.wrong) texts.push(...Object.values(step.wrong));
  } else if (step.kind === 'collect') {
    texts.push(step.success ?? COLLECT_DONE_DEFAULT);
  } else if (step.kind === 'choose') {
    if (isTest) {
      texts.push(`Správně! ${step.explain}`, `Tohle ne. ${step.explain}`);
    } else {
      texts.push(step.explain, step.wrongDefault);
      if (step.wrongExplain) texts.push(...Object.values(step.wrongExplain));
    }
  } else if (step.kind === 'mini' && step.success) {
    texts.push(step.success);
  }
  return texts;
}

function lessonTexts(lesson) {
  const isTest = lesson.test !== undefined;
  const texts = lesson.steps.flatMap((s) => stepTexts(s, isTest));
  texts.push(lesson.outro);
  if (lesson.test) texts.push(lesson.test.failOutro);
  return texts;
}

/** The exact string that gets spoken: placeholders resolved (kuzlata), notation normalised. */
function spokenKey(text) {
  return pronounce(resolveText(text, { animalId: ANIMAL }));
}

function lessonsOfLevel(level) {
  return COURSE.find((l) => l.level === level)?.lessons ?? [];
}

const ALL_LEVELS = COURSE.map((l) => l.level);

/** Unique spoken-text keys for a set of levels (extraction only — no TTS). */
function uniqueKeysFor(levels) {
  const keys = new Set();
  for (const level of levels) for (const lesson of lessonsOfLevel(level)) for (const text of lessonTexts(lesson)) keys.add(spokenKey(text));
  return keys;
}

// ---- helpers --------------------------------------------------------------------------

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', stdio: 'inherit' });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}`);
}

const hashOf = (key) => createHash('sha1').update(`${VOICE}|${key}`).digest('hex').slice(0, 16);

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { voice: VOICE, entries: {} };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { voice: VOICE, entries: {} };
  }
}

function fmtMb(bytes) {
  return `${(bytes / 1e6).toFixed(2)} MB`;
}

// ---- main -------------------------------------------------------------------------------

const requestedKeys = [...uniqueKeysFor(LEVELS)].sort();
console.log(`levels ${LEVELS.join(',')}: ${requestedKeys.length} unique texts`);

if (DRY) {
  for (const k of requestedKeys) console.log(`  ${k}`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const manifest = readManifest();
manifest.voice = VOICE;

if (!REPORT_ONLY) {
  const work = join(tmpdir(), 'zvirecisachy-lesson-audio');
  mkdirSync(work, { recursive: true });

  const toSynthesise = requestedKeys.filter((k) => {
    const hash = manifest.entries[k];
    return !hash || !existsSync(join(OUT_DIR, `${hash}.ogg`)) || !existsSync(join(OUT_DIR, `${hash}.m4a`));
  });
  for (const k of requestedKeys) manifest.entries[k] = hashOf(k);

  if (toSynthesise.length === 0) {
    console.log('nothing new to synthesise (every text already has audio)');
  } else {
    console.log(`synthesising ${toSynthesise.length} new/changed texts (${requestedKeys.length - toSynthesise.length} already cached) ...`);
    const jobs = toSynthesise.map((k) => ({ text: k, out: join(work, `${hashOf(k)}.wav`) }));
    writeFileSync(join(work, 'tts-jobs.json'), JSON.stringify(jobs, null, 1), 'utf8');
    run(PWSH, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(REPO_ROOT, 'scripts', 'lesson-video', 'tts.ps1'), '-JobsPath', join(work, 'tts-jobs.json'), '-Voice', VOICE, '-Rate', String(RATE)]);

    for (const k of toSynthesise) {
      const hash = hashOf(k);
      const wav = join(work, `${hash}.wav`);
      const ogg = join(OUT_DIR, `${hash}.ogg`);
      const m4a = join(OUT_DIR, `${hash}.m4a`);
      run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'voip', '-ac', '1', ogg]);
      run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '48k', '-ac', '1', m4a]);
    }
  }
  rmSync(work, { recursive: true, force: true });

  // Prune: a key that used to belong to one of the levels just (re)built but is no longer
  // produced by them (a text was edited or removed) is dropped — unless some *other* level
  // still needs it (e.g. shared "Výborně!"), which keepKeys also covers so those stay put.
  const otherLevels = ALL_LEVELS.filter((l) => !LEVELS.includes(l));
  const keepKeys = new Set([...requestedKeys, ...uniqueKeysFor(otherLevels)]);
  let pruned = 0;
  for (const k of Object.keys(manifest.entries)) {
    if (!keepKeys.has(k)) {
      delete manifest.entries[k];
      pruned++;
    }
  }
  if (pruned) console.log(`pruned ${pruned} stale manifest key(s)`);

  // Orphan files: anything in OUT_DIR whose hash no manifest entry points to any more.
  const keepHashes = new Set(Object.values(manifest.entries));
  let removedFiles = 0;
  for (const f of readdirSync(OUT_DIR)) {
    const m = /^([0-9a-f]{16})\.(ogg|m4a)$/.exec(f);
    if (m && !keepHashes.has(m[1])) {
      unlinkSync(join(OUT_DIR, f));
      removedFiles++;
    }
  }
  if (removedFiles) console.log(`removed ${removedFiles} orphan audio file(s)`);

  manifest.entries = Object.fromEntries(Object.keys(manifest.entries).sort().map((k) => [k, manifest.entries[k]]));
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1), 'utf8');
}

// ---- report -----------------------------------------------------------------------------
// Per-level counts/bytes (a text shared across levels, e.g. "Výborně!", counts — and is
// billed in bytes — for every level that uses it, so the per-level rows do not sum exactly
// to the "all levels" total below).

function levelStats(level) {
  let bytes = 0;
  let count = 0;
  for (const k of uniqueKeysFor([level])) {
    const hash = manifest.entries[k];
    if (!hash) continue;
    count++;
    for (const ext of ['ogg', 'm4a']) {
      const p = join(OUT_DIR, `${hash}.${ext}`);
      if (existsSync(p)) bytes += statSync(p).size;
    }
  }
  return { count, bytes };
}

console.log('');
for (const level of LEVELS) {
  const { count, bytes } = levelStats(level);
  console.log(`Level ${level}: ${count} audio texts, ${fmtMb(bytes)} (.ogg + .m4a).`);
}
let requestedBytes = 0;
for (const k of requestedKeys) {
  const hash = manifest.entries[k];
  if (!hash) continue;
  for (const ext of ['ogg', 'm4a']) {
    const p = join(OUT_DIR, `${hash}.${ext}`);
    if (existsSync(p)) requestedBytes += statSync(p).size;
  }
}
console.log(`Levels ${LEVELS.join(',')} combined: ${requestedKeys.length} unique texts, ${fmtMb(requestedBytes)} total (.ogg + .m4a) in ${OUT_DIR}.`);
