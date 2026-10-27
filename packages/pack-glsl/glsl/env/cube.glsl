// @requires color/srgb
// a cubemap (e.g. cubemap0) as an environment, in linear light; roughness picks a blurrier mip
vec3 envCube(samplerCube tex, vec3 dir, float roughness) {
  float lod = roughness * log2(float(textureSize(tex, 0).x));
  return srgbToLinear(textureLod(tex, dir, lod).rgb);
}
