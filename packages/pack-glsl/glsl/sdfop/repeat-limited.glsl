// @license MIT-0
// opRepeatLimited · pack-glsl · MIT-0
// Like opRepeat, but only `limit` copies to each side of the origin per axis
// (limit 2 gives 5 copies). 2D and 3D.
vec2 opRepeatLimited(vec2 p, vec2 spacing, vec2 limit) { return p - spacing * clamp(round(p / spacing), -limit, limit); }
vec3 opRepeatLimited(vec3 p, vec3 spacing, vec3 limit) { return p - spacing * clamp(round(p / spacing), -limit, limit); }
