// @license MIT-0
// lambert · pack-glsl · MIT-0
// Diffuse (matte) reflection: brightness follows the angle to the light.
//
// All lighting functions take the normal n, the direction to the viewer v and
// the direction to the light l (all normalized) and return the light reflected
// towards the viewer for a white light of intensity 1 – multiply by your
// light's color and shadow, and sum over lights.
vec3 lambert(vec3 n, vec3 l, vec3 albedo) {
  return albedo * max(dot(n, l), 0.0);
}
