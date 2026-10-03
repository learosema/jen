layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  // Inverse-transpose keeps normals perpendicular under non-uniform scaling;
  // precompute it on the host as a uniform if this shows up in profiles.
  vNormal = normalize(transpose(inverse(mat3(uModel))) * aNormal);
  vUV = aUV;
  gl_Position = uProjection * uView * world;
}
