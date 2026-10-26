// evaluate the shape shifted: shadowMask(scene(p - offset), blur)
float shadowMask(float d, float blur) { return 1.0 - smoothstep(-blur, blur, d); }
