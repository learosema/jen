// @license MIT-0
// lookAt · pack-glsl · MIT-0
// View matrix for a camera at eye looking at target, with `up` roughly
// upwards (usually vec3(0.0, 1.0, 0.0)): world space → view space, camera
// looking down -z. For raymarching, cameraMatrix() from glsl:raymarch is the
// counterpart that turns rays the other way.
mat4 lookAt(vec3 eye, vec3 target, vec3 up) {
  vec3 z = normalize(eye - target);
  vec3 x = normalize(cross(up, z));
  vec3 y = cross(z, x);
  return mat4(
    x.x, y.x, z.x, 0.0,
    x.y, y.y, z.y, 0.0,
    x.z, y.z, z.z, 0.0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1.0);
}
