// @license MIT-0
// rot2 · pack-glsl · MIT-0
// Counter-clockwise 2D rotation by `a` radians: p = rot2(a) * p;
mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}
