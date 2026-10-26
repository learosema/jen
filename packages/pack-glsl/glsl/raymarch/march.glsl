// sphere tracing after John C. Hart (1996)
// returns t at the surface, or -1.0 past tMax
// yours, defined further down: the distance from p to the nearest surface
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
