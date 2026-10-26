// unsharp masking with the four neighbors: amount 0 keeps the image, 0.5–1.5 sharpens
vec3 sharpen(sampler2D tex, vec2 uv, float amount) {
  vec2 t = 1.0 / vec2(textureSize(tex, 0));
  vec3 c = texture(tex, uv).rgb;
  vec3 around = texture(tex, uv + vec2(t.x, 0.0)).rgb + texture(tex, uv - vec2(t.x, 0.0)).rgb
              + texture(tex, uv + vec2(0.0, t.y)).rgb + texture(tex, uv - vec2(0.0, t.y)).rgb;
  return max(c + amount * (c - 0.25 * around), 0.0);
}
