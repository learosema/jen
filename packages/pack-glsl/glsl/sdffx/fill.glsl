// 1 inside, 0 outside, a one-pixel edge; uses derivatives, so fragment shaders only
float fillMask(float d) {
  float w = max(fwidth(d), 1e-5);
  return clamp(0.5 - d / w, 0.0, 1.0);
}
