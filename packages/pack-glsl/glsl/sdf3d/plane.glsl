// @license MIT-0
// sdPlane · pack-glsl · MIT-0
// Signed distance to the plane dot(p, n) + h = 0; n must be normalized.
// sdPlane(p, vec3(0.0, 1.0, 0.0), 1.0) is a floor at y = -1.
// Formula: Inigo Quilez, https://iquilezles.org/articles/distfunctions/
float sdPlane(vec3 p, vec3 n, float h) { return dot(p, n) + h; }
