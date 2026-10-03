// @requires vertex/basis
// @license MIT-0
// displace · pack-glsl · MIT-0
// Pushes a vertex along its normal by your displacement(position) and
// recomputes the normal from two displaced neighbours, so lighting follows
// the new shape. Use it in the vertex shader before transforming:
//   vec3 p = aPosition; vec3 n = aNormal;
//   displace(p, n);
// Needs `float displacement(vec3 p)` in your shader (object space; the
// mesh needs enough vertices to show the detail).
// Yours: how far to push the surface out (or in, if negative) at p.
float displacement(vec3 p);

void displace(inout vec3 position, inout vec3 normal) {
  const float e = 0.01;
  vec3 t;
  vec3 b;
  orthonormalBasis(normal, t, b);
  vec3 p0 = position + normal * displacement(position);
  vec3 p1 = position + t * e;
  p1 += normal * displacement(p1);
  vec3 p2 = position + b * e;
  p2 += normal * displacement(p2);
  normal = normalize(cross(p1 - p0, p2 - p0));
  position = p0;
}
