// @license MIT-0
// about 37% at distance r outside the shape
float glowMask(float d, float r) { return exp(-max(d, 0.0) / r); }
