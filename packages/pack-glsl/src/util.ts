/**
 * `glsl:util`: small helpers other chunks build on – PI/TAU, rot2, remap,
 * saturate, lattice hashes. `--fns=rot2,remap` (or `all`), inserted into `--into=<shader>`
 * before main(), or written to `<dir>/lib/` (see chunks.ts).
 */
import type { Generator } from '@codejen/jen';
import { chunkActions, pickChunks } from './chunks.ts';
import { parseList } from './common.ts';

const utilGenerator: Generator = {
  description: 'add GLSL helpers',
  params: {
    fns: { default: '' },
    into: { default: '' },
    dir: { default: 'shaders' },
  },
  actions: ({ fns, into, dir }) =>
    chunkActions(pickChunks('util', parseList(String(fns)), '--fns', 'glsl:util'), {
      into: String(into),
      dir: String(dir),
    }),
};

export default utilGenerator;
