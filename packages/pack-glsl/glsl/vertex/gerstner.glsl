// @license MIT-0
// gerstnerWave · pack-glsl · MIT-0
// One Gerstner (trochoidal) wave on a flat surface with y up: returns the
// offset for the point p and adds the wave's slope to tangent and binormal,
// so the normal stays exact. Sum several waves, starting from
//   vec3 tangent = vec3(1.0, 0.0, 0.0), binormal = vec3(0.0, 0.0, 1.0);
// and finish with normal = normalize(cross(binormal, tangent)).
// dir is the travel direction (xz), wavelength in units, steepness 0..1
// (sharper crests; keep the sum over all waves below 1 to avoid loops).
// Waves move at deep-water speed.
// Formulas: Mark Finch, "Effective Water Simulation from Physical Models", GPU Gems (2004), ch. 1.
vec3 gerstnerWave(vec3 p, vec2 dir, float wavelength, float steepness, float time, inout vec3 tangent, inout vec3 binormal) {
  float k = 6.28318530718 / wavelength;
  float speed = sqrt(9.81 / k);
  vec2 d = normalize(dir);
  float f = k * (dot(d, p.xz) - speed * time);
  float a = steepness / k;
  float s = steepness * sin(f);
  float c = steepness * cos(f);
  tangent += vec3(-d.x * d.x * s, d.x * c, -d.x * d.y * s);
  binormal += vec3(-d.x * d.y * s, d.y * c, -d.y * d.y * s);
  return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
}
