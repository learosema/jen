// uv snapped to the middle of blocks of size texels: texture(tex, pixelate(tex, uv, 8.0))
vec2 pixelate(sampler2D tex, vec2 uv, float size) {
  vec2 blocks = vec2(textureSize(tex, 0)) / max(size, 1.0);
  return (floor(uv * blocks) + 0.5) / blocks;
}
