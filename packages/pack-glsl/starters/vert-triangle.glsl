// Full-screen triangle without any vertex buffer: bind an empty VAO and
// draw 3 vertices. The triangle overshoots the viewport, which clips it.
out vec2 vUV;

void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
