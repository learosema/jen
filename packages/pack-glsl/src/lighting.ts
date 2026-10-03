/**
 * `glsl:lighting`: shading models and color output.
 *
 *   --models=lambert,blinn,toon,pbr   lambert(n, l, albedo), blinnPhong(n, v, l, albedo, shininess, specular),
 *                                     toon(n, v, l, albedo, bands), pbr(n, v, l, albedo, metallic, roughness)
 *                                     (pbr also brings pbrAmbient(), a sky/ground ambient light)
 *   --tonemap=aces,reinhard,srgb      tonemapAces(c), tonemapReinhard(c): HDR → [0, 1];
 *                                     linearToSrgb(c) / srgbToLinear(c) for display encoding
 *
 * Every model returns the light reflected towards the viewer for a white
 * light of intensity 1, so models are interchangeable. To see one in action:
 * `jen glsl:raymarch --name=Scene --lighting=pbr`.
 */
import type { Generator } from '@codejen/jen';
import { chunkActions, chunkIds, pickChunks } from './chunks.ts';
import { fail, parseList } from './common.ts';

const TONEMAP_NAMES: Record<string, string> = { aces: 'color/aces', reinhard: 'color/reinhard', srgb: 'color/srgb' };

const lightingGenerator: Generator = {
  description:
    'add lighting (--models=lambert,blinn,toon,pbr) and color output (--tonemap=aces,reinhard,srgb) --into a shader or as files in <dir>/lib/; each takes "all"',
  params: {
    models: { default: '' },
    tonemap: { default: '' },
    into: { default: '' },
    dir: { default: 'shaders' },
  },
  actions: ({ models, tonemap, into, dir }) => {
    const modelList = parseList(String(models));
    const tonemapList = parseList(String(tonemap));
    const modelNames = chunkIds('lighting')
      .map((id) => id.slice('lighting/'.length))
      .filter((m) => m !== 'pbr-ambient');
    if (modelList.length + tonemapList.length === 0) {
      fail(`glsl:lighting: pick something – --models=${modelNames.join(', ')}; --tonemap=${Object.keys(TONEMAP_NAMES).join(', ')} (each also takes "all")`);
    }

    const ids = modelList.length ? pickChunks('lighting', modelList, '--models', 'glsl:lighting') : [];
    if (ids.includes('lighting/pbr') && !ids.includes('lighting/pbr-ambient')) ids.push('lighting/pbr-ambient');

    for (const name of tonemapList.includes('all') ? Object.keys(TONEMAP_NAMES) : tonemapList) {
      const id = TONEMAP_NAMES[name];
      if (!id) fail(`glsl:lighting --tonemap: unknown "${name}" – valid: ${Object.keys(TONEMAP_NAMES).join(', ')} (or "all")`);
      ids.push(id);
    }
    return chunkActions(ids, { into: String(into), dir: String(dir) });
  },
};

export default lightingGenerator;
