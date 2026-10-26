// weighted by a Gaussian with sigma in texels, up to 4 (it reads 3 sigma around uv)
vec3 blurGaussian(sampler2D tex, vec2 uv, float sigma) {
  vec2 t = 1.0 / vec2(textureSize(tex, 0));
  float s = clamp(sigma, 0.01, 4.0);
  int r = int(ceil(3.0 * s));
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int y = -r; y <= r; y++) {
    for (int x = -r; x <= r; x++) {
      float w = exp(-float(x * x + y * y) / (2.0 * s * s));
      sum += w * texture(tex, uv + vec2(x, y) * t).rgb;
      total += w;
    }
  }
  return sum / total;
}
