#include "arletex_native.h"

#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <X11/extensions/XShm.h>
#include <chrono>
#include <fstream>
#include <iostream>

namespace arletex {

struct ScreenGrabber::Impl {
    Display* display = nullptr;
    int screen = 0;
    bool hasShm = false;
    XShmSegmentInfo shminfo{};
    XImage* ximage = nullptr;
    int lastWidth = 0;
    int lastHeight = 0;
};

ScreenGrabber::ScreenGrabber(const std::string& displayName)
    : impl(std::make_unique<Impl>()) {
    const char* dName = displayName.empty() ? nullptr : displayName.c_str();
    impl->display = XOpenDisplay(dName);
    if (impl->display) {
        impl->screen = DefaultScreen(impl->display);
        impl->hasShm = XShmQueryExtension(impl->display);
    }
}

ScreenGrabber::~ScreenGrabber() {
    if (impl->ximage) {
        if (impl->hasShm) {
            XShmDetach(impl->display, &impl->shminfo);
            XDestroyImage(impl->ximage);
            shmdt(impl->shminfo.shmaddr);
            shmctl(impl->shminfo.shmid, IPC_RMID, nullptr);
        } else {
            XDestroyImage(impl->ximage);
        }
        impl->ximage = nullptr;
    }

    if (impl->display) {
        XCloseDisplay(impl->display);
        impl->display = nullptr;
    }
}

bool ScreenGrabber::isValid() const {
    return impl->display != nullptr;
}

bool ScreenGrabber::grabScreenToPPM(const std::string& outputPath, int& outWidth, int& outHeight, double& outDurationMs) {
    if (!impl->display) return false;

    auto t0 = std::chrono::high_resolution_clock::now();

    Window root = RootWindow(impl->display, impl->screen);
    XWindowAttributes attrs;
    if (!XGetWindowAttributes(impl->display, root, &attrs)) {
        return false;
    }

    int width = attrs.width;
    int height = attrs.height;
    outWidth = width;
    outHeight = height;

    if (impl->hasShm) {
        if (!impl->ximage || impl->lastWidth != width || impl->lastHeight != height) {
            if (impl->ximage) {
                XShmDetach(impl->display, &impl->shminfo);
                XDestroyImage(impl->ximage);
                shmdt(impl->shminfo.shmaddr);
                shmctl(impl->shminfo.shmid, IPC_RMID, nullptr);
            }

            impl->ximage = XShmCreateImage(impl->display, DefaultVisual(impl->display, impl->screen),
                                           DefaultDepth(impl->display, impl->screen), ZPixmap, nullptr,
                                           &impl->shminfo, width, height);

            if (!impl->ximage) return false;

            impl->shminfo.shmid = shmget(IPC_PRIVATE, impl->ximage->bytes_per_line * impl->ximage->height,
                                         IPC_CREAT | 0777);
            if (impl->shminfo.shmid < 0) return false;

            impl->shminfo.shmaddr = impl->ximage->data = (char*)shmat(impl->shminfo.shmid, 0, 0);
            impl->shminfo.readOnly = False;

            if (!XShmAttach(impl->display, &impl->shminfo)) return false;
            impl->lastWidth = width;
            impl->lastHeight = height;
        }

        if (!XShmGetImage(impl->display, root, impl->ximage, 0, 0, AllPlanes)) {
            return false;
        }
    } else {
        XImage* img = XGetImage(impl->display, root, 0, 0, width, height, AllPlanes, ZPixmap);
        if (!img) return false;
        impl->ximage = img;
    }

    // Write binary PPM format (fastest direct raw uncompressed pixmap)
    std::ofstream ppm(outputPath, std::ios::binary);
    if (!ppm.is_open()) return false;

    ppm << "P6\n" << width << " " << height << "\n255\n";

    unsigned long rmask = impl->ximage->red_mask;
    unsigned long gmask = impl->ximage->green_mask;
    unsigned long bmask = impl->ximage->blue_mask;

    int rshift = __builtin_ctz(rmask);
    int gshift = __builtin_ctz(gmask);
    int bshift = __builtin_ctz(bmask);

    std::vector<uint8_t> row(width * 3);
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            unsigned long pixel = XGetPixel(impl->ximage, x, y);
            row[x * 3 + 0] = static_cast<uint8_t>((pixel & rmask) >> rshift);
            row[x * 3 + 1] = static_cast<uint8_t>((pixel & gmask) >> gshift);
            row[x * 3 + 2] = static_cast<uint8_t>((pixel & bmask) >> bshift);
        }
        ppm.write(reinterpret_cast<const char*>(row.data()), width * 3);
    }
    ppm.close();

    auto t1 = std::chrono::high_resolution_clock::now();
    outDurationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return true;
}

} // namespace arletex
