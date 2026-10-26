// bands: diffuse steps, plus a rim light; uses derivatives, so fragment shaders only
vec3 toon(vec3 n, vec3 v, vec3 l, vec3 albedo, float bands) {
  float nl = max(dot(n, l), 0.0) * bands;
  float band = floor(nl);
  float edge = fwidth(nl);
  float level = (band + smoothstep(1.0 - edge, 1.0, nl - band)) / bands;
  float rim = smoothstep(0.65, 0.7, 1.0 - max(dot(n, v), 0.0)) * smoothstep(0.0, 0.1, dot(n, l));
  return albedo * (0.15 + 0.85 * level) + vec3(0.35 * rim);
}
