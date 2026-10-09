/** `js:emitter`: an `EventTarget` with a typed event map – the platform's own event emitter. */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { type EventSpec, eventMap, eventMembers, parseEvents } from './events.ts';
import { TYPES_PARAM, type Types, ext, source, typesFor } from './style.ts';
import { WITH_TEST_PARAMS, sample, testAction } from './testing.ts';

export function emitterSource(types: Types, cls: string, events: EventSpec[]): string {
  const map = `${cls}EventMap`;
  const parts = [eventMap(types, map, events), `export class ${cls} extends EventTarget {\n${eventMembers(types, cls, map, false).join('\n\n')}\n}`];
  return source(types, `${parts.filter(Boolean).join('\n\n')}\n`);
}

const emitterGenerator: Generator = {
  description: 'create an EventTarget subclass with a typed event map',
  params: {
    name: {},
    events: {},
    ...WITH_TEST_PARAMS,
    ...TYPES_PARAM,
  },
  actions: (answers, { pascal, camel, kebab }, ctx) => {
    const types = typesFor('js:emitter', answers, ctx);
    const cls = pascal(String(answers.name));
    if (!cls) fail('js:emitter --name: needs a name, e.g. --name=Store');
    const events = parseEvents(String(answers.events), 'js:emitter --events');
    if (!events.length) fail('js:emitter --events: needs at least one event, e.g. --events=change:{value:number}');
    const module = kebab(String(answers.name));
    const instance = camel(cls);
    const [first] = events;
    const detail = first.detail ? sample(first.detail, types) : null;
    const declare = !detail ? 'let fired = 0;' : types === 'ts' ? 'let detail: unknown;' : types === 'jsdoc' ? '/** @type {unknown} */\nlet detail;' : 'let detail;';
    return [
      { add: `${module}${ext(types)}`, template: emitterSource(types, cls, events) },
      ...(answers.withTest
        ? [
            testAction('js:emitter', answers, ctx, types, {
              module,
              imports: [cls],
              describe: cls,
              tests: [
                {
                  name: detail ? `delivers ${first.name} with its detail` : `delivers ${first.name}`,
                  body: (a) => [
                    `const ${instance} = new ${cls}();`,
                    ...declare.split('\n'),
                    detail ? `${instance}.addEventListener('${first.name}', (event) => {` : `${instance}.addEventListener('${first.name}', () => {`,
                    detail ? '  detail = event.detail;' : '  fired++;',
                    '});',
                    `${instance}.emit('${first.name}'${detail ? `, ${detail}` : ''});`,
                    detail ? a.deepEqual('detail', detail) : a.equal('fired', '1'),
                  ],
                },
              ],
            }),
          ]
        : []),
    ];
  },
};

export default emitterGenerator;
