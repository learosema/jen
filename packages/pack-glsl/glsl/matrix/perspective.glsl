// @license MIT-0
// perspective · pack-glsl · MIT-0
// OpenGL perspective projection: vertical field of view fovY (radians),
// aspect = width / height, near and far clip distances (both > 0). Maps
// view space (camera looking down -z) to clip space with z in [-w, w].
mat4 perspective(float fovY, float aspect, float near, float far) {
  float f = 1.0 / tan(0.5 * fovY);
  float nf = 1.0 / (near - far);
  return mat4(
    f / aspect, 0.0, 0.0, 0.0,
    0.0, f, 0.0, 0.0,
    0.0, 0.0, (far + near) * nf, -1.0,
    0.0, 0.0, 2.0 * far * near * nf, 0.0);
}
