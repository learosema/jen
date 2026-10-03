// @requires sdf2d/box
// @license MIT-0
// sdRoundBox (2D) · pack-glsl · MIT-0
// Box with rounded corners of radius r; b is the half size including the rounding.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/
float sdRoundBox(vec2 p, vec2 b, float r) { return sdBox(p, b - r) - r; }
