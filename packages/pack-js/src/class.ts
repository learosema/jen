/** `js:class`: a class with `#private` fields, getters, a static `create()`, and `Symbol.dispose` with `--disposable`. */
import type { Generator } from '@codejen/jen';
import { type Named, fail, formatType, parseNamed } from './common.ts';
import { TYPES_PARAM, type Types, ext, pick, typesFor } from './style.ts';
import { type Assert, WITH_TEST_PARAMS, sample, testAction } from './testing.ts';

export function classSource(types: Types, cls: string, fields: Named[], disposable: boolean): string {
  const options = `${cls}Options`;
  const typed = fields.map((f) => ({ name: f.name, type: formatType(f.type ?? 'unknown') }));
  const names = typed.map((f) => f.name).join(', ');
  const assign = typed.map((f) => `    this.#${f.name} = ${f.name};`);

  const ts = () => {
    const members = [
      [...typed.map((f) => `  #${f.name}: ${f.type};`), ...(disposable ? ['  #disposed = false;'] : [])].join('\n'),
      typed.length ? [`  constructor({ ${names} }: ${options}) {`, ...assign, '  }'].join('\n') : null,
      typed.length
        ? `  static create(options: ${options}): ${cls} {\n    return new ${cls}(options);\n  }`
        : `  static create(): ${cls} {\n    return new ${cls}();\n  }`,
      ...typed.map((f) => `  get ${f.name}(): ${f.type} {\n    return this.#${f.name};\n  }`),
      ...(disposable
        ? [
            '  get disposed(): boolean {\n    return this.#disposed;\n  }',
            '  [Symbol.dispose](): void {\n    if (this.#disposed) return;\n    this.#disposed = true;\n  }',
          ]
        : []),
    ].filter(Boolean);
    const optionsType = typed.length ? `export interface ${options} {\n${typed.map((f) => `  ${f.name}: ${f.type};`).join('\n')}\n}\n\n` : '';
    return `${optionsType}export class ${cls}${disposable ? ' implements Disposable' : ''} {\n${members.join('\n\n')}\n}\n`;
  };

  const jsdoc = () => {
    const members = [
      [...typed.map((f) => `  /** @type {${f.type}} */\n  #${f.name};`), ...(disposable ? ['  #disposed = false;'] : [])].join('\n'),
      typed.length ? [`  /** @param {${options}} options */`, `  constructor({ ${names} }) {`, ...assign, '  }'].join('\n') : null,
      typed.length
        ? `  /**\n   * @param {${options}} options\n   * @returns {${cls}}\n   */\n  static create(options) {\n    return new ${cls}(options);\n  }`
        : `  /** @returns {${cls}} */\n  static create() {\n    return new ${cls}();\n  }`,
      ...typed.map((f) => `  get ${f.name}() {\n    return this.#${f.name};\n  }`),
      ...(disposable ? ['  get disposed() {\n    return this.#disposed;\n  }', '  [Symbol.dispose]() {\n    if (this.#disposed) return;\n    this.#disposed = true;\n  }'] : []),
    ].filter(Boolean);
    const optionsType = typed.length ? `/**\n * @typedef {object} ${options}\n${typed.map((f) => ` * @property {${f.type}} ${f.name}`).join('\n')}\n */\n\n` : '';
    return `${optionsType}${disposable ? '/** @implements {Disposable} */\n' : ''}export class ${cls} {\n${members.join('\n\n')}\n}\n`;
  };

  return pick(types, ts, jsdoc);
}

const PRIMITIVE = /^(string|number|boolean|bigint)$/;

const classGenerator: Generator = {
  description: 'create a class with #private fields, getters and a static create() (--disposable adds Symbol.dispose)',
  params: {
    name: {},
    fields: { default: '' },
    disposable: { default: false },
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  actions: (answers, { pascal, kebab, camel }, ctx) => {
    const types = typesFor('js:class', answers, ctx);
    const cls = pascal(String(answers.name));
    if (!cls) fail('js:class --name: needs a name, e.g. --name=Timer');
    const fields = parseNamed(String(answers.fields), 'js:class --fields', /^[A-Za-z_$][\w$]*$/);
    const module = kebab(String(answers.name));
    const disposable = Boolean(answers.disposable);
    const instance = camel(cls);
    const options = fields.length ? `{ ${fields.map((f) => `${f.name}: ${sample(f.type, types)}`).join(', ')} }` : '';
    return [
      { add: `${module}${ext(types)}`, template: classSource(types, cls, fields, disposable) },
      ...(answers.withTest
        ? [
            testAction('js:class', answers, ctx, types, {
              module,
              imports: [cls],
              describe: cls,
              tests: [
                {
                  name: 'is made by create()',
                  body: (a) => [
                    `const ${instance} = ${cls}.create(${options});`,
                    a.ok(`${instance} instanceof ${cls}`),
                    ...fields.filter((f) => PRIMITIVE.test(f.type ?? '')).map((f) => a.equal(`${instance}.${f.name}`, sample(f.type, types))),
                  ],
                },
                ...(disposable
                  ? [
                      {
                        name: 'can be disposed more than once',
                        body: (a: Assert) => [
                          `const ${instance} = ${cls}.create(${options});`,
                          `${instance}[Symbol.dispose]();`,
                          `${instance}[Symbol.dispose]();`,
                          a.equal(`${instance}.disposed`, 'true'),
                        ],
                      },
                    ]
                  : []),
              ],
            }),
          ]
        : []),
    ];
  },
};

export default classGenerator;
