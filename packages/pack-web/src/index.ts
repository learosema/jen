/** jen pack for web development – documented at https://learosema.github.io/jen/web.html */
import type { Pack } from '@codejen/jen';
import avatarsGenerator from './avatars.ts';
import baseGenerator from './base.ts';
import buttonGenerator from './button.ts';
import cardGenerator from './card.ts';
import compositionsGenerator from './compositions.ts';
import cubeGenerator from './cube.ts';
import dialogGenerator from './dialog.ts';
import fluidGenerator from './fluid.ts';
import pageGenerator from './page.ts';
import paletteGenerator from './palette.ts';
import popoverGenerator from './popover.ts';
import scrollGenerator from './scroll.ts';
import tailwindGenerator from './tailwind.ts';
import transitionsGenerator from './transitions.ts';
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
  page: pageGenerator,
  dialog: dialogGenerator,
  popover: popoverGenerator,
  scroll: scrollGenerator,
  transitions: transitionsGenerator,
  tailwind: tailwindGenerator,
};

export default pack;
