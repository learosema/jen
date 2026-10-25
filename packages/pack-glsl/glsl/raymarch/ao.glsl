// @license MIT-0
// 0 fully occluded, 1 open
// yours, defined further down: the distance from p to the nearest surface
float scene(vec3 p);

float calcAO(vec3 p, vec3 n) {
  float occlusion = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.03 * float(i * i);
    occlusion += weight * (h - scene(p + n * h));
    weight *= 0.7;
  }
  return clamp(1.0 - 2.0 * occlusion, 0.0, 1.0);
}
