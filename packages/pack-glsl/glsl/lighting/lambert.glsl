vec3 lambert(vec3 n, vec3 l, vec3 albedo) {
  return albedo * max(dot(n, l), 0.0);
}
