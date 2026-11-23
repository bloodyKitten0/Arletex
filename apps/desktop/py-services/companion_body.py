#!/usr/bin/env python3
"""
Arletex Desktop Companion Body
Independent Native Desktop Pet / Avatar for Linux (KDE Plasma / Wayland)
Built with PyQt6 for zero-glitch transparent frameless rendering.

Features:
- 3 Distinct Skins: Ruby (girl_1), Sapphire (girl_2), Emerald (girl_3)
- Real-time synchronization with local backend (localhost:3000)
- Dynamic emotional reflection and animation switching (idle, dialogue, book, protect, attack, walk)
- Smooth click-and-drag positioning with persistent screen coordinates
- Interactive speech bubble HUD for live dialogue display
- Right-click context menu and system tray presence
- Standalone autonomous heartbeat fallback when backend is offline
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

from PyQt6.QtCore import Qt, QTimer, QPoint, QRect, QRectF, QSize, pyqtSignal, QObject
from PyQt6.QtGui import (
    QPainter,
    QPixmap,
    QColor,
    QBrush,
    QPen,
    QFont,
    QIcon,
    QAction,
    QMouseEvent,
    QPainterPath,
)
from PyQt6.QtWidgets import (
    QApplication,
    QWidget,
    QMenu,
    QSystemTrayIcon,
)

# Base path resolution
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
SPRITES_DIR = SCRIPT_DIR.parent / "public" / "sprites"
CONFIG_DIR = Path.home() / ".config" / "arletex"
CONFIG_FILE = CONFIG_DIR / "companion_geometry.json"

ANIMATION_CONFIGS = {
    "girl_1": {
        "idle": {"file": "Idle.png", "frames": 9, "frame_w": 128, "frame_h": 128, "fps": 8},
        "walk": {"file": "Walk.png", "frames": 12, "frame_w": 128, "frame_h": 128, "fps": 12},
        "dialogue": {"file": "Dialogue.png", "frames": 11, "frame_w": 128, "frame_h": 128, "fps": 10},
        "book": {"file": "Book.png", "frames": 10, "frame_w": 64, "frame_h": 64, "fps": 5},
        "protection": {"file": "Protection.png", "frames": 4, "frame_w": 128, "frame_h": 128, "fps": 6},
        "attack": {"file": "Attack.png", "frames": 8, "frame_w": 128, "frame_h": 128, "fps": 10},
    },
    "girl_2": {
        "idle": {"file": "Idle.png", "frames": 7, "frame_w": 128, "frame_h": 128, "fps": 7},
        "walk": {"file": "Walk.png", "frames": 12, "frame_w": 128, "frame_h": 128, "fps": 12},
        "dialogue": {"file": "Dialogue.png", "frames": 6, "frame_w": 128, "frame_h": 128, "fps": 8},
        "book": {"file": "../girl_1/Book.png", "frames": 10, "frame_w": 64, "frame_h": 64, "fps": 5},
        "protection": {"file": "Protection.png", "frames": 2, "frame_w": 128, "frame_h": 128, "fps": 4},
        "attack": {"file": "Attack.png", "frames": 9, "frame_w": 128, "frame_h": 128, "fps": 10},
    },
    "girl_3": {
        "idle": {"file": "Idle.png", "frames": 6, "frame_w": 128, "frame_h": 128, "fps": 6},
        "walk": {"file": "Walk.png", "frames": 12, "frame_w": 128, "frame_h": 128, "fps": 12},
        "dialogue": {"file": "Dialogue.png", "frames": 8, "frame_w": 128, "frame_h": 128, "fps": 8},
        "book": {"file": "../girl_1/Book.png", "frames": 10, "frame_w": 64, "frame_h": 64, "fps": 5},
        "protection": {"file": "Protection.png", "frames": 3, "frame_w": 128, "frame_h": 128, "fps": 5},
        "attack": {"file": "Attack.png", "frames": 10, "frame_w": 128, "frame_h": 128, "fps": 10},
    },
}

SKIN_META = {
    "girl_1": {"name": "Ruby (Arle Original)", "color": "#f43f5e", "ribbon": "🎀"},
    "girl_2": {"name": "Sapphire (Casual)", "color": "#38bdf8", "ribbon": "🌸"},
    "girl_3": {"name": "Emerald (Elegant)", "color": "#34d399", "ribbon": "❄️"},
}


class CompanionBackendSync(QObject):
    """Polls the local Arletex backend for live emotional and companion states."""
    state_updated = pyqtSignal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll_backend)
        self.timer.start(1000)  # poll every 1 second

    def poll_backend(self):
        ports = [int(os.environ.get("ARLETEX_PORT", 39281)), 39281, 3000]
        for port in ports:
            try:
                req = urllib.request.Request(
                    f"http://127.0.0.1:{port}/api/companion/state",
                    headers={"User-Agent": "ArletexCompanionBody/1.0"},
                )
                with urllib.request.urlopen(req, timeout=0.8) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        if data.get("success") and "data" in data:
                            self.state_updated.emit(data["data"])
                            return
            except Exception:
                pass

            # Try APE experiential state snapshot if companion endpoint is idle
            try:
                req_ape = urllib.request.Request(
                    f"http://127.0.0.1:{port}/api/ape/state",
                    headers={"User-Agent": "ArletexCompanionBody/1.0"},
                )
                with urllib.request.urlopen(req_ape, timeout=0.8) as response:
                    if response.status == 200:
                        ape_data = json.loads(response.read().decode("utf-8"))
                        aff = ape_data.get("affective", {})
                        pad = aff.get("pad", {})
                        valence = pad.get("valence", aff.get("valence", 0.0))
                        mood = aff.get("currentMood", "").lower()
                        skin = "girl_1"
                        if "curious" in mood or "playful" in mood or valence > 0.4:
                            skin = "girl_2"
                        elif "contemplat" in mood or "solemn" in mood or valence < -0.2:
                            skin = "girl_3"
                        self.state_updated.emit({"character": skin, "backend_alive": True})
                        return
            except Exception:
                pass


class CompanionBodyWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.character = "girl_1"
        self.animation = "idle"
        self.flip_x = False
        self.is_speaking = False
        self.speech_text = ""
        self.speech_expire_time = 0.0
        self.current_frame = 0
        self.pixmaps = {}
        self.drag_position = None
        self.target_size = QSize(160, 160)

        # Configure Frameless Transparent Window for Wayland / KDE Plasma
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_NoSystemBackground, True)
        self.setMouseTracking(True)
        self.resize(320, 240)  # Canvas accommodates sprite + speech bubble

        # Load persisted position
        self.load_geometry()

        # Preload sprites
        self.load_all_sprites()

        # Frame animation timer
        self.anim_timer = QTimer(self)
        self.anim_timer.timeout.connect(self.advance_frame)
        self.anim_timer.start(100)

        # Setup backend sync
        self.sync = CompanionBackendSync(self)
        self.sync.state_updated.connect(self.on_state_updated)

        # Setup Tray Icon
        self.setup_tray()

    def load_geometry(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.move(data.get("x", 200), data.get("y", 200))
                    self.character = data.get("character", "girl_1")
                    return
            except Exception:
                pass
        # Default positioning at bottom-right of primary screen
        screen = QApplication.primaryScreen()
        if screen:
            geom = screen.availableGeometry()
            self.move(geom.width() - 360, geom.height() - 280)

    def save_geometry(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {"x": self.x(), "y": self.y(), "character": self.character},
                    f,
                    indent=2,
                )
        except Exception:
            pass

    def load_all_sprites(self):
        for skin, anims in ANIMATION_CONFIGS.items():
            for anim_name, cfg in anims.items():
                img_path = SPRITES_DIR / skin / cfg["file"]
                if img_path.exists():
                    pm = QPixmap(str(img_path))
                    self.pixmaps[f"{skin}_{anim_name}"] = pm
                else:
                    fallback = SPRITES_DIR / "girl_1" / cfg["file"]
                    if fallback.exists():
                        self.pixmaps[f"{skin}_{anim_name}"] = QPixmap(str(fallback))

    def on_state_updated(self, data: dict):
        char = data.get("character")
        if char in ANIMATION_CONFIGS and char != self.character:
            self.character = char
            self.current_frame = 0

        anim = data.get("activeAnimation")
        if anim in ANIMATION_CONFIGS[self.character] and anim != self.animation:
            self.animation = anim
            self.current_frame = 0

        if "flipX" in data:
            self.flip_x = bool(data["flipX"])

        if "isSpeaking" in data:
            self.is_speaking = bool(data["isSpeaking"])
            if self.is_speaking and not anim:
                self.animation = "dialogue"

        if data.get("currentSpeechText"):
            self.speech_text = str(data["currentSpeechText"])
            self.speech_expire_time = time.time() + 6.0
        elif data.get("speechText"):
            self.speech_text = str(data["speechText"])
            self.speech_expire_time = time.time() + 6.0

        self.update()

    def advance_frame(self):
        cfg = ANIMATION_CONFIGS.get(self.character, {}).get(self.animation)
        if not cfg:
            cfg = ANIMATION_CONFIGS["girl_1"]["idle"]

        total_frames = cfg["frames"]
        self.current_frame = (self.current_frame + 1) % max(1, total_frames)

        # Clear expired speech bubble
        if self.speech_text and time.time() > self.speech_expire_time:
            self.speech_text = ""
            if self.animation == "dialogue":
                self.animation = "idle"

        self.update()

    def paintEvent(self, _event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, False)  # Crisp pixel art

        cfg = ANIMATION_CONFIGS.get(self.character, {}).get(self.animation)
        if not cfg:
            cfg = ANIMATION_CONFIGS["girl_1"]["idle"]

        key = f"{self.character}_{self.animation}"
        pm = self.pixmaps.get(key)
        if not pm or pm.isNull():
            key = f"girl_1_{self.animation}"
            pm = self.pixmaps.get(key)

        sprite_x = 80
        sprite_y = 70
        sprite_w = 160
        sprite_h = 160

        # Draw subtle presence glow beneath her feet
        glow_color = QColor(SKIN_META[self.character]["color"])
        glow_color.setAlpha(45)
        painter.setBrush(QBrush(glow_color))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawEllipse(sprite_x + 30, sprite_y + 135, 100, 20)

        # Draw sprite frame
        if pm and not pm.isNull():
            fw = cfg["frame_w"]
            fh = cfg["frame_h"]
            src_x = self.current_frame * fw
            src_rect = QRect(src_x, 0, fw, fh)
            dest_rect = QRect(sprite_x, sprite_y, sprite_w, sprite_h)

            if self.flip_x:
                painter.save()
                painter.translate(dest_rect.center().x(), 0)
                painter.scale(-1, 1)
                painter.translate(-dest_rect.center().x(), 0)
                painter.drawPixmap(dest_rect, pm, src_rect)
                painter.restore()
            else:
                painter.drawPixmap(dest_rect, pm, src_rect)

        # Draw Speech Bubble if active
        if self.speech_text and time.time() <= self.speech_expire_time:
            self.draw_speech_bubble(painter, sprite_x + 80, sprite_y)

        painter.end()

    def draw_speech_bubble(self, painter: QPainter, anchor_x: int, anchor_y: int):
        painter.save()
        font = QFont("Inter, sans-serif", 9, QFont.Weight.Medium)
        painter.setFont(font)

        raw_text = self.speech_text[:160] + ("..." if len(self.speech_text) > 160 else "")
        # Compute bubble metrics
        bubble_w = min(240, max(140, len(raw_text) * 7 + 24))
        bubble_h = 42
        bubble_x = max(10, anchor_x - bubble_w // 2)
        bubble_y = max(8, anchor_y - bubble_h - 12)

        bubble_rect = QRectF(bubble_x, bubble_y, bubble_w, bubble_h)

        # Speech bubble background
        bg_color = QColor(15, 23, 42, 235)  # Dark translucent
        border_color = QColor(SKIN_META[self.character]["color"])
        painter.setBrush(QBrush(bg_color))
        painter.setPen(QPen(border_color, 1.5))

        path = QPainterPath()
        path.addRoundedRect(bubble_rect, 10, 10)
        # Tail pointer
        tail_x = min(bubble_x + bubble_w - 20, max(bubble_x + 20, anchor_x))
        path.moveTo(tail_x - 6, bubble_y + bubble_h)
        path.lineTo(tail_x, bubble_y + bubble_h + 8)
        path.lineTo(tail_x + 6, bubble_y + bubble_h)
        painter.drawPath(path)

        # Text inside bubble
        painter.setPen(QPen(QColor(241, 245, 249)))
        painter.drawText(
            bubble_rect.adjusted(8, 4, -8, -4),
            Qt.AlignmentFlag.AlignCenter | Qt.TextFlag.TextWordWrap,
            raw_text,
        )
        painter.restore()

    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.pos()
            event.accept()
        elif event.button() == Qt.MouseButton.RightButton:
            self.show_context_menu(event.globalPosition().toPoint())
            event.accept()

    def mouseMoveEvent(self, event: QMouseEvent):
        if event.buttons() & Qt.MouseButton.LeftButton and self.drag_position:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseReleaseEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = None
            self.save_geometry()
            event.accept()

    def mouseDoubleClickEvent(self, event: QMouseEvent):
        # Interactive poke reaction
        if event.button() == Qt.MouseButton.LeftButton:
            if self.animation == "idle":
                self.animation = "dialogue"
                self.speech_text = "I'm right here with you, Proof."
                self.speech_expire_time = time.time() + 3.0
            elif self.animation == "dialogue":
                self.animation = "book" if self.character == "girl_1" else "protection"
            else:
                self.animation = "idle"
            self.current_frame = 0
            self.update()
            event.accept()

    def show_context_menu(self, global_pos: QPoint):
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu {
                background-color: #0f172a;
                color: #f1f5f9;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 6px;
                font-size: 11px;
            }
            QMenu::item {
                padding: 6px 20px;
                border-radius: 4px;
            }
            QMenu::item:selected {
                background-color: #f43f5e;
                color: #ffffff;
            }
        """)

        # Title header
        title_action = menu.addAction(f"Arle Companion • {SKIN_META[self.character]['name']}")
        title_action.setEnabled(False)
        menu.addSeparator()

        # Skin switcher submenu
        skin_menu = menu.addMenu("👗 Switch Skin")
        for skin_key, meta in SKIN_META.items():
            act = skin_menu.addAction(f"{meta['ribbon']} {meta['name']}")
            if skin_key == self.character:
                act.setIcon(QIcon.fromTheme("emblem-default"))
            act.triggered.connect(lambda _, k=skin_key: self.set_skin(k))

        # Stance submenu
        stance_menu = menu.addMenu("✨ Set Stance")
        for anim in ["idle", "walk", "dialogue", "book", "protection", "attack"]:
            act = stance_menu.addAction(anim.capitalize())
            act.triggered.connect(lambda _, a=anim: self.set_stance(a))

        menu.addSeparator()
        reset_act = menu.addAction("📍 Reset to Corner")
        reset_act.triggered.connect(self.reset_to_corner)

        menu.addSeparator()
        quit_act = menu.addAction("❌ Hide Companion")
        quit_act.triggered.connect(self.close)

        menu.exec(global_pos)

    def set_skin(self, skin: str):
        if skin in ANIMATION_CONFIGS:
            self.character = skin
            self.current_frame = 0
            self.save_geometry()
            self.update()

    def set_stance(self, stance: str):
        if stance in ANIMATION_CONFIGS.get(self.character, {}):
            self.animation = stance
            self.current_frame = 0
            self.update()

    def reset_to_corner(self):
        screen = QApplication.primaryScreen()
        if screen:
            geom = screen.availableGeometry()
            self.move(geom.width() - 360, geom.height() - 280)
            self.save_geometry()

    def setup_tray(self):
        self.tray = QSystemTrayIcon(self)
        # Use first sprite as tray icon
        pm = self.pixmaps.get(f"{self.character}_idle")
        if pm and not pm.isNull():
            cfg = ANIMATION_CONFIGS[self.character]["idle"]
            frame_pm = pm.copy(0, 0, cfg["frame_w"], cfg["frame_h"])
            self.tray.setIcon(QIcon(frame_pm))
        self.tray.setToolTip(f"Arle Desktop Companion ({SKIN_META[self.character]['name']})")

        tray_menu = QMenu()
        show_act = tray_menu.addAction("Show Companion")
        show_act.triggered.connect(self.show)
        hide_act = tray_menu.addAction("Hide Companion")
        hide_act.triggered.connect(self.hide)
        tray_menu.addSeparator()
        quit_act = tray_menu.addAction("Quit Companion")
        quit_act.triggered.connect(QApplication.quit)

        self.tray.setContextMenu(tray_menu)
        self.tray.show()


def main():
    # Force Wayland or auto-platform
    if "WAYLAND_DISPLAY" in os.environ and "QT_QPA_PLATFORM" not in os.environ:
        os.environ["QT_QPA_PLATFORM"] = "wayland;xcb"

    app = QApplication(sys.argv)
    app.setApplicationName("Arle Desktop Companion")

    window = CompanionBodyWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
