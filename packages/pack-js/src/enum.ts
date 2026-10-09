/** `js:enum`: an `as const` object, the union type of its values, and a type guard – instead of TypeScript's `enum`, which isn't erasable. */
import type { Generator } from '@codejen/jen';
import { fail, parseNamed } from './common.ts';
import { TYPES_PARAM, type Types, ext, pick, typesFor } from './style.ts';
import { WITH_TEST_PARAMS, testAction } from './testing.ts';

export function enumSource(types: Types, name: string, entries: { key: string; value: string }[]): string {
  const body = entries.map((e) => `  ${e.key}: '${e.value}',`).join('\n');
  const ts = () => `export const ${name} = {
${body}
} as const;

export type ${name} = (typeof ${name})[keyof typeof ${name}];

export function is${name}(value: unknown): value is ${name} {
  return Object.values(${name}).includes(value as ${name});
}
`;
  const jsdoc = () => `export const ${name} = /** @type {const} */ ({
${body}
});

/** @typedef {(typeof ${name})[keyof typeof ${name}]} ${name} */

/**
 * @param {unknown} value
 * @returns {value is ${name}}
 */
export function is${name}(value) {
  return Object.values(${name}).includes(/** @type {${name}} */ (value));
}
`;
  return pick(types, ts, jsdoc);
}

const enumGenerator: Generator = {
  description: 'create an enum as an `as const` object with its union type and a type guard',
  params: {
    name: {},
    values: {},
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  actions: (answers, { pascal, kebab }, ctx) => {
    const types = typesFor('js:enum', answers, ctx);
    const name = pascal(String(answers.name));
    if (!name) fail('js:enum --name: needs a name, e.g. --name=Direction');
    const values = parseNamed(String(answers.values), 'js:enum --values', /^[A-Za-z][\w-]*$/).map((v) => v.name);
    if (!values.length) fail('js:enum --values: needs at least one value, e.g. --values=up,down');
    const entries = values.map((value) => ({ key: pascal(value), value }));
    const module = kebab(String(answers.name));
    const [first] = entries;
    return [
      { add: `${module}${ext(types)}`, template: enumSource(types, name, entries) },
      ...(answers.withTest
        ? [
            testAction('js:enum', answers, ctx, types, {
              module,
              imports: [name, `is${name}`],
              describe: name,
              tests: [
                { name: 'maps names to values', body: (a) => entries.map((e) => a.equal(`${name}.${e.key}`, `'${e.value}'`)) },
                { name: 'recognizes its values', body: (a) => [a.ok(`is${name}('${first.value}')`), a.ok(`!is${name}('${first.value}-not')`)] },
              ],
            }),
          ]
        : []),
    ];
  },
};

export default enumGenerator;
