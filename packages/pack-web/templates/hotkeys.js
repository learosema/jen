// @ts-check
// Keyboard shortcuts after the ARIA Authoring Practices Guide by the W3C: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#keyboardshortcuts

/**
 * @typedef {object} HotkeyOptions
 * @property {string} [description]
 * @property {Element} [scope]
 * @property {boolean} [inputs]
 */

/** @typedef {HotkeyOptions & { keys: string, handler: (event: KeyboardEvent) => void }} Hotkey */

/**
 * @typedef {object} HotkeysOptions
 * @property {boolean} [help]
 */

/** @typedef {{ key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean }} Combo */

/** @typedef {Hotkey & { combo: Combo }} Binding */

const MODIFIERS = ['ctrl', 'control', 'alt', 'option', 'shift', 'meta', 'cmd', 'mod'];

/** @type {Record<string, string>} */
const ALIASES = {
  esc: 'escape',
  space: ' ',
  plus: '+',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
};

const TYPING = 'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="range"], [type="color"]), textarea, select';

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

// "mod+k" → the keys to match; `mod` is ⌘ on Apple devices and Ctrl elsewhere.
/**
 * @param {string} keys
 * @returns {Combo}
 */
export function parseCombo(keys) {
  const parts = keys.toLowerCase().split('+').map((part) => part.trim());
  const key = parts.pop() ?? '';
  for (const part of parts) if (!MODIFIERS.includes(part)) throw new Error(`hotkeys: unknown modifier "${part}" in "${keys}"`);
  /** @param {string[]} names */
  const has = (...names) => names.some((name) => parts.includes(name));
  const mac = isMac();
  return {
    key: ALIASES[key] ?? key,
    ctrl: has('ctrl', 'control') || (!mac && has('mod')),
    meta: has('meta', 'cmd') || (mac && has('mod')),
    alt: has('alt', 'option'),
    shift: has('shift'),
  };
}

/**
 * @param {Combo} combo
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function matches(combo, event) {
  const key = event.key.toLowerCase();
  // Alt changes event.key on macOS (Option+K types "˚"), so letters and digits also match by their physical key.
  const sameKey =
    key === combo.key ||
    (/^[a-z]$/.test(combo.key) && event.code === `Key${combo.key.toUpperCase()}`) ||
    (/^[0-9]$/.test(combo.key) && event.code === `Digit${combo.key}`);
  // A symbol like "?" already implies the Shift it needs on the user's keyboard layout.
  const symbol = combo.key.length === 1 && !/[a-z0-9 ]/.test(combo.key);
  return sameKey && event.ctrlKey === combo.ctrl && event.metaKey === combo.meta && event.altKey === combo.alt && (symbol || event.shiftKey === combo.shift);
}

/** @param {EventTarget | null} target */
const typing = (target) => target instanceof HTMLElement && (target.isContentEditable || target.matches(TYPING));

// "mod+shift+k" → ["⌘", "Shift", "k"], for showing a shortcut.
/**
 * @param {string} keys
 * @returns {string[]}
 */
export function keyLabels(keys) {
  const mac = isMac();
  /** @type {Record<string, string>} */
  const names = { mod: mac ? '⌘' : 'Ctrl', cmd: '⌘', meta: mac ? '⌘' : 'Meta', ctrl: 'Ctrl', control: 'Ctrl', alt: mac ? '⌥' : 'Alt', option: '⌥', shift: 'Shift', esc: 'Esc', space: 'Space' };
  return keys.split('+').map((part) => {
    const name = part.trim();
    return names[name.toLowerCase()] ?? (name.length === 1 ? name : name.charAt(0).toUpperCase() + name.slice(1));
  });
}

/** @param {HotkeysOptions} [options] */
export function createHotkeys(options = {}) {
  /** @type {Binding[]} */
  const bindings = [];

  /** @param {KeyboardEvent} event */
  const onKeydown = (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const target = /** @type {Node | null} */ (event.target);
    const candidates = bindings.filter((b) => matches(b.combo, event) && (b.inputs || !typing(event.target)) && (!b.scope || b.scope.contains(target)));
    // Scoped bindings win over global ones.
    const hit = candidates.find((b) => b.scope) ?? candidates[0];
    if (!hit) return;
    event.preventDefault();
    hit.handler(event);
  };
  document.addEventListener('keydown', onKeydown);

  const hotkeys = {
    /**
     * @param {string} keys
     * @param {(event: KeyboardEvent) => void} handler
     * @param {HotkeyOptions} [bindOptions]
     * @returns {() => void}
     */
    bind(keys, handler, bindOptions = {}) {
      /** @type {Binding} */
      const binding = { ...bindOptions, keys, handler, combo: parseCombo(keys) };
      bindings.push(binding);
      return () => {
        const index = bindings.indexOf(binding);
        if (index >= 0) bindings.splice(index, 1);
      };
    },
    /** @returns {readonly Hotkey[]} */
    get bindings() {
      return bindings.map(({ combo: _combo, ...hotkey }) => hotkey);
    },
    showHelp() {
      if (document.querySelector('dialog.hotkeys-help[open]')) return;
      helpDialog(hotkeys.bindings).showModal();
    },
    dispose() {
      document.removeEventListener('keydown', onKeydown);
      bindings.length = 0;
    },
  };
  if (options.help) hotkeys.bind('?', () => hotkeys.showHelp(), { description: 'Show keyboard shortcuts' });
  return hotkeys;
}

/** @typedef {ReturnType<typeof createHotkeys>} Hotkeys */

/**
 * @param {readonly Hotkey[]} hotkeys
 * @returns {HTMLDialogElement}
 */
function helpDialog(hotkeys) {
  const dialog = document.createElement('dialog');
  dialog.className = 'hotkeys-help';
  dialog.setAttribute('closedby', 'any');
  dialog.setAttribute('aria-labelledby', 'hotkeys-help-title');
  const title = document.createElement('h2');
  title.id = 'hotkeys-help-title';
  title.textContent = 'Keyboard shortcuts';
  const list = document.createElement('dl');
  for (const { keys, description } of hotkeys) {
    if (!description) continue;
    const term = document.createElement('dt');
    for (const label of keyLabels(keys)) term.append(Object.assign(document.createElement('kbd'), { textContent: label }));
    list.append(term, Object.assign(document.createElement('dd'), { textContent: description }));
  }
  const form = document.createElement('form');
  form.method = 'dialog';
  form.append(Object.assign(document.createElement('button'), { textContent: 'Close' }));
  dialog.append(title, list, form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  return dialog;
}
