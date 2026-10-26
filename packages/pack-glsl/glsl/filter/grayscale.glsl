// luma with the Rec. 709 weights
vec3 grayscale(vec3 c) {
  return vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
}
