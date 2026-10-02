/**
 * `sdl3`: an SDL3 callback-based app starter – CMakeLists.txt, a vendor/
 * FetchContent of SDL3 (falling back to a local find_package before
 * fetching), and a `<name>-core` library holding the app class, with
 * src/main.cpp as the only file of the thin executable. See
 * https://github.com/learosema/learn-sdl for the pattern this follows.
 */
import type { Generator } from '@codejen/jen';
import { rootCMake, sdlMainCpp, sdlStarterParams, sdlVendorCMake, srcCMake } from './starter.ts';
import { appFolder, inFolder } from './util.ts';

function appHeader(className: string, guard: string, width: string, height: string): string {
  return `#ifndef ${guard}
#define ${guard}

#include <SDL3/SDL.h>

#include <memory>

class ${className} {
 public:
  SDL_AppResult Init();
  SDL_AppResult HandleEvent(const SDL_Event* event);
  SDL_AppResult Iterate();

 private:
  std::unique_ptr<SDL_Window, decltype(&SDL_DestroyWindow)> window_{nullptr, SDL_DestroyWindow};
  std::unique_ptr<SDL_Renderer, decltype(&SDL_DestroyRenderer)> renderer_{nullptr, SDL_DestroyRenderer};

  int width_ = ${width};
  int height_ = ${height};
  bool resized_ = false;
};

#endif  // ${guard}
`;
}

function appSource(className: string, title: string, bundle: string): string {
  return `#include "app.h"

#include <cstdio>

// jen:includes

SDL_AppResult ${className}::Init() {
  SDL_SetAppMetadata("${title}", "1.0", "${bundle}");

  if (!SDL_Init(SDL_INIT_VIDEO)) {
    SDL_Log("Couldn't initialize SDL: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }

  SDL_Window* window = nullptr;
  SDL_Renderer* renderer = nullptr;
  if (!SDL_CreateWindowAndRenderer("${title}", width_, height_, SDL_WINDOW_RESIZABLE, &window, &renderer)) {
    SDL_Log("Couldn't create window/renderer: %s", SDL_GetError());
    return SDL_APP_FAILURE;
  }
  window_.reset(window);
  renderer_.reset(renderer);
  SDL_SetRenderLogicalPresentation(renderer_.get(), width_, height_, SDL_LOGICAL_PRESENTATION_STRETCH);

  return SDL_APP_CONTINUE;
}

SDL_AppResult ${className}::HandleEvent(const SDL_Event* event) {
  if (event->type == SDL_EVENT_QUIT) {
    return SDL_APP_SUCCESS;
  }
  if (event->type == SDL_EVENT_WINDOW_RESIZED) {
    width_ = event->window.data1;
    height_ = event->window.data2;
    resized_ = true;
  }
  return SDL_APP_CONTINUE;
}

SDL_AppResult ${className}::Iterate() {
  if (resized_) {
    SDL_SetRenderLogicalPresentation(renderer_.get(), width_, height_, SDL_LOGICAL_PRESENTATION_STRETCH);
    resized_ = false;
  }

  const double now = static_cast<double>(SDL_GetTicks()) / 1000.0;
  const float red = static_cast<float>(0.5 + 0.5 * SDL_sin(now));
  const float green = static_cast<float>(0.5 + 0.5 * SDL_sin(now + SDL_PI_D * 2 / 3));
  const float blue = static_cast<float>(0.5 + 0.5 * SDL_sin(now + SDL_PI_D * 4 / 3));
  SDL_SetRenderDrawColorFloat(renderer_.get(), red, green, blue, SDL_ALPHA_OPAQUE_FLOAT);
  SDL_RenderClear(renderer_.get());

  char label[32];
  std::snprintf(label, sizeof(label), "%d x %d", width_, height_);
  SDL_SetRenderDrawColor(renderer_.get(), 255, 255, 255, SDL_ALPHA_OPAQUE);
  SDL_SetRenderScale(renderer_.get(), 4.0f, 4.0f);
  SDL_RenderDebugText(renderer_.get(), width_ / 32.0f, height_ / 32.0f, label);

  SDL_RenderPresent(renderer_.get());
  // jen:frame-end
  return SDL_APP_CONTINUE;
}
`;
}

const sdl3Generator: Generator = {
  description:
    'create an SDL3 callback-based app starter (<name>-core library + thin executable, vendor/ FetchContent SDL3)',
  params: sdlStarterParams,
  actions: ({ name, width, height, bundleId, sdlTag, folderCase, dir }, helpers) => {
    const { kebab, pascal, constant } = helpers;
    const folder = appFolder(String(name), String(dir), String(folderCase), helpers);
    const at = (path: string): string => inFolder(folder, path);
    const kebabName = kebab(String(name));
    const className = `${pascal(String(name))}App`;
    const guard = `${constant(String(name))}_APP_H`;
    const title = String(name);
    const bundle = String(bundleId) || `com.example.${kebabName}`;

    return [
      { add: at('CMakeLists.txt'), template: rootCMake(kebabName) },
      { add: at('vendor/CMakeLists.txt'), template: sdlVendorCMake(String(sdlTag)) },
      { add: at('src/CMakeLists.txt'), template: srcCMake(kebabName, { sources: ['app.cpp'], libs: 'SDL3::SDL3' }) },
      { add: at('src/main.cpp'), template: sdlMainCpp(className) },
      { add: at('src/app.h'), template: appHeader(className, guard, String(width), String(height)) },
      { add: at('src/app.cpp'), template: appSource(className, title, bundle) },
    ];
  },
};

export default sdl3Generator;
