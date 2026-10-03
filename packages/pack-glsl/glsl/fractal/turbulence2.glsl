// @requires noise/value2
// @base value
// @license MIT-0
// valueTurbulence (2D) · pack-glsl · MIT-0
// Turbulence: fBm of the noise's absolute value, like SVG feTurbulence's
// type="turbulence" – billowy, with sharp creases. Range [0, 1].
// Works on any jen noise: `jen glsl:noise --kind=… --base=perlin|simplex|value|worley`
// renames value* to the chosen base.

float valueTurbulence(vec2 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p);
    sum += amplitude * abs(n);
    total += amplitude;
    amplitude *= 0.5;
    p = p * 2.0 + vec2(0.31, 0.57);
  }
  return sum / total;
}

// Tiles every `period` units (positive whole numbers): each octave doubles the
// period along with the frequency – the trick behind feTurbulence's stitchTiles.
float valueTurbulence(vec2 p, vec2 period, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p, period);
    sum += amplitude * abs(n);
    total += amplitude;
    amplitude *= 0.5;
    p = p * 2.0 + vec2(0.31, 0.57);
    period *= 2.0;
  }
  return sum / total;
}
