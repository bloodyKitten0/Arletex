#pragma once

#include <string>
#include <vector>
#include <memory>
#include <cstdint>

namespace arletex {

struct WindowInfo {
    unsigned long id;
    std::string title;
    int x;
    int y;
    unsigned int width;
    unsigned int height;
};

struct ScreenFrame {
    int width;
    int height;
    std::vector<uint8_t> rgbData;
    double captureDurationMs;
};

class InputController {
public:
    explicit InputController(const std::string& displayName = ":0");
    ~InputController();

    bool isValid() const;

    // Direct and smooth human-like mouse movement
    bool mouseMove(int x, int y);
    bool mouseGlide(int toX, int toY, int durationMs = 120);
    bool mouseClick(int x, int y, int button = 1);
    bool mouseDoubleClick(int x, int y);

    // Keyboard automation
    bool typeText(const std::string& text, int delayMs = 15);
    bool keyPress(const std::string& keyName);
    bool keyCombo(const std::string& modifier, const std::string& key);

private:
    struct Impl;
    std::unique_ptr<Impl> impl;
};

class ScreenGrabber {
public:
    explicit ScreenGrabber(const std::string& displayName = ":0");
    ~ScreenGrabber();

    bool isValid() const;
    bool grabScreenToPPM(const std::string& outputPath, int& outWidth, int& outHeight, double& outDurationMs);

private:
    struct Impl;
    std::unique_ptr<Impl> impl;
};

class WindowManager {
public:
    explicit WindowManager(const std::string& displayName = ":0");
    ~WindowManager();

    bool isValid() const;
    std::vector<WindowInfo> listWindows();
    unsigned long findWindow(const std::string& nameQuery);
    bool focusWindow(unsigned long windowId);

private:
    struct Impl;
    std::unique_ptr<Impl> impl;
};

} // namespace arletex
