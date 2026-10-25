// @requires sdf3d/box
// @license iquilezles
// sdRoundBox (3D) · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// b: the half size, including the rounding r
float sdRoundBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
