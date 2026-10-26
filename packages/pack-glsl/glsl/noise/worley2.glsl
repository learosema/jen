// @requires util/hash
// cellular noise after Steven Worley (SIGGRAPH 1996)
// worley(): distances to the nearest and second-nearest point; worleyNoise(): the first in about [-1, 1]
vec2 worley(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = p - i;
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 r = o + hash22(mod(i + o, period)) - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return sqrt(vec2(d1, d2));
}

vec2 worley(vec2 p) { return worley(p, vec2(65536.0)); }

float worleyNoise(vec2 p, vec2 period) { return worley(p, period).x * 2.0 - 1.0; }
float worleyNoise(vec2 p) { return worley(p).x * 2.0 - 1.0; }
