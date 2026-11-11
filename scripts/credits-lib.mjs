import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

/** Merge entries into credits.json, keyed by `file`. */
export async function upsertCredits(path, entries) {
  const current = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : [];
  const byFile = new Map(current.map((e) => [e.file, e]));
  for (const e of entries) byFile.set(e.file, e);
  const merged = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(path, JSON.stringify(merged, null, 2) + '\n');
}
