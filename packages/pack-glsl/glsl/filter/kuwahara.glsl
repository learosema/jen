// painterly smoothing after Michiyoshi Kuwahara et al. (1976): the mean of the calmest of four squares around uv; radius up to 6
vec3 kuwahara(sampler2D tex, vec2 uv, int radius) {
  vec2 t = 1.0 / vec2(textureSize(tex, 0));
  int r = clamp(radius, 1, 6);
  float n = float((r + 1) * (r + 1));
  vec3 best = vec3(0.0);
  float calmest = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 dir = vec2(q % 2 == 0 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
    vec3 sum = vec3(0.0);
    vec3 sum2 = vec3(0.0);
    for (int y = 0; y <= r; y++) {
      for (int x = 0; x <= r; x++) {
        vec3 c = texture(tex, uv + dir * vec2(x, y) * t).rgb;
        sum += c;
        sum2 += c * c;
      }
    }
    vec3 mean = sum / n;
    vec3 v = sum2 / n - mean * mean;
    float variance = v.r + v.g + v.b;
    if (variance < calmest) {
      calmest = variance;
      best = mean;
    }
  }
  return best;
}
