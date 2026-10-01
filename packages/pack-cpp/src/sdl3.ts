/**
 * `sdl3`: an SDL3 callback-based app starter – CMakeLists.txt, a vendor/
 * FetchContent of SDL3 (falling back to a local find_package before
 * fetching), and src/main.cpp using SDL_MAIN_USE_CALLBACKS. See
 * https://github.com/learosema/learn-sdl for the pattern this follows.
 */
import type { Generator } from '@codejen/jen';
import { appFolder, inFolder } from './util.ts';

const SDL_TAG_DEFAULT = 'release-3.4.14';

function vendorCMake(sdlTag: string): string {
  return `include(FetchContent)

FetchContent_Declare(
  SDL3
  GIT_REPOSITORY "https://github.com/libsdl-org/SDL.git"
  GIT_TAG ${sdlTag}
  FIND_PACKAGE_ARGS NAMES SDL3 CONFIG GLOBAL
)

set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)

FetchContent_MakeAvailable(SDL3)
`;
}

function rootCMake(kebabName: string): string {
  return `cmake_minimum_required(VERSION 3.24)
project(${kebabName} CXX)

add_subdirectory(vendor)
add_subdirectory(src)
`;
}

function srcCMake(kebabName: string): string {
  return `add_executable(${kebabName})

target_compile_features(${kebabName} PRIVATE cxx_std_20)
target_sources(${kebabName} PRIVATE
  main.cpp
  # jen:sources
)
target_link_libraries(${kebabName} PRIVATE SDL3::SDL3)
`;
}

function mainCpp(title: string, bundle: string, width: string, height: string): string {
  return `#define SDL_MAIN_USE_CALLBACKS 1
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

#include <cstdio>
#include <memory>

namespace {

std::unique_ptr<SDL_Window, decltype(&SDL_DestroyWindow)> window{nullptr, SDL_DestroyWindow};
std::unique_ptr<SDL_Renderer, decltype(&SDL_DestroyRenderer)> renderer{nullptr, SDL_DestroyRenderer};

int windowWidth = ${width};
int windowHeight = ${height};
bool sizeChanged = false;

}  // namespace

SDL_AppResult SDL_AppInit(void** appstate, int argc, char* argv[]) {
  SDL_SetAppMetadata("${title}", "1.0", "${bundle}");

  if (!SDL_Init(SDL_INIT_VIDEO)) {
    SDL_Log("Couldn't initialize SDL: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }

  SDL_Window* windowPtr = nullptr;
  SDL_Renderer* rendererPtr = nullptr;
  if (!SDL_CreateWindowAndRenderer("${title}", windowWidth, windowHeight, SDL_WINDOW_RESIZABLE, &windowPtr,
                                    &rendererPtr)) {
    SDL_Log("Couldn't create window/renderer: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }
  window.reset(windowPtr);
  renderer.reset(rendererPtr);
  SDL_SetRenderLogicalPresentation(renderer.get(), windowWidth, windowHeight, SDL_LOGICAL_PRESENTATION_STRETCH);

  return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppEvent(void* appstate, SDL_Event* event) {
  if (event->type == SDL_EVENT_QUIT) {
    return SDL_APP_SUCCESS;
  }
  if (event->type == SDL_EVENT_WINDOW_RESIZED) {
    windowWidth = event->window.data1;
    windowHeight = event->window.data2;
    sizeChanged = true;
  }
  return SDL_APP_CONTINUE;
}

SDL_AppResult SDL_AppIterate(void* appstate) {
  if (sizeChanged) {
    SDL_SetRenderLogicalPresentation(renderer.get(), windowWidth, windowHeight, SDL_LOGICAL_PRESENTATION_STRETCH);
    sizeChanged = false;
  }

  const double now = static_cast<double>(SDL_GetTicks()) / 1000.0;
  const float red = static_cast<float>(0.5 + 0.5 * SDL_sin(now));
  const float green = static_cast<float>(0.5 + 0.5 * SDL_sin(now + SDL_PI_D * 2 / 3));
  const float blue = static_cast<float>(0.5 + 0.5 * SDL_sin(now + SDL_PI_D * 4 / 3));
  SDL_SetRenderDrawColorFloat(renderer.get(), red, green, blue, SDL_ALPHA_OPAQUE_FLOAT);
  SDL_RenderClear(renderer.get());

  char label[32];
  std::snprintf(label, sizeof(label), "%d x %d", windowWidth, windowHeight);
  SDL_SetRenderDrawColor(renderer.get(), 255, 255, 255, SDL_ALPHA_OPAQUE);
  SDL_SetRenderScale(renderer.get(), 4.0f, 4.0f);
  SDL_RenderDebugText(renderer.get(), windowWidth / 32.0f, windowHeight / 32.0f, label);

  SDL_RenderPresent(renderer.get());
  return SDL_APP_CONTINUE;
}

void SDL_AppQuit(void* appstate, SDL_AppResult result) {
  renderer.reset();
  window.reset();
}
`;
}

const sdl3Generator: Generator = {
  description: 'create an SDL3 callback-based app starter (CMakeLists.txt + vendor/ FetchContent SDL3 + src/main.cpp)',
  params: {
    name: {},
    width: { default: '800' },
    height: { default: '600' },
    bundleId: { default: '' },
    folderCase: { default: 'kebab' },
    dir: { default: '' },
    sdlTag: { default: SDL_TAG_DEFAULT },
  },
  actions: ({ name, width, height, bundleId, sdlTag, folderCase, dir }, helpers) => {
    const { kebab } = helpers;
    const folder = appFolder(String(name), String(dir), String(folderCase), helpers);
    const at = (path: string): string => inFolder(folder, path);
    const kebabName = kebab(String(name));
    const title = String(name);
    const bundle = String(bundleId) || `com.example.${kebabName}`;

    return [
      { add: at('CMakeLists.txt'), template: rootCMake(kebabName) },
      { add: at('vendor/CMakeLists.txt'), template: vendorCMake(String(sdlTag)) },
      { add: at('src/CMakeLists.txt'), template: srcCMake(kebabName) },
      { add: at('src/main.cpp'), template: mainCpp(title, bundle, String(width), String(height)) },
    ];
  },
};

export default sdl3Generator;
