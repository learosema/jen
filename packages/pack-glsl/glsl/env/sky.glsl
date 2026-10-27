// @requires atmosphere/sky
// the sky as an environment: dir any direction, roughness 0 sharp to 1 a soft dome; below the horizon it fades to a dark ground
vec3 envSky(vec3 dir, vec3 sun, float roughness) {
  vec3 horizon = skyColor(normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0, 0.001, 0.0)), sun);
  vec3 ground = 0.3 * horizon * vec3(0.5, 0.45, 0.4);
  vec3 sharp = dir.y > 0.0 ? skyColor(dir, sun) : mix(horizon, ground, smoothstep(0.0, 0.25, -dir.y));
  vec3 dome = mix(ground, skyColor(vec3(0.0, 1.0, 0.0), sun), 0.5 + 0.5 * dir.y);
  return mix(sharp, dome, roughness);
}
