// Roving tabindex after the ARIA Authoring Practices Guide by the W3C: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
export type Orientation = 'horizontal' | 'vertical' | 'both';

export interface RovingOptions {
  items?: string;
  orientation?: Orientation;
  wrap?: boolean;
  onChange?: (item: HTMLElement) => void;
  signal?: AbortSignal;
}

const ITEMS: Record<string, string> = {
  tablist: '[role="tab"]',
  radiogroup: '[role="radio"]',
  listbox: '[role="option"]',
  menubar: '[role^="menuitem"]',
};

const ORIENTATION: Record<string, Orientation> = {
  tablist: 'horizontal',
  toolbar: 'horizontal',
  menubar: 'horizontal',
  listbox: 'vertical',
  radiogroup: 'both',
};

// Roles whose selection follows focus, and the state their items carry.
const SELECTED: Record<string, string> = {
  tablist: 'aria-selected',
  radiogroup: 'aria-checked',
  listbox: 'aria-selected',
};

export function rovingTabindex(root: HTMLElement, options: RovingOptions = {}): () => void {
  const role = root.getAttribute('role') ?? '';
  const selector = options.items ?? ITEMS[role] ?? 'button, [role="button"], a[href], input, select';
  const orientation = options.orientation ?? (root.getAttribute('aria-orientation') as Orientation | null) ?? ORIENTATION[role] ?? 'both';
  const wrap = options.wrap ?? true;
  const state = SELECTED[role];
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const { signal } = controller;

  const items = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)].filter((item) => !item.hidden && !item.matches(':disabled'));
  const itemOf = (target: EventTarget | null): HTMLElement | undefined => items().find((item) => item.contains(target as Node));

  function select(current: HTMLElement): void {
    for (const item of items()) {
      item.tabIndex = item === current ? 0 : -1;
      if (state) item.setAttribute(state, String(item === current));
      const panel = role === 'tablist' ? document.getElementById(item.getAttribute('aria-controls') ?? '') : null;
      if (panel) panel.hidden = item !== current;
    }
  }

  function step(key: string, index: number, count: number): number | null {
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

  root.addEventListener(
    'focusin',
    (event) => {
      const item = itemOf(event.target);
      if (!item || item.tabIndex === 0) return;
      select(item);
      options.onChange?.(item);
    },
    { signal },
  );

  const list = items();
  const initial = (state && list.find((item) => item.getAttribute(state) === 'true')) || list.find((item) => item.getAttribute('tabindex') === '0') || list[0];
  if (initial) select(initial);
  return () => controller.abort();
}
