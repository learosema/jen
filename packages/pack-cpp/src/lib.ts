/**
 * `cpp:lib`: a library starter – public headers in include/<name>/,
 * BUILD_INTERFACE/INSTALL_INTERFACE include dirs, a generated export header,
 * and install + CMake package config. The real target is `<name>-core` (so
 * tests, `cpp:embed` etc. find it like in the app starters); it is exported
 * and aliased as `<name>::<name>`.
 */
import type { Generator } from '@codejen/jen';
import { appFolder, inFolder } from './util.ts';

function rootCMake(name: string): string {
  const core = `${name}-core`;
  return `cmake_minimum_required(VERSION 3.24)
project(${name} VERSION 0.1.0 LANGUAGES CXX)

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

# jen:options

add_subdirectory(src)
# jen:subdirs

install(TARGETS ${core}
  EXPORT ${name}Targets
  ARCHIVE DESTINATION \${CMAKE_INSTALL_LIBDIR}
  LIBRARY DESTINATION \${CMAKE_INSTALL_LIBDIR}
  RUNTIME DESTINATION \${CMAKE_INSTALL_BINDIR}
  INCLUDES DESTINATION \${CMAKE_INSTALL_INCLUDEDIR})
install(DIRECTORY include/ DESTINATION \${CMAKE_INSTALL_INCLUDEDIR})
install(FILES \${PROJECT_BINARY_DIR}/include/${name}/${name}_export.h DESTINATION \${CMAKE_INSTALL_INCLUDEDIR}/${name})
install(EXPORT ${name}Targets
  NAMESPACE ${name}::
  DESTINATION \${CMAKE_INSTALL_LIBDIR}/cmake/${name})

configure_package_config_file(cmake/${name}Config.cmake.in \${PROJECT_BINARY_DIR}/${name}Config.cmake
  INSTALL_DESTINATION \${CMAKE_INSTALL_LIBDIR}/cmake/${name})
write_basic_package_version_file(\${PROJECT_BINARY_DIR}/${name}ConfigVersion.cmake
  COMPATIBILITY SameMajorVersion)
install(FILES
  \${PROJECT_BINARY_DIR}/${name}Config.cmake
  \${PROJECT_BINARY_DIR}/${name}ConfigVersion.cmake
  DESTINATION \${CMAKE_INSTALL_LIBDIR}/cmake/${name})
# jen:install
# jen:cpack
`;
}

function srcCMake(name: string, macro: string): string {
  const core = `${name}-core`;
  return `add_library(${core})
add_library(${name}::${name} ALIAS ${core})
set_target_properties(${core} PROPERTIES
  OUTPUT_NAME ${name}
  EXPORT_NAME ${name}
  VERSION \${PROJECT_VERSION}
  SOVERSION \${PROJECT_VERSION_MAJOR}
  CXX_VISIBILITY_PRESET hidden
  VISIBILITY_INLINES_HIDDEN ON)

target_compile_features(${core} PUBLIC cxx_std_23)
target_include_directories(${core} PUBLIC
  $<BUILD_INTERFACE:\${PROJECT_SOURCE_DIR}/include>
  $<BUILD_INTERFACE:\${PROJECT_BINARY_DIR}/include>
  $<BUILD_INTERFACE:\${CMAKE_CURRENT_SOURCE_DIR}>
  $<INSTALL_INTERFACE:\${CMAKE_INSTALL_INCLUDEDIR}>)

include(GenerateExportHeader)
generate_export_header(${core}
  BASE_NAME ${macro}
  EXPORT_FILE_NAME \${PROJECT_BINARY_DIR}/include/${name}/${name}_export.h)
if(NOT BUILD_SHARED_LIBS)
  target_compile_definitions(${core} PUBLIC ${macro}_STATIC_DEFINE)
endif()
# jen:embed

target_sources(${core} PRIVATE
  ${name}.cpp
  # jen:sources
)
# jen:link
`;
}

const libGenerator: Generator = {
  description: 'create a library starter: include/<name>/, BUILD_INTERFACE/INSTALL_INTERFACE, export header, install + package config',
  params: {
    name: {},
    folderCase: { default: 'kebab' },
    dir: { default: '' },
  },
  actions: ({ name, folderCase, dir }, helpers) => {
    const { kebab, snake, constant } = helpers;
    const folder = appFolder(String(name), String(dir), String(folderCase), helpers);
    const at = (path: string): string => inFolder(folder, path);
    const kebabName = kebab(String(name));
    const ns = snake(String(name));
    const macro = constant(String(name));

    const header = `#ifndef ${macro}_H
#define ${macro}_H

#include <string_view>

#include <${kebabName}/${kebabName}_export.h>

namespace ${ns} {

${macro}_EXPORT std::string_view version() noexcept;

}  // namespace ${ns}

#endif  // ${macro}_H
`;
    const source = `#include <${kebabName}/${kebabName}.h>

namespace ${ns} {

std::string_view version() noexcept { return "0.1.0"; }

}  // namespace ${ns}
`;
    const config = `@PACKAGE_INIT@

include("\${CMAKE_CURRENT_LIST_DIR}/${kebabName}Targets.cmake")
check_required_components(${kebabName})
`;

    return [
      { add: at('CMakeLists.txt'), template: rootCMake(kebabName) },
      { add: at('src/CMakeLists.txt'), template: srcCMake(kebabName, macro) },
      { add: at(`include/${kebabName}/${kebabName}.h`), template: header },
      { add: at(`src/${kebabName}.cpp`), template: source },
      { add: at(`cmake/${kebabName}Config.cmake.in`), template: config },
    ];
  },
};

export default libGenerator;
