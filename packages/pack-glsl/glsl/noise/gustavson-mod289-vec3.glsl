// @license webgl-noise
// mod289 for vec3, split out of webgl-noise's classicnoise3D.glsl.
// From webgl-noise classic noise: Copyright (c) 2011 Stefan Gustavson, MIT – https://github.com/stegu/webgl-noise

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
