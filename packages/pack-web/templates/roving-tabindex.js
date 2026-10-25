// @ts-check
// Roving tabindex after the ARIA Authoring Practices Guide by the W3C: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
// Native focusgroup where the browser has it, detected by property after Jeremy Keith: https://adactio.com/journal/22445

/** @typedef {'horizontal' | 'vertical' | 'both'} Orientation */

/**
 * @typedef {object} RovingOptions
 * @property {string} [items]
 * @property {Orientation} [orientation]
 * @property {boolean} [wrap]
 * @property {(item: HTMLElement) => void} [onChange]
 * @property {AbortSignal} [signal]
 */

/** @type {Record<string, string>} */
const ITEMS = {
  tablist: '[role="tab"]',
  radiogroup: '[role="radio"]',
  listbox: '[role="option"]',
  menubar: '[role^="menuitem"]',
};

/** @type {Record<string, Orientation>} */
const ORIENTATION = {
  tablist: 'horizontal',
  toolbar: 'horizontal',
  menubar: 'horizontal',
  listbox: 'vertical',
  radiogroup: 'both',
};

// The focusgroup behaviors; any other role moves like a toolbar.
const BEHAVIORS = ['toolbar', 'tablist', 'radiogroup', 'listbox', 'menu', 'menubar'];

/** @type {Record<Orientation, string>} */
const AXIS = { horizontal: 'inline', vertical: 'block', both: '' };

// Roles whose selection follows focus, and the state their items carry.
/** @type {Record<string, string>} */
const SELECTED = {
  tablist: 'aria-selected',
  radiogroup: 'aria-checked',
  listbox: 'aria-selected',
};

/**
 * @param {HTMLElement} root
 * @param {RovingOptions} [options]
 * @returns {() => void}
 */
export function rovingTabindex(root, options = {}) {
  const role = root.getAttribute('role') ?? '';
  const selector = options.items ?? ITEMS[role] ?? 'button, [role="button"], a[href], input, select';
  const orientation = options.orientation ?? /** @type {Orientation | null} */ (root.getAttribute('aria-orientation')) ?? ORIENTATION[role] ?? 'both';
  const wrap = options.wrap ?? true;
  const state = SELECTED[role];
  // the browser moves focus and keeps one tab stop itself; selection stays ours (Chrome reflects the attribute as focusGroup)
  const native = 'focusGroup' in HTMLElement.prototype || 'focusgroup' in HTMLElement.prototype;
  const added = native && !root.hasAttribute('focusgroup');
  if (added) {
    const behavior = BEHAVIORS.includes(role) ? role : 'toolbar';
    root.setAttribute('focusgroup', [behavior, AXIS[orientation], wrap ? 'wrap' : 'nowrap'].filter(Boolean).join(' '));
  }
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const { signal } = controller;

  /** @returns {HTMLElement[]} */
  const items = () => [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(selector))].filter((item) => !item.hidden && !item.matches(':disabled'));
  /** @param {EventTarget | null} target */
  const itemOf = (target) => items().find((item) => item.contains(/** @type {Node} */ (target)));

  /** @type {HTMLElement | undefined} */
  let current;

  /** @param {HTMLElement} next */
  function select(next) {
    current = next;
    for (const item of items()) {
      // focusgroup skips items with a negative tabindex; tabbing in lands on focusgroupstart
      item.tabIndex = item === current || native ? 0 : -1;
      if (native) item.toggleAttribute('focusgroupstart', item === current);
      if (state) item.setAttribute(state, String(item === current));
      const panel = role === 'tablist' ? document.getElementById(item.getAttribute('aria-controls') ?? '') : null;
      if (panel) panel.hidden = item !== current;
    }
  }

  /**
   * @param {string} key
   * @param {number} index
   * @param {number} count
   * @returns {number | null}
   */
  function step(key, index, count) {
    const rtl = getComputedStyle(root).direction === 'rtl';
    const horizontal = orientation !== 'vertical';
    const vertical = orientation !== 'horizontal';
    const forward = (horizontal && key === (rtl ? 'ArrowLeft' : 'ArrowRight')) || (vertical && key === 'ArrowDown');
    const back = (horizontal && key === (rtl ? 'ArrowRight' : 'ArrowLeft')) || (vertical && key === 'ArrowUp');
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    if (forward) return index + 1 < count ? index + 1 : wrap ? 0 : index;
    if (back) return index > 0 ? index - 1 : wrap ? count - 1 : index;
    return null;
  }

  if (!native) {
    root.addEventListener(
      'keydown',
      (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const list = items();
        const item = itemOf(event.target);
        const next = item ? step(event.key, list.indexOf(item), list.length) : null;
        if (next === null) return;
        event.preventDefault();
        list[next].focus();
      },
      { signal },
    );
  }

  root.addEventListener(
    'focusin',
    (event) => {
      const item = itemOf(event.target);
      if (!item || item === current) return;
      select(item);
      options.onChange?.(item);
    },
    { signal },
  );

  const list = items();
  const initial = (state && list.find((item) => item.getAttribute(state) === 'true')) || list.find((item) => item.getAttribute('tabindex') === '0') || list[0];
  if (initial) select(initial);
  return () => {
    controller.abort();
    if (added) root.removeAttribute('focusgroup');
  };
}
