// @license MIT-0
// hash · pack-glsl · MIT-0
// Hashes for integer lattice cells (whole-number coordinates, e.g. floor(p)),
// results in [0, 1). Mixing function: lowbias32 by Chris Wellons (public
// domain), https://github.com/skeeto/hash-prospector
uint lowbias32(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

uint hashCell(vec2 c) {
  uvec2 u = uvec2(ivec2(c));
  return lowbias32(u.x ^ lowbias32(u.y));
}

uint hashCell(vec3 c) {
  uvec3 u = uvec3(ivec3(c));
  return lowbias32(u.x ^ lowbias32(u.y ^ lowbias32(u.z)));
}

// The top 24 bits, so the result is exactly representable and never 1.0.
float hashToFloat(uint h) { return float(h >> 8) * (1.0 / 16777216.0); }

float hash21(vec2 c) { return hashToFloat(hashCell(c)); }
float hash31(vec3 c) { return hashToFloat(hashCell(c)); }

vec2 hash22(vec2 c) {
  uint h = hashCell(c);
  return vec2(hashToFloat(h), hashToFloat(lowbias32(h)));
}

vec3 hash33(vec3 c) {
  uint h = hashCell(c);
  uint h2 = lowbias32(h);
  return vec3(hashToFloat(h), hashToFloat(h2), hashToFloat(lowbias32(h2)));
}
