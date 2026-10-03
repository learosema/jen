// @requires noise/value3
// @base value
// @license MIT-0
// valueTurbulence (3D) · pack-glsl · MIT-0
// Turbulence: fBm of the noise's absolute value, like SVG feTurbulence's
// type="turbulence" – billowy, with sharp creases. Range [0, 1].
// `gain` scales each octave's amplitude (default 0.5; higher is rougher).
// The `period` overloads tile every `period` units (positive whole numbers):
// each octave doubles the period along with the frequency – the trick behind
// feTurbulence's stitchTiles. That's why the frequency step is fixed at 2.
// Works on any jen noise: `jen glsl:noise --kind=… --base=perlin|simplex|value|worley`
// renames value* to the chosen base.

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
