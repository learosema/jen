// @license MIT-0
// raymarch · pack-glsl · MIT-0
// Sphere tracing: steps along the ray ro + t * rd by the distance scene()
// returns, until it hits a surface (returns t) or passes tMax (returns -1.0).
// Needs `float scene(vec3 p)` in your shader.
// Your scene: the distance from p to the nearest surface, defined further down.
float scene(vec3 p);

float raymarch(vec3 ro, vec3 rd, float tMax) {
  float t = 0.0;
  for (int i = 0; i < 256; i++) {
    float d = scene(ro + t * rd);
    // Relative epsilon: far surfaces don't need sub-pixel precision.
    if (abs(d) < 0.0005 * t + 0.0001) return t;
    t += d;
    if (t > tMax) break;
  }
  return -1.0;
}
