/**
 * `cpp:warnings`: an INTERFACE target carrying the warning flags
 * (-Wall -Wextra -Wpedantic -Wconversion -Wshadow, resp. /W4 /permissive-),
 * linked into the core library through the `# jen:link` marker.
 */
import type { Generator } from '@codejen/jen';

const warningsGenerator: Generator = {
  description: 'add a project_warnings INTERFACE target (-Wall -Wextra … resp. /W4) and link it into the core library',
  params: {
    werror: { default: false },
  },
  actions: ({ werror }) => {
    const warnings = `# Warning flags as an INTERFACE target, so they are linked into our own targets only
# and never leak onto vendored code.
add_library(project_warnings INTERFACE)
target_compile_options(project_warnings INTERFACE
  $<$<CXX_COMPILER_ID:MSVC>:/W4 /permissive-${werror ? ' /WX' : ''}>
  $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-Wall -Wextra -Wpedantic -Wconversion -Wshadow${werror ? ' -Werror' : ''}>
)
`;
    return [
      { add: '/cmake/warnings.cmake', template: warnings },
      { insert: '/CMakeLists.txt', before: '# jen:options', line: 'include(cmake/warnings.cmake)' },
      {
        insert: { find: 'CMakeLists.txt' },
        before: '# jen:link',
        line: 'target_link_libraries(${PROJECT_NAME}-core PRIVATE project_warnings)',
      },
    ];
  },
};

export default warningsGenerator;
