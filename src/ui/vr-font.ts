import { UIKit } from '@iwsdk/core';
import { publicUrl } from '../app.js';
import places from '../data/places.json';
import en from '../i18n/en.json';
import zh from '../i18n/zh.json';

/**
 * UIKit draws text from MSDF atlases. UIKitML's own @font-face support generates
 * those atlases with an ASCII-only charset, so Chinese would render as boxes.
 * Here we generate the atlas ourselves with every character the app can show.
 *
 * The TTFs are small subsets of Noto Sans SC built by scripts/build-font.mjs.
 */
function charset(): string {
  const parts: string[] = [...Object.values(en), ...Object.values(zh)];
  for (const p of places) parts.push(...Object.values(p.name));
  let ascii = '';
  for (let c = 0x20; c < 0x7f; c++) ascii += String.fromCharCode(c);
  return [...new Set([...parts.join(''), ...ascii, ...'·…—–:'])].join('');
}

type FontInfo = unknown;
let chain: Promise<unknown> = Promise.resolve();
const loads = new Map<string, Promise<FontInfo>>();

/** Generate one weight; generation is serialized because concurrent MSDF jobs can corrupt atlases. */
function load(file: string): Promise<FontInfo> {
  let p = loads.get(file);
  if (!p) {
    p = chain.then(async () => {
      const result = await new UIKit.TTFLoader().loadAsync([
        { url: publicUrl(file), charset: charset(), fontSize: 42, textureSize: [2048, 1024] },
      ]);
      // Same shape UIKitML unwraps: { family: { weight: font } }.
      const family = Object.values(result as Record<string, Record<string, FontInfo>>)[0];
      const font = family && Object.values(family)[0];
      if (!font) throw new Error(`no font face in ${file}`);
      return font;
    });
    chain = p.catch(() => {});
    loads.set(file, p);
  }
  return p;
}

export function vrFontFamilies() {
  return {
    ui: {
      normal: () => load('fonts/ui-regular.ttf'),
      bold: () => load('fonts/ui-bold.ttf'),
    },
  };
}
