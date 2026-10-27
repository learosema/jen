/**
 * `glsl:filter`: image filters for a texture.
 *
 *   --kinds=…        pixel: grayscale, sepia, posterize, dither, vignette, grain, chromatic, pixelate
 *                    neighborhood: sobel, blur-box, blur-gaussian, sharpen, kuwahara
 *                    looks: crt (curvature, scanlines, shadow mask)
 *   --name=Retro     a starter that fits uTexture0 into the canvas and runs the picked filters
 *   --into=<shader>  just the functions
 *
 * The filters that read the texture (sobel, blurs, sharpen, kuwahara,
 * chromatic, crt) make the color; one pass runs one of them, the starter
 * lists the others to switch to. The rest work on that color.
 */
import { posix } from 'node:path';
import type { Generator } from '@codejen/jen';
import { MARKER_LINE, chunkActions, chunkIds, pickChunks } from './chunks.ts';
import { fail, parseList } from './common.ts';
import { VERSIONS, parseVersion, withHeader } from './dialect.ts';

/** Filters that read the texture themselves, and how the starter calls them. */
const SOURCES: Record<string, string> = {
  crt: 'crt(uTexture0, uv, vec2(320.0, 240.0), gl_FragCoord.xy)',
  kuwahara: 'kuwahara(uTexture0, uv, 4)',
  'blur-gaussian': 'blurGaussian(uTexture0, uv, 2.0)',
  'blur-box': 'blurBox(uTexture0, uv, 3)',
  sharpen: 'sharpen(uTexture0, uv, 1.0)',
  chromatic: 'chromaticAberration(uTexture0, uv, 0.03)',
  sobel: 'vec3(sobel(uTexture0, uv))',
};

/** Filters on a color, in the order the starter applies them. */
const STEPS: Record<string, string> = {
  grayscale: 'color = grayscale(color);',
  sepia: 'color = sepia(color, 1.0);',
  posterize: 'color = posterize(color, 4.0);',
  dither: 'color = ditherBayer(color, gl_FragCoord.xy, 4.0);',
  grain: 'color = filmGrain(color, gl_FragCoord.xy, uTime, 0.08);',
  vignette: 'color *= vignette(uv, 0.6);',
};

function starter(kinds: string[]): string {
  const sources = kinds.filter((k) => SOURCES[k]);
  const [first, ...others] = sources;
  const lines = [
    ...(kinds.includes('pixelate') ? ['uv = pixelate(uTexture0, uv, 8.0);'] : []),
    `vec3 color = ${first ? SOURCES[first] : 'texture(uTexture0, uv).rgb'};`,
    ...others.map((k) => `// or: color = ${SOURCES[k]};`),
    ...Object.keys(STEPS).filter((k) => kinds.includes(k)).map((k) => STEPS[k]),
  ];
  return `uniform float uTime;          // seconds since start
uniform vec2 uResolution;     // viewport size in pixels
uniform sampler2D uTexture0;  // texture0="photo.jpg", "clip.mp4", "camera" or "test-pattern" on the element

out vec4 fragColor;

${MARKER_LINE}
void main() {
  // The image fit into the canvas, centered.
  vec2 size = vec2(textureSize(uTexture0, 0));
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / (size * min(uResolution.x / size.x, uResolution.y / size.y)) + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

${lines.map((l) => `  ${l}`).join('\n')}
  fragColor = vec4(color, 1.0);
}
`;
}

const filterGenerator: Generator = {
  description: 'add image filters: color, blur, edges, CRT and more',
  params: {
    kinds: { description: 'comma-separated filters: grayscale, sepia, posterize, dither, vignette, grain, chromatic, pixelate, sobel, blur-box, blur-gaussian, sharpen, kuwahara, crt – or all' },
    name: { default: '', description: 'instead of --into: create a starter shader with this name that runs the filters on texture0' },
    into: { path: true, default: '', description: 'existing shader or --inline page to insert the functions into, before main() (default: one file each in lib/)' },
    version: { default: '300es', choices: VERSIONS, description: 'GLSL dialect: 300es is WebGL2, 330 and 410 desktop OpenGL' },
  },
  usage: [
    'filters that read the texture take (sampler2D tex, vec2 uv, …) and find the texel size themselves; the others take a color',
    'one pass runs one texture filter; chain several with a second pass',
    '<shader-canvas texture0="photo.jpg"> feeds uTexture0 – also a video ("clip.mp4"), "camera" (after a click on its button), or "test-pattern": bars, a ramp and a grid to try filters on',
  ],
  examples: ['--name=Retro --kinds=crt', '--name=Paint --kinds=kuwahara,vignette', '--kinds=sobel,grayscale --into=index.html'],
  actions: ({ kinds, name, into, version }, { kebab, pascal }, ctx) => {
    const list = parseList(String(kinds ?? ''));
    if (name && into) fail('glsl:filter: use either --name (new starter) or --into (existing shader), not both');
    const ids = pickChunks('filter', list, '--kinds', 'glsl:filter');
    if (!name) return chunkActions(ids, { into: String(into), dir: '', ctx });

    const picked = list.includes('all') ? chunkIds('filter').map((id) => id.slice('filter/'.length)) : list;
    const file = `${kebab(String(name))}.frag.glsl`;
    const shown = posix.relative(ctx.cwd ?? '.', posix.join(ctx.destDir, file));
    return [
      { add: file, template: withHeader(parseVersion(version), starter(picked)) },
      ...chunkActions(ids, { into: file, dir: '', ctx, fresh: true }),
      { note: `a page for it: jen glsl:webgl --name=${pascal(String(name))} --inline --shader=${shown} --texture=test-pattern (or your image)` },
    ];
  },
};

export default filterGenerator;
