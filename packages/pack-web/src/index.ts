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
 *   jen web:card                                          composable .card block (after smolcss.dev)
 *   jen web:avatars                                       overlapping .avatars list block (after smolcss.dev)
 *   jen web:fluid                                         Utopia-style fluid type and space scales
 *   jen web:compositions [--only=flow,cluster]            layout primitives (flow, cluster, sidebar, switcher, …)
 *   jen web:utilities                                     utility classes from the palette and fluid tokens
 *   jen web:cube --primary=#5b5bd6                        all of the above in one go
 *   jen web:tailwind                                      entry point for Tailwind v4; palette/fluid then write @theme
 */
import type { Pack } from '@codejen/jen';
import avatarsGenerator from './avatars.ts';
import baseGenerator from './base.ts';
import buttonGenerator from './button.ts';
import cardGenerator from './card.ts';
import compositionsGenerator from './compositions.ts';
import cubeGenerator from './cube.ts';
import fluidGenerator from './fluid.ts';
import paletteGenerator from './palette.ts';
import tailwindGenerator from './tailwind.ts';
import utilitiesGenerator from './utilities.ts';

const pack: Pack = {
  base: baseGenerator,
  palette: paletteGenerator,
  button: buttonGenerator,
  card: cardGenerator,
  avatars: avatarsGenerator,
  fluid: fluidGenerator,
  compositions: compositionsGenerator,
  utilities: utilitiesGenerator,
  cube: cubeGenerator,
  tailwind: tailwindGenerator,
};

export default pack;
