#!/usr/bin/env node
/**
 * Turns each place's equirectangular panorama (.cache/hdri/{id}_src.jpg, written by
 * fetch-hdris.mjs) into GPU-ready backgrounds:
 *
 *   public/hdri/{id}_cube.ktxc     cube map, 6 × 2048² faces, Basis-compressed, with mipmaps (VR)
 *   public/hdri/{id}_cube_1k.ktxc  same at 1024² (flat screens and phones)
 *
 * and samples average sky / horizon / ground colours for lighting into
 * src/data/place-light.json, which replaces the per-place HDR download.
 *
 * Why: a JPG background is decoded on the main thread, then three.js converts it into an
 * uncompressed cube render target at runtime. A KTX2 cube map is transcoded in a worker and
 * uploaded as ASTC/BC7/ETC, using ~4–8× less GPU memory and no main-thread work.
 *
 * Face layout follows three.js for a CubeTexture used as scene.background, so the same
 * `yawForFocus` rotation applies as with the old equirect JPG.
 *
 * Usage: node scripts/build-cubemaps.mjs [--force] [--mode=etc1s|uastc] [--only=id,id]
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';
import { upsertCredits } from './credits-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const force = args.includes('--force');
const mode = (args.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'etc1s').toLowerCase();
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',');
const FACE = 2048;

const places = JSON.parse(await readFile(join(root, 'src/data/places.json'), 'utf8'));
const lightPath = join(root, 'src/data/place-light.json');
const light = existsSync(lightPath) ? JSON.parse(await readFile(lightPath, 'utf8')) : {};

/**
 * Direction for pixel (s, t) of each face, s/t in [-1, 1], s → right, t → down,
 * in the order [+x, −x, +y, −y, +z, −z] (OpenGL cube map convention).
 */
const FACES = [
  (s, t) => [1, -t, -s],
  (s, t) => [-1, -t, s],
  (s, t) => [s, 1, t],
  (s, t) => [s, -1, -t],
  (s, t) => [s, -t, 1],
  (s, t) => [-s, -t, -1],
];

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Bilinear sample of an RGB(A) equirect at direction (x, y, z) using three.js's equirectUv. */
function makeSampler(data, W, H, ch) {
  return (x, y, z, out, o) => {
    const len = Math.hypot(x, y, z);
    x /= len;
    y /= len;
    z /= len;
    const u = Math.atan2(z, x) / (2 * Math.PI) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI + 0.5;
    const fx = u * W - 0.5;
    const fy = (1 - v) * H - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.max(0, Math.min(H - 1, Math.floor(fy)));
    const y1 = Math.min(H - 1, y0 + 1);
    const ax = fx - x0;
    const ay = Math.max(0, Math.min(1, fy - Math.floor(fy)));
    const xa = ((x0 % W) + W) % W;
    const xb = (xa + 1) % W;
    for (let c = 0; c < 3; c++) {
      const p00 = data[(y0 * W + xa) * ch + c];
      const p10 = data[(y0 * W + xb) * ch + c];
      const p01 = data[(y1 * W + xa) * ch + c];
      const p11 = data[(y1 * W + xb) * ch + c];
      out[o + c] = (p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay + 0.5;
    }
    out[o + 3] = 255;
  };
}

function renderFace(sample, face, size) {
  const out = new Uint8Array(size * size * 4);
  const dir = FACES[face];
  for (let j = 0; j < size; j++) {
    const t = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const s = ((i + 0.5) / size) * 2 - 1;
      const [dx, dy, dz] = dir(s, t);
      // three.js samples a (non-render-target) CubeTexture background with x flipped.
      sample(-dx, dy, dz, out, (j * size + i) * 4);
    }
  }
  return out;
}

/** Average linear colour in three latitude bands: sky (above 20°), horizon (±20°), ground. */
function bandColours(data, W, H, ch) {
  const acc = { sky: [0, 0, 0, 0], equator: [0, 0, 0, 0], ground: [0, 0, 0, 0] };
  for (let y = 0; y < H; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    const w = Math.cos((lat * Math.PI) / 180); // area weight
    const band = lat > 20 ? acc.sky : lat < -20 ? acc.ground : acc.equator;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      band[0] += srgbToLinear(data[i]) * w;
      band[1] += srgbToLinear(data[i + 1]) * w;
      band[2] += srgbToLinear(data[i + 2]) * w;
      band[3] += w;
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(acc)) {
    out[k] = [v[0] / v[3], v[1] / v[3], v[2] / v[3]].map((n) => Math.round(n * 1000) / 1000);
  }
  return out;
}

const rawDecoder = async (buf) => ({ data: buf.data, width: buf.width, height: buf.height });

/**
 * The Basis encoder caps one texture at ~12 Mpix, so a 6 × 2048² cube can't be encoded in
 * one go. Each face is encoded as its own 2D KTX2, and the six are packed into one file:
 *   "KTXC" | uint32 faceCount (6) | 6 × uint32 byteLength | face 0 … face 5   (little-endian)
 * src/systems/cubemap-loader.ts unpacks it and builds a CompressedCubeTexture.
 */
async function encodeFace(data, size) {
  // ktx2-encoder decodes "images" with imageDecoder; pass the raw RGBA straight through.
  const input = Object.assign(new Uint8Array(0), { data, width: size, height: size });
  const opts =
    mode === 'uastc'
      ? { isUASTC: true, needSupercompression: true, uastcLDRQualityLevel: 1, enableRDO: true, rdoQualityLevel: 1 }
      : { isUASTC: false, qualityLevel: 230, compressionLevel: 2 };
  return encodeToKTX2(input, {
    ...opts,
    generateMipmap: true,
    isKTX2File: true,
    isSetKTX2SRGBTransferFunc: true,
    isPerceptual: true,
    isYFlip: false,
    imageDecoder: rawDecoder,
  });
}

async function encodeCube(faces, size) {
  const parts = [];
  for (const f of faces) parts.push(await encodeFace(f, size));
  const header = Buffer.alloc(8 + 4 * parts.length);
  header.write('KTXC', 0, 'ascii');
  header.writeUInt32LE(parts.length, 4);
  parts.forEach((p, i) => header.writeUInt32LE(p.length, 8 + 4 * i));
  return Buffer.concat([header, ...parts.map((p) => Buffer.from(p))]);
}

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const credits = [];

for (const place of places) {
  if (only && !only.includes(place.id)) continue;
  const id = place.id;
  const src = join(root, '.cache/hdri', `${id}_src.jpg`);
  const out2k = join(root, 'public/hdri', `${id}_cube.ktxc`);
  const out1k = join(root, 'public/hdri', `${id}_cube_1k.ktxc`);
  for (const f of [out2k, out1k]) {
    credits.push({
      file: `hdri/${f.split('/').pop()}`,
      title: place.polyhaven,
      author: 'Poly Haven',
      source_url: `https://polyhaven.com/a/${place.polyhaven}`,
      license: 'CC0 1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      changes: 'Reprojected from Poly Haven tonemapped JPG to a compressed cube map',
    });
  }
  if (!force && existsSync(out2k) && existsSync(out1k) && light[id]) {
    console.log(`✓ ${id} cube maps present`);
    continue;
  }
  if (!existsSync(src)) throw new Error(`${src} missing; run npm run fetch:hdris first`);

  const t0 = Date.now();
  const { data, info } = await sharp(src, { limitInputPixels: false })
    .resize({ width: FACE * 4, height: FACE * 2, fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sample = makeSampler(data, info.width, info.height, info.channels);
  const faces = [0, 1, 2, 3, 4, 5].map((f) => renderFace(sample, f, FACE));

  const small = await sharp(src).resize({ width: 512, height: 256, fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  light[id] = bandColours(small.data, small.info.width, small.info.height, small.info.channels);

  const k2 = await encodeCube(faces, FACE);
  await writeFile(out2k, k2);
  const faces1k = await Promise.all(
    faces.map(async (f) => new Uint8Array(await sharp(f, { raw: { width: FACE, height: FACE, channels: 4 } }).resize(1024, 1024).raw().toBuffer())),
  );
  const k1 = await encodeCube(faces1k, 1024);
  await writeFile(out1k, k1);
  console.log(`✓ ${id}: ${mode} cube ${mb(k2.length)}, 1k ${mb(k1.length)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

await writeFile(lightPath, JSON.stringify(light, null, 2) + '\n');
await upsertCredits(join(root, 'public/credits.json'), credits);
