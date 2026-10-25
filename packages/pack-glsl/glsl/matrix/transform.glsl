// @license MIT-0
// combine right to left: translate(t) * transform(rotateY(a)) * scale(s)
mat4 translate(vec3 t) {
  return mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, t, 1.0);
}

mat4 scale(vec3 s) {
  return mat4(s.x, 0.0, 0.0, 0.0, 0.0, s.y, 0.0, 0.0, 0.0, 0.0, s.z, 0.0, 0.0, 0.0, 0.0, 1.0);
}

mat4 transform(mat3 m) {
  return mat4(vec4(m[0], 0.0), vec4(m[1], 0.0), vec4(m[2], 0.0), vec4(0.0, 0.0, 0.0, 1.0));
}
