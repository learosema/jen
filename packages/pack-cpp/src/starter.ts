/**
 * Pieces shared by the app starters (`cpp:app`, `cpp:sdl3`, `cpp:sdl3-opengl`).
 *
 * Every starter splits the project into a `<name>-core` library that holds all
 * the code and a thin `<name>` executable that holds only `main.cpp`, so tests
 * can link against the core. It also leaves the `# jen:*` markers that later
 * generators insert at:
 *
 *   root CMakeLists.txt   # jen:options   (include(cmake/…) lines, options)
 *                         # jen:subdirs   (enable_testing(), add_subdirectory(tests))
 *                         # jen:install   (install() rules)
 *                         # jen:cpack     (CPack settings, after all install() rules)
 *   src/CMakeLists.txt    # jen:embed     (embed_file() calls)
 *                         # jen:sources   (core library sources)
 *                         # jen:link      (target_link_libraries() for the core library)
 *                         # jen:app       (executable-only settings: icons, bundle properties)
 *   src/app.cpp           // jen:includes (extra #includes)
 *                         // jen:frame-end (end of SDL_AppIterate)
 *                         // jen:gl-init  (after the glad load, sdl3-opengl only)
 */

export const SDL_TAG_DEFAULT = 'release-3.4.14';

/** Params shared by every SDL app starter. */
export const sdlStarterParams = {
  name: {},
  width: { default: '800' },
  height: { default: '600' },
  bundleId: { default: '' },
  folderCase: { default: 'kebab' },
  dir: { default: '' },
  sdlTag: { default: SDL_TAG_DEFAULT },
};

export function sdlVendorCMake(sdlTag: string, extra = ''): string {
  return `include(FetchContent)

FetchContent_Declare(
  SDL3
  GIT_REPOSITORY "https://github.com/libsdl-org/SDL.git"
  GIT_TAG ${sdlTag}
  FIND_PACKAGE_ARGS NAMES SDL3 CONFIG GLOBAL
)

set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)

FetchContent_MakeAvailable(SDL3)
${extra}`;
}

export function rootCMake(name: string, { preamble = '', vendor = true } = {}): string {
  return `cmake_minimum_required(VERSION 3.24)
${preamble}
project(${name} CXX)

# jen:options

${vendor ? 'add_subdirectory(vendor)\n' : ''}add_subdirectory(src)
# jen:subdirs

# jen:install
# jen:cpack
`;
}

/** src/CMakeLists.txt: the core library, plus the thin executable around main.cpp. */
export function srcCMake(
  name: string,
  { sources, libs = '', preamble = '' }: { sources: string[]; libs?: string; preamble?: string },
): string {
  const core = `${name}-core`;
  return `add_library(${core})

target_compile_features(${core} PUBLIC cxx_std_23)
target_include_directories(${core} PUBLIC \${CMAKE_CURRENT_SOURCE_DIR})
${preamble}# jen:embed

target_sources(${core} PRIVATE
${sources.map((s) => `  ${s}`).join('\n')}
  # jen:sources
)
${libs ? `target_link_libraries(${core} PUBLIC ${libs})\n` : ''}# jen:link

add_executable(${name} main.cpp)
target_link_libraries(${name} PRIVATE ${core})
# jen:app
`;
}

/** The thin main.cpp for the SDL callback starters: everything lives in the `<Name>App` class. */
export function sdlMainCpp(className: string): string {
  return `#define SDL_MAIN_USE_CALLBACKS 1
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>

#include "app.h"

SDL_AppResult SDL_AppInit(void** appstate, int argc, char* argv[]) {
  auto* app = new ${className}();
  *appstate = app;
  return app->Init();
}

SDL_AppResult SDL_AppEvent(void* appstate, SDL_Event* event) {
  return static_cast<${className}*>(appstate)->HandleEvent(event);
}

SDL_AppResult SDL_AppIterate(void* appstate) {
  return static_cast<${className}*>(appstate)->Iterate();
}

void SDL_AppQuit(void* appstate, SDL_AppResult result) {
  delete static_cast<${className}*>(appstate);
}
`;
}
