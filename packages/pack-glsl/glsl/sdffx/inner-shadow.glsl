// @license MIT-0
// innerShadowMask · pack-glsl · MIT-0
// Shadow inside a shape along its edge: 1 at the edge, fading to 0 at
// depth w, 0 outside. Shift p for a directional inner shadow.
float innerShadowMask(float d, float w) {
  return d > 0.0 ? 0.0 : 1.0 - smoothstep(0.0, w, -d);
}
