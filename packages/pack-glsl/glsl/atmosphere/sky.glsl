// rd the view ray, sun the direction to the sun (both normalized); linear color – the sun's height sets day, dusk or night
vec3 skyColor(vec3 rd, vec3 sun) {
  float day = smoothstep(-0.12, 0.3, sun.y);  // 0 at night, 1 in daylight
  float dusk = smoothstep(-0.12, 0.02, sun.y) * (1.0 - smoothstep(0.02, 0.3, sun.y));  // the sun near the horizon
  float y = clamp(rd.y, 0.0, 1.0);
  float h = mix(sqrt(y), 1.0 - pow(1.0 - y, 6.0), dusk);  // at dusk the warm band stays low
  vec3 zenith = mix(vec3(0.005, 0.008, 0.025), vec3(0.12, 0.27, 0.6), day);
  vec3 horizon = mix(vec3(0.015, 0.02, 0.045), vec3(0.62, 0.72, 0.85), day);
  // dusk: an orange band low in the sky, strongest toward the sun
  float s = max(dot(rd, sun), 0.0);
  horizon = mix(horizon, vec3(1.0, 0.42, 0.16), dusk * (0.45 + 0.55 * s));
  zenith = mix(zenith, vec3(0.03, 0.05, 0.2), dusk);
  vec3 color = mix(horizon, zenith, h);
  vec3 glow = mix(vec3(1.0, 0.65, 0.35), vec3(1.0, 0.35, 0.1), dusk);
  color += glow * (0.2 * pow(s, 8.0) + 0.4 * pow(s, 128.0)) * smoothstep(-0.12, 0.0, sun.y);
  color += vec3(1.0, 0.9, 0.75) * 6.0 * smoothstep(0.9994, 0.9997, s) * step(0.0, sun.y);
  return color;
}
