/**
 * `glsl:matrix`: matrices for GPU-side transforms – rotateX/Y/Z and
 * rotateAxis (mat3), perspective and lookAt (mat4, OpenGL conventions),
 * translate, scale and transform (mat3 → mat4). `--fns=rotate,…` (or `all`),
 * inserted into `--into=<shader>` or written to `<dir>/lib/`.
 */
import type { Generator } from '@codejen/jen';
import { chunkActions, pickChunks } from './chunks.ts';
import { parseList } from './common.ts';

const matrixGenerator: Generator = {
  description: 'add matrix helpers',
  params: {
    fns: { default: '' },
    into: { default: '' },
    dir: { default: 'shaders' },
  },
  actions: ({ fns, into, dir }) =>
    chunkActions(pickChunks('matrix', parseList(String(fns)), '--fns', 'glsl:matrix'), {
      into: String(into),
      dir: String(dir),
    }),
};

export default matrixGenerator;
