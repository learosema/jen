// @license MIT-0
// cameraMatrix · pack-glsl · MIT-0
// Camera basis looking from eye at target, rolled by `roll` radians. For a
// pixel at centered coordinates uv (y from -0.5 to 0.5):
//   vec3 rd = cameraMatrix(eye, target, 0.0) * normalize(vec3(uv, 1.5));
// The last value is the focal length: larger zooms in.
mat3 cameraMatrix(vec3 eye, vec3 target, float roll) {
  vec3 forward = normalize(target - eye);
  vec3 up = vec3(sin(roll), cos(roll), 0.0);
  vec3 right = normalize(cross(forward, up));
  return mat3(right, cross(right, forward), forward);
}
