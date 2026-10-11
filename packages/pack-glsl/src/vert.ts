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
import { fail, readPackFile } from './common.ts';
import { parseVersion, withHeader } from './dialect.ts';

const KINDS = ['quad', 'triangle', 'mesh'];

const vertGenerator: Generator = {
  description: 'create a GLSL vertex shader starter',
  params: {
    name: { description: 'file name: Clouds makes clouds.vert.glsl' },
    kind: { default: 'quad', description: 'quad (full-screen, matches cpp:sdl3-opengl), triangle (full-screen, no vertex buffer) or mesh (3D model with normals for lighting)' },
    version: { default: '300es', description: 'GLSL dialect: 300es (WebGL2), 330 or 410 (desktop OpenGL core)' },
  },
  actions: ({ name, kind, version }, { kebab }) => {
    const k = String(kind);
    if (!KINDS.includes(k)) fail(`glsl:vert --kind: expected one of ${KINDS.map((x) => `"${x}"`).join(', ')}, got "${k}"`);
    return [
      {
        add: `${kebab(String(name))}.vert.glsl`,
        template: withHeader(parseVersion(version), readPackFile(`starters/vert-${k}.glsl`)),
      },
    ];
  },
};

export default vertGenerator;
