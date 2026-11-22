# Arletex Native Reflex Engine (C++20 & CMake)

The **Arletex Native Reflex Engine** provides hardware-level embodied agency for Arle directly on Linux:

- **Ultra-fast Screen Vision:** XShm raw frame capture (<8 ms) and KWin Wayland frame inspection.
- **Physical Mouse Dynamics:** Sub-millisecond clicks, double clicks, and natural cubic-eased cursor gliding across the desktop.
- **Physical Keyboard Simulation:** Keystroke by keystroke hardware key events, modifiers (`Ctrl`, `Alt`, `Shift`), and key combinations (`Ctrl+L`, `Return`).
- **Window Management:** Real-time client inspection via `_NET_CLIENT_LIST` and immediate window activation via `_NET_ACTIVE_WINDOW`.

---

## Directory Structure

```text
native/
├── CMakeLists.txt              # Standard CMake build definition (Release, -O3, -march=native)
├── include/
│   └── arletex_native.h        # Unified C++ API header (InputController, ScreenGrabber, WindowManager)
├── src/
│   ├── input_controller.cpp    # Mouse and keyboard hardware automation
│   ├── screen_grabber.cpp      # Fast XShm / X11 framebuffer grabber
│   ├── window_manager.cpp      # _NET_CLIENT_LIST and window focus routines
│   └── main.cpp                # CLI interface for Node.js / Electron integration
└── build/
    ├── libarletex_native_static.a  # Static native library
    └── reflex_engine               # High-speed native binary executable
```

---

## Building with CMake

```bash
cd native
mkdir -p build && cd build
cmake ..
make -j$(nproc)
```

The resulting binary `native/build/reflex_engine` executes commands in microseconds.
