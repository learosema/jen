/**
 * `glsl:raymarch`: sphere tracing signed distance fields.
 *
 *   --name=Scene [--lighting=lambert|blinn|toon|pbr] [--minimal] [--materials]
 *                    a starter: scene() with a small scene, camera orbit, soft shadows,
 *                    ambient occlusion and fog, lit with the chosen model (see
 *                    glsl:lighting); --minimal: no shadows, AO or fog;
 *                    --materials: sceneMaterial() returns a material id per surface
 *   --into=<shader>  the helpers for your own scene(): raymarch, calcNormal, softShadow,
 *                    calcAO, cameraMatrix (pick with --parts=march,normal,…)
 *
 * The helpers call `float scene(vec3 p)`, which they declare as a prototype,
 * so your scene can live anywhere in the shader. Material scenes keep that
 * contract: `scene()` returns sceneMaterial(p).x, and the material id is
 * looked up once per pixel at the hit point – the helpers stay the same.
 */
import type { Action, Generator } from '@codejen/jen';
import { chunkActions, pickChunks } from './chunks.ts';
import { fail, inFolder, parseList } from './common.ts';
import { parseVersion, withHeader } from './dialect.ts';
import type { Version } from './dialect.ts';

const SCENE_CHUNKS = ['sdf3d/plane', 'sdf3d/sphere', 'sdf3d/torus', 'sdf3d/round-box', 'sdfop/smooth-union'];

const GROUND = 'sdPlane(p, vec3(0.0, 1.0, 0.0), 0.5)';
const BLOB = `opSmoothUnion(
    sdSphere(p - vec3(0.0, 0.15 + 0.15 * sin(uTime), 0.0), 0.45),
    sdTorus(p - vec3(0.0, -0.1, 0.0), vec2(0.75, 0.12)),
    0.3)`;
const BOX = 'sdRoundBox(p - vec3(1.7, -0.1, 0.4), vec3(0.4), 0.08)';

const SCENE = `// The scene: the distance from p to the nearest surface.
float scene(vec3 p) {
  float ground = ${GROUND};
  float blob = ${BLOB};
  float box = ${BOX};
  return min(ground, min(blob, box));
}`;

const MATERIAL_SCENE = `// The scene: x is the distance from p to the nearest surface, y that
// surface's material id (0 ground, 1 blob, 2 box).
vec2 sceneMaterial(vec3 p) {
  vec2 hit = vec2(${GROUND}, 0.0);
  float blob = ${BLOB};
  if (blob < hit.x) hit = vec2(blob, 1.0);
  float box = ${BOX};
  if (box < hit.x) hit = vec2(box, 2.0);
  return hit;
}

// The distance alone, for raymarch(), calcNormal(), softShadow() and calcAO().
float scene(vec3 p) { return sceneMaterial(p).x; }`;

export const LIGHTING_MODELS = ['lambert', 'blinn', 'toon', 'pbr'];

const CHECKER = 'vec3(0.45 + 0.2 * mod(floor(p.x) + floor(p.z), 2.0))';

/**
 * The surface at the hit point: albedo, plus metallic/roughness for pbr.
 * Without materials, the ground is the plane at y = -0.5; the tolerance grows
 * with t like raymarch()'s hit threshold, so the distant ground isn't
 * mistaken for an object.
 */
function surface(materials: boolean, pbr: boolean): string {
  if (materials) {
    return `float material = sceneMaterial(p).y;  // 0 ground, 1 blob, 2 box
    vec3 albedo = material < 0.5 ? ${CHECKER}  // checkered ground
                : material < 1.5 ? vec3(0.95, 0.4, 0.6)
                : vec3(0.3, 0.55, 0.95);${pbr ? `
    float metallic = material > 1.5 ? 1.0 : 0.0;
    float roughness = material < 0.5 ? 0.8 : 0.3;` : ''}`;
  }
  return `bool ground = p.y < -0.49 + 0.001 * t;
    vec3 albedo = ground ? ${CHECKER} : vec3(0.95, 0.4, 0.6);  // checkered ground, pink objects${pbr ? `
    float metallic = 0.0;
    float roughness = ground ? 0.8 : 0.3;` : ''}`;
}

/** Sun and sky light for each model; `shadow` and `ao` are 1.0 in the minimal starter. */
const LIGHT: Record<string, string> = {
  lambert: `color = lambert(n, light, albedo) * shadow * vec3(1.0, 0.95, 0.85)
          + albedo * (0.5 + 0.5 * n.y) * ao * vec3(0.25, 0.3, 0.4);`,
  blinn: `color = blinnPhong(n, v, light, albedo, 64.0, 0.6) * shadow * vec3(1.0, 0.95, 0.85)
          + albedo * (0.5 + 0.5 * n.y) * ao * vec3(0.25, 0.3, 0.4);`,
  toon: `color = toon(n, v, light, albedo, 3.0) * (0.5 + 0.5 * step(0.5, shadow));`,
  pbr: `color = pbr(n, v, light, albedo, metallic, roughness) * shadow * 3.0 * vec3(1.0, 0.95, 0.85)
          + pbrAmbient(n, v, albedo, metallic, roughness, vec3(0.35, 0.45, 0.6), vec3(0.15, 0.12, 0.1)) * ao;`,
};

function shade(minimal: boolean, materials: boolean, lighting: string, fogDistance: string): string {
  const lines = [
    'vec3 n = calcNormal(p);',
    'vec3 v = -rd;',
    'vec3 light = normalize(vec3(0.6, 0.8, 0.4));',
    minimal ? 'float shadow = 1.0;' : 'float shadow = softShadow(p, light, 0.02, 10.0, 16.0);',
    minimal ? 'float ao = 1.0;' : 'float ao = calcAO(p, n);',
    surface(materials, lighting === 'pbr'),
    LIGHT[lighting],
  ];
  if (!minimal) lines.push(`color = mix(color, sky, 1.0 - exp(-pow(t / ${fogDistance}, 3.0)));  // distance fog`);
  return lines.map((l) => `    ${l}`).join('\n');
}

export interface StarterOptions {
  /** GLSL defining `float scene(vec3 p)` (and, with `materials`, `vec2 sceneMaterial(vec3 p)`). */
  scene: string;
  /** Chunks the scene calls. */
  chunks: string[];
  minimal: boolean;
  materials?: boolean;
  /** One of LIGHTING_MODELS; default lambert. */
  lighting?: string;
  /** Camera orbit radius. */
  distance?: number;
}

/** A raymarching starter. Shared with `glsl:sdf --dim=3 --name`, which fills the scene with the picked shapes. */
export function raymarchStarter(file: string, version: Version, options: StarterOptions): Action[] {
  const { scene, chunks, minimal, materials = false, lighting = 'lambert', distance = 4 } = options;
  const parts = minimal ? ['march', 'normal', 'camera'] : ['march', 'normal', 'soft-shadow', 'ao', 'camera'];
  const color = lighting === 'pbr' ? ['lighting/pbr', 'lighting/pbr-ambient', 'color/aces', 'color/srgb'] : [`lighting/${lighting}`, 'color/srgb'];
  const output = lighting === 'pbr'
    ? '  // Exposure, then HDR → [0, 1] → sRGB for display.\n  fragColor = vec4(linearToSrgb(tonemapAces(color * 1.6)), 1.0);'
    : '  fragColor = vec4(linearToSrgb(color), 1.0);  // linear → sRGB for display';
  const body = `uniform float uTime;        // seconds since start
uniform vec2 uResolution;   // viewport size in pixels
uniform vec2 uMouse;        // pointer position in pixels, origin bottom-left

out vec4 fragColor;

${scene}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // Orbit slowly; move the pointer sideways to look around.
  float angle = 0.3 * uTime + 6.2831853 * uMouse.x / uResolution.x;
  vec3 eye = vec3(${distance.toFixed(1)} * sin(angle), ${(distance * 0.375).toFixed(2)}, ${distance.toFixed(1)} * cos(angle));
  vec3 rd = cameraMatrix(eye, vec3(0.0), 0.0) * normalize(vec3(uv, 1.5));

  vec3 sky = mix(vec3(0.8, 0.88, 1.0), vec3(0.35, 0.55, 0.9), clamp(2.0 * rd.y, 0.0, 1.0));
  vec3 color = sky;
  float t = raymarch(eye, rd, 30.0);
  if (t > 0.0) {
    vec3 p = eye + t * rd;
${shade(minimal, materials, lighting, (3 * distance).toFixed(1))}
  }

${output}
}
`;
  return [
    { add: file, template: withHeader(version, body) },
    ...chunkActions([...chunks, ...parts.map((part) => `raymarch/${part}`), ...color], { into: file, dir: '' }),
  ];
}

const raymarchGenerator: Generator = {
  description: 'raymarch signed distance fields',
  params: {
    name: { default: '' },
    minimal: { default: false },
    materials: { default: false },
    lighting: { default: 'lambert' },
    parts: { default: 'all' },
    into: { default: '' },
    dir: { default: 'shaders' },
    version: { default: '300es' },
  },
  actions: ({ name, minimal, materials, lighting, parts, into, dir, version }, { kebab }) => {
    const model = String(lighting);
    if (!LIGHTING_MODELS.includes(model)) {
      fail(`glsl:raymarch --lighting: expected one of ${LIGHTING_MODELS.map((m) => `"${m}"`).join(', ')}, got "${model}"`);
    }
    if (name && into) fail('glsl:raymarch: use either --name (new starter) or --into (existing shader), not both');
    if (name) {
      const file = inFolder(String(dir), `${kebab(String(name))}.frag.glsl`);
      return raymarchStarter(file, parseVersion(version), {
        scene: materials ? MATERIAL_SCENE : SCENE,
        chunks: SCENE_CHUNKS,
        minimal: Boolean(minimal),
        materials: Boolean(materials),
        lighting: model,
      });
    }
    if (materials) {
      fail(
        'glsl:raymarch --materials: only for a new starter (--name). The helpers work with any scene: ' +
          'give yours a `float scene(vec3 p)` returning the distance.',
      );
    }
    const ids = pickChunks('raymarch', parseList(String(parts)), '--parts', 'glsl:raymarch');
    return chunkActions(ids, { into: String(into), dir: String(dir) });
  },
};

export default raymarchGenerator;
