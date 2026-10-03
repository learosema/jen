// @license MIT-0
// softShadow · pack-glsl · MIT-0
// Soft shadow towards a light: marches from ro along rd (to the light) and
// tracks how closely the ray passes geometry. 0 is full shadow, 1 fully lit;
// larger k gives harder shadows (try 8–32). Start at a small tMin to leave
// the surface.
// Technique: Inigo Quilez, https://iquilezles.org/articles/rmshadows/
// Your scene: the distance from p to the nearest surface, defined further down.
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
