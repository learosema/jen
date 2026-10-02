/**
 * `cpp:app`: a console starter without SDL. `main` wraps argv in a
 * `std::span` to avoid pointer arithmetic (bounds profile); everything else
 * lives in the `<name>-core` library (see starter.ts for the markers).
 */
import type { Generator } from '@codejen/jen';
import { rootCMake, srcCMake } from './starter.ts';
import { appFolder, inFolder } from './util.ts';

const MAIN_CPP = `#include <cstddef>
#include <span>

#include "app.h"

int main(int argc, char** argv) {
  // a span instead of pointer arithmetic on argv (bounds profile)
  const std::span<char* const> args{argv, static_cast<std::size_t>(argc)};
  return Run(args);
}
`;

function appHeader(guard: string): string {
  return `#ifndef ${guard}
#define ${guard}

#include <span>

int Run(std::span<char* const> args);

#endif  // ${guard}
`;
}

const APP_CPP = `#include "app.h"

#include <iostream>

int Run(std::span<char* const> args) {
  std::cout << "Hello from " << args.front() << '\\n';
  return 0;
}
`;

const appGenerator: Generator = {
  description: 'create a console app starter without SDL (<name>-core library + thin executable, main wraps argv in a span)',
  params: {
    name: {},
    folderCase: { default: 'kebab' },
    dir: { default: '' },
  },
  actions: ({ name, folderCase, dir }, helpers) => {
    const { kebab, constant } = helpers;
    const folder = appFolder(String(name), String(dir), String(folderCase), helpers);
    const at = (path: string): string => inFolder(folder, path);
    const kebabName = kebab(String(name));

    return [
      { add: at('CMakeLists.txt'), template: rootCMake(kebabName, { vendor: false }) },
      { add: at('src/CMakeLists.txt'), template: srcCMake(kebabName, { sources: ['app.cpp'] }) },
      { add: at('src/main.cpp'), template: MAIN_CPP },
      { add: at('src/app.h'), template: appHeader(`${constant(String(name))}_APP_H`) },
      { add: at('src/app.cpp'), template: APP_CPP },
    ];
  },
};

export default appGenerator;
