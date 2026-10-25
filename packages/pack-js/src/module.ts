/** `js:module`: a module exporting a function of the same name, to fill in. */
import type { Generator } from '@codejen/jen';
import { ext, pick, testAction, TYPES_PARAM, typesFor, WITH_TEST_PARAMS } from '@codejen/jen/js';
import { fail } from './common.ts';

const moduleGenerator: Generator = {
  description: 'create a module exporting a function of the same name',
  params: {
    name: { description: 'any case: format-date makes formatDate() in format-date.ts' },
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  examples: ['--name=format-date --withTest'],
  actions: (answers, { camel, kebab }, ctx) => {
    const types = typesFor('js:module', answers, ctx);
    const fn = camel(String(answers.name));
    if (!fn) fail('js:module --name: needs a name, e.g. --name=format-date');
    const module = kebab(String(answers.name));
    const body = `  throw new Error('${fn}: not implemented yet');`;
    const text = pick(
      types,
      () => `export function ${fn}(): void {\n${body}\n}\n`,
      () => `/** @returns {void} */\nexport function ${fn}() {\n${body}\n}\n`,
    );
    return [
      { add: `${module}${ext(types)}`, template: text },
      ...(answers.withTest
        ? [testAction('js:module', answers, ctx, types, { module, imports: [fn], describe: fn, tests: [{ name: 'is a function', body: (a) => [a.equal(`typeof ${fn}`, "'function'")] }] })]
        : []),
    ];
  },
};

export default moduleGenerator;
