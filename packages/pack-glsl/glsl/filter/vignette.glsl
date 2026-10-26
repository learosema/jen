// multiply by it: 1 in the middle, darker toward the corners; uv 0–1 across the image, strength 0–1
float vignette(vec2 uv, float strength) {
  return 1.0 - strength * smoothstep(0.25, 0.75, length(uv - 0.5));
}
