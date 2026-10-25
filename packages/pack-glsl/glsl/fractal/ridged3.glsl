// @requires noise/value3
// @base value
// @license MIT-0
// fBm of (1 - |noise|)², sharp ridges where the noise crosses zero; [0, 1]

float valueRidged(vec3 p, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p);
    sum += amplitude * (1.0 - abs(n)) * (1.0 - abs(n));
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
  }
  return sum / total;
}

float valueRidged(vec3 p, int octaves) { return valueRidged(p, octaves, 0.5); }

float valueRidged(vec3 p, vec3 period, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p, period);
    sum += amplitude * (1.0 - abs(n)) * (1.0 - abs(n));
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
    period *= 2.0;
  }
  return sum / total;
}

float valueRidged(vec3 p, vec3 period, int octaves) { return valueRidged(p, period, octaves, 0.5); }
