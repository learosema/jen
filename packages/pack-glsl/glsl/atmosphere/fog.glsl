// t the distance along the ray; fogColor e.g. skyColor(rd, sun), so the horizon blends in
vec3 fogExp(vec3 color, vec3 fogColor, float t, float density) {
  return mix(color, fogColor, 1.0 - exp(-t * density));
}

// clear up close, thick far away
vec3 fogExp2(vec3 color, vec3 fogColor, float t, float density) {
  float d = t * density;
  return mix(color, fogColor, 1.0 - exp(-d * d));
}
