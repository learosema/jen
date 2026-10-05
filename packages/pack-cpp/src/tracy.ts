/**
 * `cpp:tracy`: the Tracy profiler via FetchContent behind a PROFILING option
 * (default OFF), linked into the core library. No wrapper header: Tracy's
 * macros are no-ops without TRACY_ENABLE. Hooks FrameMark into the app
 * starter's `// jen:frame-end` marker; --gpu adds OpenGL GPU zones.
 */
import type { Action, Generator } from '@codejen/jen';

const TRACY_TAG_DEFAULT = 'v0.11.1';

function tracyCMake(tag: string): string {
  return `# Tracy is only active with -DPROFILING=ON; its macros compile to nothing otherwise.
option(PROFILING "Enable Tracy profiling" OFF)
set(TRACY_ENABLE \${PROFILING} CACHE BOOL "Tracy follows PROFILING" FORCE)

# Keep Tracy's own install rules out of our package (needs CMake >= 3.28, ignored before).
if(CMAKE_VERSION VERSION_GREATER_EQUAL 3.28)
  set(tracy_exclude EXCLUDE_FROM_ALL)
endif()

include(FetchContent)
FetchContent_Declare(
  tracy
  GIT_REPOSITORY "https://github.com/wolfpld/tracy.git"
  GIT_TAG ${tag}
  GIT_SHALLOW TRUE
  \${tracy_exclude}
)
FetchContent_MakeAvailable(tracy)
`;
}

const tracyGenerator: Generator = {
  description:
    'add the Tracy profiler (PROFILING option, FetchContent) and a FrameMark at the app starter\'s frame end; --gpu for OpenGL GPU zones',
  params: {
    gpu: { default: false },
    file: { path: true, default: '' },
    tracyTag: { default: TRACY_TAG_DEFAULT },
  },
  actions: ({ gpu, file, tracyTag }) => {
    // the app source carrying the starter's markers, unless --file (relative to the cwd) says which
    const app = String(file) || { find: /\.cpp$/, containing: '// jen:includes' };
    const actions: Action[] = [
      { add: '/cmake/tracy.cmake', template: tracyCMake(String(tracyTag)) },
      { insert: '/CMakeLists.txt', before: '# jen:options', line: 'include(cmake/tracy.cmake)' },
      { insert: { find: 'CMakeLists.txt' }, before: '# jen:link', line: 'target_link_libraries(${PROJECT_NAME}-core PUBLIC Tracy::TracyClient)' },
      { insert: app, before: '// jen:includes', line: '#include <tracy/Tracy.hpp>' },
    ];
    if (gpu) {
      actions.push(
        { insert: app, before: '// jen:includes', line: '#include <tracy/TracyOpenGL.hpp>' },
        { insert: app, before: '// jen:gl-init', line: 'TracyGpuContext;' },
        // after the swap, ahead of the frame mark
        { insert: app, before: '// jen:frame-end', line: 'TracyGpuCollect;' },
      );
    }
    actions.push({ insert: app, before: '// jen:frame-end', line: 'FrameMark;' });
    return actions;
  },
};

export default tracyGenerator;
