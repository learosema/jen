/**
 * `glsl:vert`: a vertex shader starter.
 *
 *   --kind=quad      full-screen quad from a vec2 attribute at location 0 (default; matches cpp:sdl3-opengl)
 *   --kind=triangle  full-screen triangle from gl_VertexID, no vertex buffer at all
 *   --kind=mesh      position/normal/uv attributes, uModel/uView/uProjection, world-space outputs for lighting
 *
 * All three output vUV.
 */
import type { Generator } from '@codejen/jen';
import { fail, inFolder, readPackFile } from './common.ts';
import { parseVersion, withHeader } from './dialect.ts';

const KINDS = ['quad', 'triangle', 'mesh'];

const vertGenerator: Generator = {
  description: 'create a GLSL vertex shader starter',
  params: {
    name: {},
    kind: { default: 'quad' },
    dir: { default: 'shaders' },
    version: { default: '300es' },
  },
  actions: ({ name, kind, dir, version }, { kebab }) => {
    const k = String(kind);
    if (!KINDS.includes(k)) fail(`glsl:vert --kind: expected one of ${KINDS.map((x) => `"${x}"`).join(', ')}, got "${k}"`);
    return [
      {
        add: inFolder(String(dir), `${kebab(String(name))}.vert.glsl`),
        template: withHeader(parseVersion(version), readPackFile(`starters/vert-${k}.glsl`)),
      },
    ];
  },
};

export default vertGenerator;
