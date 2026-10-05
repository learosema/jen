/**
 * `cpp:compiler`: compiler settings that encourage the C++ Core Guidelines –
 * conventions for the whole build (no compiler extensions, compile_commands.json),
 * guideline-mapped warnings and hardening (bounds checks, stack protector) in a
 * `project_options` INTERFACE target linked into the core library via `# jen:link`.
 * Complements `cpp:warnings` (general warnings) and `cpp:tidy` (static analysis).
 */
import type { Generator } from '@codejen/jen';

function compilerCMake(hardening: boolean): string {
  const hardeningBlock = `
  # Hardening: bounds checks (Bounds profile, ES.42/SL.con.3) and exploit mitigations.
  if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_definitions(project_options INTERFACE
      # libstdc++: operator[], front(), back(), … are bounds-checked
      $<$<CONFIG:Debug>:_GLIBCXX_ASSERTIONS>
      # libc++ (only has an effect there)
      $<$<NOT:$<CONFIG:Debug>>:_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_FAST>
      $<$<CONFIG:Debug>:_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_DEBUG>)
    target_compile_options(project_options INTERFACE
      -fstack-protector-strong
      $<$<NOT:$<CONFIG:Debug>>:-U_FORTIFY_SOURCE>
      $<$<NOT:$<CONFIG:Debug>>:-D_FORTIFY_SOURCE=2>)
    if(UNIX AND NOT APPLE)
      target_compile_options(project_options INTERFACE -fstack-clash-protection)
      if(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|i[3-6]86")
        target_compile_options(project_options INTERFACE -fcf-protection)
      endif()
    endif()
  elseif(MSVC)
    target_compile_options(project_options INTERFACE /GS /guard:cf /sdl)
    target_link_options(project_options INTERFACE /GUARD:CF)
  endif()
`;
  return `# Conventions for the whole build.
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)  # -std=c++23, not -std=gnu++23: keeps the code portable (P.2)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)  # for clangd and clang-tidy

# Options for our own targets only (linked privately, so vendored code is unaffected).
add_library(project_options INTERFACE)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(project_options INTERFACE
    -Wnon-virtual-dtor      # C.35: a base class destructor should be public virtual or protected non-virtual
    -Woverloaded-virtual    # C.138: don't hide virtual functions by accident
    -Wsuggest-override      # C.128: virtual functions should specify exactly one of virtual, override, final
    -Wold-style-cast        # ES.49: if you must cast, use a named cast
    -Wcast-align            # ES.48: avoid casts
    -Wdouble-promotion      # ES.46: avoid lossy (narrowing, truncating) arithmetic conversions
    -Wformat=2              # ES.34: don't define a C-style variadic function; check printf-style formats
    -Wimplicit-fallthrough  # ES.78: don't rely on implicit fallthrough in switch statements
    -Wnull-dereference      # ES.65: don't dereference an invalid pointer
    -Werror=return-type     # a function that falls off the end is always a bug
    $<$<CXX_COMPILER_ID:GNU>:-Wduplicated-cond>
    $<$<CXX_COMPILER_ID:GNU>:-Wlogical-op>)
elseif(MSVC)
  target_compile_options(project_options INTERFACE
    /utf-8                  # source and execution charset
    /Zc:__cplusplus         # make __cplusplus report the real standard
    /Zc:inline
    /EHsc)
endif()
${hardening ? hardeningBlock : ''}`;
}

const compilerGenerator: Generator = {
  description:
    'add guideline-oriented compiler settings (project_options: no extensions, guideline warnings, hardening) and link them into the core library',
  params: {
    hardening: { default: true },
  },
  actions: ({ hardening }) => [
    { add: '/cmake/compiler.cmake', template: compilerCMake(Boolean(hardening)) },
    { insert: '/CMakeLists.txt', before: '# jen:options', line: 'include(cmake/compiler.cmake)' },
    {
      insert: { find: 'CMakeLists.txt' },
      before: '# jen:link',
      line: 'target_link_libraries(${PROJECT_NAME}-core PRIVATE project_options)',
    },
  ],
};

export default compilerGenerator;
