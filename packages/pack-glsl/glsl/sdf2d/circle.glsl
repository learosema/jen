// @license MIT-0
// sdCircle · pack-glsl · MIT-0
// Signed distance to a circle of radius r around the origin.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/
float sdCircle(vec2 p, float r) { return length(p) - r; }
