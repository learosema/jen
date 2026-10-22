/** jen pack for web development – documented at https://learosema.github.io/jen/web.html */
import type { Pack } from '@codejen/jen';
import avatarsGenerator from './avatars.ts';
import baseGenerator from './base.ts';
import buttonGenerator from './button.ts';
import cardGenerator from './card.ts';
import compositionsGenerator, { compositionGenerators } from './compositions.ts';
import cubeGenerator from './cube.ts';
import dialogGenerator from './dialog.ts';
import fluidGenerator from './fluid.ts';
import manifestGenerator from './manifest.ts';
import pageGenerator from './page.ts';
import paletteGenerator from './palette.ts';
import colorGenerator from './single-color.ts';
import popoverGenerator from './popover.ts';
import scrollGenerator from './scroll.ts';
import swGenerator from './sw.ts';
import tailwindGenerator from './tailwind.ts';
import transitionsGenerator from './transitions.ts';
import utilitiesGenerator, { utilityGenerators } from './utilities.ts';

const pack: Pack = {
  base: baseGenerator,
  palette: paletteGenerator,
  color: colorGenerator,
  button: buttonGenerator,
  card: cardGenerator,
  avatars: avatarsGenerator,
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
  scroll: scrollGenerator,
  transitions: transitionsGenerator,
  tailwind: tailwindGenerator,
};

export default pack;
export { recipes } from './recipes.ts';
