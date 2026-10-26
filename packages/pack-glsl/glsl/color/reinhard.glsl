// after Erik Reinhard et al., Photographic Tone Reproduction (SIGGRAPH 2002)
vec3 tonemapReinhard(vec3 c) { return c / (1.0 + c); }
