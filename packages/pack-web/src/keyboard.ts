/** `web:roving`, `web:menu`, `web:grid-navigation`, `web:hotkeys`: the ARIA keyboard patterns as plain modules, from templates/. */
import type { Generator } from '@codejen/jen';
import { TYPES_PARAM, ext, typesFor } from '@codejen/jen/js';
import { styled } from './styled.ts';

export const KEYBOARD = {
  roving: { file: 'roving-tabindex', description: 'roving tabindex for toolbars, tab lists, radio groups and listboxes (ARIA APG) – the browser\'s focusgroup where it has one' },
  menu: { file: 'menu', description: 'menu and menubar keyboard interaction: arrows, Home/End, typeahead, Escape, popover-aware (ARIA APG)' },
  'grid-navigation': { file: 'grid-navigation', description: 'two-dimensional grid navigation with arrows, Home/End, Page Up/Down (ARIA APG)' },
  hotkeys: { file: 'hotkeys', description: 'a hotkeys registry: scoped bindings, modifiers, ignores typing, optional help overlay' },
};

const keyboardGenerator = (generator: keyof typeof KEYBOARD): Generator => ({
  description: `create ${KEYBOARD[generator].description}`,
  params: { ...TYPES_PARAM },
  examples: ['', '--types=ts --dir=src/lib'],
  actions: (answers, _helpers, ctx) => {
    const types = typesFor(`web:${generator}`, answers, ctx);
    return [{ add: `${KEYBOARD[generator].file}${ext(types)}`, template: styled(KEYBOARD[generator].file, types) }];
  },
});

export const rovingGenerator = keyboardGenerator('roving');
export const menuGenerator = keyboardGenerator('menu');
export const gridNavigationGenerator = keyboardGenerator('grid-navigation');
export const hotkeysGenerator = keyboardGenerator('hotkeys');
