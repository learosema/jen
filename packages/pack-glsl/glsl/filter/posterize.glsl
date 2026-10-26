// levels per channel, 2 or more
vec3 posterize(vec3 c, float levels) {
  float n = max(levels - 1.0, 1.0);
  return floor(c * n + 0.5) / n;
}
