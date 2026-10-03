// @license MIT-0
// opSmoothUnion · pack-glsl · MIT-0
// Union blended over a distance k (k > 0): shapes melt into each other.
// Quadratic polynomial smooth minimum.
// Formula: Inigo Quilez, https://iquilezles.org/articles/smin/
float opSmoothUnion(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
