// @license iquilezles
// @requires sdfop/smooth-union
// opSmoothIntersect · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// Intersection with a rounded seam of size k.
float opSmoothIntersect(float a, float b, float k) { return -opSmoothUnion(-a, -b, k); }
