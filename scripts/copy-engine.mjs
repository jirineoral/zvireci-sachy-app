// Copies the single-threaded lite Stockfish build from node_modules into public/engine/
// so Vite serves it verbatim (dev) and copies it into dist/ (build). The glue script
// finds its .wasm next to itself by name, so both files must stay side by side.
// Runs from the npm `postinstall` script. public/engine/ is git-ignored.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'node_modules', 'stockfish', 'bin');
const targetDir = join(root, 'public', 'engine');
const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];
// The engine is GPL-3.0: its licence text is published next to the binaries.
const licence = { source: join(root, 'node_modules', 'stockfish', 'Copying.txt'), target: 'LICENSE-GPL-3.0.txt' };

mkdirSync(targetDir, { recursive: true });

// sha256 of the two engine files as shipped by stockfish@18.0.8. A mismatch means a
// different package version or a tampered node_modules: stop instead of publishing it.
// UPDATE THESE (and ENGINE_WASM_BYTES in src/main.ts) when the engine version changes.
const EXPECTED_SHA256 = {
  'stockfish-18-lite-single.js': '5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391',
  'stockfish-18-lite-single.wasm': 'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1',
};
for (const file of files) {
  const source = join(sourceDir, file);
  if (!existsSync(source)) {
    console.error(`copy-engine: missing ${source} — is the "stockfish" package installed?`);
    process.exit(1);
  }
  const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
  if (digest !== EXPECTED_SHA256[file]) {
    console.error(`copy-engine: ${file} has sha256 ${digest}, expected ${EXPECTED_SHA256[file]} — engine version changed or file tampered; refusing to copy`);
    process.exit(1);
  }
  copyFileSync(source, join(targetDir, file));
  console.log(`copy-engine: ${file} -> public/engine/`);
}
if (!existsSync(licence.source)) {
  console.error(`copy-engine: missing ${licence.source} — the GPL text must ship with the engine`);
  process.exit(1);
}
copyFileSync(licence.source, join(targetDir, licence.target));
console.log(`copy-engine: ${licence.target} -> public/engine/`);
