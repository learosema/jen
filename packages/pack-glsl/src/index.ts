/**
 * jen pack for GLSL: shader starters plus SDF, raymarching, noise and
 * lighting functions. Defaults to WebGL2's GLSL ES 3.00; everything is
 * written so it also compiles as desktop 3.30/4.10 core (see dialect.ts).
 *
 * Functions ship as plain, attributed .glsl files ("chunks", see chunks.ts):
 * `--into=<shader>` inserts them with their dependencies and license
 * notices before main(), otherwise they're written to `<dir>/lib/`.
 *
 *   jen glsl:frag --name=Clouds                    full-screen fragment starter
 *   jen glsl:vert --name=Quad [--kind=triangle|mesh] vertex starter
 *   jen glsl:port --file=shaders/clouds.frag.glsl --to=410   switch dialect header
 *   jen glsl:util --fns=rot2,remap --into=shaders/clouds.frag.glsl
 *   jen glsl:webgl --name=Clouds [--inline] [--tag=my-canvas]   no-build WebGL2 playground with <shader-canvas>
 */
import type { Pack } from '@codejen/jen';
import fragGenerator from './frag.ts';
import portGenerator from './port.ts';
import utilGenerator from './util.ts';
import vertGenerator from './vert.ts';
import webglGenerator from './webgl.ts';

const pack: Pack = {
  frag: fragGenerator,
  vert: vertGenerator,
  port: portGenerator,
  util: utilGenerator,
  webgl: webglGenerator,
};

export default pack;
