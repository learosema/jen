/**
 * `cpp:tidy`: a .clang-tidy that makes tooling enforce the C++ Core
 * Guidelines (cppcoreguidelines-*, modernize-*, bugprone-*, performance-*),
 * with the usual noisy checks switched off, plus an opt-in CLANG_TIDY CMake
 * option that runs it during the build.
 */
import type { Generator } from '@codejen/jen';

const CLANG_TIDY = `# Enforces the C++ Core Guidelines: https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines
#
# Switched off because they are too noisy for graphics/game code:
#   cppcoreguidelines-avoid-magic-numbers          every 0.5f or 255 would be flagged
#   cppcoreguidelines-pro-bounds-pointer-arithmetic,
#   cppcoreguidelines-pro-bounds-array-to-pointer-decay,
#   cppcoreguidelines-pro-type-vararg              SDL and OpenGL are C APIs: they want raw pointers, C arrays, varargs
#   cppcoreguidelines-pro-type-reinterpret-cast    the SDL callbacks hand over an untyped appstate pointer
#   cppcoreguidelines-avoid-non-const-global-variables
#   modernize-use-trailing-return-type             wants trailing return types everywhere, which nobody does
Checks: >
  -*,
  bugprone-*,
  cppcoreguidelines-*,
  modernize-*,
  performance-*,
  readability-braces-around-statements,
  readability-container-size-empty,
  readability-make-member-function-const,
  -cppcoreguidelines-avoid-magic-numbers,
  -cppcoreguidelines-pro-bounds-pointer-arithmetic,
  -cppcoreguidelines-pro-bounds-array-to-pointer-decay,
  -cppcoreguidelines-pro-type-vararg,
  -cppcoreguidelines-pro-type-reinterpret-cast,
  -cppcoreguidelines-avoid-non-const-global-variables,
  -modernize-use-trailing-return-type
WarningsAsErrors: ''
# Only report on our own code, not on vendored SDL/glad/doctest headers.
HeaderFilterRegex: '^(?!.*(_deps|vendor)).*'
`;

const TIDY_CMAKE = `# Opt-in: cmake -S . -B build -DCLANG_TIDY=ON
option(CLANG_TIDY "Run clang-tidy during the build" OFF)
if(CLANG_TIDY)
  find_program(CLANG_TIDY_EXE NAMES clang-tidy REQUIRED)
  set(CMAKE_CXX_CLANG_TIDY "\${CLANG_TIDY_EXE}")
endif()
`;

const tidyGenerator: Generator = {
  description: 'add a .clang-tidy enforcing the C++ Core Guidelines, plus an opt-in CLANG_TIDY CMake option (cmake/tidy.cmake)',
  params: {
    cmake: { default: true },
  },
  actions: ({ cmake }) => [
    { add: '.clang-tidy', template: CLANG_TIDY },
    ...(cmake
      ? [
          { add: 'cmake/tidy.cmake', template: TIDY_CMAKE },
          { insert: 'CMakeLists.txt', before: '# jen:options', line: 'include(cmake/tidy.cmake)' },
        ]
      : []),
  ],
};

export default tidyGenerator;
