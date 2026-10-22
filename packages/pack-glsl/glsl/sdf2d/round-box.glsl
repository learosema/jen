// @requires sdf2d/box
// @license iquilezles
// sdRoundBox (2D) · Inigo Quilez · MIT
// Box with rounded corners of radius r; b is the half size including the rounding.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/
float sdRoundBox(vec2 p, vec2 b, float r) { return sdBox(p, b - r) - r; }
