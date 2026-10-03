// @requires sdf3d/box
// @license MIT-0
// sdRoundBox (3D) · pack-glsl · MIT-0
// Box with rounded edges of radius r; b is the half size including the rounding.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float sdRoundBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
