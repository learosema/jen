/**
 * `glsl:displace`: moving surfaces in the vertex shader, normals included.
 *
 *   --kind=noise    displace(p, n) along the normal by your displacement(p) – here 3D simplex noise
 *   --kind=wobble   the same with a sine wobble (no noise needed)
 *   --kind=waves    a sum of Gerstner waves on a flat surface, with exact normals
 *
 * --into inserts the functions into a vertex shader (or <dir>/lib/ files).
 * --name writes a preview pair, <name>.vert.glsl and <name>.frag.glsl, for
 * the mesh attributes and uniforms <shader-canvas> provides:
 *
 *   <shader-canvas mesh="sphere" detail="96" vert="shaders/blob.vert.glsl" src="shaders/blob.frag.glsl" orbit>
 *
 * (waves: mesh="plane" detail="128").
 */
import type { Action, Generator } from '@codejen/jen';
import { chunkActions } from './chunks.ts';
import { fail, inFolder } from './common.ts';
import { parseVersion, withHeader } from './dialect.ts';
import type { Version } from './dialect.ts';

const KINDS: Record<string, string[]> = {
  noise: ['vertex/displace', 'noise/simplex3'],
  wobble: ['vertex/displace'],
  waves: ['vertex/gerstner', 'matrix/rotate'],
};

const DISPLACEMENT: Record<string, string> = {
  noise: `// How far to push the surface out at p (object space).
float displacement(vec3 p) {
  return 0.15 * simplexNoise(p * 2.0 + vec3(0.0, 0.0, 0.4 * uTime));
}`,
  wobble: `// How far to push the surface out at p (object space).
float displacement(vec3 p) {
  return 0.06 * sin(8.0 * p.y + 3.0 * uTime) * sin(6.0 * p.x + 2.0 * uTime);
}`,
};

const ATTRIBUTES = `layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;

uniform float uTime;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;`;

const OUTPUT = `  vec4 world = uModel * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(uModel) * n);  // uModel is a rotation here; use the inverse-transpose for scaling
  vUV = aUV;
  gl_Position = uProjection * uView * world;`;

function vertexShader(kind: string): string {
  if (kind === 'waves') {
    return `${ATTRIBUTES}

void main() {
  // The plane lies in xy; turn it into a y-up surface (xz) and tilt it towards the camera.
  vec3 p = 2.0 * vec3(aPosition.x, 0.0, -aPosition.y);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 offset = gerstnerWave(p, vec2(1.0, 0.3), 1.6, 0.25, uTime, tangent, binormal)
              + gerstnerWave(p, vec2(-0.4, 1.0), 0.9, 0.2, uTime, tangent, binormal)
              + gerstnerWave(p, vec2(0.7, -0.6), 0.5, 0.15, uTime, tangent, binormal);
  p = (p + offset) * 0.5;
  vec3 n = normalize(cross(binormal, tangent));
  mat3 tilt = rotateX(0.5);
  p = tilt * p;
  n = tilt * n;

${OUTPUT}
}
`;
  }
  return `${ATTRIBUTES}

${DISPLACEMENT[kind]}

void main() {
  vec3 p = aPosition;
  vec3 n = aNormal;
  displace(p, n);

${OUTPUT}
}
`;
}

function fragmentShader(kind: string): string {
  const albedo = kind === 'waves' ? 'vec3(0.05, 0.3, 0.5)' : 'vec3(0.95, 0.4, 0.6)';
  return `uniform mat4 uView;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;

out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 eye = -(transpose(mat3(uView)) * uView[3].xyz);  // camera position from the view matrix
  vec3 v = normalize(eye - vWorldPos);
  vec3 l = normalize(vec3(0.6, 0.8, 0.5));
  vec3 albedo = ${albedo};
  vec3 color = blinnPhong(n, v, l, albedo, 64.0, 0.5) + albedo * 0.2 * (0.5 + 0.5 * n.y);
  fragColor = vec4(linearToSrgb(color), 1.0);
}
`;
}

function preview(dir: string, base: string, kind: string, version: Version): Action[] {
  const vert = inFolder(dir, `${base}.vert.glsl`);
  const frag = inFolder(dir, `${base}.frag.glsl`);
  return [
    { add: vert, template: withHeader(version, vertexShader(kind)) },
    ...chunkActions(KINDS[kind], { into: vert, dir: '' }),
    { add: frag, template: withHeader(version, fragmentShader(kind)) },
    ...chunkActions(['lighting/blinn', 'color/srgb'], { into: frag, dir: '' }),
  ];
}

const displaceGenerator: Generator = {
  description: 'displace surfaces in the vertex shader with correct normals',
  params: {
    kind: { default: 'noise' },
    into: { default: '' },
    dir: { default: 'shaders' },
    name: { default: '' },
    version: { default: '300es' },
  },
  actions: ({ kind, into, dir, name, version }, { kebab }) => {
    const k = String(kind);
    if (!KINDS[k]) fail(`glsl:displace --kind: expected one of ${Object.keys(KINDS).map((x) => `"${x}"`).join(', ')}, got "${k}"`);
    if (name && into) fail('glsl:displace: use either --name (new preview pair) or --into (existing vertex shader), not both');
    if (name) return preview(String(dir), kebab(String(name)), k, parseVersion(version));
    // --into/files: just the building blocks; your displacement() decides the shape.
    const ids = k === 'waves' ? ['vertex/gerstner'] : ['vertex/displace'];
    return chunkActions(ids, { into: String(into), dir: String(dir) });
  },
};

export default displaceGenerator;
