/**
 * `sdl3-opengl`: an SDL3 + OpenGL (4.1 core, via a vendored glad loader) app
 * starter with a shader-quad demo, following
 * https://github.com/learosema/learn-sdl's 06_opengl example: SDL3 owns the
 * window/context, glad loads the GL function pointers, and
 * cmake/embed-glsl.cmake turns the .glsl sources into inline C strings at
 * configure time (see `cpp:shader` for embedding more later). The code lives in
 * a `<name>-core` library, with src/main.cpp as the only file of the thin
 * executable (see starter.ts for the markers this leaves behind).
 */
import type { Action, Generator } from '@codejen/jen';
import { readAsset } from './assets.ts';
import { rootCMake, sdlMainCpp, sdlStarterParams, sdlVendorCMake, srcCMake } from './starter.ts';
import { appFolder, inFolder } from './util.ts';

function appHeader(className: string, guard: string, width: string, height: string): string {
  return `#ifndef ${guard}
#define ${guard}

#include <SDL3/SDL.h>
#include <glad/glad.h>

#include <memory>

class ${className} {
 public:
  ~${className}();

  SDL_AppResult Init();
  SDL_AppResult HandleEvent(const SDL_Event* event);
  SDL_AppResult Iterate();

 private:
  bool InitGeometry();
  void Resize();

  std::unique_ptr<SDL_Window, decltype(&SDL_DestroyWindow)> window_{nullptr, SDL_DestroyWindow};
  std::unique_ptr<SDL_GLContextState, decltype(&SDL_GL_DestroyContext)> glContext_{nullptr, SDL_GL_DestroyContext};

  GLuint program_ = 0;
  GLuint vao_ = 0;
  GLuint vbo_ = 0;
  GLint timeUniform_ = -1;

  int width_ = ${width};
  int height_ = ${height};
  bool resized_ = true;
};

#endif  // ${guard}
`;
}

function appSource(className: string, title: string, bundle: string): string {
  return `#include "app.h"

#include "quad.frag.glsl.h"
#include "quad.vert.glsl.h"
#include "shader-utils.h"

// jen:includes

namespace {

constexpr float kQuadVertices[] = {
    -1.0f, -1.0f,
    1.0f,  -1.0f,
    -1.0f, 1.0f,

    -1.0f, 1.0f,
    1.0f,  -1.0f,
    1.0f,  1.0f,
};

}  // namespace

${className}::~${className}() {
  if (program_) glDeleteProgram(program_);
  if (vbo_) glDeleteBuffers(1, &vbo_);
  if (vao_) glDeleteVertexArrays(1, &vao_);
}

SDL_AppResult ${className}::Init() {
  SDL_SetAppMetadata("${title}", "1.0", "${bundle}");

  if (!SDL_Init(SDL_INIT_VIDEO)) {
    SDL_Log("Couldn't initialize SDL: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }

  SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 1);
  // required for macOS's core profile, a no-op everywhere else
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, SDL_GL_CONTEXT_FORWARD_COMPATIBLE_FLAG);
  SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
  SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 24);

  SDL_Window* window = SDL_CreateWindow("${title}", width_, height_, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE);
  if (!window) {
    SDL_Log("Couldn't create window: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }
  window_.reset(window);

  SDL_GLContext glContext = SDL_GL_CreateContext(window_.get());
  if (!glContext) {
    SDL_Log("Couldn't create GL context: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }
  glContext_.reset(glContext);

  if (!gladLoadGLLoader(reinterpret_cast<GLADloadproc>(SDL_GL_GetProcAddress))) {
    SDL_Log("gladLoadGLLoader failed");
    return SDL_APP_FAILURE;
  }
  // jen:gl-init

  SDL_GL_SetSwapInterval(1);

  program_ = CreateProgramFromShaders(quadVertexShader, quadFragmentShader);
  if (!program_) return SDL_APP_FAILURE;
  timeUniform_ = glGetUniformLocation(program_, "uTime");

  if (!InitGeometry()) return SDL_APP_FAILURE;

  SDL_Log("OpenGL Version: %s", reinterpret_cast<const char*>(glGetString(GL_VERSION)));
  SDL_Log("GLSL Version:   %s", reinterpret_cast<const char*>(glGetString(GL_SHADING_LANGUAGE_VERSION)));

  return SDL_APP_CONTINUE;
}

bool ${className}::InitGeometry() {
  glGenVertexArrays(1, &vao_);
  glGenBuffers(1, &vbo_);

  glBindVertexArray(vao_);
  glBindBuffer(GL_ARRAY_BUFFER, vbo_);
  glBufferData(GL_ARRAY_BUFFER, sizeof(kQuadVertices), kQuadVertices, GL_STATIC_DRAW);

  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), nullptr);
  glEnableVertexAttribArray(0);
  glBindVertexArray(0);

  return true;
}

void ${className}::Resize() {
  glViewport(0, 0, width_, height_);
  resized_ = false;
}

SDL_AppResult ${className}::Iterate() {
  if (resized_) Resize();

  const float t = static_cast<float>(SDL_GetTicks()) / 1000.0f;
  glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

  glUseProgram(program_);
  glUniform1f(timeUniform_, t);

  glBindVertexArray(vao_);
  glDrawArrays(GL_TRIANGLES, 0, 6);

  SDL_GL_SwapWindow(window_.get());
  // jen:frame-end
  return SDL_APP_CONTINUE;
}

SDL_AppResult ${className}::HandleEvent(const SDL_Event* event) {
  if (event->type == SDL_EVENT_QUIT) return SDL_APP_SUCCESS;
  if (event->type == SDL_EVENT_WINDOW_RESIZED) {
    width_ = event->window.data1;
    height_ = event->window.data2;
    resized_ = true;
  }
  return SDL_APP_CONTINUE;
}
`;
}

function shaderUtilsHeader(): string {
  return `#ifndef SHADER_UTILS_H
#define SHADER_UTILS_H

#include <glad/glad.h>

GLuint CompileShader(GLenum type, const char* source);
GLuint LinkProgram(GLuint vertexShader, GLuint fragmentShader);
GLuint CreateProgramFromShaders(const char* vertexSource, const char* fragmentSource);

#endif  // SHADER_UTILS_H
`;
}

function shaderUtilsSource(): string {
  return `#include "shader-utils.h"

#include <SDL3/SDL.h>

GLuint CompileShader(GLenum type, const char* source) {
  GLuint shader = glCreateShader(type);
  glShaderSource(shader, 1, &source, nullptr);
  glCompileShader(shader);

  GLint success = 0;
  glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
  if (!success) {
    char log[512];
    glGetShaderInfoLog(shader, sizeof(log), nullptr, log);
    SDL_Log("Shader compile error: %s", log);
    glDeleteShader(shader);
    return 0;
  }
  return shader;
}

GLuint LinkProgram(GLuint vertexShader, GLuint fragmentShader) {
  GLuint program = glCreateProgram();
  glAttachShader(program, vertexShader);
  glAttachShader(program, fragmentShader);
  glLinkProgram(program);

  GLint success = 0;
  glGetProgramiv(program, GL_LINK_STATUS, &success);
  if (!success) {
    char log[512];
    glGetProgramInfoLog(program, sizeof(log), nullptr, log);
    SDL_Log("Program link error: %s", log);
    glDeleteProgram(program);
    return 0;
  }
  return program;
}

GLuint CreateProgramFromShaders(const char* vertexSource, const char* fragmentSource) {
  GLuint vertexShader = CompileShader(GL_VERTEX_SHADER, vertexSource);
  if (!vertexShader) return 0;

  GLuint fragmentShader = CompileShader(GL_FRAGMENT_SHADER, fragmentSource);
  if (!fragmentShader) {
    glDeleteShader(vertexShader);
    return 0;
  }

  GLuint program = LinkProgram(vertexShader, fragmentShader);

  glDeleteShader(vertexShader);
  glDeleteShader(fragmentShader);

  return program;
}
`;
}

const QUAD_VERT = `#version 410 core
layout (location = 0) in vec2 aPos;
out vec2 vUV;

void main() {
  vUV = aPos * 0.5 + 0.5;  // -1..1 -> 0..1
  vUV.y = 1.0 - vUV.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const QUAD_FRAG = `#version 410 core
in vec2 vUV;
out vec4 FragColor;

uniform float uTime;

void main() {
  vec3 color = vec3(
      0.5 + 0.5 * sin(uTime + vUV.x * 6.2831),
      vUV.y,
      0.5 + 0.5 * cos(uTime + vUV.y * 6.2831));
  FragColor = vec4(color, 1.0);
}
`;

const sdl3OpenglGenerator: Generator = {
  description:
    'create an SDL3 + OpenGL (4.1 core, glad) app starter with a shader-quad demo; vendors glad and wires up cmake/embed-glsl.cmake',
  params: sdlStarterParams,
  actions: ({ name, width, height, bundleId, sdlTag, folderCase, dir }, helpers) => {
    const { pascal, kebab, constant } = helpers;
    const folder = appFolder(String(name), String(dir), String(folderCase), helpers);
    const at = (path: string): string => inFolder(folder, path);
    const kebabName = kebab(String(name));
    const className = `${pascal(String(name))}App`;
    const guard = `${constant(String(name))}_APP_H`;
    const title = String(name);
    const bundle = String(bundleId) || `com.example.${kebabName}`;

    const actions: Action[] = [
      { add: at('CMakeLists.txt'), template: rootCMake(kebabName, { preamble: 'include(cmake/embed-glsl.cmake)\n' }) },
      { add: at('vendor/CMakeLists.txt'), template: sdlVendorCMake(String(sdlTag), '\nadd_subdirectory(glad)\n') },
      { add: at('cmake/embed-glsl.cmake'), template: readAsset('embed-glsl.cmake') },
      { add: at('vendor/glad/CMakeLists.txt'), template: readAsset('glad/CMakeLists.txt') },
      { add: at('vendor/glad/include/glad/glad.h'), template: readAsset('glad/include/glad/glad.h') },
      { add: at('vendor/glad/include/KHR/khrplatform.h'), template: readAsset('glad/include/KHR/khrplatform.h') },
      { add: at('vendor/glad/src/glad.c'), template: readAsset('glad/src/glad.c') },
      {
        add: at('src/CMakeLists.txt'),
        template: srcCMake(kebabName, {
          sources: ['shader-utils.cpp', 'app.cpp'],
          libs: 'SDL3::SDL3 glad',
          preamble: 'embed_glsl("quad.vert.glsl" quadVertexShader)\nembed_glsl("quad.frag.glsl" quadFragmentShader)\n',
        }),
      },
      { add: at('src/main.cpp'), template: sdlMainCpp(className) },
      { add: at('src/app.h'), template: appHeader(className, guard, String(width), String(height)) },
      { add: at('src/app.cpp'), template: appSource(className, title, bundle) },
      { add: at('src/shader-utils.h'), template: shaderUtilsHeader() },
      { add: at('src/shader-utils.cpp'), template: shaderUtilsSource() },
      { add: at('src/quad.vert.glsl'), template: QUAD_VERT },
      { add: at('src/quad.frag.glsl'), template: QUAD_FRAG },
    ];
    return actions;
  },
};

export default sdl3OpenglGenerator;
