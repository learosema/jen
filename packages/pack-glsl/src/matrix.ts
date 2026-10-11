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
    fns: { default: '', description: 'comma-separated: rotate, perspective, look-at, transform (translate, scale) – or all' },
    into: { path: true, default: '', description: 'existing shader to insert the functions into, before main() (default: one file each in lib/)' },
  },
  actions: ({ fns, into }) =>
    chunkActions(pickChunks('matrix', parseList(String(fns)), '--fns', 'glsl:matrix'), {
      into: String(into),
      dir: '',
    }),
};

export default matrixGenerator;
