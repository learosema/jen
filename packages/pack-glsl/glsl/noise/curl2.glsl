// @requires noise/psrdnoise2
// @license MIT-0
// curlNoise (2D) · pack-glsl · MIT-0
// Divergence-free 2D flow (e.g. for particles): the gradient of simplex noise
// (psrdnoise, see its header above), rotated by 90°. `alpha` rotates the
// noise's gradients – animate it with time for swirling motion. Not
// normalized; the length varies across the field. The `period` overload tiles
// like simplexNoise.
vec2 curlNoise(vec2 p, float alpha) {
  vec2 g;
  psrdnoise(p, vec2(0.0), alpha, g);
  return vec2(g.y, -g.x);
}

vec2 curlNoise(vec2 p, vec2 period, float alpha) {
  vec2 g;
  psrdnoise(p, period, alpha, g);
  return vec2(g.y, -g.x);
}
