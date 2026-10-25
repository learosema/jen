// @requires noise/value3
// @base value
// @license MIT-0
// about [-1, 1]; each octave doubles the period too, like feTurbulence's stitchTiles

float valueFbm(vec3 p, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p);
    sum += amplitude * n;
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
  }
  return sum / total;
}

float valueFbm(vec3 p, int octaves) { return valueFbm(p, octaves, 0.5); }

float valueFbm(vec3 p, vec3 period, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p, period);
    sum += amplitude * n;
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
    period *= 2.0;
  }
  return sum / total;
}

float valueFbm(vec3 p, vec3 period, int octaves) { return valueFbm(p, period, octaves, 0.5); }
