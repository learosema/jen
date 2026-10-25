// @license webgl-noise
// mod289 (vec3) · Stefan Gustavson (webgl-noise) · https://github.com/stegu/webgl-noise

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
