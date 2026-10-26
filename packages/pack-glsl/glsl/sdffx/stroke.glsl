// @requires sdffx/fill
// Antialiased outline of width w, centered on the shape's edge.
float strokeMask(float d, float w) { return fillMask(abs(d) - 0.5 * w); }
