// @license MIT-0
// rd the view ray, sun the direction to the sun (both normalized); linear color with a glow and a disc
vec3 skyColor(vec3 rd, vec3 sun) {
  vec3 color = mix(vec3(0.62, 0.72, 0.85), vec3(0.12, 0.27, 0.6), sqrt(clamp(rd.y, 0.0, 1.0)));
  float s = max(dot(rd, sun), 0.0);
  color += vec3(1.0, 0.65, 0.35) * (0.2 * pow(s, 8.0) + 0.4 * pow(s, 128.0));
  color += vec3(1.0, 0.9, 0.75) * 6.0 * smoothstep(0.9994, 0.9997, s);
  return color;
}
