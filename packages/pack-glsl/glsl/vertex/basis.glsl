// @license MIT-0
// after Duff et al., "Building an Orthonormal Basis, Revisited" (JCGT 2017)
// t and b perpendicular to the unit vector n, cross(t, b) = n; stable for every n
void orthonormalBasis(vec3 n, out vec3 t, out vec3 b) {
  float s = n.z >= 0.0 ? 1.0 : -1.0;
  float a = -1.0 / (s + n.z);
  float c = n.x * n.y * a;
  t = vec3(1.0 + s * n.x * n.x * a, s * c, -s * n.x);
  b = vec3(c, s + n.y * n.y * a, -n.y);
}
