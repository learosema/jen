// @requires color/srgb
// a panorama (equirectangular image, e.g. texture0) as an environment, in linear light; roughness picks a blurrier mip
vec3 envEquirect(sampler2D tex, vec3 dir, float roughness) {
  const float PI = 3.14159265359;
  vec2 uv = vec2(0.5 + atan(dir.z, dir.x) / (2.0 * PI), 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / PI);
  float lod = roughness * log2(float(textureSize(tex, 0).x));
  return srgbToLinear(textureLod(tex, uv, lod).rgb);
}
