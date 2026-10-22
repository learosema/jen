# Third-party notices

pack-cpp's own code is ISC licensed (see [LICENSE](LICENSE)). `cpp:sdl3-opengl` copies a vendored OpenGL loader into your project, from `assets/glad/`:

## glad – the generated loader (`glad.h`, `glad.c`)

- Source: https://github.com/Dav1dde/glad (version 0.1.36), generated with the settings in the header of `assets/glad/include/glad/glad.h`
- License: glad's README says "The glad generated code itself is any of Public Domain, WTFPL or CC0"; this pack takes it under CC0 1.0. It's generated from the Khronos OpenGL registry (`gl.xml`, Apache 2.0); Khronos' licensing lead considers other licenses on such generated output fine: https://github.com/KhronosGroup/OpenGL-Registry/issues/376#issuecomment-596187053
- Changes: none.

## The Khronos Group – `khrplatform.h`

- Source: https://github.com/KhronosGroup/EGL-Registry (`api/KHR/khrplatform.h`), as added by glad
- License: the Khronos MIT-style license, whose notice is in the file itself and stays with it
- Changes: none.
