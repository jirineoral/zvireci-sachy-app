// Copies the single-threaded lite Stockfish build from node_modules into public/engine/
// so Vite serves it verbatim (dev) and copies it into dist/ (build). The glue script
// finds its .wasm next to itself by name, so both files must stay side by side.
// Runs from the npm `postinstall` script. public/engine/ is git-ignored.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'node_modules', 'stockfish', 'bin');
const targetDir = join(root, 'public', 'engine');
const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = join(sourceDir, file);
  if (!existsSync(source)) {
    console.error(`copy-engine: missing ${source} — is the "stockfish" package installed?`);
    process.exit(1);
  }
  copyFileSync(source, join(targetDir, file));
  console.log(`copy-engine: ${file} -> public/engine/`);
}
