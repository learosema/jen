// @license MIT-0
// opRevolve · pack-glsl · MIT-0
// Spins a 2D shape around the y axis at distance o: evaluate a 2D shape at
// opRevolve(p, o), e.g. sdBox(opRevolve(p, 1.0), vec2(0.2)) for a square ring.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
vec2 opRevolve(vec3 p, float o) { return vec2(length(p.xz) - o, p.y); }
