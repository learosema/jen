// t where the ray meets the plane dot(p, n) + h = 0 (like sdPlane), or -1.0 if it runs parallel or away
float rayPlane(vec3 ro, vec3 rd, vec3 n, float h) {
  float d = dot(rd, n);
  float t = abs(d) < 1e-6 ? -1.0 : -(dot(ro, n) + h) / d;
  return t > 0.0 ? t : -1.0;
}
