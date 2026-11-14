#include "arletex_native.h"

#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <algorithm>
#include <cstring>
#include <iostream>

namespace arletex {

struct WindowManager::Impl {
    Display* display = nullptr;
    int screen = 0;
};

WindowManager::WindowManager(const std::string& displayName)
    : impl(std::make_unique<Impl>()) {
    const char* dName = displayName.empty() ? nullptr : displayName.c_str();
    impl->display = XOpenDisplay(dName);
    if (impl->display) {
        impl->screen = DefaultScreen(impl->display);
    }
}

WindowManager::~WindowManager() {
    if (impl->display) {
        XCloseDisplay(impl->display);
        impl->display = nullptr;
    }
}

bool WindowManager::isValid() const {
    return impl->display != nullptr;
}

static std::string getWindowTitle(Display* display, Window win) {
    Atom netWmName = XInternAtom(display, "_NET_WM_NAME", False);
    Atom utf8String = XInternAtom(display, "UTF8_STRING", False);
    Atom actualType;
    int actualFormat;
    unsigned long nItems, bytesAfter;
    unsigned char* prop = nullptr;

    if (XGetWindowProperty(display, win, netWmName, 0, 1024, False, utf8String,
                           &actualType, &actualFormat, &nItems, &bytesAfter, &prop) == Success && prop) {
        std::string title(reinterpret_cast<char*>(prop));
        XFree(prop);
        return title;
    }

    char* wmName = nullptr;
    if (XFetchName(display, win, &wmName) && wmName) {
        std::string title(wmName);
        XFree(wmName);
        return title;
    }

    return "";
}

std::vector<WindowInfo> WindowManager::listWindows() {
    std::vector<WindowInfo> result;
    if (!impl->display) return result;

    Atom netClientList = XInternAtom(impl->display, "_NET_CLIENT_LIST", False);
    Atom actualType;
    int actualFormat;
    unsigned long nItems = 0, bytesAfter = 0;
    unsigned char* prop = nullptr;

    Window root = RootWindow(impl->display, impl->screen);
    if (XGetWindowProperty(impl->display, root, netClientList, 0, 1024, False, XA_WINDOW,
                           &actualType, &actualFormat, &nItems, &bytesAfter, &prop) == Success && prop) {
        Window* wins = reinterpret_cast<Window*>(prop);
        for (unsigned long i = 0; i < nItems; ++i) {
            std::string title = getWindowTitle(impl->display, wins[i]);
            if (title.empty()) continue;

            XWindowAttributes attrs;
            if (XGetWindowAttributes(impl->display, wins[i], &attrs) && attrs.map_state == IsViewable) {
                result.push_back({
                    wins[i],
                    title,
                    attrs.x,
                    attrs.y,
                    static_cast<unsigned int>(attrs.width),
                    static_cast<unsigned int>(attrs.height)
                });
            }
        }
        XFree(prop);
    }

    return result;
}

unsigned long WindowManager::findWindow(const std::string& nameQuery) {
    if (!impl->display) return 0;

    std::string lowerQuery = nameQuery;
    std::transform(lowerQuery.begin(), lowerQuery.end(), lowerQuery.begin(), ::tolower);

    auto windows = listWindows();
    for (const auto& w : windows) {
        std::string lowerTitle = w.title;
        std::transform(lowerTitle.begin(), lowerTitle.end(), lowerTitle.begin(), ::tolower);
        if (lowerTitle.find(lowerQuery) != std::string::npos) {
            return w.id;
        }
    }
    return 0;
}

bool WindowManager::focusWindow(unsigned long windowId) {
    if (!impl->display || windowId == 0) return false;

    Atom netActiveWindow = XInternAtom(impl->display, "_NET_ACTIVE_WINDOW", False);
    XEvent event{};
    event.xclient.type = ClientMessage;
    event.xclient.window = windowId;
    event.xclient.message_type = netActiveWindow;
    event.xclient.format = 32;
    event.xclient.data.l[0] = 2; // 2 = Source: Pager or External controller
    event.xclient.data.l[1] = CurrentTime;

    Window root = RootWindow(impl->display, impl->screen);
    XSendEvent(impl->display, root, False,
               SubstructureRedirectMask | SubstructureNotifyMask, &event);
    XMapRaised(impl->display, windowId);
    XSetInputFocus(impl->display, windowId, RevertToPointerRoot, CurrentTime);
    XFlush(impl->display);
    return true;
}

} // namespace arletex
