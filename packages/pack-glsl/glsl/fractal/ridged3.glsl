// @requires noise/value3
// @base value
// @license MIT-0
// valueRidged (3D) · pack-glsl · MIT-0
// Ridged multifractal: fBm of (1 - |noise|)², sharp ridges where the
// noise crosses zero – mountain ranges, veins, lightning. Range [0, 1].
// Works on any jen noise: `jen glsl:noise --kind=… --base=perlin|simplex|value|worley`
// renames value* to the chosen base.

float valueRidged(vec3 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p);
    sum += amplitude * (1.0 - abs(n)) * (1.0 - abs(n));
    total += amplitude;
    amplitude *= 0.5;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
  }
  return sum / total;
}

// Tiles every `period` units (positive whole numbers): each octave doubles the
// period along with the frequency – the trick behind feTurbulence's stitchTiles.
float valueRidged(vec3 p, vec3 period, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    float n = valueNoise(p, period);
    sum += amplitude * (1.0 - abs(n)) * (1.0 - abs(n));
    total += amplitude;
    amplitude *= 0.5;
    p = p * 2.0 + vec3(0.31, 0.57, 0.83);
    period *= 2.0;
  }
  return sum / total;
}
