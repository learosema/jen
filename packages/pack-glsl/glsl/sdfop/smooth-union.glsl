// @license iquilezles
// opSmoothUnion · Inigo Quilez · https://iquilezles.org/articles/smin/
// blends over the distance k > 0
float opSmoothUnion(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
