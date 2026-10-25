// @license MIT-0
// radians, counter-clockwise looking down the axis; rotateAxis needs a normalized axis
mat3 rotateX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotateY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotateZ(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

// Rodrigues' rotation formula as a matrix.
mat3 rotateAxis(vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  vec3 t = (1.0 - c) * axis;
  return mat3(
    t.x * axis.x + c,          t.x * axis.y + s * axis.z, t.x * axis.z - s * axis.y,
    t.y * axis.x - s * axis.z, t.y * axis.y + c,          t.y * axis.z + s * axis.x,
    t.z * axis.x + s * axis.y, t.z * axis.y - s * axis.x, t.z * axis.z + c);
}
