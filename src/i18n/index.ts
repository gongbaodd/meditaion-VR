import en from './en.json';
import zh from './zh.json';

export type Lang = 'en' | 'zh';
const tables: Record<Lang, Record<string, string>> = { en, zh };

let lang: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach((f) => f(l));
}

export function onLangChange(f: (l: Lang) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Translate `key`; `{name}` placeholders are filled from vars (values that are keys get translated too). */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = tables[lang][key] ?? tables.en[key] ?? key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (_, k) => {
      const v = vars[k];
      if (v == null) return `{${k}}`;
      const str = String(v);
      return tables[lang][str] ?? tables.en[str] ?? str;
    });
  }
  return s;
}

export function detectLang(): Lang {
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
