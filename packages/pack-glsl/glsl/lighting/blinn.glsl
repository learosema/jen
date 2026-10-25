// @license MIT-0
// shininess: highlight size (8 broad, 256 tight); specular: its strength (0–1)
vec3 blinnPhong(vec3 n, vec3 v, vec3 l, vec3 albedo, float shininess, float specular) {
  float nl = max(dot(n, l), 0.0);
  vec3 h = normalize(l + v);
  float highlight = pow(max(dot(n, h), 0.0), shininess) * specular * nl;
  return albedo * nl + vec3(highlight);
}
