import strings from './strings.json';

const table: Record<string, string> = strings;

/** Look up UI text by `key`; `{name}` placeholders are filled from vars (values that are keys get looked up too). */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = table[key] ?? key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (_, k) => {
      const v = vars[k];
      if (v == null) return `{${k}}`;
      const str = String(v);
      return table[str] ?? str;
    });
  }
  return s;
}
