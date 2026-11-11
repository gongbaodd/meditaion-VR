#!/usr/bin/env node
/**
 * Fails if any media file under public/hdri or public/audio has no entry in
 * public/credits.json, or if an entry uses a licence we don't allow.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = new Set(['CC0 1.0', 'CC BY 4.0', 'CC BY 3.0', 'OFL-1.1']);
const MEDIA = /\.(hdr|exr|jpg|jpeg|png|webp|ktx2|mp3|ogg|opus|wav|m4a|flac|ttf|otf|woff2?)$/i;

const creditsPath = join(root, 'public/credits.json');
const credits = existsSync(creditsPath) ? JSON.parse(await readFile(creditsPath, 'utf8')) : [];
const byFile = new Map(credits.map((c) => [c.file, c]));
const problems = [];

for (const dir of ['hdri', 'audio', 'fonts']) {
  const abs = join(root, 'public', dir);
  if (!existsSync(abs)) continue;
  for (const f of await readdir(abs)) {
    if (!MEDIA.test(f)) continue;
    const rel = `${dir}/${f}`;
    const c = byFile.get(rel);
    if (!c) problems.push(`${rel}: no credits entry`);
    else if (!ALLOWED.has(c.license)) problems.push(`${rel}: licence "${c.license}" not allowed`);
    else if (!c.source_url) problems.push(`${rel}: missing source_url`);
  }
}

if (problems.length) {
  console.error('Credits check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`Credits OK (${credits.length} entries).`);
