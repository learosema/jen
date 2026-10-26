// after Mark Finch, GPU Gems (2004), ch. 1
// returns p's offset and adds the slope to tangent and binormal; keep the sum of steepness below 1
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
