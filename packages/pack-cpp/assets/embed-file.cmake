# Script mode: turns a binary file into a C++ header with a constexpr byte array.
#
#   cmake -DIN=assets/tiles.png -DOUT=tiles.h -DNAME=tilesPng -P embed-file.cmake
#
# Run at build time by embed_file() (see embed.cmake), not at configure time.
file(READ "${IN}" hex HEX)
string(LENGTH "${hex}" len)
math(EXPR size "${len} / 2")
string(REGEX REPLACE "([0-9a-f][0-9a-f])" "0x\\1," bytes "${hex}")
file(WRITE "${OUT}"
  "#pragma once\n#include <array>\n\n"
  "inline constexpr std::array<unsigned char, ${size}> ${NAME} = {${bytes}};\n")
