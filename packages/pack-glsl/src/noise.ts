/**
 * `glsl:noise`: noise functions, in 2D or 3D (`--dim`).
 *
 *   base noises    value, perlin, simplex, worley    <base>Noise(p) / <base>Noise(p, period), about [-1, 1]
 *   fractals       fbm, turbulence, ridged, warp     <base>Fbm(p, octaves[, gain]) / (p, period, octaves[, gain]),
 *                                                     any --base (default simplex); warp takes a strength instead of gain
 *   flow           curl                               curlNoise(p, alpha) / (p, period, alpha)
 *
 * Every function has a `period` overload that tiles seamlessly (feTurbulence's
 * stitchTiles, for any noise). Like all chunk generators, it inserts into
 * `--into=<shader>` or writes to `<dir>/lib/`; `--name` instead creates a
 * preview shader that shows the noise (`--tile` draws the period 2×2 times, so
 * seams would show).
 */
import type { Action, Generator } from '@codejen/jen';
import { NOISE_BASES, chunkActions } from './chunks.ts';
import { fail, inFolder } from './common.ts';
import { parseVersion, withHeader } from './dialect.ts';

const FRACTALS = ['fbm', 'turbulence', 'ridged', 'warp'];
const KINDS = [...NOISE_BASES, ...FRACTALS, 'curl'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The chunk for a kind, dimension and base: noise/perlin2, fractal/fbm3@simplex, noise/curl2. */
function chunkFor(kind: string, dim: number, base: string): string {
  if (FRACTALS.includes(kind)) return `fractal/${kind}${dim}@${base}`;
  return `noise/${kind}${dim}`;
}

/** The body of the preview shader's main(): `p` is set up, `color` must be assigned. */
function previewExpression(kind: string, dim: number, base: string, tile: boolean): string {
  const v = `vec${dim}`;
  const point = dim === 2 ? 'p' : 'vec3(p, uTime * 0.25)';
  const period = tile ? (dim === 2 ? ', period' : ', vec3(period, 8.0)') : '';
  if (kind === 'curl') {
    const flow = `curlNoise(${point}${period}, ${dim === 2 ? 'uTime' : '0.0'})`;
    const direction = dim === 2 ? 'vec3(0.5 + 0.5 * normalize(flow), 0.6)' : '0.5 + 0.5 * normalize(flow)';
    return `${v} flow = ${flow};\n  color = ${direction};  // flow direction as color`;
  }
  const fn = NOISE_BASES.includes(kind) ? `${kind}Noise(${point}${period})` : `${base}${cap(kind)}(${point}${period}, 6)`;
  const unsigned = kind === 'turbulence' || kind === 'ridged';
  return `float n = ${fn};\n  color = vec3(${unsigned ? 'n' : '0.5 + 0.5 * n'});`;
}

function previewShader(kind: string, dim: number, base: string, tile: boolean): string {
  const setup = tile
    ? [
        '  // The period, drawn 2×2 times: any seam would show as a cross in the middle.',
        '  vec2 period = vec2(4.0);',
        '  vec2 p = gl_FragCoord.xy / uResolution * period * 2.0;',
      ]
    : ['  vec2 p = gl_FragCoord.xy / uResolution.y * 6.0;'];
  if (dim === 2 && !tile) setup.push('  p.x += uTime * 0.25;');
  return `uniform float uTime;        // seconds since start
uniform vec2 uResolution;   // viewport size in pixels

out vec4 fragColor;

void main() {
${setup.join('\n')}
  vec3 color;
  ${previewExpression(kind, dim, base, tile)}
  fragColor = vec4(color, 1.0);
}
`;
}

const noiseGenerator: Generator = {
  description:
    'add GLSL noise (--kind=value|perlin|simplex|worley|fbm|turbulence|ridged|warp|curl, --dim=2|3, --base=… for fractals), tileable; --into, files in <dir>/lib/, or --name for a preview shader',
  params: {
    kind: { default: '' },
    dim: { default: '2' },
    base: { default: 'simplex' },
    into: { default: '' },
    dir: { default: 'shaders' },
    name: { default: '' },
    tile: { default: false },
    version: { default: '300es' },
  },
  actions: ({ kind, dim, base, into, dir, name, tile, version }, { kebab }) => {
    const k = String(kind);
    const valid = KINDS.map((x) => `"${x}"`).join(', ');
    if (!k) fail(`glsl:noise --kind: pick one of ${valid}`);
    if (!KINDS.includes(k)) fail(`glsl:noise --kind: expected one of ${valid}, got "${k}"`);
    const d = Number(dim);
    if (d !== 2 && d !== 3) fail(`glsl:noise --dim: expected "2" or "3", got "${String(dim)}"`);
    const b = String(base);
    if (!NOISE_BASES.includes(b)) fail(`glsl:noise --base: expected one of ${NOISE_BASES.map((x) => `"${x}"`).join(', ')}, got "${b}"`);
    if (name && into) fail('glsl:noise: use either --name (new preview shader) or --into (existing shader), not both');

    const ids = [chunkFor(k, d, b)];
    if (!name) return chunkActions(ids, { into: String(into), dir: String(dir) });

    const file = inFolder(String(dir), `${kebab(String(name))}.frag.glsl`);
    const preview: Action = { add: file, template: withHeader(parseVersion(version), previewShader(k, d, b, Boolean(tile))) };
    return [preview, ...chunkActions(ids, { into: file, dir: String(dir) })];
  },
};

export default noiseGenerator;
