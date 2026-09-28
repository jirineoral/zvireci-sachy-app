// Lesson videos: per-level index of rendered videos + an overview sheet of the posters.
//   node scripts/lesson-video/index.mjs 1 --out DIR
// Writes DIR/level<N>-index.md and DIR/level<N>-overview.jpg from DIR/<id>/ folders.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLessons } from './storyboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = resolve(oi >= 0 ? args[oi + 1] : process.env.LESSON_VIDEO_OUT ?? join(tmpdir(), 'zvirecisachy-lesson-videos'));
const level = Number(args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--out'));
if (!level) throw new Error('usage: node scripts/lesson-video/index.mjs <level> [--out DIR]');

const probe = (f) => parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' }).stdout);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const rows = [];
const skipped = [];
let totalBytes = 0;
let totalSec = 0;
for (const l of listLessons().filter((x) => x.level === level)) {
  const dir = join(OUT, l.id);
  const v169 = join(dir, `${l.id}-16x9.mp4`);
  const v916 = join(dir, `${l.id}-9x16.mp4`);
  if (!existsSync(v169) || !existsSync(v916)) {
    skipped.push(l);
    continue;
  }
  const d = probe(v169);
  const s169 = statSync(v169).size;
  const s916 = statSync(v916).size;
  totalBytes += s169 + s916;
  totalSec += d;
  rows.push({ ...l, d, s169, s916, dir, poster: join(dir, `${l.id}-poster-16x9.jpg`) });
}

const mb = (b) => (b / 1e6).toFixed(2);
const md = [
  `# Level ${level} lesson videos`,
  '',
  `${rows.length} lessons rendered, total ${mmss(totalSec)} per format, ${mb(totalBytes)} MB (both formats).`,
  `Folder: \`${OUT}\``,
  '',
  '| # | id | title | duration | 16:9 MB | 9:16 MB | folder |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.number} | ${r.id} | ${r.title} | ${mmss(r.d)} | ${mb(r.s169)} | ${mb(r.s916)} | \`${r.dir}\` |`),
  '',
  'Each folder: `<id>-16x9.mp4`, `<id>-9x16.mp4`, `<id>-poster-{16x9,9x16}.jpg`, `<id>-contact-{16x9,9x16}.jpg`, `<id>-script.txt`.',
];
if (skipped.length) md.push('', `Not rendered: ${skipped.map((s) => `${s.id} (${s.title})`).join(', ')}.`);
writeFileSync(join(OUT, `level${level}-index.md`), md.join('\n') + '\n', 'utf8');

const sheet = join(OUT, `level${level}-overview.jpg`);
const r = spawnSync(process.env.PYTHON ?? 'python', [join(HERE, 'render.py'), 'overview', sheet, ...rows.flatMap((x) => [x.poster, `${x.number}. ${x.title} · ${mmss(x.d)}`])], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('overview failed');
console.log(`level ${level}: ${rows.length} lessons, ${mb(totalBytes)} MB -> ${join(OUT, `level${level}-index.md`)}`);
