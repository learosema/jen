// @requires noise/psrdnoise2
// @license MIT-0
// the gradient of simplex noise turned by 90°; animate alpha for swirls; not normalized
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
