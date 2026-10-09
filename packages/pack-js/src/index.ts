/** jen pack for TypeScript and JavaScript – documented at https://learosema.github.io/jen/js.html */
import type { Pack } from '@codejen/jen';
import brandGenerator from './brand.ts';
import classGenerator from './class.ts';
import elementGenerator from './element.ts';
import emitterGenerator from './emitter.ts';
import enumGenerator from './enum.ts';
import errorGenerator from './error.ts';
import { gridGenerator, hotkeysGenerator, menuGenerator, rovingGenerator } from './keyboard.ts';
import moduleGenerator from './module.ts';
import testGenerator from './test.ts';
import unionGenerator from './union.ts';

const pack: Pack = {
  element: elementGenerator,
  roving: rovingGenerator,
  menu: menuGenerator,
  grid: gridGenerator,
  hotkeys: hotkeysGenerator,
  class: classGenerator,
  enum: enumGenerator,
  union: unionGenerator,
  brand: brandGenerator,
  error: errorGenerator,
  emitter: emitterGenerator,
  module: moduleGenerator,
  test: testGenerator,
};

export default pack;
