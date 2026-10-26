// @license MIT-0
// falloff after Brian Karis, Real Shading in Unreal Engine 4 · https://blog.selfshadow.com/publications/s2013-shading-course/
// the light from lightPos arriving at p, 0 beyond range; sets l to the direction towards it
float pointLight(vec3 p, vec3 lightPos, float range, out vec3 l) {
  vec3 d = lightPos - p;
  float dist2 = dot(d, d);
  l = d * inversesqrt(max(dist2, 1e-8));
  float window = clamp(1.0 - pow(dist2 / (range * range), 2.0), 0.0, 1.0);
  return window * window / (dist2 + 1.0);
}
