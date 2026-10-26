// @requires noise/value2
// @base value
// turbulence after Ken Perlin, An Image Synthesizer (SIGGRAPH 1985)
// fBm of |noise|, like feTurbulence type="turbulence"; [0, 1]

float valueTurbulence(vec2 p, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p);
    sum += amplitude * abs(n);
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec2(0.31, 0.57);
  }
  return sum / total;
}

float valueTurbulence(vec2 p, int octaves) { return valueTurbulence(p, octaves, 0.5); }

float valueTurbulence(vec2 p, vec2 period, int octaves, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p, period);
    sum += amplitude * abs(n);
    total += amplitude;
    amplitude *= gain;
    p = p * 2.0 + vec2(0.31, 0.57);
    period *= 2.0;
  }
  return sum / total;
}

float valueTurbulence(vec2 p, vec2 period, int octaves) { return valueTurbulence(p, period, octaves, 0.5); }
