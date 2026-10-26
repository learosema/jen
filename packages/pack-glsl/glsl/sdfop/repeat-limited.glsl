// @license iquilezles
// opRepeatLimited · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// limit copies to each side per axis (2 gives 5); 2D and 3D
vec2 opRepeatLimited(vec2 p, vec2 spacing, vec2 limit) { return p - spacing * clamp(round(p / spacing), -limit, limit); }
vec3 opRepeatLimited(vec3 p, vec3 spacing, vec3 limit) { return p - spacing * clamp(round(p / spacing), -limit, limit); }
