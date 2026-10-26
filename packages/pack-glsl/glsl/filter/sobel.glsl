// @requires filter/grayscale
// edges after Irwin Sobel and Gary Feldman (1968): how fast brightness changes at uv, 0 on flat areas
float sobel(sampler2D tex, vec2 uv) {
  vec2 t = 1.0 / vec2(textureSize(tex, 0));
  float s[9];
  for (int i = 0; i < 9; i++) {
    vec2 o = vec2(float(i % 3) - 1.0, float(i / 3) - 1.0);
    s[i] = grayscale(texture(tex, uv + o * t).rgb).r;
  }
  float gx = s[2] + 2.0 * s[5] + s[8] - s[0] - 2.0 * s[3] - s[6];
  float gy = s[6] + 2.0 * s[7] + s[8] - s[0] - 2.0 * s[1] - s[2];
  return length(vec2(gx, gy));
}
