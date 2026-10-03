// @requires noise/psrdnoise3
// @license MIT-0
// curlNoise (3D) · pack-glsl · MIT-0
// Divergence-free 3D flow (e.g. for particles): the curl of a vector field
// made of three offset simplex noises (psrdnoise, see its header above).
// `alpha` rotates the noise's gradients – animate it with time for swirling
// motion. Not normalized. The `period` overload tiles like simplexNoise.
vec3 curlNoise(vec3 p, vec3 period, float alpha) {
  vec3 gx;
  vec3 gy;
  vec3 gz;
  psrdnoise(p, period, alpha, gx);
  psrdnoise(p + vec3(19.1, 33.4, 47.2), period, alpha, gy);
  psrdnoise(p + vec3(74.2, -124.5, 99.4), period, alpha, gz);
  return vec3(gz.y - gy.z, gx.z - gz.x, gy.x - gx.y);
}

vec3 curlNoise(vec3 p, float alpha) { return curlNoise(p, vec3(0.0), alpha); }
