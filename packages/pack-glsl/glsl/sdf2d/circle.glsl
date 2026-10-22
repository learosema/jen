// @license iquilezles
// sdCircle · Inigo Quilez · MIT
// Signed distance to a circle of radius r around the origin.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/
float sdCircle(vec2 p, float r) { return length(p) - r; }
