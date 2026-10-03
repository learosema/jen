// @license MIT-0
// tonemapReinhard · pack-glsl · MIT-0
// Maps linear HDR color to [0, 1]: c / (1 + c). Gentle, a bit flat in the
// highlights. Encode with linearToSrgb() afterwards.
vec3 tonemapReinhard(vec3 c) { return c / (1.0 + c); }
