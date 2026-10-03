// @license MIT-0
// opRepeat · pack-glsl · MIT-0
// Repeats space every `spacing` units: evaluate a shape at opRepeat(p, s)
// for an infinite grid of copies. 2D and 3D.
vec2 opRepeat(vec2 p, vec2 spacing) { return p - spacing * round(p / spacing); }
vec3 opRepeat(vec3 p, vec3 spacing) { return p - spacing * round(p / spacing); }
