#include "arletex_native.h"

#include <iostream>
#include <string>
#include <cstdlib>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "{\"error\":\"Usage: reflex_engine <cmd> [args...]\"}\n";
        return 1;
    }

    std::string cmd = argv[1];
    const char* dispEnv = std::getenv("DISPLAY");
    std::string display = dispEnv ? dispEnv : ":0";

    arletex::InputController input(display);
    arletex::ScreenGrabber screen(display);
    arletex::WindowManager winMgr(display);

    if (cmd == "mouse_move" && argc >= 4) {
        int x = std::atoi(argv[2]);
        int y = std::atoi(argv[3]);
        bool ok = input.mouseMove(x, y);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"mouse_move\",\"x\":" << x << ",\"y\":" << y << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "mouse_glide" && argc >= 4) {
        int toX = std::atoi(argv[2]);
        int toY = std::atoi(argv[3]);
        int dur = (argc >= 5) ? std::atoi(argv[4]) : 120;
        bool ok = input.mouseGlide(toX, toY, dur);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"mouse_glide\",\"toX\":" << toX << ",\"toY\":" << toY << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "mouse_click" && argc >= 4) {
        int x = std::atoi(argv[2]);
        int y = std::atoi(argv[3]);
        int btn = (argc >= 5) ? std::atoi(argv[4]) : 1;
        bool ok = input.mouseClick(x, y, btn);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"mouse_click\",\"x\":" << x << ",\"y\":" << y << ",\"button\":" << btn << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "type_text" && argc >= 3) {
        std::string text = argv[2];
        int delay = (argc >= 4) ? std::atoi(argv[3]) : 15;
        bool ok = input.typeText(text, delay);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"type_text\",\"chars\":" << text.length() << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "key_press" && argc >= 3) {
        std::string key = argv[2];
        bool ok = input.keyPress(key);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"key_press\",\"key\":\"" << key << "\"}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "key_combo" && argc >= 4) {
        std::string mod = argv[2];
        std::string key = argv[3];
        bool ok = input.keyCombo(mod, key);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"key_combo\",\"mod\":\"" << mod << "\",\"key\":\"" << key << "\"}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "grab_screen" && argc >= 3) {
        std::string path = argv[2];
        int w = 0, h = 0;
        double elapsed = 0.0;
        bool ok = screen.grabScreenToPPM(path, w, h, elapsed);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"grab_screen\",\"path\":\"" << path << "\",\"width\":" << w << ",\"height\":" << h << ",\"elapsed_ms\":" << elapsed << "}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "list_windows") {
        auto list = winMgr.listWindows();
        std::cout << "{\"success\":true,\"windows\":[";
        for (size_t i = 0; i < list.size(); ++i) {
            std::cout << "{\"id\":" << list[i].id << ",\"title\":\"" << list[i].title << "\",\"x\":" << list[i].x << ",\"y\":" << list[i].y << ",\"width\":" << list[i].width << ",\"height\":" << list[i].height << "}";
            if (i + 1 < list.size()) std::cout << ",";
        }
        std::cout << "]}\n";
        return 0;
    }

    if (cmd == "find_window" && argc >= 3) {
        std::string query = argv[2];
        unsigned long winId = winMgr.findWindow(query);
        std::cout << "{\"success\":" << (winId != 0 ? "true" : "false") << ",\"action\":\"find_window\",\"query\":\"" << query << "\",\"window_id\":" << winId << "}\n";
        return winId != 0 ? 0 : 1;
    }

    if (cmd == "focus_window" && argc >= 3) {
        unsigned long winId = std::strtoul(argv[2], nullptr, 0);
        bool ok = winMgr.focusWindow(winId);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"action\":\"focus_window\",\"window_id\":" << winId << "}\n";
        return ok ? 0 : 1;
    }

    std::cout << "{\"success\":false,\"error\":\"Unknown command: " << cmd << "\"}\n";
    return 1;
}
