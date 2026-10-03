// @requires sdfop/smooth-union
// @license MIT-0
// opSmoothIntersect · pack-glsl · MIT-0
// Intersection with a rounded seam of size k.
float opSmoothIntersect(float a, float b, float k) { return -opSmoothUnion(-a, -b, k); }
