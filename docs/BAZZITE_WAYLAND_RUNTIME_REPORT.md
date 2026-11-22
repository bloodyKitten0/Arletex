# Bazzite & Wayland Runtime Validation Report (P0.4)

**Date of Execution:** 2026-11-22  
**Target Hardware Platform:** ASUS ROG Ally X (RC72LA)  
**Processor:** AMD Ryzen Z1 Extreme (8 Cores, 16 Threads, Zen 4 architecture, RDNA 3 iGPU)  
**Total System Memory:** 24 GB LPDDR5X-7500 (UMA architecture, dynamically shared between CPU and GPU)  
**Host Operating System:** Bazzite Linux (Fedora Silverblue-based immutable Ostree distribution)  
**Desktop Environment:** KDE Plasma 6 / Gamescope  
**Display Server Protocol:** Wayland (`XDG_SESSION_TYPE=wayland`)

---

## 1. Subsystem Audit & Runtime Capabilities

| Subsystem                      | Host Configuration                                                                   | Provider Implementation                                                                                                  | Validation Outcome |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **Display Server**             | Wayland native compositor                                                            | `DesktopEnvironmentProvider` (captures screenshots via native tools or DBus portals, queries windows via DBus/KWin)      | **VERIFIED**       |
| **Virtual Input**              | `ydotool` daemon (`ydotoold`) on `/tmp/ydotool.sock`                                 | `DesktopEnvironmentProvider.mouseClick`, `keyTap`, `typeText` via `ydotool`                                              | **VERIFIED**       |
| **Media & Audio Architecture** | PipeWire 1.x + WirePlumber (`wpctl`) + MPRIS D-Bus                                   | `VerificationEngine` queries MPRIS `PlaybackStatus` and PipeWire active audio streams before declaring playback verified | **VERIFIED**       |
| **Web Browser Isolation**      | Google Chrome Flatpak (`com.google.Chrome`)                                          | Chrome Profile 7 (`Profile 7`) dedicated to Arletex (`arletex.email@gmail.com`) with independent cookies and session     | **VERIFIED**       |
| **Local LLM Engine**           | `llama-server` on `127.0.0.1:8080` (Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M.gguf) | Offloading 36 GPU layers to AMD Radeon 780M iGPU with 12K context window                                                 | **VERIFIED**       |
| **Voice & Multimodal Stack**   | Kokoro 82M TTS + FastEmbed embeddings on `127.0.0.1:39282`                           | `specialists_server.py` microservice handling voice synthesis and dense embeddings                                       | **VERIFIED**       |

---

## 2. Desktop & Browser Postcondition Verification Proofs

1. **Process Spawn vs. Genuine Verification:**
   - Spawning a child process PID (e.g. synthetic test double PID 99999) does not verify that a page was loaded or rendered.
   - Verification returns `partially_successful` with `verified: false` unless an independent empirical observation confirms the target URL.
2. **Spotify Playback Reality Grounding:**
   - Separates "window open", "track selected", and "audio stream active".
   - If `PlaybackStatus` is paused or no active PipeWire audio stream exists, verification returns `verified: false`.
   - Verified active audio stream required for `verified_successful`.
3. **Application & File Resolution:**
   - FreeDesktop `.desktop` files are scanned across system roots (`/usr/share/applications`, Flatpak exports, user paths).
   - Non-existent files return honest failure (`success: false`, `error: "Could not locate file..."`) rather than fabricated success.

---

## 3. Evidence References

- Acceptance Test: `tests/p0_target_device_runtime_validation.test.ts` (6/6 passing)
- Desktop Provider Suite: `tests/desktop_environment_provider.test.ts` (16/16 passing)
- Hardware Boundary Suite: `tests/security_and_target_device.milestone7.test.ts` (17/17 passing)
