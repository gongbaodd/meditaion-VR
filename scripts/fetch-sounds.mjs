#!/usr/bin/env node
/**
 * Optional: replace the synthesized ambience/bells with real CC0 recordings from Freesound.
 *
 *   FREESOUND_TOKEN=xxxx node scripts/fetch-sounds.mjs [--force]
 *
 * Get a token at https://freesound.org/apiv2/apply (free account).
 * Token auth gives access to search and the high-quality MP3 previews (~128 kbps), which is
 * what this script downloads. Original files need OAuth2 and are not required here.
 *
 * Reads assets/sounds.json, only accepts "Creative Commons 0" sounds, writes
 * public/audio/*.mp3, public/audio/manifest.json and the credits entries.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertCredits } from './credits-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.FREESOUND_TOKEN;
const force = process.argv.includes('--force');
if (!token) {
  console.log('FREESOUND_TOKEN not set: skipping (the app will use synthesized sound).');
  process.exit(0);
}

const API = 'https://freesound.org/apiv2';
const FIELDS = 'id,name,username,license,url,previews,duration';
const CC0 = 'Creative Commons 0';
const configPath = join(root, 'assets/sounds.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const outDir = join(root, 'public/audio');
await mkdir(outDir, { recursive: true });

async function api(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
  if (!res.ok) throw new Error(`${url.pathname} → HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function pick(spec) {
  if (spec.id) return api(`/sounds/${spec.id}/`, { fields: FIELDS });
  const params = {
    query: spec.query,
    filter: `license:"${CC0}" duration:[${spec.minDuration} TO ${spec.maxDuration}]`,
    sort: 'rating_desc',
    fields: FIELDS,
    page_size: '10',
  };
  let res;
  try {
    res = await api('/search/text/', params);
  } catch {
    res = await api('/search/', params);
  }
  const hit = res.results?.find((r) => r.license?.includes('publicdomain/zero') || r.license === CC0);
  if (!hit) throw new Error(`no CC0 result for "${spec.query}"`);
  return hit;
}

const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
const credits = [];

for (const group of ['ambient', 'bells']) {
  manifest[group] ??= {};
  for (const [name, spec] of Object.entries(config[group])) {
    const file = `audio/${group === 'ambient' ? 'amb' : 'bell'}-${name}.mp3`;
    const dest = join(root, 'public', file);
    try {
      const s = await pick(spec);
      const isCC0 = s.license?.includes('publicdomain/zero') || s.license === CC0;
      if (!isCC0) throw new Error(`sound ${s.id} is not CC0 (${s.license}); refusing`);
      if (force || !existsSync(dest) || spec.id !== s.id) {
        const res = await fetch(s.previews['preview-hq-mp3']);
        if (!res.ok) throw new Error(`preview download → HTTP ${res.status}`);
        await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      }
      spec.id = s.id;
      manifest[group][name] = { file, gain: spec.gain ?? 1 };
      credits.push({
        file,
        title: s.name,
        author: s.username,
        source_url: s.url,
        license: 'CC0 1.0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        changes: 'Freesound high-quality MP3 preview; loop seam cross-faded at runtime',
      });
      console.log(`✓ ${group}/${name}: #${s.id} "${s.name}" by ${s.username}`);
    } catch (e) {
      console.warn(`✗ ${group}/${name}: ${e.message} (synth fallback stays)`);
    }
  }
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
await upsertCredits(join(root, 'public/credits.json'), credits);
console.log('manifest.json, sounds.json and credits.json updated');
