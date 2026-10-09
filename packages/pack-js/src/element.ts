/** `js:element`: a custom element with typed, reflected attributes, typed events, shadow DOM and form association. */
import { posix } from 'node:path';
import type { Action, Context, Generator, Helpers } from '@codejen/jen';
import { fail, parseNamed } from './common.ts';
import { type EventSpec, eventMap, eventMembers, parseEvents } from './events.ts';
import { TYPES_PARAM, type Types, ext, importExt, source, typesFor } from './style.ts';
import { template } from './templates.ts';
import { wireInto } from './wire.ts';

type AttrType = 'string' | 'number' | 'boolean';

interface Attr {
  name: string;
  prop: string;
  type: AttrType;
}

export type Shadow = 'open' | 'closed' | 'none';

export interface ElementSpec {
  tag: string;
  cls: string;
  attrs: Attr[];
  events: EventSpec[];
  shadow: Shadow;
  form: boolean;
}

/** Attributes every element already has: an accessor for one would clash with HTMLElement's own property. */
const BUILT_IN = new Set(
  'accesskey autocapitalize autofocus class contenteditable dir draggable enterkeyhint hidden id inert inputmode is lang nonce part popover role slot spellcheck style tabindex title translate'.split(' '),
);

export function elementSpec(answers: Record<string, unknown>, { pascal, camel }: Helpers): ElementSpec {
  const tag = String(answers.name);
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag)) fail(`js:element --name: "${tag}" is not a custom element name – lowercase, with a hyphen, e.g. my-counter`);
  const shadow = String(answers.shadow);
  if (shadow !== 'open' && shadow !== 'closed' && shadow !== 'none') fail(`js:element --shadow: expected open, closed or none, got "${shadow}"`);
  const attrs = parseNamed(String(answers.attrs), 'js:element --attrs', /^[a-z][a-z0-9-]*$/).map(({ name, type }): Attr => {
    if (BUILT_IN.has(name)) fail(`js:element --attrs: "${name}" is a built-in attribute of every element`);
    if (type !== null && type !== 'string' && type !== 'number' && type !== 'boolean') {
      fail(`js:element --attrs: ${name} is "${type}" – attributes are string, number or boolean`);
    }
    return { name, prop: camel(name), type: type ?? 'string' };
  });
  const form = Boolean(answers.form);
  if (form && !attrs.some((a) => a.name === 'value')) attrs.push({ name: 'value', prop: 'value', type: 'string' });
  return { tag, cls: pascal(tag), attrs, events: parseEvents(String(answers.events), 'js:element --events'), shadow, form };
}

const accessor = (types: Types, { name, prop, type }: Attr): string => {
  const ts = types === 'ts';
  const read = type === 'boolean' ? `this.hasAttribute('${name}')` : type === 'number' ? `Number(this.getAttribute('${name}') ?? 0)` : `this.getAttribute('${name}') ?? ''`;
  const write = type === 'boolean' ? `this.toggleAttribute('${name}', value);` : `this.setAttribute('${name}', ${type === 'number' ? 'String(value)' : 'value'});`;
  return [
    `  get ${prop}()${ts ? `: ${type}` : ''} {`,
    `    return ${read};`,
    '  }',
    '',
    ...(types === 'jsdoc' ? [`  /** @param {${type}} value */`] : []),
    `  set ${prop}(value${ts ? `: ${type}` : ''}) {`,
    `    ${write}`,
    '  }',
  ].join('\n');
};

const css = (spec: ElementSpec): string => {
  const host = spec.shadow === 'none' ? spec.tag : ':host';
  const hidden = spec.shadow === 'none' ? `${spec.tag}[hidden]` : ':host([hidden])';
  return `const sheet = new CSSStyleSheet();
sheet.replaceSync(\`
  ${host} {
    display: block;
  }

  ${hidden} {
    display: none;
  }
\`);`;
};

export function elementSource(types: Types, spec: ElementSpec): string {
  const { tag, cls, attrs, events, shadow, form } = spec;
  const ts = types === 'ts';
  const jsdoc = types === 'jsdoc';
  const map = `${cls}EventMap`;
  const attrType = `${cls}Attribute`;
  const names = attrs.map((a) => `'${a.name}'`).join(', ');
  const update = attrs.length > 0;
  const returns = ts ? ': void' : '';

  const fields: string[] = [];
  if (attrs.length) fields.push(ts ? `  static observedAttributes = [${names}] as const;` : jsdoc ? `  static observedAttributes = /** @type {const} */ ([${names}]);` : `  static observedAttributes = [${names}];`);
  if (form) fields.push('  static formAssociated = true;');
  const privates: string[] = [];
  if (shadow !== 'none') privates.push(`  #root = this.attachShadow({ mode: '${shadow}' });`);
  if (form) privates.push('  #internals = this.attachInternals();');

  const members: string[] = [fields.join('\n'), privates.join('\n')].filter(Boolean);
  if (shadow !== 'none') {
    members.push(`  constructor() {
    super();
    this.#root.adoptedStyleSheets = [sheet];
    this.#root.innerHTML = '<slot></slot>';
  }`);
  }

  const connected: string[] = [];
  if (shadow === 'none') {
    const root = ts ? '(this.getRootNode() as Document | ShadowRoot)' : jsdoc ? '/** @type {Document | ShadowRoot} */ (this.getRootNode())' : 'this.getRootNode()';
    connected.push(`    const root = ${root};`, '    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];');
  }
  if (update) connected.push('    this.#update();');
  if (connected.length) members.push([`  connectedCallback()${returns} {`, ...connected, '  }'].join('\n'));

  if (attrs.length) {
    const doc = jsdoc ? [`  /**`, `   * @param {${attrType}} _name`, '   * @param {string | null} oldValue', '   * @param {string | null} newValue', '   */'] : [];
    const params = ts ? `_name: ${attrType}, oldValue: string | null, newValue: string | null` : '_name, oldValue, newValue';
    members.push([...doc, `  attributeChangedCallback(${params})${returns} {`, '    if (oldValue !== newValue) this.#update();', '  }'].join('\n'));
    members.push(...attrs.map((a) => accessor(types, a)));
  }

  if (form) {
    const value = attrs.find((a) => a.name === 'value')!;
    members.push(
      `  get form()${ts ? ': HTMLFormElement | null' : ''} {
    return this.#internals.form;
  }`,
      `  get validity()${ts ? ': ValidityState' : ''} {
    return this.#internals.validity;
  }`,
      `  checkValidity()${ts ? ': boolean' : ''} {
    return this.#internals.checkValidity();
  }`,
      `  reportValidity()${ts ? ': boolean' : ''} {
    return this.#internals.reportValidity();
  }`,
    );
    members.push(`  #update()${returns} {
    this.#internals.setFormValue(${value.type === 'string' ? 'this.value' : 'String(this.value)'});
  }`);
  } else if (update) {
    members.push(`  #update()${returns} {}`);
  }

  if (events.length) members.push(...eventMembers(types, cls, map, true));

  const parts = [
    css(spec),
    events.length ? eventMap(types, map, events) : null,
    attrs.length && ts ? `type ${attrType} = (typeof ${cls}.observedAttributes)[number];` : null,
    attrs.length && jsdoc ? `/** @typedef {(typeof ${cls}.observedAttributes)[number]} ${attrType} */` : null,
    `export class ${cls} extends HTMLElement {\n${members.join('\n\n')}\n}`,
    `customElements.define('${tag}', ${cls});`,
    ts ? `declare global {\n  interface HTMLElementTagNameMap {\n    '${tag}': ${cls};\n  }\n}` : null,
  ];
  return source(types, `${parts.filter((p) => p !== null).join('\n\n')}\n`);
}

export const ELEMENTS_FILE = 'elements.d.ts';
export const ELEMENTS_MARKER = 'jen:elements';

/** The nearest elements.d.ts with the marker, in the destination or a folder above it, else the shallowest one; null if there is none. */
function findElements(ctx: Context): string | null {
  for (let dir = ctx.destDir; ; dir = posix.dirname(dir)) {
    const file = dir === '.' ? ELEMENTS_FILE : `${dir}/${ELEMENTS_FILE}`;
    if (ctx.read(file)?.includes(ELEMENTS_MARKER)) return file;
    if (dir === '.' || dir === '/' || dir === '') break;
  }
  return ctx.grep(ELEMENTS_FILE, ELEMENTS_MARKER)[0] ?? null;
}

/** JSDoc has no `declare global`: the tag goes into a global elements.d.ts instead, so `querySelector('my-counter')` knows its type. */
function tagMapActions(ctx: Context, spec: ElementSpec, file: string): Action[] {
  const existing = findElements(ctx);
  const target = existing ?? posix.join(ctx.destDir, ELEMENTS_FILE);
  let path = posix.relative(posix.dirname(target), posix.join(ctx.destDir, file));
  if (!path.startsWith('.')) path = `./${path}`;
  return [
    ...(existing ? [] : [{ add: ELEMENTS_FILE, template: template(ELEMENTS_FILE) }]),
    { insert: `/${target}`, before: ELEMENTS_MARKER, line: `'${spec.tag}': import('${path}').${spec.cls};` },
  ];
}

const elementGenerator: Generator = {
  description: 'create a custom element with typed attributes and events (--into loads it from a page or module)',
  params: {
    name: {},
    attrs: { default: '' },
    events: { default: '' },
    shadow: { default: 'none' },
    form: { default: false },
    into: { path: true, default: '' },
    ...TYPES_PARAM,
  },
  actions: (answers, helpers, ctx) => {
    const types = typesFor('js:element', answers, ctx);
    const spec = elementSpec(answers, helpers);
    const file = `${spec.tag}${ext(types)}`;
    const into = String(answers.into);
    return [
      { add: file, template: elementSource(types, spec) },
      ...(types === 'jsdoc' ? tagMapActions(ctx, spec, file) : []),
      ...(into ? wireInto(into, file, ctx, importExt(ctx, types), `<${spec.tag}></${spec.tag}>`) : []),
    ];
  },
};

export default elementGenerator;
