// @license MIT-0
// glowMask · pack-glsl · MIT-0
// Soft glow around a shape, fading to about 37% at distance r outside.
// Add it under (or over) the shape itself.
float glowMask(float d, float r) { return exp(-max(d, 0.0) / r); }
