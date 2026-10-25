/** `--events=change:{value:number},close`: a typed event map, an `emit()` helper and typed `addEventListener` overloads. */
import { formatType, key, parseNamed } from './common.ts';
import type { Types } from './style.ts';

export interface EventSpec {
  name: string;
  detail: string | null;
}

export const parseEvents = (text: string, param: string): EventSpec[] =>
  parseNamed(text, param, /^[a-z][a-z0-9:-]*$/).map(({ name, type }) => ({ name, detail: type && formatType(type) }));

const entry = (e: EventSpec): string => `${key(e.name)}: CustomEvent<${e.detail ?? 'void'}>;`;

/** The event map type: an interface, or a JSDoc typedef; nothing for plain JavaScript. */
export function eventMap(types: Types, map: string, events: EventSpec[]): string | null {
  if (types === 'ts') return [`export interface ${map} {`, ...events.map((e) => `  ${entry(e)}`), '}'].join('\n');
  if (types === 'jsdoc') return ['/**', ' * @typedef {{', ...events.map((e) => ` *   ${entry(e)}`), ` * }} ${map}`, ' */'].join('\n');
  return null;
}

/**
 * Class members, indented for a class body: `emit()`, and – with types –
 * `addEventListener` overloads, so listeners get the event's detail type.
 */
export function eventMembers(types: Types, cls: string, map: string, bubbles: boolean): string[] {
  const init = bubbles ? '{ detail, bubbles: true, composed: true }' : '{ detail }';
  const dispatch = `return this.dispatchEvent(new CustomEvent(type, ${init}));`;
  const options = 'boolean | AddEventListenerOptions';
  // An event without a detail takes none: emit('close'), not emit('close', undefined).
  const args = `${map}[K]['detail'] extends void ? [] : [${map}[K]['detail']]`;
  if (types === 'ts') {
    return [
      `  emit<K extends keyof ${map}>(type: K, ...[detail]: ${args}): boolean {
    ${dispatch}
  }`,
      `  override addEventListener<K extends keyof ${map}>(type: K, listener: (this: ${cls}, event: ${map}[K]) => unknown, options?: ${options}): void;
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: ${options}): void;
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: ${options}): void {
    super.addEventListener(type, listener, options);
  }`,
    ];
  }
  const emit = `  emit(type, ...args) {
    const [detail] = args;
    ${dispatch}
  }`;
  if (types === 'none') return [emit];
  return [
    `  /**
   * @template {keyof ${map}} K
   * @param {K} type
   * @param {${args}} args
   * @returns {boolean}
   */
${emit}`,
    `  /**
   * @template {keyof ${map}} K
   * @overload
   * @param {K} type
   * @param {(this: ${cls}, event: ${map}[K]) => unknown} listener
   * @param {${options}} [options]
   * @returns {void}
   */
  /**
   * @overload
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} listener
   * @param {${options}} [options]
   * @returns {void}
   */
  /**
   * @override
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} listener
   * @param {${options}} [options]
   */
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
  }`,
  ];
}
