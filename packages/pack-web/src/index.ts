/** jen pack for web development – documented at https://learosema.github.io/jen/web.html */
import type { AnyGenerator } from '@codejen/jen';
import avatarsGenerator from './avatars.ts';
import baseGenerator from './base.ts';
import buttonGenerator from './button.ts';
import { blockGenerators } from './blocks.ts';
import cardGenerator from './card.ts';
import checkGenerator from './check.ts';
import compositionsGenerator, { compositionGenerators } from './compositions.ts';
import cubeGenerator from './cube.ts';
import dialogGenerator from './dialog.ts';
import elementGenerator from './element.ts';
import esbuildGenerator from './esbuild.ts';
import fluidGenerator from './fluid.ts';
import importGenerator from './import.ts';
import { gridNavigationGenerator, hotkeysGenerator, menuGenerator, rovingGenerator } from './keyboard.ts';
import manifestGenerator from './manifest.ts';
import pageGenerator from './page.ts';
import themeToggleGenerator from './theme-toggle.ts';
import paletteGenerator from './palette.ts';
import colorGenerator from './single-color.ts';
import popoverGenerator from './popover.ts';
import scrollGenerator from './scroll.ts';
import swGenerator from './sw.ts';
import tailwindGenerator from './tailwind.ts';
import transitionsGenerator from './transitions.ts';
import utilitiesGenerator, { utilityGenerators } from './utilities.ts';
import viteGenerator from './vite.ts';

// web:check --render is async
const pack: Record<string, AnyGenerator> = {
  base: baseGenerator,
  palette: paletteGenerator,
  color: colorGenerator,
  button: buttonGenerator,
  card: cardGenerator,
  avatars: avatarsGenerator,
  ...blockGenerators,
  fluid: fluidGenerator,
  compositions: compositionsGenerator,
  ...compositionGenerators,
  utilities: utilitiesGenerator,
  ...utilityGenerators,
  cube: cubeGenerator,
  page: pageGenerator,
  manifest: manifestGenerator,
  sw: swGenerator,
  dialog: dialogGenerator,
  popover: popoverGenerator,
  'theme-toggle': themeToggleGenerator,
  scroll: scrollGenerator,
  transitions: transitionsGenerator,
  tailwind: tailwindGenerator,
  check: checkGenerator,
  import: importGenerator,
  vite: viteGenerator,
  esbuild: esbuildGenerator,
  element: elementGenerator,
  roving: rovingGenerator,
  menu: menuGenerator,
  'grid-navigation': gridNavigationGenerator,
  hotkeys: hotkeysGenerator,
};

export default pack;
export { recipes } from './recipes.ts';
