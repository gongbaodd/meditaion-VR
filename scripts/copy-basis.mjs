#!/usr/bin/env node
/**
 * Copies three.js's Basis Universal transcoder (used by KTX2Loader to decode the place
 * cube maps in a worker) into public/basis/, so it is self-hosted and always matches the
 * installed three version instead of coming from a CDN.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// 'three' resolves to build/three.cjs; its package root is two levels up.
const threeDir = dirname(dirname(require.resolve('three')));
const src = join(threeDir, 'examples/jsm/libs/basis');
const out = join(root, 'public/basis');

await mkdir(out, { recursive: true });
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  await copyFile(join(src, f), join(out, f));
}
console.log('✓ basis transcoder copied');
