// @requires noise/psrdnoise3
// curl noise after Robert Bridson et al. (SIGGRAPH 2007)
// the curl of three offset simplex noises; animate alpha for swirls; not normalized
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
