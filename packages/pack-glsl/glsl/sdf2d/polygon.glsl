// @license MIT-0
// sdPolygon · pack-glsl · MIT-0
// Signed distance to a regular polygon with n sides (n >= 3) and circumradius r.
// One edge faces +x; rotate p for other orientations.
float sdPolygon(vec2 p, float r, float n) {
  float sector = 6.28318530718 / n;
  // Fold p into the sector around +x, mirrored to its upper half.
  float a = mod(atan(p.y, p.x) + 0.5 * sector, sector) - 0.5 * sector;
  vec2 q = length(p) * vec2(cos(a), abs(sin(a)));
  // That sector's edge: x = apothem, |y| <= half the edge length.
  vec2 edge = r * vec2(cos(0.5 * sector), sin(0.5 * sector));
  float dx = q.x - edge.x;
  return length(vec2(dx, max(q.y - edge.y, 0.0))) * sign(dx);
}
