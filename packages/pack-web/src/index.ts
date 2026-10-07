/**
 * jen pack for web development: design tokens and CSS that follow CUBE CSS
 * and the WCAG contrast rules, built from the web platform – no framework.
 *
 * Files go into the current directory, or --dir. `web:base` writes the
 * stylesheet entry point `styles.css`; later generators add their
 * `@import` above its `jen:imports` marker (see entry.ts).
 *
 *   jen web:base                                          entry point (CUBE CSS layers), reset, base styles
 *   jen web:palette --primary=#5b5bd6 [--contrast=aaa]    6-shade palette + light/dark role tokens, contrast-checked
 *   jen web:button                                        .button block with BEM modifiers on the palette tokens
 */
import type { Pack } from '@codejen/jen';
import baseGenerator from './base.ts';
import buttonGenerator from './button.ts';
import paletteGenerator from './palette.ts';

const pack: Pack = {
  base: baseGenerator,
  palette: paletteGenerator,
  button: buttonGenerator,
};

export default pack;
