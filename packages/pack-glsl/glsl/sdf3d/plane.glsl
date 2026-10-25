// @license iquilezles
// sdPlane · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// the plane dot(p, n) + h = 0, n normalized
float sdPlane(vec3 p, vec3 n, float h) { return dot(p, n) + h; }
