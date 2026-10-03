// @license bakinglab
// tonemapAces: Stephen Hill's fit of the ACES filmic curve (RRT + ODT), via
// BakingLab by MJP and David Neubelt, MIT – https://github.com/TheRealMJP/BakingLab
// Ported from HLSL: the matrices keep BakingLab's row layout, so they're
// applied as `color * M` (GLSL's mat3() takes columns).
// Maps linear HDR color to [0, 1] with a filmic shoulder; encode with
// linearToSrgb() afterwards.

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 ACESInputMat = mat3(
  0.59719, 0.35458, 0.04823,
  0.07600, 0.90834, 0.01566,
  0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutputMat = mat3(
   1.60475, -0.53108, -0.07367,
  -0.10208,  1.10813, -0.00605,
  -0.00327, -0.07276,  1.07602
);

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 tonemapAces(vec3 color) {
  color = color * ACESInputMat;
  // Apply RRT and ODT
  color = RRTAndODTFit(color);
  color = color * ACESOutputMat;
  return clamp(color, 0.0, 1.0);
}
