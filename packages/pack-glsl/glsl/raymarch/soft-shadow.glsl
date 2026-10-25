// @license iquilezles
// softShadow · Inigo Quilez · https://iquilezles.org/articles/rmshadows/
// 0 shadow, 1 lit; larger k is harder (8–32); start at a small tMin
// yours, defined further down: the distance from p to the nearest surface
float scene(vec3 p);

float softShadow(vec3 ro, vec3 rd, float tMin, float tMax, float k) {
  float result = 1.0;
  float t = tMin;
  for (int i = 0; i < 64; i++) {
    float h = scene(ro + t * rd);
    result = min(result, k * h / t);
    if (result < 0.001 || t > tMax) break;
    t += clamp(h, 0.01, 0.5);
  }
  return clamp(result, 0.0, 1.0);
}
