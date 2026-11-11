#!/usr/bin/env node
/**
 * Downloads the Poly Haven HDRIs listed in src/data/places.json and self-hosts them.
 *
 * Per place it writes to public/hdri/:
 *   {id}_ibl.hdr   1k HDR, used for image-based lighting
 *   {id}_4k.jpg    4096×2048 background (from Poly Haven's tonemapped JPG)
 *   {id}_8k.jpg    8192×4096 background, loaded lazily as an HD upgrade
 *   {id}_thumb.jpg 640×320 menu thumbnail
 * and records each file in public/credits.json.
 *
 * Poly Haven assets are CC0. Their API asks for a unique User-Agent.
 * Files that already exist are skipped, so this is safe to run before every build.
 *
 * Usage: node scripts/fetch-hdris.mjs [--force]
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { upsertCredits } from './credits-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'hdri');
const force = process.argv.includes('--force');
const UA = 'meditation-vr-asset-fetch/0.1 (self-hosting CC0 HDRIs)';

const places = JSON.parse(await readFile(join(root, 'src/data/places.json'), 'utf8'));

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function download(url, expectedMd5) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (expectedMd5) {
    const md5 = createHash('md5').update(buf).digest('hex');
    if (md5 !== expectedMd5) throw new Error(`md5 mismatch for ${url}`);
  }
  return buf;
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

await mkdir(outDir, { recursive: true });
const credits = [];

for (const place of places) {
  const id = place.id;
  const ph = place.polyhaven;
  const targets = {
    ibl: join(outDir, `${id}_ibl.hdr`),
    bg4k: join(outDir, `${id}_4k.jpg`),
    bg8k: join(outDir, `${id}_8k.jpg`),
    thumb: join(outDir, `${id}_thumb.jpg`),
  };
  const info = await getJSON(`https://api.polyhaven.com/info/${ph}`);
  const sourceUrl = `https://polyhaven.com/a/${ph}`;
  const author = Object.keys(info.authors ?? {}).join(', ') || 'Poly Haven';
  for (const file of Object.values(targets)) {
    credits.push({
      file: `hdri/${file.split('/').pop()}`,
      title: info.name,
      author,
      source_url: sourceUrl,
      license: 'CC0 1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      changes: file.endsWith('.hdr')
        ? 'Downloaded at 1k resolution'
        : 'Resized from Poly Haven tonemapped JPG',
    });
  }

  const missing = Object.values(targets).filter((f) => force || !existsSync(f));
  if (missing.length === 0) {
    console.log(`✓ ${id} (${ph}) already present`);
    continue;
  }

  const files = await getJSON(`https://api.polyhaven.com/files/${ph}`);

  if (force || !existsSync(targets.ibl)) {
    const f = files.hdri['1k'].hdr;
    await writeFile(targets.ibl, await download(f.url, f.md5));
    console.log(`  ${id}: IBL 1k HDR ${mb(f.size)}`);
  }

  const needJpg = [targets.bg4k, targets.bg8k, targets.thumb].some((f) => force || !existsSync(f));
  if (needJpg) {
    const t = files.tonemapped;
    console.log(`  ${id}: downloading tonemapped JPG ${mb(t.size)} …`);
    const src = await download(t.url, t.md5);
    const variants = [
      [targets.bg4k, 4096, 85],
      [targets.bg8k, 8192, 80],
      [targets.thumb, 640, 78],
    ];
    for (const [file, width, quality] of variants) {
      const out = await sharp(src, { limitInputPixels: false })
        .resize({ width, height: width / 2, fit: 'fill' })
        .jpeg({ quality, mozjpeg: true, progressive: true })
        .toBuffer();
      await writeFile(file, out);
      console.log(`  ${id}: ${file.split('/').pop()} ${mb(out.length)}`);
    }
  }
  console.log(`✓ ${id} (${ph})`);
}

await upsertCredits(join(root, 'public', 'credits.json'), credits);
console.log('credits.json updated');
