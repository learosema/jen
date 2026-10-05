/**
 * `glsl:sdf`: signed distance functions.
 *
 *   --shapes=…    2D: circle, box, round-box, segment, polygon, star
 *                 3D: sphere, box, round-box, torus, capsule, cylinder, plane
 *   --ops=…       union, subtract, intersect, smooth-union/-subtract/-intersect,
 *                 round, onion, repeat, repeat-limited, extrude, revolve
 *   --effects=…   2D only: fill, stroke, glow, shadow, inner-shadow (masks from a distance)
 *
 * Each list takes `all`. Like every chunk generator: --into, files in
 * <dir>/lib/, or --name for a preview – the picked shapes side by side, as a
 * 2D drawing or (--dim=3) a raymarched scene.
 */
import type { Action, Generator } from '@codejen/jen';
import { chunkActions, chunkIds, pickChunks } from './chunks.ts';
import { fail, parseList } from './common.ts';
import { parseVersion, withHeader } from './dialect.ts';
import { raymarchStarter } from './raymarch.ts';

/** How the preview draws each shape, centered on `q`. */
const SAMPLES_2D: Record<string, string> = {
  circle: 'sdCircle(q, 0.3)',
  box: 'sdBox(q, vec2(0.3, 0.2))',
  'round-box': 'sdRoundBox(q, vec2(0.3, 0.2), 0.08)',
  segment: 'sdSegment(q, vec2(-0.25, -0.2), vec2(0.25, 0.2)) - 0.04',
  polygon: 'sdPolygon(q, 0.32, 6.0)',
  star: 'sdStar(q, 0.34, 0.15, 5.0)',
};

const SAMPLES_3D: Record<string, string> = {
  sphere: 'sdSphere(q, 0.5)',
  box: 'sdBox(q, vec3(0.4))',
  'round-box': 'sdRoundBox(q, vec3(0.45), 0.1)',
  torus: 'sdTorus(q, vec2(0.45, 0.15))',
  capsule: 'sdCapsule(q, vec3(0.0, -0.35, 0.0), vec3(0.0, 0.35, 0.0), 0.25)',
  cylinder: 'sdCylinder(q, 0.35, 0.45)',
};

/** `float d = …` lines placing each picked shape on a row along x, unioned into `d`. */
function row(shapes: string[], samples: Record<string, string>, spacing: number, y: string): string {
  const placed = shapes.filter((s) => samples[s]);
  return placed
    .map((shape, i) => {
      const x = (i - (placed.length - 1) / 2) * spacing;
      const q = y === '' ? `p - vec2(${x.toFixed(2)}, 0.0)` : `p - vec3(${x.toFixed(2)}, ${y}, 0.0)`;
      const sample = samples[shape].replace(/\bq\b/g, `(${q})`);
      return i === 0 ? `  float d = ${sample};` : `  d = min(d, ${sample});`;
    })
    .join('\n');
}

function preview2d(shapes: string[]): string {
  return `uniform vec2 uResolution;   // viewport size in pixels

out vec4 fragColor;

// The picked shapes side by side.
float scene(vec2 p) {
${row(shapes, SAMPLES_2D, 0.8, '')}
  return d;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y * ${Math.max(1.2, shapes.length * 0.8 + 0.4).toFixed(1)};
  float d = scene(p);

  // Distance isolines outside, fill and outline on top.
  vec3 color = vec3(0.1, 0.1, 0.13) + 0.05 * smoothstep(0.4, 0.6, 0.5 + 0.5 * cos(d * 90.0)) * exp(-4.0 * max(d, 0.0));
  color = mix(color, vec3(0.95, 0.4, 0.6), fillMask(d));
  color = mix(color, vec3(1.0), strokeMask(d, 0.01));

  fragColor = vec4(color, 1.0);
}
`;
}

const sdfGenerator: Generator = {
  description: 'add signed distance functions',
  params: {
    dim: { default: '2' },
    shapes: { default: '' },
    ops: { default: '' },
    effects: { default: '' },
    into: { path: true, default: '' },
    name: { default: '' },
    version: { default: '300es' },
  },
  actions: ({ dim, shapes, ops, effects, into, name, version }, { kebab }) => {
    const d = String(dim);
    if (d !== '2' && d !== '3') fail(`glsl:sdf --dim: expected "2" or "3", got "${d}"`);
    if (name && into) fail('glsl:sdf: use either --name (new preview shader) or --into (existing shader), not both');
    const shapeList = parseList(String(shapes));
    const opList = parseList(String(ops));
    const effectList = parseList(String(effects));
    if (d === '3' && effectList.length > 0) fail('glsl:sdf --effects: 2D only (they work on screen-space distances)');
    if (shapeList.length + opList.length + effectList.length === 0) {
      const names = (area: string) => chunkIds(area).map((id) => id.slice(area.length + 1)).join(', ');
      fail(
        `glsl:sdf: pick something – --shapes=${names(`sdf${d}d`)}; --ops=${names('sdfop')}` +
          (d === '2' ? `; --effects=${names('sdffx')}` : '') +
          ' (each also takes "all")',
      );
    }

    const pick = (area: string, list: string[], flag: string) =>
      list.length ? pickChunks(area, list, flag, 'glsl:sdf') : [];
    const ids = [
      ...pick(`sdf${d}d`, shapeList, '--shapes'),
      ...pick('sdfop', opList, '--ops'),
      ...pick('sdffx', effectList, '--effects'),
    ];
    if (!name) return chunkActions(ids, { into: String(into), dir: '' });

    const samples = d === '2' ? SAMPLES_2D : SAMPLES_3D;
    // In the order given; `all` in the documented order (the samples' keys).
    const picked = shapeList.includes('all') ? Object.keys(samples) : shapeList;
    if (!picked.some((s) => samples[s])) {
      fail(`glsl:sdf --name: the preview needs at least one of --shapes=${Object.keys(samples).join(', ')}`);
    }
    const file = `${kebab(String(name))}.frag.glsl`;
    const v = parseVersion(version);

    if (d === '3') {
      const shown = picked.filter((s) => samples[s]);
      const scene = `// The picked shapes side by side, on the ground.
float scene(vec3 p) {
${row(shown, samples, 1.3, '0.0')}
  return min(d, sdPlane(p, vec3(0.0, 1.0, 0.0), 0.5));
}`;
      const distance = Math.max(4, shown.length * 1.3 + 1.5);
      return raymarchStarter(file, v, { scene, chunks: [...ids, 'sdf3d/plane'], minimal: false, distance });
    }
    const preview: Action = { add: file, template: withHeader(v, preview2d(picked)) };
    return [preview, ...chunkActions([...ids, 'sdffx/fill', 'sdffx/stroke'], { into: file, dir: '' })];
  },
};

export default sdfGenerator;
