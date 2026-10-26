// @requires filter/grayscale
// amount 0 keeps the colors, 1 is all sepia
vec3 sepia(vec3 c, float amount) {
  return mix(c, min(grayscale(c) * vec3(1.07, 0.85, 0.6), 1.0), amount);
}
