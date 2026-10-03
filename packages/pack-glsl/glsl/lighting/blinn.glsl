// @license MIT-0
// blinnPhong · pack-glsl · MIT-0
// Lambert diffuse plus a Blinn-Phong highlight. shininess sets the highlight
// size (8 broad, 256 tight), specular its strength (0.0–1.0).
//
// All lighting functions take the normal n, the direction to the viewer v and
// the direction to the light l (all normalized) and return the light reflected
// towards the viewer for a white light of intensity 1 – multiply by your
// light's color and shadow, and sum over lights.
vec3 blinnPhong(vec3 n, vec3 v, vec3 l, vec3 albedo, float shininess, float specular) {
  float nl = max(dot(n, l), 0.0);
  vec3 h = normalize(l + v);
  float highlight = pow(max(dot(n, h), 0.0), shininess) * specular * nl;
  return albedo * nl + vec3(highlight);
}
