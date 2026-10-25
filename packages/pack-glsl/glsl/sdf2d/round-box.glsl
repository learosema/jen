// @requires sdf2d/box
// @license iquilezles
// sdRoundBox (2D) · Inigo Quilez · https://iquilezles.org/articles/distfunctions2d/
// b: the half size, including the rounding r
float sdRoundBox(vec2 p, vec2 b, float r) { return sdBox(p, b - r) - r; }
