uniform float uTime;        // seconds since start
uniform vec2 uResolution;   // viewport size in pixels
uniform vec2 uMouse;        // pointer position in pixels, origin bottom-left

out vec4 fragColor;

void main() {
  // Centered coordinates: y spans [-0.5, 0.5], x keeps the aspect ratio.
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  float d = length(uv) - 0.25 - 0.05 * sin(uTime);
  vec3 color = mix(vec3(0.95, 0.4, 0.6), vec3(0.1, 0.1, 0.15), smoothstep(0.0, 0.005, d));

  fragColor = vec4(color, 1.0);
}
