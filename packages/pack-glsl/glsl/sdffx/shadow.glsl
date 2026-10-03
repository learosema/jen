// @license MIT-0
// shadowMask · pack-glsl · MIT-0
// Soft drop shadow: evaluate the shape at a shifted position, e.g.
// shadowMask(scene(p - offset), 0.05), and darken where the mask is high.
// blur is the width of the soft edge.
float shadowMask(float d, float blur) { return 1.0 - smoothstep(-blur, blur, d); }
