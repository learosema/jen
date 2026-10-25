/**
 * `glsl:raymarch`: sphere tracing signed distance fields.
 *
 *   --name=Scene [--lighting=lambert|blinn|toon|pbr] [--minimal] [--materials]
 *                    a starter: scene() with a small scene, camera orbit, soft shadows,
 *                    ambient occlusion and fog, lit with the chosen model (see
 *                    glsl:lighting); --minimal: no shadows, AO or fog;
 *                    --materials: sceneMaterial() returns a material id per surface
 *   --name=Land --scene=terrain [--water] [--minimal]
 *                    a heightfield flyover instead: terrain() from fbm and ridged
 *                    noise, materials by slope and height, sky, sun and fog
 *   --into=<shader>  the helpers for your own scene(): raymarch, calcNormal, softShadow,
 *                    calcAO, cameraMatrix (pick with --parts=march,normal,…)
 *
 * The helpers call `float scene(vec3 p)`, which they declare as a prototype,
 * so your scene can live anywhere in the shader. Material scenes keep that
 * contract: `scene()` returns sceneMaterial(p).x, and the material id is
 * looked up once per pixel at the hit point – the helpers stay the same.
 */
import type { Action, Context, Generator } from '@codejen/jen';
import { MARKER_LINE, chunkActions, pickChunks } from './chunks.ts';
import { fail, parseList } from './common.ts';
import { VERSIONS, parseVersion, withHeader } from './dialect.ts';
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
export function raymarchStarter(file: string, version: Version, ctx: Context, options: StarterOptions): Action[] {
  const { scene, chunks, minimal, materials = false, lighting = 'lambert', distance = 4 } = options;
  const parts = minimal ? ['march', 'normal', 'camera'] : ['march', 'normal', 'soft-shadow', 'ao', 'camera'];
  const color = lighting === 'pbr' ? ['lighting/pbr', 'lighting/pbr-ambient', 'color/aces', 'color/srgb'] : [`lighting/${lighting}`, 'color/srgb'];
  const output = lighting === 'pbr'
    ? '  // Exposure, then HDR → [0, 1] → sRGB for display.\n  fragColor = vec4(linearToSrgb(tonemapAces(color * 1.6)), 1.0);'
    : '  fragColor = vec4(linearToSrgb(color), 1.0);  // linear → sRGB for display';
  // the marker goes above the scene's own comment, so the functions don't come between them
  const body = `uniform float uTime;        // seconds since start
uniform vec2 uResolution;   // viewport size in pixels
uniform vec2 uMouse;        // pointer position in pixels, origin bottom-left

out vec4 fragColor;

${MARKER_LINE}
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
    ...chunkActions([...chunks, ...parts.map((part) => `raymarch/${part}`), ...color], { into: file, dir: '', ctx }),
  ];
}

const TERRAIN_CHUNKS = ['fractal/fbm2@simplex', 'fractal/ridged2@simplex', 'raymarch/march', 'raymarch/normal', 'raymarch/camera', 'lighting/lambert', 'atmosphere/sky', 'color/srgb'];

/** A heightfield flyover: terrain() from noise, the camera flying over it, materials by slope and height. */
function terrainStarter(file: string, version: Version, ctx: Context, { water, minimal }: { water: boolean; minimal: boolean }): Action[] {
  const sand = water ? `
  albedo = mix(albedo, vec3(0.4, 0.34, 0.22), smoothstep(WATER + 0.05, WATER + 0.01, p.y));  // sand at the shore` : '';
  const waterHit = water ? `
  // The water: a plane at y = WATER, in front of the terrain or where the ray misses it.
  float tw = rd.y < 0.0 ? (WATER - eye.y) / rd.y : -1.0;
  if (tw > 0.0 && (t < 0.0 || tw < t)) {
    vec3 p = eye + tw * rd;
    vec3 n = normalize(vec3(0.04 * simplexNoise(p.xz * 3.0 + uTime), 1.0, 0.04 * simplexNoise(p.zx * 3.0 - uTime)));
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);  // Schlick
    vec3 r = reflect(rd, n);
    color = mix(vec3(0.01, 0.04, 0.06), skyColor(r, sun), fresnel)
          + vec3(1.0, 0.85, 0.6) * pow(max(dot(r, sun), 0.0), 600.0) * 1.5;  // sun glint
    t = tw;
  }` : '';
  const shadow = minimal ? '1.0' : 'softShadow(p + 0.02 * n, sun, 0.05, 12.0, 12.0)';
  const fog = minimal ? '' : `
  if (t > 0.0) color = fogExp2(color, skyColor(rd, sun), t, 0.022);  // haze toward the horizon`;
  const body = `uniform float uTime;        // seconds since start
uniform vec2 uResolution;   // viewport size in pixels
uniform vec2 uMouse;        // pointer position in pixels, origin bottom-left

out vec4 fragColor;
${water ? '\nconst float WATER = 0.45;  // the water level\n' : ''}
${MARKER_LINE}
// The ground's height at xz: rolling hills, and ridged mountains where the mask is high.
float terrain(vec2 xz) {
  vec2 p = 0.12 * xz;
  float hills = 0.5 + 0.5 * simplexFbm(p, 4);
  float mountains = simplexRidged(0.7 * p + vec2(5.2, 1.3), 6);
  float mask = smoothstep(0.35, 0.75, 0.5 + 0.5 * simplexFbm(0.25 * p + vec2(-3.1, 7.7), 3));
  return 1.2 * hills + 3.5 * mask * mountains * mountains;
}

// A heightfield isn't a true distance: the steeper the slopes, the smaller this factor must be.
float scene(vec3 p) { return 0.4 * (p.y - terrain(p.xz)); }

// Rock on steep slopes, grass on flat ground, snow up high.
vec3 terrainColor(vec3 p, vec3 n) {
  float slope = 1.0 - n.y;  // 0 flat, 1 vertical
  vec3 albedo = mix(vec3(0.07, 0.13, 0.03), vec3(0.16, 0.13, 0.11), smoothstep(0.12, 0.3, slope));${sand}
  float snowLine = 2.3 + 0.3 * simplexNoise(0.5 * p.xz);
  return mix(albedo, vec3(0.8, 0.85, 0.9), smoothstep(snowLine, snowLine + 0.2, p.y) * smoothstep(0.55, 0.35, slope));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // Fly forward above the peaks; move the pointer sideways to look around.
  float turn = 1.5 * (uMouse.x / uResolution.x - 0.5) * step(1.0, uMouse.x);
  vec3 eye = vec3(2.0 * sin(0.05 * uTime), 4.8, 1.2 * uTime);
  vec3 target = eye + vec3(sin(turn), -0.25, cos(turn));
  vec3 rd = cameraMatrix(eye, target, 0.0) * normalize(vec3(uv, 1.5));

  vec3 sun = normalize(vec3(-0.5, 0.35, 0.8));
  vec3 color = skyColor(rd, sun);
  float t = raymarch(eye, rd, 80.0);
  if (t > 0.0) {
    vec3 p = eye + t * rd;
    vec3 n = calcNormal(p);
    float shadow = ${shadow};
    vec3 albedo = terrainColor(p, n);
    color = lambert(n, sun, albedo) * shadow * vec3(1.0, 0.9, 0.75) * 3.0
          + albedo * (0.5 + 0.5 * n.y) * vec3(0.35, 0.45, 0.6);  // sky light, so shadows aren't black
  }${waterHit}${fog}

  fragColor = vec4(linearToSrgb(color), 1.0);  // linear → sRGB for display
}
`;
  const chunks = [...TERRAIN_CHUNKS, ...(minimal ? [] : ['raymarch/soft-shadow', 'atmosphere/fog'])];
  return [{ add: file, template: withHeader(version, body) }, ...chunkActions(chunks, { into: file, dir: '', ctx })];
}

export const SCENES = ['shapes', 'terrain'];

const raymarchGenerator: Generator = {
  description: 'raymarch signed distance fields',
  params: {
    name: { default: '', description: 'create a starter shader with this name: a small scene, orbiting camera, shadows, AO and fog' },
    scene: { default: 'shapes', choices: SCENES, description: 'with --name: shapes, or terrain – a heightfield flyover with sky, sun and fog' },
    water: { default: false, description: 'with --scene=terrain: a water plane in the valleys, with sand at the shore' },
    minimal: { default: false, description: 'with --name: leave out soft shadows, ambient occlusion and fog' },
    materials: { default: false, description: 'with --name: a material id per surface, for different colors' },
    lighting: { default: 'lambert', choices: LIGHTING_MODELS, description: 'with --name: the shading model (see glsl:lighting)' },
    parts: { default: 'all', description: 'with --into, comma-separated: march, normal, soft-shadow, ao, camera – or all' },
    into: { path: true, default: '', description: 'existing shader or --inline page to add the raymarching helpers to, for your own scene()' },
    version: { default: '300es', choices: VERSIONS, description: 'GLSL dialect: 300es is WebGL2, 330 and 410 desktop OpenGL' },
  },
  usage: [
    'the helpers call your float scene(vec3 p): the distance from p to the nearest surface',
    'vec3 rd = cameraMatrix(eye, target, 0.0) * normalize(vec3(uv, 1.5));  uv centered, y from -0.5 to 0.5; a larger focal length (1.5) zooms in',
    'softShadow(ro, rd, tMin, tMax, k): start at a small tMin to leave the surface; k 8–32, larger is harder',
  ],
  examples: [
    '--name=Scene',
    '--name=Scene --lighting=pbr --materials --dir=shaders',
    '--name=Land --scene=terrain --water',
    '--parts=march,normal --into=shaders/scene.frag.glsl',
  ],
  actions: ({ name, scene, water, minimal, materials, lighting, parts, into, version }, { kebab }, ctx) => {
    const model = String(lighting);
    if (!SCENES.includes(String(scene))) fail(`glsl:raymarch --scene: expected "shapes" or "terrain", got "${String(scene)}"`);
    const terrain = scene === 'terrain';
    if ((terrain || water) && !name) fail('glsl:raymarch --scene and --water: only for a new starter (--name)');
    if (water && !terrain) fail('glsl:raymarch --water: only with --scene=terrain');
    if (terrain && (materials || model !== 'lambert')) fail('glsl:raymarch --scene=terrain: lit with lambert, by slope and height – --materials and --lighting are for the shapes scene');
    if (!LIGHTING_MODELS.includes(model)) {
      fail(`glsl:raymarch --lighting: expected one of ${LIGHTING_MODELS.map((m) => `"${m}"`).join(', ')}, got "${model}"`);
    }
    if (name && into) fail('glsl:raymarch: use either --name (new starter) or --into (existing shader), not both');
    if (name) {
      const file = `${kebab(String(name))}.frag.glsl`;
      if (terrain) return terrainStarter(file, parseVersion(version), ctx, { water: Boolean(water), minimal: Boolean(minimal) });
      return raymarchStarter(file, parseVersion(version), ctx, {
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
    return chunkActions(ids, { into: String(into), dir: '', ctx });
  },
};

export default raymarchGenerator;
