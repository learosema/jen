/**
 * A small, pragmatic .editorconfig reader: covers indent_style, indent_size,
 * tab_width, end_of_line, trim_trailing_whitespace and insert_final_newline,
 * with glob support for *, **, ?, [...] and {a,b}. No nested braces, no
 * numeric ranges, no charset/max_line_length – those don't affect generated
 * text either way.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

interface EditorConfigSection {
  pattern: string;
  props: Record<string, string>;
}

function parseEditorConfig(text: string): { root: boolean; sections: EditorConfigSection[] } {
  let root = false;
  const sections: EditorConfigSection[] = [];
  let current: EditorConfigSection | null = null;
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      current = { pattern: section[1], props: {} };
      sections.push(current);
      continue;
    }
    const kv = line.match(/^([^=]+)=(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const value = kv[2].trim();
    if (current) current.props[key] = value.toLowerCase();
    else if (key === 'root') root = value.toLowerCase() === 'true';
  }
  return { root, sections };
}

const RE_SPECIAL = /[.+^$()|\\\]]/g;

/** Translates a (subset of) editorconfig glob into a RegExp, relative to the .editorconfig's own directory. */
function globToRegExp(glob: string): RegExp {
  const pattern = glob.includes('/') ? glob.replace(/^\//, '') : `**/${glob}`;
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i++;
      if (pattern[i + 1] === '/') i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end < 0) {
        re += '\\[';
      } else {
        const cls = pattern.slice(i + 1, end);
        re += `[${cls.startsWith('!') ? `^${cls.slice(1)}` : cls}]`;
        i = end;
      }
    } else if (c === '{') {
      const end = pattern.indexOf('}', i + 1);
      if (end < 0) {
        re += '\\{';
      } else {
        const alts = pattern
          .slice(i + 1, end)
          .split(',')
          .map((s) => s.replace(RE_SPECIAL, '\\$&'));
        re += `(?:${alts.join('|')})`;
        i = end;
      }
    } else {
      re += c.replace(RE_SPECIAL, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** Walks upward from the file, merging matching .editorconfig sections (closer file & later section win). */
export function editorConfigFor(file: string): Record<string, string> {
  const chain: Record<string, string>[][] = [];
  let dir = dirname(file);
  for (;;) {
    const cfgPath = join(dir, '.editorconfig');
    if (existsSync(cfgPath)) {
      const { root, sections } = parseEditorConfig(readFileSync(cfgPath, 'utf8'));
      const rel = relative(dir, file);
      const matched = sections.filter((s) => globToRegExp(s.pattern).test(rel)).map((s) => s.props);
      if (matched.length > 0) chain.push(matched);
      if (root) break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const props: Record<string, string> = {};
  for (const fileMatches of chain.reverse()) for (const p of fileMatches) Object.assign(props, p);
  return props;
}

/** Normalizes indentation, line endings, trailing whitespace and final newline per editorconfig props. */
export function applyEditorConfig(content: string, props: Record<string, string>): string {
  if (Object.keys(props).length === 0) return content;
  const eol = props.end_of_line === 'crlf' ? '\r\n' : props.end_of_line === 'cr' ? '\r' : '\n';
  const hadFinalNewline = /\r\n$|\r$|\n$/.test(content);
  const lines = content.split(/\r\n|\r|\n/);
  if (hadFinalNewline) lines.pop();

  const indentSize = Number(props.indent_size === 'tab' ? props.tab_width : props.indent_size) || undefined;

  const formatted = lines.map((line) => {
    let out = line;
    if (indentSize && (props.indent_style === 'space' || props.indent_style === 'tab')) {
      const indent = out.match(/^[ \t]*/)?.[0] ?? '';
      let columns = 0;
      for (const ch of indent) columns += ch === '\t' ? indentSize : 1;
      const newIndent =
        props.indent_style === 'tab'
          ? '\t'.repeat(Math.floor(columns / indentSize)) + ' '.repeat(columns % indentSize)
          : ' '.repeat(columns);
      out = newIndent + out.slice(indent.length);
    }
    return props.trim_trailing_whitespace === 'true' ? out.replace(/[ \t]+$/, '') : out;
  });

  let result = formatted.join(eol);
  if (props.insert_final_newline === 'true' || (hadFinalNewline && props.insert_final_newline !== 'false')) {
    result += eol;
  }
  return result;
}

/** Guesses a file's own indent style/size from its content, for when no .editorconfig rule applies. */
function sniffIndent(text: string): { style: 'tab' | 'space'; size: number } {
  const leads = text
    .split('\n')
    .map((l) => l.match(/^[ \t]+/)?.[0] ?? '')
    .filter(Boolean);
  const tabs = leads.filter((l) => l[0] === '\t').length;
  const spaced = leads.filter((l) => l[0] === ' ').map((l) => l.length);
  if (tabs > 0 && tabs >= spaced.length) return { style: 'tab', size: 1 };
  if (spaced.length === 0) return { style: 'space', size: 2 };
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return { style: 'space', size: spaced.reduce(gcd) };
}

/** What newly introduced lines in `text` should be indented with: .editorconfig wins, else the file's own style. */
export function indentTargetFor(file: string, text: string): { style: 'tab' | 'space'; size: number } {
  const props = editorConfigFor(file);
  const style = props.indent_style === 'tab' || props.indent_style === 'space' ? props.indent_style : undefined;
  const size = Number(props.indent_size === 'tab' ? props.tab_width : props.indent_size) || undefined;
  const sniffed = sniffIndent(text);
  return { style: style ?? sniffed.style, size: size ?? sniffed.size };
}

/**
 * Re-renders a block of lines in the target indent style, preserving their
 * relative nesting (the block's own smallest indent becomes one level).
 * `baseIndent` is prefixed to every line, e.g. the marker's own indentation.
 * A single line is just trimmed and prefixed – exactly today's behaviour.
 */
export function reindentBlock(
  block: string[],
  baseIndent: string,
  target: { style: 'tab' | 'space'; size: number },
): string[] {
  if (block.length <= 1) return [baseIndent + (block[0] ?? '').trim()];
  const leads = block.filter((l) => l.trim() !== '').map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
  const unit = Math.min(...leads.filter((n) => n > 0), Infinity);
  const step = target.style === 'tab' ? '\t' : ' '.repeat(target.size);
  return block.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const lead = line.match(/^[ \t]*/)?.[0].length ?? 0;
    const level = unit > 0 && Number.isFinite(unit) ? Math.round(lead / unit) : 0;
    return baseIndent + step.repeat(level) + trimmed;
  });
}

/** Whether `block` (compared line-by-line, trimmed) already occurs anywhere in `lines`. */
export function containsBlock(lines: string[], block: string[]): boolean {
  const b = block.map((l) => l.trim());
  for (let k = 0; k + b.length <= lines.length; k++) {
    if (b.every((l, j) => lines[k + j].trim() === l)) return true;
  }
  return false;
}

/**
 * Reindents a multi-line `replace` template to match the indentation at its
 * first match in `text`. The first line continues inline right after the
 * match, so it's left exactly as written; only the following lines – which
 * start fresh – are re-rendered in the file's indent style.
 */
export function reindentReplace(
  text: string,
  pattern: RegExp,
  replace: string,
  target: { style: 'tab' | 'space'; size: number },
): string {
  const search = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  const m = search.exec(text);
  if (!m) return replace;
  const lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
  const baseIndent = text.slice(lineStart, m.index).match(/^[ \t]*/)?.[0] ?? '';
  const lines = replace.split('\n');
  const rendered = reindentBlock(lines, baseIndent, target);
  return [lines[0], ...rendered.slice(1)].join('\n');
}
