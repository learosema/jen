// @license MIT-0
// toon · pack-glsl · MIT-0
// Cel shading: the diffuse light quantized into `bands` steps, with a rim
// light along the lit silhouette. Edges are antialiased with screen-space
// derivatives, so fragment shaders only.
//
// All lighting functions take the normal n, the direction to the viewer v and
// the direction to the light l (all normalized) and return the light reflected
// towards the viewer for a white light of intensity 1 – multiply by your
// light's color and shadow, and sum over lights.
vec3 toon(vec3 n, vec3 v, vec3 l, vec3 albedo, float bands) {
  float nl = max(dot(n, l), 0.0) * bands;
  float band = floor(nl);
  float edge = fwidth(nl);
  float level = (band + smoothstep(1.0 - edge, 1.0, nl - band)) / bands;
  float rim = smoothstep(0.65, 0.7, 1.0 - max(dot(n, v), 0.0)) * smoothstep(0.0, 0.1, dot(n, l));
  return albedo * (0.15 + 0.85 * level) + vec3(0.35 * rim);
}
