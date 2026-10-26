// @license MIT-0
// @requires sdf2d/vesica
// @requires sdf2d/box
// a pointed (gothic) arch: half width w, sides down to y = -h, the arcs meet at y = 1.73 w
float sdPointedArch(vec2 p, float w, float h) {
  float arcs = max(sdVesica(p.yx, 1.7320508 * w, w), -p.y - h);  // overlaps the sides, so no seam inside
  float sides = sdBox(p - vec2(0.0, -0.5 * h), vec2(w, 0.5 * h));
  return min(arcs, sides);
}
