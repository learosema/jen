// Grid keyboard navigation after the ARIA Authoring Practices Guide by the W3C: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
export interface GridOptions {
  rows?: string;
  cells?: string;
  pageSize?: number;
  onMove?: (cell: HTMLElement, row: number, column: number) => void;
  signal?: AbortSignal;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const EDITING = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]';

export function gridNavigation(grid: HTMLElement, options: GridOptions = {}): () => void {
  const rowSelector = options.rows ?? '[role="row"]';
  const cellSelector = options.cells ?? '[role="gridcell"], [role="columnheader"], [role="rowheader"]';
  const pageSize = options.pageSize ?? 5;
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const { signal } = controller;

  const matrix = (): HTMLElement[][] =>
    [...grid.querySelectorAll<HTMLElement>(rowSelector)].map((row) => [...row.querySelectorAll<HTMLElement>(cellSelector)]).filter((cells) => cells.length > 0);
  // A cell's focus target: the widget inside it, if it has one, else the cell itself.
  const target = (cell: HTMLElement): HTMLElement => cell.querySelector<HTMLElement>(FOCUSABLE) ?? cell;
  const clamp = (n: number, max: number): number => Math.min(Math.max(n, 0), max);

  function activate(cell: HTMLElement): void {
    for (const row of matrix()) for (const other of row) target(other).tabIndex = other === cell ? 0 : -1;
  }

  function position(rows: HTMLElement[][], node: EventTarget | null): [number, number] | null {
    const cell = node instanceof Element ? node.closest<HTMLElement>(cellSelector) : null;
    const row = cell ? rows.findIndex((cells) => cells.includes(cell)) : -1;
    return cell && row >= 0 ? [row, rows[row].indexOf(cell)] : null;
  }

  grid.addEventListener(
    'keydown',
    (event) => {
      if (event.target instanceof Element && event.target.matches(EDITING)) return;
      const rows = matrix();
      const at = position(rows, event.target);
      if (!at) return;
      const rtl = getComputedStyle(grid).direction === 'rtl';
      const ctrl = event.ctrlKey || event.metaKey;
      let [row, column] = at;
      switch (event.key) {
        case 'ArrowRight':
          column += rtl ? -1 : 1;
          break;
        case 'ArrowLeft':
          column += rtl ? 1 : -1;
          break;
        case 'ArrowDown':
          row++;
          break;
        case 'ArrowUp':
          row--;
          break;
        case 'PageDown':
          row += pageSize;
          break;
        case 'PageUp':
          row -= pageSize;
          break;
        case 'Home':
          column = 0;
          if (ctrl) row = 0;
          break;
        case 'End':
          column = Infinity;
          if (ctrl) row = Infinity;
          break;
        default:
          return;
      }
      event.preventDefault();
      row = clamp(row, rows.length - 1);
      column = clamp(column, rows[row].length - 1);
      const cell = rows[row][column];
      activate(cell);
      target(cell).focus();
      options.onMove?.(cell, row, column);
    },
    { signal },
  );

  grid.addEventListener(
    'focusin',
    (event) => {
      const rows = matrix();
      const at = position(rows, event.target);
      if (at) activate(rows[at[0]][at[1]]);
    },
    { signal },
  );

  const rows = matrix();
  const current = rows.flat().find((cell) => target(cell).getAttribute('tabindex') === '0') ?? rows[0]?.[0];
  if (current) activate(current);
  return () => controller.abort();
}
