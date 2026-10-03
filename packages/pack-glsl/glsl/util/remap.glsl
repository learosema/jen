// @license MIT-0
// remap · pack-glsl · MIT-0
// Maps v from [inMin, inMax] to [outMin, outMax], without clamping.
float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
}
