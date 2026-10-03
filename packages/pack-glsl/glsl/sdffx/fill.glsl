// @license MIT-0
// fillMask · pack-glsl · MIT-0
// Antialiased coverage of a shape from its signed distance d: 1 inside, 0
// outside, a one-pixel ramp at the edge (screen-space derivatives, so
// fragment shaders only).
float fillMask(float d) {
  float w = max(fwidth(d), 1e-5);
  return clamp(0.5 - d / w, 0.0, 1.0);
}
