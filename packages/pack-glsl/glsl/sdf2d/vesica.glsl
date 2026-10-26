// @license iquilezles
// sdVesica · Inigo Quilez · https://iquilezles.org/articles/distfunctions2d/
// pointed at x = -w and x = w, h thick above and below the x axis (h < w)
float sdVesica(vec2 p, float w, float h) {
  float d = 0.5 * (w * w - h * h) / h;
  p = abs(p);
  vec3 c = (w * p.y < d * (p.x - w)) ? vec3(0.0, w, 0.0) : vec3(-d, 0.0, d + h);
  return length(p - c.yx) - c.z;
}
