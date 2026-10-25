// @ts-check
// Grid keyboard navigation after the ARIA Authoring Practices Guide by the W3C: https://www.w3.org/WAI/ARIA/apg/patterns/grid/

/**
 * @typedef {object} GridOptions
 * @property {string} [rows]
 * @property {string} [cells]
 * @property {number} [pageSize]
 * @property {(cell: HTMLElement, row: number, column: number) => void} [onMove]
 * @property {AbortSignal} [signal]
 */

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const EDITING = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]';

/**
 * @param {HTMLElement} grid
 * @param {GridOptions} [options]
 * @returns {() => void}
 */
export function gridNavigation(grid, options = {}) {
  const rowSelector = options.rows ?? '[role="row"]';
  const cellSelector = options.cells ?? '[role="gridcell"], [role="columnheader"], [role="rowheader"]';
  const pageSize = options.pageSize ?? 5;
  const controller = new AbortController();
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const { signal } = controller;

  /** @returns {HTMLElement[][]} */
  const matrix = () =>
    [.../** @type {NodeListOf<HTMLElement>} */ (grid.querySelectorAll(rowSelector))]
      .map((row) => [.../** @type {NodeListOf<HTMLElement>} */ (row.querySelectorAll(cellSelector))])
      .filter((cells) => cells.length > 0);
  // A cell's focus target: the widget inside it, if it has one, else the cell itself.
  /**
   * @param {HTMLElement} cell
   * @returns {HTMLElement}
   */
  const target = (cell) => cell.querySelector(FOCUSABLE) ?? cell;
  /**
   * @param {number} n
   * @param {number} max
   */
  const clamp = (n, max) => Math.min(Math.max(n, 0), max);

  /** @param {HTMLElement} cell */
  function activate(cell) {
    for (const row of matrix()) for (const other of row) target(other).tabIndex = other === cell ? 0 : -1;
  }

  /**
   * @param {HTMLElement[][]} rows
   * @param {EventTarget | null} node
   * @returns {[number, number] | null}
   */
  function position(rows, node) {
    /** @type {HTMLElement | null} */
    const cell = node instanceof Element ? node.closest(cellSelector) : null;
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
