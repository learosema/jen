# Embeds a binary file into a target as a constexpr byte array.
#
#   embed_file(my-game-core assets/tiles.png tilesPng)
#
# `file` is relative to the project's source dir. The header is generated at
# build time, so editing the asset re-embeds it without re-running cmake.
# Include the generated header (#include "tilesPng.h") from exactly one .cpp:
# large constexpr arrays cost compile time in every translation unit.
# Usage: SDL_IOFromConstMem(tilesPng.data(), tilesPng.size())
function(embed_file target file name)
  set(out "${CMAKE_CURRENT_BINARY_DIR}/embedded/${name}.h")
  set(script "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/embed-file.cmake")
  add_custom_command(
    OUTPUT "${out}"
    COMMAND ${CMAKE_COMMAND} -DIN=${PROJECT_SOURCE_DIR}/${file} -DOUT=${out} -DNAME=${name} -P ${script}
    DEPENDS "${PROJECT_SOURCE_DIR}/${file}" "${script}"
    VERBATIM)
  target_sources(${target} PRIVATE "${out}")
  target_include_directories(${target} PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/embedded")
endfunction()
