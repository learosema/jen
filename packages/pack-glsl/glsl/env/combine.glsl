// Fresnel with roughness after Sébastien Lagarde (2011)
// like pbrAmbient, lit by an environment: irradiance = env(n, 1.0), reflection = env(reflect(-v, n), roughness)
vec3 pbrEnv(vec3 n, vec3 v, vec3 albedo, float metallic, float roughness, vec3 irradiance, vec3 reflection) {
  float nv = max(dot(n, v), 0.0);
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  vec3 fresnel = f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(1.0 - nv, 5.0);
  return (1.0 - fresnel) * (1.0 - metallic) * albedo * irradiance + fresnel * reflection;
}
