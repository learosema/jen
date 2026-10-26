// the average of the (2 radius + 1)² texels around uv; radius up to 8
vec3 blurBox(sampler2D tex, vec2 uv, int radius) {
  vec2 t = 1.0 / vec2(textureSize(tex, 0));
  int r = clamp(radius, 0, 8);
  vec3 sum = vec3(0.0);
  for (int y = -r; y <= r; y++) {
    for (int x = -r; x <= r; x++) sum += texture(tex, uv + vec2(x, y) * t).rgb;
  }
  float n = float(2 * r + 1);
  return sum / (n * n);
}
