// @requires noise/value3
// @base value
// @license MIT-0
// fBm of |noise|, like feTurbulence type="turbulence"; [0, 1]

float valueTurbulence(vec3 p, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p);
    sum += amplitude * abs(n);
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
  }
  return sum / total;
}

float valueTurbulence(vec3 p, int octaves) { return valueTurbulence(p, octaves, 0.5); }

float valueTurbulence(vec3 p, vec3 period, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p, period);
    sum += amplitude * abs(n);
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
    period *= 2.0;
  }
  return sum / total;
}

float valueTurbulence(vec3 p, vec3 period, int octaves) { return valueTurbulence(p, period, octaves, 0.5); }
