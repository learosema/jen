/** Parsing the list params (`--attrs`, `--events`, `--fields`, `--cases`, `--values`) and formatting types. */

export function fail(message: string): never {
  throw new Error(message);
}

/** Splits on commas outside `{}`, `[]`, `()` and `<>`, so types like `{a:number,b:string}` stay whole. */
export function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = '';
  for (const ch of text) {
    if ('{[(<'.includes(ch)) depth++;
    else if ('}])'.includes(ch) || (ch === '>' && !part.endsWith('='))) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(part);
      part = '';
    } else {
      part += ch;
    }
  }
  parts.push(part);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export interface Named {
  name: string;
  type: string | null;
}

/** `size:number,label` → names with their types (null where none is given). */
export function parseNamed(text: string, param: string, name = /^[A-Za-z_$][\w$-]*$/): Named[] {
  const items = splitTop(text).map((part) => {
    const colon = part.indexOf(':');
    const item = colon < 0 ? { name: part, type: null } : { name: part.slice(0, colon).trim(), type: part.slice(colon + 1).trim() || null };
    if (!name.test(item.name)) fail(`${param}: "${item.name}" is not a valid name`);
    return item;
  });
  const seen = new Set<string>();
  for (const { name } of items) {
    if (seen.has(name)) fail(`${param}: "${name}" is listed twice`);
    seen.add(name);
  }
  return items;
}

/** `{value:number}` → `{ value: number }`, in one pass – regexes around runs of whitespace backtrack quadratically on user input. */
export function formatType(type: string): string {
  const out: string[] = [];
  const space = () => {
    if (out.length && out[out.length - 1] !== ' ') out.push(' ');
  };
  const unspace = () => {
    if (out[out.length - 1] === ' ') out.pop();
  };
  for (const ch of type) {
    if (/\s/.test(ch)) {
      space();
    } else if (ch === ':' || ch === ',' || ch === ';') {
      unspace();
      out.push(ch);
      space();
    } else if (ch === '{') {
      out.push(ch);
      space();
    } else if (ch === '}') {
      unspace();
      if (out[out.length - 1] !== '{') out.push(' ');
      out.push(ch);
    } else {
      out.push(ch);
    }
  }
  unspace();
  return out.join('');
}

/** An object key: bare if it's an identifier, quoted otherwise. */
export const key = (name: string): string => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`);

/** The fields of an object type like `{ a: number, b?: string }`, or null if it isn't one. */
export function objectFields(type: string): Named[] | null {
  const m = /^\{(.*)\}$/s.exec(type.trim());
  if (!m) return null;
  return splitTop(m[1].replaceAll(';', ',')).map((part) => {
    const colon = part.indexOf(':');
    return { name: part.slice(0, colon).replace(/\?$/, '').trim(), type: part.slice(colon + 1).trim() };
  });
}
