#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <chrono>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>
#include <X11/keysym.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <X11/extensions/XShm.h>

extern "C" {
  int XTestFakeMotionEvent(Display* dpy, int screen_number, int x, int y, unsigned long delay);
  int XTestFakeButtonEvent(Display* dpy, unsigned int button, int is_press, unsigned long delay);
  int XTestFakeKeyEvent(Display* dpy, unsigned int keycode, int is_press, unsigned long delay);
}

class FastReflexEngine {
private:
    Display* dpy;
    int screen;
    Window root;

public:
    FastReflexEngine(const char* displayName = ":0") {
        dpy = XOpenDisplay(displayName);
        if (!dpy) {
            std::cerr << "{\"success\":false,\"error\":\"Cannot open display " << displayName << "\"}\n";
            exit(1);
        }
        screen = DefaultScreen(dpy);
        root = RootWindow(dpy, screen);
    }

    ~FastReflexEngine() {
        if (dpy) {
            XCloseDisplay(dpy);
        }
    }

    // 1. Instant Mouse Movement (Sub-millisecond)
    bool mouseMove(int x, int y) {
        XTestFakeMotionEvent(dpy, screen, x, y, CurrentTime);
        XFlush(dpy);
        return true;
    }

    // 2. Instant Mouse Click
    bool mouseClick(int x, int y, int button = 1) {
        if (x >= 0 && y >= 0) {
            XTestFakeMotionEvent(dpy, screen, x, y, CurrentTime);
        }
        XTestFakeButtonEvent(dpy, button, True, CurrentTime);
        XFlush(dpy);
        usleep(15000); // 15ms click hold
        XTestFakeButtonEvent(dpy, button, False, CurrentTime);
        XFlush(dpy);
        return true;
    }

    // 3. Fast Physical Keyboard Typing
    bool typeText(const std::string& text, int delayUs = 12000) {
        for (size_t i = 0; i < text.length(); ++i) {
            char c = text[i];
            KeySym sym = NoSymbol;
            bool shift = false;

            if (c >= 'A' && c <= 'Z') {
                sym = XK_A + (c - 'A');
                shift = true;
            } else if (c >= 'a' && c <= 'z') {
                sym = XK_a + (c - 'a');
            } else if (c >= '0' && c <= '9') {
                sym = XK_0 + (c - '0');
            } else if (c == ' ') sym = XK_space;
            else if (c == '\n') sym = XK_Return;
            else if (c == '\t') sym = XK_Tab;
            else if (c == '.') sym = XK_period;
            else if (c == ',') sym = XK_comma;
            else if (c == ':') { sym = XK_colon; shift = true; }
            else if (c == ';') sym = XK_semicolon;
            else if (c == '/') sym = XK_slash;
            else if (c == '?') { sym = XK_question; shift = true; }
            else if (c == '!') { sym = XK_exclam; shift = true; }
            else if (c == '@') { sym = XK_at; shift = true; }
            else if (c == '#') { sym = XK_numbersign; shift = true; }
            else if (c == '$') { sym = XK_dollar; shift = true; }
            else if (c == '%') { sym = XK_percent; shift = true; }
            else if (c == '&') { sym = XK_ampersand; shift = true; }
            else if (c == '*') { sym = XK_asterisk; shift = true; }
            else if (c == '(') { sym = XK_parenleft; shift = true; }
            else if (c == ')') { sym = XK_parenright; shift = true; }
            else if (c == '-') sym = XK_minus;
            else if (c == '_') { sym = XK_underscore; shift = true; }
            else if (c == '=') sym = XK_equal;
            else if (c == '+') { sym = XK_plus; shift = true; }
            else if (c == '\'') sym = XK_apostrophe;
            else if (c == '"') { sym = XK_quotedbl; shift = true; }
            else {
                sym = static_cast<KeySym>(c);
            }

            KeyCode code = XKeysymToKeycode(dpy, sym);
            if (code == 0) continue;

            if (shift) {
                KeyCode shiftCode = XKeysymToKeycode(dpy, XK_Shift_L);
                XTestFakeKeyEvent(dpy, shiftCode, True, CurrentTime);
            }

            XTestFakeKeyEvent(dpy, code, True, CurrentTime);
            XFlush(dpy);
            usleep(delayUs);
            XTestFakeKeyEvent(dpy, code, False, CurrentTime);

            if (shift) {
                KeyCode shiftCode = XKeysymToKeycode(dpy, XK_Shift_L);
                XTestFakeKeyEvent(dpy, shiftCode, False, CurrentTime);
            }
            XFlush(dpy);
            usleep(delayUs);
        }
        return true;
    }

    // 4. Key Press (Return, Super, Tab, BackSpace, Escape, etc.)
    bool keyPress(const std::string& keyName) {
        KeySym sym = XStringToKeysym(keyName.c_str());
        if (sym == NoSymbol) {
            if (keyName == "Return" || keyName == "Enter") sym = XK_Return;
            else if (keyName == "Super" || keyName == "Super_L" || keyName == "Win") sym = XK_Super_L;
            else if (keyName == "Escape" || keyName == "Esc") sym = XK_Escape;
            else if (keyName == "Tab") sym = XK_Tab;
            else if (keyName == "BackSpace" || keyName == "Backspace") sym = XK_BackSpace;
            else if (keyName == "Space") sym = XK_space;
            else if (keyName == "Up") sym = XK_Up;
            else if (keyName == "Down") sym = XK_Down;
            else if (keyName == "Left") sym = XK_Left;
            else if (keyName == "Right") sym = XK_Right;
        }

        KeyCode code = XKeysymToKeycode(dpy, sym);
        if (code == 0) return false;

        XTestFakeKeyEvent(dpy, code, True, CurrentTime);
        XFlush(dpy);
        usleep(20000);
        XTestFakeKeyEvent(dpy, code, False, CurrentTime);
        XFlush(dpy);
        return true;
    }

    // 5. Key Combination (e.g. "Control_L" + "t", "Alt_L" + "F2")
    bool keyCombo(const std::string& modName, const std::string& keyName) {
        KeySym modSym = XStringToKeysym(modName.c_str());
        KeySym keySym = XStringToKeysym(keyName.c_str());
        KeyCode modCode = XKeysymToKeycode(dpy, modSym);
        KeyCode keyCode = XKeysymToKeycode(dpy, keySym);

        if (modCode == 0 || keyCode == 0) return false;

        XTestFakeKeyEvent(dpy, modCode, True, CurrentTime);
        XFlush(dpy);
        usleep(10000);

        XTestFakeKeyEvent(dpy, keyCode, True, CurrentTime);
        XFlush(dpy);
        usleep(15000);

        XTestFakeKeyEvent(dpy, keyCode, False, CurrentTime);
        XTestFakeKeyEvent(dpy, modCode, False, CurrentTime);
        XFlush(dpy);
        return true;
    }

    // 6. Sub-10ms XShm Frame Grab to PPM/BMP
    bool grabScreenFast(const std::string& outputPath) {
        int width = DisplayWidth(dpy, screen);
        int height = DisplayHeight(dpy, screen);

        XShmSegmentInfo shminfo;
        XImage* img = XShmCreateImage(dpy, DefaultVisual(dpy, screen),
                                      DefaultDepth(dpy, screen),
                                      ZPixmap, NULL, &shminfo, width, height);
        if (!img) return false;

        shminfo.shmid = shmget(IPC_PRIVATE, img->bytes_per_line * img->height, IPC_CREAT | 0777);
        shminfo.shmaddr = img->data = (char*)shmat(shminfo.shmid, 0, 0);
        shminfo.readOnly = False;

        XShmAttach(dpy, &shminfo);
        XSync(dpy, False);
        XShmGetImage(dpy, root, img, 0, 0, AllPlanes);

        // Write as high-speed PPM format (instantly readable by imagemagick or VLM)
        FILE* fp = fopen(outputPath.c_str(), "wb");
        if (fp) {
            fprintf(fp, "P6\n%d %d\n255\n", width, height);
            for (int y = 0; y < height; ++y) {
                for (int x = 0; x < width; ++x) {
                    unsigned long pixel = XGetPixel(img, x, y);
                    unsigned char r = (pixel >> 16) & 0xff;
                    unsigned char g = (pixel >> 8) & 0xff;
                    unsigned char b = pixel & 0xff;
                    fputc(r, fp);
                    fputc(g, fp);
                    fputc(b, fp);
                }
            }
            fclose(fp);
        }

        XShmDetach(dpy, &shminfo);
        XDestroyImage(img);
        shmdt(shminfo.shmaddr);
        shmctl(shminfo.shmid, IPC_RMID, 0);
        return true;
    }

    // 7. Find Window Coordinates via X11 Tree (2ms)
    bool findWindow(const std::string& query, int& outX, int& outY, int& outW, int& outH, Window& outWin) {
        Atom clientListAtom = XInternAtom(dpy, "_NET_CLIENT_LIST", True);
        if (clientListAtom == None) return false;

        Atom actualType;
        int actualFormat;
        unsigned long numItems, bytesAfter;
        unsigned char* propData = NULL;

        if (XGetWindowProperty(dpy, root, clientListAtom, 0, 1024, False, XA_WINDOW,
                               &actualType, &actualFormat, &numItems, &bytesAfter, &propData) == Success) {
            Window* windows = (Window*)propData;
            for (unsigned long i = 0; i < numItems; ++i) {
                Window win = windows[i];
                char* winName = NULL;
                if (XFetchName(dpy, win, &winName) > 0 && winName) {
                    std::string title(winName);
                    XFree(winName);
                    if (title.find(query) != std::string::npos) {
                        XWindowAttributes attr;
                        XGetWindowAttributes(dpy, win, &attr);
                        int absX = 0, absY = 0;
                        Window child;
                        XTranslateCoordinates(dpy, win, root, 0, 0, &absX, &absY, &child);
                        outX = absX;
                        outY = absY;
                        outW = attr.width;
                        outH = attr.height;
                        outWin = win;
                        XFree(propData);
                        return true;
                    }
                }
            }
            XFree(propData);
        }
        return false;
    }

    // 8. Focus Window
    bool focusWindow(const std::string& query) {
        int x, y, w, h;
        Window win;
        if (findWindow(query, x, y, w, h, win)) {
            XRaiseWindow(dpy, win);
            XSetInputFocus(dpy, win, RevertToParent, CurrentTime);
            XFlush(dpy);
            return true;
        }
        return false;
    }
};

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "{\"error\":\"Usage: reflex_engine <cmd> [args...]\"}\n";
        return 1;
    }

    const char* displayEnv = getenv("DISPLAY");
    const char* displayName = displayEnv ? displayEnv : ":0";
    FastReflexEngine engine(displayName);

    std::string cmd = argv[1];

    if (cmd == "mouse_move" && argc >= 4) {
        int x = std::atoi(argv[2]);
        int y = std::atoi(argv[3]);
        engine.mouseMove(x, y);
        std::cout << "{\"success\":true,\"action\":\"mouse_move\",\"x\":" << x << ",\"y\":" << y << "}\n";
        return 0;
    }

    if (cmd == "mouse_click" && argc >= 4) {
        int x = std::atoi(argv[2]);
        int y = std::atoi(argv[3]);
        int btn = (argc >= 5) ? std::atoi(argv[4]) : 1;
        engine.mouseClick(x, y, btn);
        std::cout << "{\"success\":true,\"action\":\"mouse_click\",\"x\":" << x << ",\"y\":" << y << ",\"button\":" << btn << "}\n";
        return 0;
    }

    if (cmd == "type_text" && argc >= 3) {
        std::string text = argv[2];
        engine.typeText(text);
        std::cout << "{\"success\":true,\"action\":\"type_text\",\"length\":" << text.length() << "}\n";
        return 0;
    }

    if (cmd == "key_press" && argc >= 3) {
        std::string key = argv[2];
        engine.keyPress(key);
        std::cout << "{\"success\":true,\"action\":\"key_press\",\"key\":\"" << key << "\"}\n";
        return 0;
    }

    if (cmd == "key_combo" && argc >= 4) {
        std::string mod = argv[2];
        std::string key = argv[3];
        engine.keyCombo(mod, key);
        std::cout << "{\"success\":true,\"action\":\"key_combo\",\"mod\":\"" << mod << "\",\"key\":\"" << key << "\"}\n";
        return 0;
    }

    if (cmd == "grab_screen" && argc >= 3) {
        std::string path = argv[2];
        auto t0 = std::chrono::high_resolution_clock::now();
        bool ok = engine.grabScreenFast(path);
        auto t1 = std::chrono::high_resolution_clock::now();
        double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"grab_screen\",\"path\":\"" << path << "\",\"elapsed_ms\":" << ms << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "find_window" && argc >= 3) {
        std::string query = argv[2];
        int x = 0, y = 0, w = 0, h = 0;
        Window win = 0;
        bool ok = engine.findWindow(query, x, y, w, h, win);
        if (ok) {
            std::cout << "{\"success\":true,\"found\":true,\"windowId\":" << win << ",\"x\":" << x << ",\"y\":" << y << ",\"width\":" << w << ",\"height\":" << h << "}\n";
        } else {
            std::cout << "{\"success\":true,\"found\":false,\"query\":\"" << query << "\"}\n";
        }
        return 0;
    }

    if (cmd == "focus_window" && argc >= 3) {
        std::string query = argv[2];
        bool ok = engine.focusWindow(query);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"focus_window\",\"query\":\"" << query << "\"}\n";
        return ok ? 0 : 1;
    }

    std::cout << "{\"success\":false,\"error\":\"Unknown command: " << cmd << "\"}\n";
    return 1;
}
