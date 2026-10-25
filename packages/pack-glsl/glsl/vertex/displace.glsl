// @requires vertex/basis
// @license MIT-0
// pushes p along n by your displacement(p) and recomputes n
// yours: how far to push the surface out (in, if negative) at p
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
