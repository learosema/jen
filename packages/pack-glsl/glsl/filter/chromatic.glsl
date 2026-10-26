// red and blue pushed apart toward the edges, like a cheap lens; amount about 0.01–0.05
vec3 chromaticAberration(sampler2D tex, vec2 uv, float amount) {
  vec2 d = (uv - 0.5) * amount;
  // clamped, so the edges don't pull in color from the other side
  return vec3(texture(tex, clamp(uv + d, 0.0, 1.0)).r, texture(tex, uv).g, texture(tex, clamp(uv - d, 0.0, 1.0)).b);
}
