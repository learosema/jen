// @license MIT-0
// sdStar · pack-glsl · MIT-0
// Signed distance to a star with n points (n >= 3), outer radius r and inner
// radius ri (0 < ri < r). One point faces +x; rotate p for other orientations.
float sdStar(vec2 p, float r, float ri, float n) {
  float sector = 6.28318530718 / n;
  // Fold p into half a sector: angle 0 is a tip, angle sector/2 an inner corner.
  float a = abs(mod(atan(p.y, p.x) + 0.5 * sector, sector) - 0.5 * sector);
  vec2 q = length(p) * vec2(cos(a), sin(a));
  vec2 tip = vec2(r, 0.0);
  vec2 edge = ri * vec2(cos(0.5 * sector), sin(0.5 * sector)) - tip;
  vec2 v = q - tip;
  float d = length(v - edge * clamp(dot(v, edge) / dot(edge, edge), 0.0, 1.0));
  // Inside is the origin's side of the edge.
  return edge.x * v.y - edge.y * v.x > 0.0 ? -d : d;
}
