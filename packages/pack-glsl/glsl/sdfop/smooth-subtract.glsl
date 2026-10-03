// @requires sdfop/smooth-union
// @license MIT-0
// opSmoothSubtract · pack-glsl · MIT-0
// Shape a with shape b cut out, with a rounded seam of size k.
float opSmoothSubtract(float a, float b, float k) { return -opSmoothUnion(-a, b, k); }
