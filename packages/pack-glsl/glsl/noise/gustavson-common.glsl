// @license webgl-noise
// Shared helpers of webgl-noise's classic noise (split out of classicnoise2D/3D.glsl
// so 2D and 3D noise can live in one shader).
// From webgl-noise classic noise: Copyright (c) 2011 Stefan Gustavson, MIT – https://github.com/stegu/webgl-noise

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}
