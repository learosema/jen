// rd = cameraMatrix(eye, target, roll) * normalize(vec3(uv, 1.5)) – 1.5 is the focal length
mat3 cameraMatrix(vec3 eye, vec3 target, float roll) {
  vec3 forward = normalize(target - eye);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  // roll turns right and up around the view direction
  float c = cos(roll);
  float s = sin(roll);
  return mat3(c * right + s * up, c * up - s * right, forward);
}
