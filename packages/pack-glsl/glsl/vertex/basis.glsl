// @license MIT-0
// orthonormalBasis · pack-glsl · MIT-0
// Two unit vectors t and b perpendicular to the unit vector n, with
// cross(t, b) = n. Branchless and stable for every n, including straight down.
// Method: Duff et al., "Building an Orthonormal Basis, Revisited", JCGT 6(1), 2017.
void orthonormalBasis(vec3 n, out vec3 t, out vec3 b) {
  float s = n.z >= 0.0 ? 1.0 : -1.0;
  float a = -1.0 / (s + n.z);
  float c = n.x * n.y * a;
  t = vec3(1.0 + s * n.x * n.x * a, s * c, -s * n.x);
  b = vec3(c, s + n.y * n.y * a, -n.y);
}
