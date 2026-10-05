/**
 * `cpp:doctest`: doctest via FetchContent, a `tests` executable linked
 * against `${PROJECT_NAME}-core` (the core library every starter generates),
 * and the `# jen:tests` marker that `--withTest` inserts into.
 */
import type { Generator } from '@codejen/jen';

const DOCTEST_TAG_DEFAULT = 'v2.4.12';

function testsCMake(tag: string): string {
  return `include(FetchContent)

FetchContent_Declare(
  doctest
  GIT_REPOSITORY "https://github.com/doctest/doctest.git"
  GIT_TAG ${tag}
)

set(DOCTEST_WITH_TESTS OFF)
set(DOCTEST_NO_INSTALL ON)
FetchContent_MakeAvailable(doctest)
include("\${doctest_SOURCE_DIR}/scripts/cmake/doctest.cmake")

add_executable(tests)
target_sources(tests PRIVATE
  main.cpp
  # jen:tests
)
target_link_libraries(tests PRIVATE \${PROJECT_NAME}-core doctest::doctest)

doctest_discover_tests(tests)
`;
}

const MAIN_CPP = `#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>
`;

const doctestGenerator: Generator = {
  description:
    'set up doctest: tests/ with a main, a tests target linked against <name>-core, ctest discovery, and the # jen:tests marker for --withTest',
  params: {
    doctestTag: { default: DOCTEST_TAG_DEFAULT },
  },
  actions: ({ doctestTag }) => [
    { add: '/tests/CMakeLists.txt', template: testsCMake(String(doctestTag)) },
    { add: '/tests/main.cpp', template: MAIN_CPP },
    { insert: '/CMakeLists.txt', before: '# jen:subdirs', line: 'enable_testing()\nadd_subdirectory(tests)' },
  ],
};

export default doctestGenerator;
