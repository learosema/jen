/**
 * `cpp:module` (experimental): a C++20 modules starter – a `.cppm` module
 * interface in a `FILE_SET CXX_MODULES` of the `<name>-core` library, imported
 * by main.cpp. Needs CMake >= 3.28 and a module-capable generator (Ninja, VS).
 */
import type { Generator } from '@codejen/jen';
import { appFolder, inFolder } from './util.ts';

const moduleGenerator: Generator = {
  description: '(experimental) create a C++20 modules starter: .cppm in a FILE_SET CXX_MODULES, CMake >= 3.28, needs Ninja',
  params: {
    name: {},
    folderCase: { default: 'kebab' },
    dir: { default: '' },
  },
  actions: ({ name, folderCase, dir }, helpers) => {
    const { kebab, snake } = helpers;
    const folder = appFolder(String(name), String(dir), String(folderCase), helpers);
    const at = (path: string): string => inFolder(folder, path);
    const kebabName = kebab(String(name));
    const mod = snake(String(name));
    const core = `${kebabName}-core`;

    const root = `cmake_minimum_required(VERSION 3.28)
project(${kebabName} CXX)

# jen:options

add_subdirectory(src)
# jen:subdirs

# jen:install
# jen:cpack
`;
    const src = `# C++20 modules need CMake >= 3.28 and the Ninja (or a Visual Studio) generator:
#   cmake -S . -B build -G Ninja
add_library(${core})

target_compile_features(${core} PUBLIC cxx_std_23)
target_include_directories(${core} PUBLIC \${CMAKE_CURRENT_SOURCE_DIR})
# jen:embed

target_sources(${core} PUBLIC FILE_SET CXX_MODULES FILES
  ${mod}.cppm
)
target_sources(${core} PRIVATE
  # jen:sources
)
# jen:link

add_executable(${kebabName} main.cpp)
target_link_libraries(${kebabName} PRIVATE ${core})
# jen:app
`;
    const cppm = `module;

#include <string_view>

export module ${mod};

export namespace ${mod} {

constexpr std::string_view greeting() noexcept { return "Hello from a module!"; }

}  // namespace ${mod}
`;
    const main = `#include <iostream>

import ${mod};

int main() {
  std::cout << ${mod}::greeting() << '\\n';
  return 0;
}
`;
    return [
      { add: at('CMakeLists.txt'), template: root },
      { add: at('src/CMakeLists.txt'), template: src },
      { add: at(`src/${mod}.cppm`), template: cppm },
      { add: at('src/main.cpp'), template: main },
    ];
  },
};

export default moduleGenerator;
