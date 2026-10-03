// @license MIT-0
// pbr · pack-glsl · MIT-0
// Physically based shading (Cook-Torrance): GGX distribution, Smith-Schlick
// geometry and Schlick Fresnel, metallic/roughness workflow. albedo is the
// base color (linear), metallic 0 (dielectric) to 1 (metal), roughness 0
// (mirror) to 1 (matte). Includes the 1/π of the diffuse term, so a sun
// needs an intensity around 3 to look as bright as with lambert(). Tonemap
// the result (see glsl:lighting --tonemap).
//
// All lighting functions take the normal n, the direction to the viewer v and
// the direction to the light l (all normalized) and return the light reflected
// towards the viewer for a white light of intensity 1 – multiply by your
// light's color and shadow, and sum over lights.
// Formulas: Brian Karis, "Real Shading in Unreal Engine 4" (SIGGRAPH 2013).
vec3 pbr(vec3 n, vec3 v, vec3 l, vec3 albedo, float metallic, float roughness) {
  const float PI = 3.14159265359;
  vec3 h = normalize(v + l);
  float nl = max(dot(n, l), 0.0);
  float nv = max(dot(n, v), 1e-4);
  float nh = max(dot(n, h), 0.0);
  float vh = max(dot(v, h), 0.0);

  // GGX / Trowbridge-Reitz normal distribution, alpha = roughness².
  float a = roughness * roughness;
  float a2 = a * a;
  float denom = nh * nh * (a2 - 1.0) + 1.0;
  float distribution = a2 / (PI * denom * denom);

  // Smith geometry term with Schlick-GGX, k for direct lighting.
  float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  float geometry = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));

  // Schlick Fresnel; dielectrics reflect 4% head-on, metals their color.
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);

  vec3 specular = distribution * geometry * fresnel / (4.0 * nv * max(nl, 1e-4));
  vec3 diffuse = (1.0 - fresnel) * (1.0 - metallic) * albedo / PI;
  return (diffuse + specular) * nl;
}
