// @requires util/hash
// @license MIT-0
// worley (3D) · pack-glsl · MIT-0
// Cellular (Worley) noise: one random feature point per lattice cell.
// worley() returns the distances to the nearest and second-nearest point
// (F1, F2); worleyNoise() is F1 mapped to about [-1, 1] like the other
// noises. The `period` overloads tile every `period` units (positive whole
// numbers).
vec2 worley(vec3 p, vec3 period) {
  vec3 i = floor(p);
  vec3 f = p - i;
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = o + hash33(mod(i + o, period)) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return sqrt(vec2(d1, d2));
}

vec2 worley(vec3 p) { return worley(p, vec3(65536.0)); }

float worleyNoise(vec3 p, vec3 period) { return worley(p, period).x * 2.0 - 1.0; }
float worleyNoise(vec3 p) { return worley(p).x * 2.0 - 1.0; }
