// @license MIT-0
// opOnion · pack-glsl · MIT-0
// Hollows a shape into a shell of thickness t; nest it for onion layers.
float opOnion(float d, float t) { return abs(d) - t; }
