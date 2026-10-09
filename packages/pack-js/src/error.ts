/** `js:error`: an `Error` subclass with its own name, extra fields, and `cause`. */
import type { Generator } from '@codejen/jen';
import { type Named, fail, formatType, parseNamed } from './common.ts';
import { TYPES_PARAM, type Types, ext, pick, typesFor } from './style.ts';
import { WITH_TEST_PARAMS, sample, testAction } from './testing.ts';

export function errorSource(types: Types, cls: string, fields: Named[]): string {
  const options = `${cls}Options`;
  const typed = fields.map((f) => ({ name: f.name, type: formatType(f.type ?? 'unknown') }));
  const names = typed.map((f) => f.name).join(', ');
  const assign = typed.map((f) => `    this.${f.name} = ${f.name};`);
  const ts = () => {
    const optionsType = typed.length ? `export interface ${options} extends ErrorOptions {\n${typed.map((f) => `  ${f.name}: ${f.type};`).join('\n')}\n}\n\n` : '';
    const members = [
      [`  override name = '${cls}';`, ...typed.map((f) => `  readonly ${f.name}: ${f.type};`)].join('\n'),
      ...(typed.length ? [[`  constructor(message: string, { ${names}, ...options }: ${options}) {`, '    super(message, options);', ...assign, '  }'].join('\n')] : []),
    ];
    return `${optionsType}export class ${cls} extends Error {\n${members.join('\n\n')}\n}\n`;
  };
  const jsdoc = () => {
    const optionsType = typed.length ? `/** @typedef {ErrorOptions & { ${typed.map((f) => `${f.name}: ${f.type}`).join(', ')} }} ${options} */\n\n` : '';
    const members = [
      [`  /** @override */`, `  name = '${cls}';`, ...typed.map((f) => `  /** @readonly @type {${f.type}} */\n  ${f.name};`)].join('\n'),
      ...(typed.length
        ? [
            [
              '  /**',
              '   * @param {string} message',
              `   * @param {${options}} options`,
              '   */',
              `  constructor(message, { ${names}, ...options }) {`,
              '    super(message, options);',
              ...assign,
              '  }',
            ].join('\n'),
          ]
        : []),
    ];
    return `${optionsType}export class ${cls} extends Error {\n${members.join('\n\n')}\n}\n`;
  };
  return pick(types, ts, jsdoc);
}

const errorGenerator: Generator = {
  description: 'create an Error subclass with its own name, extra fields and cause',
  params: {
    name: {},
    fields: { default: '' },
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  actions: (answers, { pascal, kebab }, ctx) => {
    const types = typesFor('js:error', answers, ctx);
    const base = pascal(String(answers.name));
    if (!base) fail('js:error --name: needs a name, e.g. --name=NotFound');
    const cls = base.endsWith('Error') ? base : `${base}Error`;
    const fields = parseNamed(String(answers.fields), 'js:error --fields', /^[A-Za-z_$][\w$]*$/);
    if (fields.some((f) => ['name', 'message', 'cause', 'stack'].includes(f.name))) fail('js:error --fields: name, message, cause and stack are already on every Error');
    const module = kebab(cls);
    const options = `{ ${[...fields.map((f) => `${f.name}: ${sample(f.type, types)}`), 'cause'].join(', ')} }`;
    return [
      { add: `${module}${ext(types)}`, template: errorSource(types, cls, fields) },
      ...(answers.withTest
        ? [
            testAction('js:error', answers, ctx, types, {
              module,
              imports: [cls],
              describe: cls,
              tests: [
                {
                  name: 'is an Error with its own name and a cause',
                  body: (a) => [
                    "const cause = new Error('cause');",
                    `const error = new ${cls}('message', ${options});`,
                    a.ok('error instanceof Error'),
                    a.equal('error.name', `'${cls}'`),
                    a.equal('error.cause', 'cause'),
                  ],
                },
              ],
            }),
          ]
        : []),
    ];
  },
};

export default errorGenerator;
