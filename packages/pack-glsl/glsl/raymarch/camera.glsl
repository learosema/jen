// @license MIT-0
// rd = cameraMatrix(eye, target, roll) * normalize(vec3(uv, 1.5)) – 1.5 is the focal length
mat3 cameraMatrix(vec3 eye, vec3 target, float roll) {
  vec3 forward = normalize(target - eye);
  vec3 up = vec3(sin(roll), cos(roll), 0.0);
  vec3 right = normalize(cross(forward, up));
  return mat3(right, cross(right, forward), forward);
}
