// @license iquilezles
// opRepeat · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// evaluate a shape at opRepeat(p, spacing); 2D and 3D
vec2 opRepeat(vec2 p, vec2 spacing) { return p - spacing * round(p / spacing); }
vec3 opRepeat(vec3 p, vec3 spacing) { return p - spacing * round(p / spacing); }
