/** `cpp:presets`: a CMakePresets.json with debug, release, asan and ubsan presets. */
import type { Generator } from '@codejen/jen';

type Json = Record<string, unknown>;

function configurePreset(name: string, description: string, cache: Json, inherits = 'base'): Json {
  return { name, displayName: name, description, inherits, cacheVariables: cache };
}

const presetsGenerator: Generator = {
  description: 'add a CMakePresets.json with debug, release, asan and ubsan presets',
  params: {},
  actions: () => {
    const sanitizer = (flag: string): Json => ({
      CMAKE_BUILD_TYPE: 'Debug',
      CMAKE_CXX_FLAGS: `-fsanitize=${flag} -fno-omit-frame-pointer`,
      CMAKE_EXE_LINKER_FLAGS: `-fsanitize=${flag}`,
      CMAKE_SHARED_LINKER_FLAGS: `-fsanitize=${flag}`,
    });

    const names = ['debug', 'release', 'asan', 'ubsan'];
    const presets = {
      version: 3,
      cmakeMinimumRequired: { major: 3, minor: 24, patch: 0 },
      configurePresets: [
        { name: 'base', hidden: true, binaryDir: '${sourceDir}/build/${presetName}' },
        configurePreset('debug', 'Debug build', { CMAKE_BUILD_TYPE: 'Debug' }),
        configurePreset('release', 'Optimized release build', { CMAKE_BUILD_TYPE: 'Release' }),
        configurePreset('asan', 'Debug build with AddressSanitizer (GCC/Clang)', sanitizer('address')),
        configurePreset('ubsan', 'Debug build with UndefinedBehaviorSanitizer (GCC/Clang)', sanitizer('undefined')),
      ],
      buildPresets: names.map((name) => ({ name, configurePreset: name })),
      testPresets: names.map((name) => ({
        name,
        configurePreset: name,
        output: { outputOnFailure: true },
      })),
    };
    return [{ add: '/CMakePresets.json', template: `${JSON.stringify(presets, null, 2)}\n` }];
  },
};

export default presetsGenerator;
