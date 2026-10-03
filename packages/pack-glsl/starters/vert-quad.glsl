// Full-screen quad: two triangles in clip space at attribute location 0
// (-1..1, e.g. the 6-vertex buffer of cpp:sdl3-opengl).
layout(location = 0) in vec2 aPos;

out vec2 vUV;

void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
