// @license iquilezles
// opRevolve · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// evaluate a 2D shape at opRevolve(p, o): spun around y at distance o
vec2 opRevolve(vec3 p, float o) { return vec2(length(p.xz) - o, p.y); }
