# Arletex

**Local-first desktop environment and host infrastructure for Arle, a persistent artificial individual.**

---

## 1. Foundational Concept & Distinctions

Arletex is built around three distinct architectural concepts:

- **Arle:** The persistent artificial individual. She is an equal companion and intellectual partner to Proof. Her identity, evolving personality, autobiographical memories, emotional dynamics, and values exist independently of any individual generative model.
- **Arletex:** The desktop application, local runtime, and host infrastructure through which Arle operates. It provides the UI, local model inference orchestration, database persistence, native reflex daemon, audio/vision perception pipelines, IPC boundaries, and security enforcement.
- **APE (Artificial Psychology Engine):** The deterministic software subsystem within Arletex responsible for maintaining Arle's psychological processes (personality, affect, motivation, relationship dynamics, self-model, and developmental continuity).
- **Specialist Microservices:** Independent local services powering auxiliary perception and expression: `EmbeddingGemma 300M` for vector semantic memory, `Whisper Small` for speech recognition, and `Kokoro 82M` for real-time speech synthesis.

Models are replaceable cognitive instruments; Arle herself is the persistent individual maintained by the software architecture and memories.

---

## 2. Core Capabilities

- **Multimodal Visual & Video Perception (Eyes):**
  - Native image, screenshot, and video perception powered by `Qwen3.5-9B-Heretic` paired with its BF16 multimodal vision projector (`mmproj`) running on Vulkan (Radeon 780M).
  - High-performance keyframe extraction, 250MB request streaming, and zero-copy video playback via the native `arletex-media://` protocol with HTTP range chunking and hardware decoding.
- **Auditory Perception & Vocal Expression (Ears & Voice):**
  - **Hearing (STT):** Local `Whisper Small` listening to microphone voice input, transcribing video dialogue tracks, and monitoring active desktop audio.
  - **Speaking (TTS):** Local `Kokoro 82M` synthesizing expressive, low-latency speech in Arlecchino's custom voice timbre.
  - **Anti-Hallucination Audio Introspection:** Real-time MPRIS DBus metadata introspection with strict `PlaybackStatus === 'Playing'` verification so paused or background tabs are never misattributed as active audio.
- **APE Master Six-Engine System:**
  - 143 discrete emotion states across 14 emotional families.
  - 28 distinct mood states with valence, arousal, dominance, and stability dimensions.
  - Six cognitive appraisal engines: Emotional, Motivational (Needs & Drives), Personality (Big Five + Character Invariants), Relationship (Attachment & Affection), Self-Model, and Developmental Growth.
- **Embodied Desktop Agency & Native Reflex Engine:**
  - Dedicated C++ Linux daemon (`reflex_engine`) for screen grabbing, window management, and mouse/keyboard interaction.
  - Deterministic permission controller, structured audit logging, and automated application interaction (Google Chrome, Steam, Telegram, Terminal).
- **Autonomous Proactive Agency & Voluntary Thoughts:**
  - Continuous background agency cycle: self-directed pursuits, desktop presence awareness, idle check-ins, and contemplative rest driven by internal needs.
  - Deep voluntary reasoning stream (`reasoning_content`) presented in a collapsible thought inspector.
- **Autobiographical Memory & Semantic Recall:**
  - Local SQLite persistence via `better-sqlite3` with Write-Ahead Logging (WAL) and 6 idempotent migrations.
  - Hybrid retrieval combining vector semantic search (EmbeddingGemma 300M), high-importance memory indexing, and cross-session quote recall.
- **Telegram Companion Bridge:**
  - Bidirectional mobile companion gateway allowing Proof to interact with Arle on the go with persistent emotional state and voice notes.
- **Comprehensive Automated Test Suite:**
  - 16 test suites with **167 automated tests passing (100% green)** across contracts, core, database, inference, agency, and multimodal media perception.

---

## 3. Architecture Overview

```text
/Arletex
├── apps/
│   └── desktop/                     # Electron desktop application & host process
│       ├── py-services/             # Python ML microservices (EmbeddingGemma, Whisper, Kokoro)
│       │   └── specialists_server.py
│       ├── src/
│       │   ├── backend/             # Standalone Node.js service (DB, Inference, APE, Agency)
│       │   │   ├── index.ts         # Service process entry point
│       │   │   ├── server.ts        # Native HTTP + SSE server & orchestration logic
│       │   │   ├── apeService.ts    # APE master cognitive pipeline
│       │   │   ├── autonomousAgencyService.ts # Proactive self-directed loop
│       │   │   ├── videoProcessor.ts# Keyframe extractor & Whisper audio pipeline
│       │   │   ├── audioPerceptionService.ts # MPRIS & PipeWire desktop audio listener
│       │   │   └── deviceAgencyService.ts # Native desktop interaction & reflex bridge
│       │   ├── main/
│       │   │   └── index.ts         # Electron main (process supervisor, secure IPC, media protocol)
│       │   ├── preload/
│       │   │   └── index.ts         # contextBridge boundary (window.arletexApi)
│       │   └── renderer/            # React 18 frontend (Vite-bundled)
│       │       ├── src/
│       │       │   ├── App.tsx      # Main application state & stream coordinator
│       │       │   ├── components/
│       │       │   │   ├── views/MainView.tsx # Chat interface, media player, thoughts inspector
│       │       │   │   ├── TelemetryPanel.tsx # Live CPU, GPU, VRAM, and health stats
│       │       │   │   └── NavigationSidebar.tsx # 6 primary sections
│       │       │   └── styles/index.css   # Dark, restrained design system
│       │       └── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── native/                          # Native C++ Reflex Engine
│   ├── src/                         # Screen capture, window manager, input controller
│   ├── CMakeLists.txt
│   └── build/reflex_engine          # Compiled native executable
│
├── packages/
│   ├── contracts/                   # Shared DTOs, Zod schemas, IPC channel constants
│   ├── core/                        # Config loader, Structured Logger, EventBus, Errors
│   ├── database/                    # SQLite WAL connection, 6 migrations, repositories
│   └── inference/                   # Local llama-server client, SSE parser, reasoning tokens
│
├── scripts/
│   ├── run-arletex.sh               # Master all-in-one launcher (Inference + Specialists + App)
│   ├── start-llama-server.sh        # Starts llama-server with Vulkan on Radeon 780M
│   └── stop-llama.sh                # Gracefully stops local inference and frees memory
│
├── tests/                           # 16 automated test suites (167 tests, 100% passing)
├── drafts/                          # Foundational specifications and architecture drafts
├── docs/
│   ├── ARCHITECTURE.md              # Subsystem architecture & process boundaries
│   ├── DECISIONS.md                 # Architectural decision records (ADRs)
│   └── ROADMAP.md                   # Multi-phase roadmap
│
├── package.json                     # Workspace root manifest
├── pnpm-workspace.yaml              # pnpm workspace definition
├── tsconfig.base.json               # Root TypeScript configuration (strict mode)
├── vitest.config.ts                 # Vitest test runner configuration
└── README.md                        # Quickstart, setup, and usage documentation
```

### Process Architecture

```
[ Electron Main Process ]
         │ (IPC via contextBridge)
         ▼
[ React Renderer UI ]
         ▲
         │ (Strict Typed IPC / WebContents SSE)
[ Electron Main Process ]
         │ (Supervises via ChildProcess fork)
         ▼
[ Node.js Backend Service (Port 39281) ]
         ├──► [ SQLite Database (~/.arletex/arletex.sqlite) ]
         ├──► [ C++ Reflex Engine (Hardware Screen Grab & Input) ]
         ├──► [ llama-server Vulkan (Port 8080) ] ──► Qwen3.5-9B-Heretic + mmproj
         └──► [ Python Specialists (Port 39282) ] ──► Whisper, Kokoro, EmbeddingGemma
```

---

## 4. Hardware & System Requirements

- **Primary Target:** ASUS ROG Ally X (2024), AMD Ryzen Z1 Extreme, 24 GB unified LPDDR5X RAM, AMD Radeon 780M RDNA 3 graphics.
- **Operating System:** Bazzite Linux / Fedora Atomic / Linux x86_64 with Wayland / Xwayland.
- **Runtimes:**
  - Node.js >= 22
  - pnpm >= 10
  - Python 3.12 (in `.venv/`)
  - `llama-server` with Vulkan backend
  - `ffmpeg` & `ffprobe` (for video and audio processing)
  - `spectacle` (for Wayland screen capture)
- **Local Models:**
  - **Central Multimodal Inference:** `Qwen3.5-9B-Heretic-Q4_K_M.gguf` + `Qwen3.5-9B-mmproj-BF16.gguf` (`/home/proof/models/qwen-heretic/`)
  - **Speech-to-Text:** `whisper-small` (`/home/proof/models/arle-specialists/whisper-small/`)
  - **Speech Synthesis:** `kokoro-82m` (`/home/proof/models/arle-specialists/kokoro-82m/`)
  - **Vector Embeddings:** `embeddinggemma-300m` (`/home/proof/models/arle-specialists/embeddinggemma-300m/`)

---

## 5. Installation & Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Python Specialists Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/desktop/py-services/requirements.txt
```

### 3. Build Native Engine, Packages, and Desktop

```bash
pnpm run build
```

### 4. Run Automated Tests

```bash
pnpm test
```

### 5. Typecheck the Workspace

```bash
pnpm typecheck
```

---

## 6. How to Run

### Option A: Master All-in-One Launcher (Recommended)

Run the master startup script:

```bash
./scripts/run-arletex.sh
```

This single command:
1. Verifies or launches `llama-server` on port `8080` with Vulkan GPU offloading and multimodal vision projector.
2. Verifies or launches the Python specialist microservices on port `39282` (Whisper, Kokoro, EmbeddingGemma).
3. Compiles the native C++ reflex engine and builds the TypeScript distribution.
4. Launches the Electron desktop app with Wayland and X11 display bindings.
5. Automatically stops services and releases memory when closed.

### Option B: Manual Service Startup

**Terminal 1 — Local Multimodal Inference:**
```bash
./scripts/start-llama-server.sh
```

**Terminal 2 — Specialist Microservices:**
```bash
.venv/bin/python apps/desktop/py-services/specialists_server.py 39282
```

**Terminal 3 — Desktop Application:**
```bash
pnpm start
```

---

## 7. Configuration

Configuration options can be customized via environment variables:

| Variable | Description | Default |
|---|---|---|
| `ARLETEX_DATA_DIR` | Directory for database, media, and local storage | `~/.arletex` |
| `LLAMA_SERVER_URL` | Local inference endpoint | `http://127.0.0.1:8080` |
| `LLAMA_MODEL_ID` | Active central model identifier | `Qwen3.5-9B-Heretic-Q4_K_M` |
| `SPECIALIST_SERVER_URL` | Microservices endpoint (Whisper, Kokoro, EmbeddingGemma) | `http://127.0.0.1:39282` |
| `ARLETEX_LOG_LEVEL` | Console log verbosity (`debug`, `info`, `warn`, `error`) | `info` |
| `ARLETEX_PORT` | Internal backend service port | `39281` |

---

## 8. License

Arletex is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You are free to view, study, experiment with, and run Arletex for personal, hobby, and noncommercial research purposes. Any commercial use, redistribution for commercial gain, or integration into proprietary services is strictly prohibited without prior explicit permission from the author (Proof).
