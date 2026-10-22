/**
 * `jen generator --like=…`: a draft generator that writes existing files again, with one
 * word in them – the name – templated in every case the helpers make.
 */
import { posix } from 'node:path';
import { fromCwd } from './context.ts';
import { JenError, helpers, lineList } from './core.ts';
import type { Context, Placed } from './core.ts';

/** Larger files are refused: an example is source code, not data. */
const MAX_BYTES = 256 * 1024;
/** Other files that mention the word, at most. */
const MAX_MENTIONS = 5;

type Helper = 'pascal' | 'camel' | 'kebab' | 'snake' | 'constant';

/** One spelling of the word, and the helpers that make it – several for one lower-case word (camel, kebab, snake). */
interface Variant {
  text: string;
  made: Helper[] | 'prose';
}

/** Every spelling of `word` the helpers make; for two or more words also "order items" in prose. */
export function variants(word: string): Variant[] {
  const found = new Map<string, Variant>();
  for (const h of ['camel', 'pascal', 'kebab', 'snake', 'constant'] as const) {
    const text = helpers[h](word);
    if (!text) continue;
    const v = found.get(text);
    if (v && v.made !== 'prose') v.made.push(h);
    else found.set(text, { text, made: [h] });
  }
  const prose = helpers.kebab(word).replaceAll('-', ' ');
  if (prose.includes(' ')) found.set(prose, { text: prose, made: 'prose' });
  return [...found.values()];
}

/** Characters that make a word part of a longer name: `usersCount`, `superusers`, `users-list`, `$users` stay. */
const NAME_CHAR = 'A-Za-z0-9_$\\-';
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches any of the variants as a whole token, the longest first. */
export function tokenRe(vs: Variant[], flags = 'g'): RegExp {
  const alts = vs.map((v) => v.text).sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![${NAME_CHAR}])(?:${alts.map(escapeRe).join('|')})(?![${NAME_CHAR}])`, flags);
}

/** Text as the inside of a template literal that evaluates to it exactly – `\r` too, which a literal would turn into `\n`. */
const escapeTemplate = (s: string): string => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\r/g, '\\r');

/**
 * `text` as template-literal content with every whole-token variant replaced by its helper call,
 * e.g. `${camel(name)}`. A lower-case single word is `kebab` in a path or next to a `/`, else `camel`.
 */
export function templated(text: string, vs: Variant[], inPath: boolean): { out: string; count: number; used: Set<Helper> } {
  const byText = new Map(vs.map((v) => [v.text, v]));
  const used = new Set<Helper>();
  let out = '';
  let at = 0;
  let count = 0;
  for (const m of text.matchAll(tokenRe(vs))) {
    const v = byText.get(m[0]) as Variant;
    let expr: string;
    if (v.made === 'prose') {
      used.add('kebab');
      expr = "kebab(name).replaceAll('-', ' ')";
    } else {
      const slash = text[m.index - 1] === '/' || text[m.index + m[0].length] === '/';
      const h = v.made.length === 1 ? v.made[0] : inPath || slash ? 'kebab' : 'camel';
      used.add(h);
      expr = `${h}(name)`;
    }
    out += `${escapeTemplate(text.slice(at, m.index))}\${${expr}}`;
    at = m.index + m[0].length;
    count++;
  }
  return { out: out + escapeTemplate(text.slice(at)), count, used };
}

/** Names that contain the word but were left as they are, e.g. `usersCount` – for the note. */
function kept(text: string, vs: Variant[]): string[] {
  const exact = new Set(vs.map((v) => v.text));
  const names = text.match(new RegExp(`[${NAME_CHAR}]+`, 'g')) ?? [];
  return names.filter((n) => !exact.has(n) && vs.some((v) => !v.text.includes(' ') && n.includes(v.text)));
}

const isBinary = (text: string): boolean => text.slice(0, 8192).includes('\0');
const tooLarge = (text: string): boolean => Buffer.byteLength(text) > MAX_BYTES;

const refuse = (message: string, value: string): never => {
  throw new JenError(`generator --like: ${message}`, 'bad_value', { param: 'like', value });
};

/** The `--like` files, checked, as paths from the project root, with their contents. */
function readExamples(like: string, ctx: Context): Array<{ path: string; text: string }> {
  return like
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((given) => {
      const path = fromCwd(ctx, given);
      if (path === null) return refuse(`${given} is outside the project root (${ctx.root})`, given);
      if (ctx.isDir(path)) return refuse(`${given} is a directory – name the files in it`, given);
      const text = ctx.read(path);
      if (text === null) return refuse(`${given} doesn't exist`, given);
      if (isBinary(text)) return refuse(`${given} is a binary file`, given);
      if (tooLarge(text)) return refuse(`${given} is over ${MAX_BYTES / 1024} KB`, given);
      return { path, text };
    });
}

const quote = (s: string): string => JSON.stringify(s);

/**
 * The actions of `jen generator --like=…`: the draft module at `file` (absolute), and notes – how often the
 * word was replaced, names that contain it but were kept, and other files that mention it.
 */
export function likeDraft(file: string, name: string, like: string, word: string, ctx: Context): Placed[] {
  const examples = readExamples(like, ctx);
  if (examples.length === 0) refuse('name one or more files, comma-separated', like);
  // users.test.js → users, UserCard.tsx → UserCard
  const w = word || posix.basename(examples[0].path).replace(/^(\.?[^.]*).*$/, '$1');
  const vs = variants(w);
  if (vs.length === 0) refuse(`"${w}" has no letters or digits to replace – pass --word=<the varying part>`, like);

  const used = new Set<Helper>();
  let count = 0;
  const keep = new Set<string>();
  const actions = examples.map(({ path, text }) => {
    const p = templated(`/${path}`, vs, true);
    const t = templated(text, vs, false);
    for (const h of [...p.used, ...t.used]) used.add(h);
    count += p.count + t.count;
    for (const n of kept(text, vs)) keep.add(n);
    return `    {\n      add: \`${p.out}\`,\n      template: \`${t.out}\`,\n    },\n`;
  });
  const shown = examples.map((e) => e.path).join(', ');
  if (count === 0) refuse(`"${w}" doesn't occur in ${shown} – pass --word=<the varying part>`, like);

  const order: Helper[] = ['camel', 'pascal', 'kebab', 'snake', 'constant'];
  const module = `// @ts-check
/** @type {import('@codejen/jen').Generator} */
export default {
  description: ${quote(name)},
  params: {
    name: { description: ${quote(`replaces ${w} in the example files: ${vs.map((v) => v.text).join(', ')}`)} },
  },
  examples: [${quote(`--name=${w}`)}],
  actions: ({ name }, { ${order.filter((h) => used.has(h)).join(', ')} }) => [
${actions.join('')}  ],
};
`;

  const keptNote = keep.size > 0 ? `; left as they are: ${[...keep].slice(0, 5).join(', ')}${keep.size > 5 ? ' …' : ''}` : '';
  const note = `reproduces ${shown} – replaced ${w} ${count}×${keptNote}; check where the name shouldn't change`;

  // a pattern usually has a registration somewhere, e.g. an index file importing it: name those files
  const re = tokenRe(vs, '');
  const skip = new Set(examples.map((e) => e.path));
  const mentions: Placed[] = [];
  for (const other of ctx.grep(/(?:)/)) {
    if (skip.has(other) || other.startsWith('.jen/')) continue;
    const text = ctx.read(other);
    if (text === null || tooLarge(text) || isBinary(text)) continue;
    const lines = text.split('\n').flatMap((l, i) => (re.test(l) ? [i + 1] : []));
    if (lines.length === 0) continue;
    const at = `line${lines.length > 1 ? 's' : ''} ${lineList(lines)}`;
    mentions.push({ note: `mentions ${w} too (${at}) – add inserts for it (docs: Actions)`, file: other });
  }
  if (mentions.length > MAX_MENTIONS) {
    const more = mentions.length - MAX_MENTIONS;
    mentions.splice(MAX_MENTIONS, more, { note: `… and ${more} more file${more > 1 ? 's' : ''} mention ${w}` });
  }

  return [{ add: file, template: module, verbatim: true }, { note, file, written: true }, ...mentions];
}
