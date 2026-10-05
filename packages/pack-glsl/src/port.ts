/**
 * `glsl:port`: switches an existing shader between dialects by rewriting only
 * its header – e.g. a WebGL2 prototype (300es) into cpp:sdl3-opengl (410).
 * Default `precision … float|int;` lines are dropped and the `#version` line
 * is replaced by the target's header; other precision lines (samplers) stay,
 * since desktop GLSL accepts and ignores them.
 */
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { header, parseVersion } from './dialect.ts';

const portGenerator: Generator = {
  description: 'switch a shader between GLSL dialects by rewriting its header',
  params: {
    file: { path: true },
    to: {},
  },
  actions: ({ file, to }) => {
    const target = String(file);
    if (!target) fail('glsl:port --file: the shader to port is required');
    return [
      { modify: target, pattern: /^[ \t]*precision\s+(?:lowp|mediump|highp)\s+(?:float|int)\s*;[ \t]*\r?\n/gm, replace: '' },
      { modify: target, pattern: /^#version[^\n]*$/m, replace: header(parseVersion(to, 'glsl:port --to')) },
    ];
  },
};

export default portGenerator;
