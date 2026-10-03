// @license MIT-0
// pbrAmbient · pack-glsl · MIT-0
// Cheap image-free ambient light for pbr(): a sky/ground hemisphere for
// the diffuse part, the same gradient in the reflection direction for the
// specular part, blurred towards the diffuse one with roughness. Multiply by
// ambient occlusion if you have it.
// Fresnel with roughness: Sébastien Lagarde (2011).
vec3 pbrAmbient(vec3 n, vec3 v, vec3 albedo, float metallic, float roughness, vec3 sky, vec3 ground) {
  float nv = max(dot(n, v), 0.0);
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  // Fresnel with roughness: rough surfaces don't get a bright grazing rim.
  vec3 fresnel = f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 irradiance = mix(ground, sky, 0.5 + 0.5 * n.y);
  vec3 r = reflect(-v, n);
  vec3 reflection = mix(mix(ground, sky, smoothstep(-0.1, 0.1, r.y)), irradiance, roughness);
  return (1.0 - fresnel) * (1.0 - metallic) * albedo * irradiance + fresnel * reflection;
}
