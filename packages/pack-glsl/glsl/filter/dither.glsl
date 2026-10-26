// ordered dithering after Bryce Bayer (1973): levels per channel; fragCoord is gl_FragCoord.xy
vec3 ditherBayer(vec3 c, vec2 fragCoord, float levels) {
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 p = ivec2(mod(fragCoord, 4.0));
  float threshold = (m[p.y * 4 + p.x] + 0.5) / 16.0;
  float n = max(levels - 1.0, 1.0);
  return floor(c * n + threshold) / n;
}
