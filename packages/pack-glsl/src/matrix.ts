/**
 * `glsl:matrix`: matrices for GPU-side transforms – rotateX/Y/Z and
 * rotateAxis (mat3), perspective and lookAt (mat4, OpenGL conventions),
 * translate, scale and transform (mat3 → mat4). `--fns=rotate,…` (or `all`),
 * inserted into `--into=<shader>` or written to `<dir>/lib/`.
 */
import type { Generator } from '@codejen/jen';
import { chunkActions, pickChunks } from './chunks.ts';
import { parseList } from './common.ts';

/** translate and scale live in the transform chunk – accept the words a request actually uses. */
const ALIASES: Record<string, string> = { translate: 'transform', scale: 'transform' };

const matrixGenerator: Generator = {
  description: 'add matrix helpers',
  params: {
    fns: { description: 'comma-separated: rotate, perspective, look-at, transform (also as translate or scale) – or all' },
    into: { path: true, default: '', description: 'existing shader to insert the functions into, before main() (default: one file each in lib/)' },
  },
  usage: [
    'lookAt() turns world space into view space; cameraMatrix() from glsl:raymarch turns rays the other way',
  ],
  examples: ['--fns=rotate,look-at --into=shaders/mesh.vert.glsl'],
  actions: ({ fns, into }, _helpers, ctx) => {
    const names = [...new Set(parseList(String(fns ?? '')).map((name) => ALIASES[name] ?? name))];
    return chunkActions(pickChunks('matrix', names, '--fns', 'glsl:matrix'), {
      into: String(into),
      dir: '',
      ctx,
    });
  },
};

export default matrixGenerator;
