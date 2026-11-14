#include "arletex_native.h"

#include <X11/Xlib.h>
#include <X11/keysym.h>
#include <unistd.h>
#include <cmath>
#include <chrono>
#include <thread>
#include <iostream>

extern "C" {
  int XTestFakeMotionEvent(Display* dpy, int screen_number, int x, int y, unsigned long delay);
  int XTestFakeButtonEvent(Display* dpy, unsigned int button, int is_press, unsigned long delay);
  int XTestFakeKeyEvent(Display* dpy, unsigned int keycode, int is_press, unsigned long delay);
}

namespace arletex {

struct InputController::Impl {
    Display* display = nullptr;
    int screen = 0;
};

InputController::InputController(const std::string& displayName)
    : impl(std::make_unique<Impl>()) {
    const char* dName = displayName.empty() ? nullptr : displayName.c_str();
    impl->display = XOpenDisplay(dName);
    if (impl->display) {
        impl->screen = DefaultScreen(impl->display);
    }
}

InputController::~InputController() {
    if (impl->display) {
        XCloseDisplay(impl->display);
        impl->display = nullptr;
    }
}

bool InputController::isValid() const {
    return impl->display != nullptr;
}

bool InputController::mouseMove(int x, int y) {
    if (!impl->display) return false;
    XTestFakeMotionEvent(impl->display, impl->screen, x, y, CurrentTime);
    XFlush(impl->display);
    return true;
}

bool InputController::mouseGlide(int toX, int toY, int durationMs) {
    if (!impl->display) return false;

    // Get current mouse pointer position
    Window root, child;
    int rootX = 0, rootY = 0, winX = 0, winY = 0;
    unsigned int mask = 0;
    XQueryPointer(impl->display, RootWindow(impl->display, impl->screen),
                  &root, &child, &rootX, &rootY, &winX, &winY, &mask);

    int startX = rootX;
    int startY = rootY;
    int steps = std::max(6, durationMs / 10);
    int stepSleepUs = (durationMs * 1000) / steps;

    for (int i = 1; i <= steps; ++i) {
        double t = static_cast<double>(i) / steps;
        // Ease-out cubic curve for natural physical hand motion
        double ease = 1.0 - std::pow(1.0 - t, 3.0);
        int curX = static_cast<int>(startX + (toX - startX) * ease);
        int curY = static_cast<int>(startY + (toY - startY) * ease);

        XTestFakeMotionEvent(impl->display, impl->screen, curX, curY, CurrentTime);
        XFlush(impl->display);
        usleep(stepSleepUs);
    }

    return true;
}

bool InputController::mouseClick(int x, int y, int button) {
    if (!impl->display) return false;
    mouseMove(x, y);
    usleep(8000);
    XTestFakeButtonEvent(impl->display, button, True, CurrentTime);
    XFlush(impl->display);
    usleep(15000);
    XTestFakeButtonEvent(impl->display, button, False, CurrentTime);
    XFlush(impl->display);
    return true;
}

bool InputController::mouseDoubleClick(int x, int y) {
    if (!impl->display) return false;
    mouseClick(x, y, 1);
    usleep(45000);
    mouseClick(x, y, 1);
    return true;
}

bool InputController::typeText(const std::string& text, int delayMs) {
    if (!impl->display) return false;

    for (char c : text) {
        KeySym sym = NoSymbol;
        bool needShift = false;

        if (c >= 'a' && c <= 'z') {
            sym = XK_a + (c - 'a');
        } else if (c >= 'A' && c <= 'Z') {
            sym = XK_a + (c - 'A');
            needShift = true;
        } else if (c >= '0' && c <= '9') {
            sym = XK_0 + (c - '0');
        } else {
            switch (c) {
                case ' ': sym = XK_space; break;
                case '.': sym = XK_period; break;
                case ',': sym = XK_comma; break;
                case '/': sym = XK_slash; break;
                case ':': sym = XK_semicolon; needShift = true; break;
                case ';': sym = XK_semicolon; break;
                case '-': sym = XK_minus; break;
                case '_': sym = XK_minus; needShift = true; break;
                case '=': sym = XK_equal; break;
                case '+': sym = XK_equal; needShift = true; break;
                case '?': sym = XK_slash; needShift = true; break;
                case '!': sym = XK_1; needShift = true; break;
                case '@': sym = XK_2; needShift = true; break;
                case '#': sym = XK_3; needShift = true; break;
                case '$': sym = XK_4; needShift = true; break;
                case '%': sym = XK_5; needShift = true; break;
                case '&': sym = XK_7; needShift = true; break;
                case '*': sym = XK_8; needShift = true; break;
                case '(': sym = XK_9; needShift = true; break;
                case ')': sym = XK_0; needShift = true; break;
                case '\n': sym = XK_Return; break;
                case '\t': sym = XK_Tab; break;
                default: sym = static_cast<KeySym>(static_cast<unsigned char>(c)); break;
            }
        }

        KeyCode code = XKeysymToKeycode(impl->display, sym);
        if (code == 0) continue;

        if (needShift) {
            KeyCode shiftCode = XKeysymToKeycode(impl->display, XK_Shift_L);
            XTestFakeKeyEvent(impl->display, shiftCode, True, CurrentTime);
        }

        XTestFakeKeyEvent(impl->display, code, True, CurrentTime);
        XFlush(impl->display);
        usleep(8000);
        XTestFakeKeyEvent(impl->display, code, False, CurrentTime);

        if (needShift) {
            KeyCode shiftCode = XKeysymToKeycode(impl->display, XK_Shift_L);
            XTestFakeKeyEvent(impl->display, shiftCode, False, CurrentTime);
        }
        XFlush(impl->display);

        if (delayMs > 0) {
            usleep(delayMs * 1000);
        }
    }

    return true;
}

bool InputController::keyPress(const std::string& keyName) {
    if (!impl->display) return false;

    KeySym sym = XStringToKeysym(keyName.c_str());
    if (sym == NoSymbol) {
        if (keyName == "Return" || keyName == "Enter") sym = XK_Return;
        else if (keyName == "BackSpace") sym = XK_BackSpace;
        else if (keyName == "Tab") sym = XK_Tab;
        else if (keyName == "Escape") sym = XK_Escape;
        else if (keyName == "Up") sym = XK_Up;
        else if (keyName == "Down") sym = XK_Down;
        else if (keyName == "Left") sym = XK_Left;
        else if (keyName == "Right") sym = XK_Right;
        else return false;
    }

    KeyCode code = XKeysymToKeycode(impl->display, sym);
    if (code == 0) return false;

    XTestFakeKeyEvent(impl->display, code, True, CurrentTime);
    XFlush(impl->display);
    usleep(15000);
    XTestFakeKeyEvent(impl->display, code, False, CurrentTime);
    XFlush(impl->display);
    return true;
}

bool InputController::keyCombo(const std::string& modifier, const std::string& key) {
    if (!impl->display) return false;

    KeySym modSym = XStringToKeysym(modifier.c_str());
    KeySym keySym = XStringToKeysym(key.c_str());
    if (modSym == NoSymbol || keySym == NoSymbol) return false;

    KeyCode modCode = XKeysymToKeycode(impl->display, modSym);
    KeyCode keyCode = XKeysymToKeycode(impl->display, keySym);
    if (modCode == 0 || keyCode == 0) return false;

    XTestFakeKeyEvent(impl->display, modCode, True, CurrentTime);
    XFlush(impl->display);
    usleep(10000);

    XTestFakeKeyEvent(impl->display, keyCode, True, CurrentTime);
    XFlush(impl->display);
    usleep(15000);
    XTestFakeKeyEvent(impl->display, keyCode, False, CurrentTime);

    XTestFakeKeyEvent(impl->display, modCode, False, CurrentTime);
    XFlush(impl->display);
    return true;
}

} // namespace arletex
