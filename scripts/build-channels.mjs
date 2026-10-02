#!/usr/bin/env node
// Post-build step: channel landing paths for visit attribution (/li = LinkedIn, /fb = Facebook,
// /k = chess clubs). GitHub Pages cannot redirect, and Cloudflare Web Analytics strips ? and #
// and gets no referrer from in-app browsers (and the page sends `no-referrer`), so the only
// thing that survives into the data is the page path: each channel is a verbatim copy of
// dist/index.html at dist/<channel>/index.html, served for /li and /li/ and recorded by the
// beacon as requestPath "/li/". Everything in the app uses root-absolute URLs, so the copy works as-is.
// Runs after build-sw in the build:pages and build:dev-site scripts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHANNELS = ['li', 'fb', 'k'];

const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const html = readFileSync(join(DIST, 'index.html'), 'utf-8');
if (!html.includes('<head>')) throw new Error('build-channels: dist/index.html has no <head>');
// The copies must not compete with the home page in search results.
const copy = html.replace('<head>', '<head>\n    <meta name="robots" content="noindex" />');

for (const channel of CHANNELS) {
  mkdirSync(join(DIST, channel), { recursive: true });
  writeFileSync(join(DIST, channel, 'index.html'), copy);
  console.log(`build-channels: dist/${channel}/index.html written`);
}
