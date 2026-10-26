// 1 at the edge, 0 at depth w and outside
float innerShadowMask(float d, float w) {
  return d > 0.0 ? 0.0 : 1.0 - smoothstep(0.0, w, -d);
}
