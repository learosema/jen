/** `js:brand`: a branded type, so a `UserId` can't be passed where any string goes, with its guard and checked constructor. */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { TYPES_PARAM, type Types, ext, pick, typesFor } from './style.ts';
import { WITH_TEST_PARAMS, testAction } from './testing.ts';

const CHECKS: Record<string, string> = {
  string: "typeof value === 'string'",
  number: "typeof value === 'number' && Number.isFinite(value)",
  bigint: "typeof value === 'bigint'",
};

export function brandSource(types: Types, name: string, factory: string, underlying: string): string {
  const guard = `export function is${name}(value${types === 'ts' ? `: unknown): value is ${name}` : ')'} {
  return ${CHECKS[underlying]};
}`;
  const make = (signature: string) => `export function ${factory}${signature} {
  if (!is${name}(value)) throw new TypeError(\`Not a ${name}: \${String(value)}\`);
  return value;
}`;
  const ts = () => `declare const brand: unique symbol;

export type ${name} = ${underlying} & { readonly [brand]: '${name}' };

${guard}

${make(`(value: ${underlying}): ${name}`)}
`;
  const jsdoc = () => `/** @typedef {${underlying} & { readonly __brand: '${name}' }} ${name} */

/**
 * @param {unknown} value
 * @returns {value is ${name}}
 */
${guard}

/**
 * @param {${underlying}} value
 * @returns {${name}}
 */
${make('(value)')}
`;
  return pick(types, ts, jsdoc);
}

const brandGenerator: Generator = {
  description: 'create a branded type with a type guard and a checked constructor',
  params: {
    name: {},
    underlying: { default: 'string' },
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  actions: (answers, { pascal, camel, kebab }, ctx) => {
    const types = typesFor('js:brand', answers, ctx);
    const name = pascal(String(answers.name));
    if (!name) fail('js:brand --name: needs a name, e.g. --name=UserId');
    const underlying = String(answers.underlying);
    if (!(underlying in CHECKS)) fail(`js:brand --underlying: expected string, number or bigint, got "${underlying}"`);
    const factory = camel(name);
    const module = kebab(String(answers.name));
    const valid = { string: "'a'", number: '1', bigint: '1n' }[underlying]!;
    const never = (v: string) => (types === 'ts' ? `${v} as never` : types === 'jsdoc' ? `/** @type {never} */ (${v})` : v);
    const invalid = underlying === 'number' ? 'Number.NaN' : never(underlying === 'string' ? '1' : "'a'");
    return [
      { add: `${module}${ext(types)}`, template: brandSource(types, name, factory, underlying) },
      ...(answers.withTest
        ? [
            testAction('js:brand', answers, ctx, types, {
              module,
              imports: [factory, `is${name}`],
              describe: name,
              tests: [
                { name: 'keeps valid values', body: (a) => [a.equal(`${factory}(${valid})`, valid), a.ok(`is${name}(${valid})`)] },
                { name: 'rejects invalid values', body: (a) => [a.throws(`() => ${factory}(${invalid})`, 'TypeError')] },
              ],
            }),
          ]
        : []),
    ];
  },
};

export default brandGenerator;
