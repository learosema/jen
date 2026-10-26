// @license iquilezles
// @requires sdfop/smooth-union
// opSmoothSubtract · Inigo Quilez · https://iquilezles.org/articles/distfunctions/
// Shape a with shape b cut out, with a rounded seam of size k.
float opSmoothSubtract(float a, float b, float k) { return -opSmoothUnion(-a, b, k); }
