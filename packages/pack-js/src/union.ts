/** `js:union`: a tagged union, and a `match` function whose `switch` is checked for exhaustiveness via `never`. */
import type { Generator } from '@codejen/jen';
import { type Named, fail, formatType, objectFields, parseNamed } from './common.ts';
import { TYPES_PARAM, type Types, ext, pick, typesFor } from './style.ts';
import { WITH_TEST_PARAMS, sample, testAction } from './testing.ts';

export interface Case {
  kind: string;
  type: string;
  fields: Named[];
}

export function unionSource(types: Types, name: string, value: string, cases: Case[]): string {
  const handlers = `${name}Handlers`;
  const switchBody = [
    `  switch (${value}.kind) {`,
    ...cases.flatMap((c) => [`    case '${c.kind}':`, `      return handlers.${c.kind}(${value});`]),
    '    default:',
    `      return assertNever(${value});`,
    '  }',
  ].join('\n');
  const throwNever = "  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);";

  const ts = () => {
    const interfaces = cases.map((c) => [`export interface ${c.type} {`, `  kind: '${c.kind}';`, ...c.fields.map((f) => `  ${f.name}: ${f.type};`), '}'].join('\n'));
    return `${interfaces.join('\n\n')}

export type ${name} = ${cases.map((c) => c.type).join(' | ')};

export interface ${handlers}<R> {
${cases.map((c) => `  ${c.kind}: (${value}: ${c.type}) => R;`).join('\n')}
}

export function match${name}<R>(${value}: ${name}, handlers: ${handlers}<R>): R {
${switchBody}
}

function assertNever(value: never): never {
${throwNever}
}
`;
  };

  const jsdoc = () => {
    const typedefs = cases.map((c) => `/** @typedef {{ ${[`kind: '${c.kind}'`, ...c.fields.map((f) => `${f.name}: ${f.type}`)].join(', ')} }} ${c.type} */`);
    return `${typedefs.join('\n')}

/** @typedef {${cases.map((c) => c.type).join(' | ')}} ${name} */

/**
 * @template R
 * @typedef {{
${cases.map((c) => ` *   ${c.kind}: (${value}: ${c.type}) => R;`).join('\n')}
 * }} ${handlers}
 */

/**
 * @template R
 * @param {${name}} ${value}
 * @param {${handlers}<R>} handlers
 * @returns {R}
 */
export function match${name}(${value}, handlers) {
${switchBody}
}

/**
 * @param {never} value
 * @returns {never}
 */
function assertNever(value) {
${throwNever}
}
`;
  };

  return pick(types, ts, jsdoc);
}

const unionGenerator: Generator = {
  description: 'create a tagged union type with an exhaustively checked match function',
  params: {
    name: {},
    cases: {},
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  actions: (answers, { pascal, camel, kebab }, ctx) => {
    const types = typesFor('js:union', answers, ctx);
    const name = pascal(String(answers.name));
    if (!name) fail('js:union --name: needs a name, e.g. --name=Shape');
    const cases = parseNamed(String(answers.cases), 'js:union --cases', /^[a-z][A-Za-z0-9]*$/).map(({ name: kind, type }): Case => {
      const fields = type === null ? [] : objectFields(type);
      if (!fields) fail(`js:union --cases: ${kind} has "${type}" – a case's fields go in braces, e.g. ${kind}:{radius:number}`);
      return { kind, type: pascal(kind), fields: fields.map((f) => ({ name: f.name, type: formatType(f.type ?? 'unknown') })) };
    });
    if (cases.length < 2) fail('js:union --cases: needs at least two cases, e.g. --cases=circle:{radius:number},square:{size:number}');
    if (cases.some((c) => c.type === name)) fail(`js:union --cases: a case can't be named like the union itself (${name})`);
    const value = camel(name);
    const module = kebab(String(answers.name));
    const object = (c: Case) => `{ ${[`kind: '${c.kind}'`, ...c.fields.map((f) => `${f.name}: ${sample(f.type, types)}`)].join(', ')} }`;
    const handlers = `{ ${cases.map((c) => `${c.kind}: () => '${c.kind}'`).join(', ')} }`;
    return [
      { add: `${module}${ext(types)}`, template: unionSource(types, name, value, cases) },
      ...(answers.withTest
        ? [
            testAction('js:union', answers, ctx, types, {
              module,
              imports: [`match${name}`],
              describe: name,
              tests: [{ name: 'matches every case', body: (a) => cases.map((c) => a.equal(`match${name}(${object(c)}, ${handlers})`, `'${c.kind}'`)) }],
            }),
          ]
        : []),
    ];
  },
};

export default unionGenerator;
