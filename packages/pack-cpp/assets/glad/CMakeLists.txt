cmake_minimum_required(VERSION 3.24)
project(glad VERSION 1.0 LANGUAGES C)

add_library(glad include/glad/glad.h src/glad.c include/KHR/khrplatform.h)
target_include_directories(glad PUBLIC include/ include/KHR include/glad)