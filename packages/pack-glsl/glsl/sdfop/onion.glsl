// @license iquilezles
// opOnion · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// Hollows a shape into a shell of thickness t; nest it for onion layers.
float opOnion(float d, float t) { return abs(d) - t; }
