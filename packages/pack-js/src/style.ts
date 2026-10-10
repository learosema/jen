/** The output styles – TypeScript, JavaScript with JSDoc types, plain JavaScript – and how a project picks one. */
import type { Answers, Context } from '@codejen/jen';
import { fail } from './common.ts';
import { template } from './templates.ts';

export type Types = 'ts' | 'jsdoc' | 'none';

const TYPES: Types[] = ['ts', 'jsdoc', 'none'];

export const TYPES_PARAM = { types: { default: '' } };

/** `--types`, else what the nearest tsconfig.json or jsconfig.json says. */
export function typesFor(generator: string, answers: Answers, ctx: Context): Types {
  const given = String(answers.types ?? '');
  if (!given) return detectTypes(ctx);
  if (!TYPES.includes(given as Types)) fail(`${generator} --types: expected ts, jsdoc or none, got "${given}"`);
  return given as Types;
}

/** The nearer of tsconfig.json and jsconfig.json decides; a tsconfig.json with `checkJs` means JSDoc. */
export function detectTypes(ctx: Context): Types {
  const config = nearestConfig(ctx);
  if (!config) return 'none';
  if (config.endsWith('jsconfig.json')) return 'jsdoc';
  return /"checkJs"\s*:\s*true/.test(ctx.read(config) ?? '') ? 'jsdoc' : 'ts';
}

function nearestConfig(ctx: Context): string | null {
  const depth = (file: string | null) => (file === null ? -1 : file.split('/').length);
  const ts = ctx.findUp('tsconfig.json', undefined, ctx.destDir);
  const js = ctx.findUp('jsconfig.json', undefined, ctx.destDir);
  return depth(js) > depth(ts) ? js : ts;
}

export const ext = (types: Types): string => (types === 'ts' ? '.ts' : '.js');

/**
 * The extension relative imports use: `.ts` where the tsconfig allows it (so
 * Node runs the files directly), else `.js`, which TypeScript maps to the `.ts` file.
 */
export function importExt(ctx: Context, types: Types): string {
  if (types !== 'ts') return '.js';
  const config = nearestConfig(ctx);
  const text = (config && ctx.read(config)) ?? '';
  return /"(allowImportingTsExtensions|rewriteRelativeImportExtensions)"\s*:\s*true/.test(text) ? '.ts' : '.js';
}

/** `// @ts-check` on top of JSDoc-typed files. */
export const source = (types: Types, body: string): string => (types === 'jsdoc' ? `// @ts-check\n${body}` : body);

/** A template in the project's style: `name.ts`, or `name.js` (JSDoc), stripped of its types for plain JavaScript. */
export function styled(name: string, types: Types): string {
  if (types === 'ts') return template(`${name}.ts`);
  const js = template(`${name}.js`);
  return types === 'jsdoc' ? js : stripTypes(js);
}

const TYPE_TAG = /^@(type|typedef|param|returns?|property|template|overload|override|readonly|satisfies|implements|extends|this|import|callback)\b/;

/** JSDoc-typed JavaScript → plain JavaScript: drops `// @ts-check`, type-only comment blocks and inline type casts. */
export function stripTypes(js: string): string {
  return js
    .replace(/^\/\/ @ts-check\n/, '')
    .replace(/^[ \t]*\/\*\*[\s\S]*?\*\/[ \t]*\n/gm, (block) => (typeOnly(block) ? '' : block))
    .replace(/\/\*\* @(?:type|satisfies) \{.*?\} \*\/ \(([^()]*)\)/g, '$1')
    .replace(/\/\*\* @(?:type|satisfies) \{.*?\} \*\/ ?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '');
}

const typeOnly = (block: string): boolean => {
  const first = block
    .replace(/^\s*\/\*\*/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*(\*\s*)?/, '').trim())
    .find(Boolean);
  return first !== undefined && TYPE_TAG.test(first);
};

/** TypeScript, or JSDoc-typed JavaScript – stripped of its types for plain JavaScript. */
export const pick = (types: Types, ts: () => string, jsdoc: () => string): string =>
  types === 'ts' ? ts() : types === 'jsdoc' ? source('jsdoc', jsdoc()) : stripTypes(jsdoc());
