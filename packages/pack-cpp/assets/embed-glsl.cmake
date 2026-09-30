# Helper function to embed glsl files.
#
# embed_glsl(shaders/quad.vert.glsl QUAD_VERT_SRC)
function(embed_glsl INPUT_FILE VARIABLE_NAME)
    set(OUTPUT_HEADER "${INPUT_FILE}.h")
    set(OUTPUT_HEADER_PATH "${CMAKE_CURRENT_SOURCE_DIR}/${OUTPUT_HEADER}")
    set(INPUT_FILE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/${INPUT_FILE}")
    if(NOT EXISTS "${INPUT_FILE_PATH}")
        message(FATAL_ERROR "Shader not found: ${INPUT_FILE_PATH}")
    endif()

    file(READ "${INPUT_FILE_PATH}" SHADER_SOURCE)

    # check for name clashes
    set(DELIM "GLSL_${VARIABLE_NAME}")
    string(FIND "${SHADER_SOURCE}" "${DELIM}" DELIM_FOUND)
    if(NOT DELIM_FOUND EQUAL -1)
        message(FATAL_ERROR
            "Shader ${INPUT_FILE_PATH} contains Raw-String-Delimiter "
            "'${DELIM}' - VARIABLE_NAME should be changed in embed_glsl() call.")
    endif()

    # generate a guard macro: library.h -> __LIBRARY_H__
    string(TOUPPER "${OUTPUT_HEADER}" GUARD_MACRO)
    string(REGEX REPLACE "[^A-Z0-9_]" "_" GUARD_MACRO "${GUARD_MACRO}")
    set(GUARD_MACRO "__${GUARD_MACRO}__")

    file(WRITE "${OUTPUT_HEADER_PATH}"
        "#ifndef ${GUARD_MACRO}\n"
        "#define ${GUARD_MACRO}\n"
        "\n\n"
        "// Generated from ${INPUT_FILE} - do not edit\n"
        "inline constexpr const char* ${VARIABLE_NAME} = R\"(\n"
        "${SHADER_SOURCE})\";\n"
        "\n\n#endif\n"
    )

    set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${INPUT_FILE_PATH}")
endfunction()