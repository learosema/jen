/**
 * `glsl:lighting`: shading models and color output.
 *
 *   --models=lambert,blinn,toon,pbr   lambert(n, l, albedo), blinnPhong(n, v, l, albedo, shininess, specular),
 *                                     toon(n, v, l, albedo, bands), pbr(n, v, l, albedo, metallic, roughness)
 *                                     (pbr also brings pbrAmbient(), a sky/ground ambient light)
 *   --tonemap=aces,reinhard,srgb      tonemapAces(c), tonemapReinhard(c): HDR → [0, 1];
 *                                     linearToSrgb(c) / srgbToLinear(c) for display encoding
 *   --sky, --fog                      skyColor(rd, sun), day to dusk to night by the sun's height; fogExp(), fogExp2()
 *   --point                           pointLight(p, lightPos, range, out l): inverse-square falloff to 0 at range
 *   --env=sky|equirect|cube           envSky / envEquirect / envCube(…, dir, roughness) and pbrEnv(): an environment to light and reflect
 *
 * Every model returns the light reflected towards the viewer for a white
 * light of intensity 1, so models are interchangeable. To see one in action:
 * `jen glsl:raymarch --name=Scene --lighting=pbr`.
 */
import type { Generator } from '@codejen/jen';
import { chunkActions, chunkIds, pickChunks } from './chunks.ts';
import { fail, parseList } from './common.ts';

export const ENVS = ['sky', 'equirect', 'cube'];

const TONEMAP_NAMES: Record<string, string> = { aces: 'color/aces', reinhard: 'color/reinhard', srgb: 'color/srgb' };

const lightingGenerator: Generator = {
  description: 'add lighting and color output',
  params: {
    models: { default: '', description: 'comma-separated shading models: lambert, blinn, toon, pbr – or all (pick at least one of --models, --tonemap, --sky, --fog, --point, --env)' },
    tonemap: { default: '', description: 'comma-separated color output: aces, reinhard (HDR to [0, 1]), srgb (display encoding) – or all (pick at least one of --models, --tonemap, --sky, --fog, --point, --env)' },
    sky: { default: false, description: 'skyColor(rd, sun): a gradient with the sun\'s glow and disc – a low sun gives dusk, one below the horizon night (pick at least one of --models, --tonemap, --sky, --fog, --point, --env)' },
    fog: { default: false, description: 'fogExp() and fogExp2(): fade to a color (the sky\'s) with distance (pick at least one of --models, --tonemap, --sky, --fog, --point, --env)' },
    point: { default: false, description: 'pointLight(): a light at a position, inverse-square falloff ending at a range – for torches, lamps (pick at least one of --models, --tonemap, --sky, --fog, --point, --env)' },
    env: { default: '', choices: ENVS, description: 'an environment to reflect and be lit by: sky (follows the sun), equirect (a panorama in texture0), cube (cubemap0) – with pbrEnv() (pick at least one of --models, --tonemap, --sky, --fog, --point, --env)' },
    into: { path: true, default: '', description: 'existing shader or --inline page to insert the functions into, before main() (default: one file each in lib/)' },
  },
  usage: [
    'every model takes the normal n, the direction to the viewer v and to the light l (all normalized) and returns the light reflected for a white light of intensity 1 – multiply by your light\'s color and shadow, and sum over lights',
    'light in linear space; tonemapAces() or tonemapReinhard() map HDR to [0, 1], then linearToSrgb() encodes for display',
    'pbr() includes the 1/π of the diffuse term: a sun needs about intensity 3 to look as bright as with lambert()',
    'color = fogExp2(color, skyColor(rd, sun), t, 0.02);  t the distance along the ray: far surfaces fade into the sky',
    'color += pbrEnv(n, v, albedo, metallic, roughness, envSky(n, sun, 1.0), envSky(reflect(-v, n), sun, roughness)) * ao;  the environment instead of pbrAmbient – envEquirect(uTexture0, …) or envCube(uCubemap0, …) alike',
    'for (int i = 0; i < 4; i++) { vec3 l; float a = pointLight(p, lamps[i], 8.0, l); color += lambert(n, l, albedo) * a * 10.0 * lampColor; }  sum over lights; a shadow is softShadow(p + 0.01 * n, l, 0.02, distance(p, lamps[i]), 16.0)',
  ],
  examples: ['--models=pbr --tonemap=aces,srgb --into=shaders/scene.frag.glsl', '--sky --fog --into=index.html', '--models=pbr --point --into=index.html', '--models=pbr --env=sky --into=index.html'],
  actions: ({ models, tonemap, sky, fog, point, env, into }, _helpers, ctx) => {
    const modelList = parseList(String(models));
    const tonemapList = parseList(String(tonemap));
    const modelNames = chunkIds('lighting')
      .map((id) => id.slice('lighting/'.length))
      .filter((m) => m !== 'pbr-ambient');
    if (modelList.length + tonemapList.length === 0 && !sky && !fog && !point && !env) {
      fail(`glsl:lighting: pick something – --models=${modelNames.join(', ')}; --tonemap=${Object.keys(TONEMAP_NAMES).join(', ')} (each also takes "all"); --sky, --fog, --point, --env=${ENVS.join('|')}`);
    }

    const ids = modelList.length ? pickChunks('lighting', modelList, '--models', 'glsl:lighting') : [];
    if (ids.includes('lighting/pbr') && !ids.includes('lighting/pbr-ambient')) ids.push('lighting/pbr-ambient');

    for (const name of tonemapList.includes('all') ? Object.keys(TONEMAP_NAMES) : tonemapList) {
      const id = TONEMAP_NAMES[name];
      if (!id) fail(`glsl:lighting --tonemap: unknown "${name}" – valid: ${Object.keys(TONEMAP_NAMES).join(', ')} (or "all")`);
      ids.push(id);
    }
    if (sky) ids.push('atmosphere/sky');
    if (fog) ids.push('atmosphere/fog');
    if (point) ids.push('lights/point');
    if (env && !ENVS.includes(String(env))) fail(`glsl:lighting --env: expected ${ENVS.map((e) => `"${e}"`).join(', ')}, got "${String(env)}"`);
    if (env) ids.push(`env/${String(env)}`, 'env/combine');
    return chunkActions(ids, { into: String(into), dir: '', ctx });
  },
};

export default lightingGenerator;
