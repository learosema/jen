// @license MIT-0
// sdSphere · pack-glsl · MIT-0
// Signed distance to a sphere of radius r around the origin.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float sdSphere(vec3 p, float r) { return length(p) - r; }
