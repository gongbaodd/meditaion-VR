#!/usr/bin/env node
/**
 * Builds the VR panel font: Noto Sans SC (SIL OFL 1.1), subset to exactly the
 * characters the app can display (all i18n strings, place names, digits, ASCII).
 *
 * UIKit renders text from glyph atlases generated from a TTF; the full CJK font
 * is ~17 MB, the subset is a few hundred KB.
 *
 * Writes public/fonts/ui-regular.ttf and public/fonts/ui-bold.ttf.
 * Re-run after changing src/i18n/*.json or src/data/places.json.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { upsertCredits } from './credits-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL = 'https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf';
const cacheDir = join(root, '.cache', 'fonts');
const cached = join(cacheDir, 'NotoSansSC-wght.ttf');
const outDir = join(root, 'public', 'fonts');

if (!existsSync(cached)) {
  console.log('Downloading Noto Sans SC (17 MB, once)…');
  await mkdir(cacheDir, { recursive: true });
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`font download → HTTP ${res.status}`);
  await writeFile(cached, Buffer.from(await res.arrayBuffer()));
}

// Every character the VR panels might show.
const texts = [];
for (const f of ['src/i18n/en.json', 'src/i18n/zh.json']) {
  texts.push(...Object.values(JSON.parse(await readFile(join(root, f), 'utf8'))));
}
for (const p of JSON.parse(await readFile(join(root, 'src/data/places.json'), 'utf8'))) {
  texts.push(...Object.values(p.name));
}
let ascii = '';
for (let c = 0x20; c < 0x7f; c++) ascii += String.fromCharCode(c);
const chars = [...new Set([...texts.join(''), ...ascii, ...'·…—–‘’“”×', ' '])].join('');

const full = await readFile(cached);
await mkdir(outDir, { recursive: true });
for (const [name, wght] of [
  ['ui-regular.ttf', 400],
  ['ui-bold.ttf', 700],
]) {
  const out = await subsetFont(full, chars, { targetFormat: 'truetype', variationAxes: { wght } });
  await writeFile(join(outDir, name), out);
  console.log(`  ${name}: ${(out.length / 1024).toFixed(0)} KB, ${[...chars].length} chars`);
}

await upsertCredits(
  join(root, 'public', 'credits.json'),
  ['ui-regular.ttf', 'ui-bold.ttf'].map((f) => ({
    file: `fonts/${f}`,
    title: 'Noto Sans SC',
    author: 'Google, Adobe (Noto project)',
    source_url: 'https://github.com/google/fonts/tree/main/ofl/notosanssc',
    license: 'OFL-1.1',
    license_url: 'https://openfontlicense.org',
    changes: 'Subset to the characters used by this app; instanced at a fixed weight',
  })),
);
