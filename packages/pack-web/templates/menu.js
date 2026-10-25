// @ts-check
// Menu and menubar keyboard interaction after the ARIA Authoring Practices Guide by the W3C: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/

/**
 * @typedef {object} MenuOptions
 * @property {'horizontal' | 'vertical'} [orientation]
 * @property {AbortSignal} [signal]
 */

const ITEMS = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';
const TYPEAHEAD_MS = 500;

/**
 * @param {HTMLElement} root
 * @param {MenuOptions} [options]
 * @returns {() => void}
 */
export function menu(root, options = {}) {
  const orientation = options.orientation ?? (root.getAttribute('role') === 'menubar' ? 'horizontal' : 'vertical');
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const { signal } = controller;
  /** @type {HTMLElement | null} */
  const trigger = root.popover && root.id ? document.querySelector(`[popovertarget="${CSS.escape(root.id)}"]`) : null;
  let typed = '';
  let typedAt = 0;
  let openAtEnd = false;

  // Items of this menu, not of a submenu inside it.
  /** @returns {HTMLElement[]} */
  const items = () =>
    [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(ITEMS))].filter((item) => !item.hidden && item.parentElement?.closest('[role="menu"], [role="menubar"]') === root);

  /** @param {HTMLElement | undefined} item */
  function focus(item) {
    if (!item) return;
    for (const other of items()) other.tabIndex = other === item ? 0 : -1;
    item.focus();
  }

  function close() {
    if (!root.matches(':popover-open')) return;
    root.hidePopover();
    trigger?.focus();
  }

  /**
   * @param {string} key
   * @param {number} index
   * @param {HTMLElement[]} list
   * @param {number} time
   */
  function typeahead(key, index, list, time) {
    typed = time - typedAt > TYPEAHEAD_MS ? key.toLowerCase() : typed + key.toLowerCase();
    typedAt = time;
    const start = typed.length === 1 ? index + 1 : Math.max(index, 0);
    const ordered = [...list.slice(start), ...list.slice(0, start)];
    focus(ordered.find((item) => item.textContent?.trim().toLowerCase().startsWith(typed)));
  }

  root.addEventListener(
    'keydown',
    (event) => {
      const list = items();
      const index = list.findIndex((item) => item.contains(/** @type {Node} */ (event.target)));
      const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const previous = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      if (event.key === 'Tab') return close();
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === next) focus(list[(index + 1) % list.length]);
      else if (event.key === previous) focus(list.at(index > 0 ? index - 1 : -1));
      else if (event.key === 'Home') focus(list[0]);
      else if (event.key === 'End') focus(list.at(-1));
      else if (event.key === 'Escape' && root.popover) close();
      else if ((event.key === 'Enter' || event.key === ' ') && index >= 0 && !(event.target instanceof HTMLButtonElement)) list[index].click();
      else if (event.key.length === 1 && event.key !== ' ') typeahead(event.key, index, list, event.timeStamp);
      else return;
      event.preventDefault();
    },
    { signal },
  );

  root.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('[role="menuitem"]')) close();
    },
    { signal },
  );

  root.addEventListener(
    'toggle',
    (event) => {
      if (/** @type {ToggleEvent} */ (event).newState !== 'open') return;
      const list = items();
      focus(openAtEnd ? list.at(-1) : list[0]);
      openAtEnd = false;
    },
    { signal },
  );

  if (trigger) {
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openAtEnd = event.key === 'ArrowUp';
        root.showPopover();
      },
      { signal },
    );
  }

  const list = items();
  for (const item of list) item.tabIndex = item === list[0] ? 0 : -1;
  return () => controller.abort();
}
