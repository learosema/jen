// @license lottes-crt
// crt · Timothy Lottes · https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl
// the curved screen: uv on it, outside 0–1 is off screen; warp about vec2(0.031, 0.041)
vec2 crtWarp(vec2 uv, vec2 warp) {
  uv = uv * 2.0 - 1.0;
  uv *= vec2(1.0 + uv.y * uv.y * warp.x, 1.0 + uv.x * uv.x * warp.y);
  return uv * 0.5 + 0.5;
}

float crtGauss(float d, float scale) { return exp2(scale * d * d); }

// the emulated pixel nearest to uv, off pixels away, in linear light; black off screen
vec3 crtFetch(sampler2D tex, vec2 uv, vec2 off, vec2 pixels) {
  vec2 p = (floor(uv * pixels + off) + 0.5) / pixels;
  if (any(lessThan(p, vec2(0.0))) || any(greaterThan(p, vec2(1.0)))) return vec3(0.0);
  return pow(texture(tex, p).rgb, vec3(2.2));
}

// one scanline, off lines away, blurred over three pixels
vec3 crtLine(sampler2D tex, vec2 uv, float off, vec2 pixels) {
  float d = 0.5 - fract(uv.x * pixels.x);
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -1; i <= 1; i++) {
    float w = crtGauss(d + float(i), -3.0);
    sum += w * crtFetch(tex, uv, vec2(float(i), off), pixels);
    total += w;
  }
  return sum / total;
}

// the shadow mask, one of r, g, b lit per screen pixel; dark about 0.5, light about 1.5
vec3 crtMask(vec2 fragCoord, float dark, float light) {
  float x = fract((fragCoord.x + 3.0 * fragCoord.y) / 6.0);
  vec3 m = vec3(dark);
  if (x < 0.333) m.r = light;
  else if (x < 0.666) m.g = light;
  else m.b = light;
  return m;
}

// the whole look for a screen of pixels.x by pixels.y, e.g. vec2(320.0, 240.0); returns sRGB
vec3 crt(sampler2D tex, vec2 uv, vec2 pixels, vec2 fragCoord) {
  vec2 p = crtWarp(uv, vec2(0.031, 0.041));
  float d = 0.5 - fract(p.y * pixels.y);
  vec3 c = vec3(0.0);
  for (int i = -1; i <= 1; i++) c += crtLine(tex, p, float(i), pixels) * crtGauss(d + float(i), -8.0);
  return pow(c * crtMask(fragCoord, 0.5, 1.5), vec3(1.0 / 2.2));
}
