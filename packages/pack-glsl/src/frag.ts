/**
 * `glsl:frag`: a full-screen fragment shader starter – centered,
 * aspect-correct coordinates from gl_FragCoord plus the uniforms every jen
 * host feeds (uTime, uResolution, uMouse), so it runs as-is in
 * <shader-canvas> and cpp:sdl3-opengl alike.
 */
import type { Generator } from '@codejen/jen';
import { readPackFile } from './common.ts';
import { VERSIONS, parseVersion, withHeader } from './dialect.ts';

const fragGenerator: Generator = {
  description: 'create a full-screen GLSL fragment shader starter',
  params: {
    name: { description: 'file name: Clouds makes clouds.frag.glsl' },
    version: { default: '300es', choices: VERSIONS, description: 'GLSL dialect: 300es is WebGL2, 330 and 410 desktop OpenGL' },
  },
  examples: ['--name=Plasma --dir=shaders', '--name=Vignette --version=410'],
  actions: ({ name, version }, { kebab }) => [
    {
      add: `${kebab(String(name))}.frag.glsl`,
      template: withHeader(parseVersion(version), readPackFile('starters/frag.glsl')),
    },
  ],
};

export default fragGenerator;
