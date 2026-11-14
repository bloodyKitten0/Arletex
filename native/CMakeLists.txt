cmake_minimum_required(VERSION 3.20)
project(ArletexNativeReflex VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Optimization flags for high-frequency hardware reflex
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -pipe -fomit-frame-pointer")

# Header include paths
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    /home/linuxbrew/.linuxbrew/include
    /usr/include
)

# Link directories
link_directories(
    /home/linuxbrew/.linuxbrew/lib
    /usr/lib64
    /usr/lib
)

# Library sources
set(ARLETEX_NATIVE_SOURCES
    src/input_controller.cpp
    src/screen_grabber.cpp
    src/window_manager.cpp
)

# Static library for integration
add_library(arletex_native_static STATIC
    ${ARLETEX_NATIVE_SOURCES}
)

target_link_libraries(arletex_native_static
    PUBLIC
    X11
    Xext
    /usr/lib64/libXtst.so.6
)

# Standalone reflex_engine executable
add_executable(reflex_engine
    src/main.cpp
)

target_link_libraries(reflex_engine
    PRIVATE
    arletex_native_static
    X11
    Xext
    /usr/lib64/libXtst.so.6
)

# Set rpath so it runs without LD_LIBRARY_PATH issues
set_target_properties(reflex_engine PROPERTIES
    INSTALL_RPATH "/home/linuxbrew/.linuxbrew/lib:/usr/lib64"
    BUILD_WITH_INSTALL_RPATH TRUE
)

# Output build binary to standard location
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
