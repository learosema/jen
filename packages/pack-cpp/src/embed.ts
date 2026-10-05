/**
 * `cpp:embed`: cross-platform binary embedding. `#embed` isn't portable yet
 * (C only in Clang/GCC 15, C++26 for C++, no MSVC), so assets are turned into
 * a constexpr byte array by a CMake script at *build* time (add_custom_command),
 * which re-embeds them when they change without re-running cmake.
 */
import type { Generator } from '@codejen/jen';
import { readAsset } from './assets.ts';
import { fail } from './util.ts';

const embedGenerator: Generator = {
  description:
    'embed a binary file as a constexpr byte array, generated at build time by cmake/embed.cmake and wired in at # jen:embed',
  params: {
    file: {},
    name: {},
    target: { default: '' },
    method: { default: 'cmake' },
  },
  actions: ({ file, name, target, method }, { camel }) => {
    if (String(method) !== 'cmake') {
      fail(`cpp:embed --method: only "cmake" is supported so far (#embed isn't portable yet), got "${method}"`);
    }
    const variable = camel(String(name));
    const targetName = String(target) || '${PROJECT_NAME}-core';

    return [
      { add: '/cmake/embed-file.cmake', template: readAsset('embed-file.cmake') },
      { add: '/cmake/embed.cmake', template: readAsset('embed.cmake') },
      { insert: { find: 'CMakeLists.txt' }, before: '# jen:embed', line: 'include(${PROJECT_SOURCE_DIR}/cmake/embed.cmake)' },
      {
        insert: { find: 'CMakeLists.txt' },
        before: '# jen:embed',
        line: `embed_file(${targetName} ${String(file)} ${variable})`,
      },
    ];
  },
};

export default embedGenerator;
