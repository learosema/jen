// @requires util/hash
// noise that changes 24 times a second; amount about 0.05–0.15, fragCoord is gl_FragCoord.xy
vec3 filmGrain(vec3 c, vec2 fragCoord, float time, float amount) {
  float n = hash31(vec3(floor(fragCoord), floor(time * 24.0))) - 0.5;
  return max(c + amount * n, 0.0);
}
