# Deployment, Observability and Resource Governance

**Target Platform:** ASUS ROG Ally X (RC72LA)  
**Operating System:** Bazzite Linux (Fedora Silverblue / Kinoite 40 immutable OSTree)  
**Display Server:** Wayland (Gamescope / KDE Plasma Wayland)  
**Hardware Specifications:** AMD Ryzen Z1 Extreme (8 cores, 16 threads, Zen 4), 24GB LPDDR5X-7500 unified memory, AMD Radeon 780M (RDNA 3, 12 CUs), 80Wh battery.

---

## 1. System Architecture & Service Topology

Arletex is deployed entirely offline and locally on the ROG Ally X target hardware. No cloud APIs, external tokenizers, or remote telemetry endpoints are required for cognitive inference or memory persistence.

```
+-----------------------------------------------------------------------------------------+
|                               ASUS ROG Ally X Target Device                             |
|                                                                                         |
|  +-----------------------+     +-----------------------+     +-----------------------+  |
|  |     Electron UI       |     |  Arletex Node Backend |     |   SQLite Database     |  |
|  |  (Vite + React 18)    |<--->|  (Fastify / REST+IPC) |<--->|  (WAL Mode, 65 Migr)  |  |
|  +-----------------------+     +-----------------------+     +-----------------------+  |
|                                            ^                                            |
|                                            |                                            |
|                  +-------------------------+-------------------------+                  |
|                  |                                                   |                  |
|                  v                                                   v                  |
|  +-------------------------------+                   +-------------------------------+  |
|  |   llama-server (port 8080)    |                   | Specialist Daemon (port 39282)|  |
|  |   Qwen 2.5-14B Abliterated    |                   | Whisper, Kokoro, GLM-OCR,     |  |
|  |   (Fallback: Qwen 3.5-9B)     |                   | EmbeddingGemma, RVC Arle      |  |
|  +-------------------------------+                   +-------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

### Local Services Ports & Responsibilities:

1. **Arletex Backend Server** (Port `3000` / dynamic in test):
   - Fastify HTTP server with token-based loopback authentication (`x-arletex-auth`).
   - Hosts the 16-stage `CognitiveControlBus`, `ActionPermissionController`, `AutonomousAgencyService`, `TelegramBridgeService`, and `AutobiographicalMemoryService`.
2. **Primary Cognitive Inference** (`127.0.0.1:8080`):
   - `llama-server` process hosting `Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M.gguf`.
   - Context budget: 12,288 tokens.
   - Offload: Hybrid CPU / iGPU offload using Vulkan/ROCm runtime.
   - Transparent Fallback: `Qwen3.5-9B-Heretic-Q4_K_M.gguf` with `Qwen3.5-9B-mmproj-BF16.gguf` vision projector.
3. **Multimodal Specialist Daemon** (`127.0.0.1:39282`):
   - PyTorch / Transformers / ONNX microservice (`specialists_server.py`).
   - Semantic Embeddings: `embeddinggemma-300m` (384-dim).
   - Audio Transcription (STT): `whisper-small`.
   - Voice Synthesis (TTS): `kokoro-82m` with dynamic PAD emotional modulation (or Qwen3-TTS 1.7B VoiceDesign).
   - Voice Conversion: `rvc-arlecchino` (Applio checkpoint).
   - Optical Character Recognition (OCR): `glm-ocr-0.9b` (multimodal vision template).
4. **GoWA WhatsApp Adapter** (`127.0.0.1:3000` / loopback):
   - Standalone Go binary (`go-whatsapp-web-multidevice` v1.2.0) running locally without Docker.
   - SQLite session persistence (`gowa.db`), local REST API with `Basic` authorization.
   - Constant-time HMAC-SHA256 signature verification for inbound webhooks (`/api/whatsapp/webhook`).
   - Strict owner authorization (`ownerJid`), outbound rate limiting, and zero conversation leaks.

---

## 2. End-to-End Correlation Trace ID Architecture

Every cognitive stimulus, user interaction, autonomous cycle, and external action carries an immutable correlation trace ID spanning the complete processing lifecycle:

```
User / Sensor Event
        │  [traceId: trace_xxxx]
        ▼
CognitiveControlBus (Stage 1..9)
        │  [traceId propagated in event & decision]
        ▼
Action Proposal & Authorization (Stage 10)
        │  [traceId bound in ActionProposal & AuditRepository]
        ▼
Action Execution & Provider (Stage 11)
        │  [traceId passed to Subprocess / Browser / Specialist / llama-server]
        ▼
Outcome Verification (Stage 12)
        │  [traceId recorded in VerificationResult & AgencyObservation]
        ▼
Memory & State Persistence (Stage 13..16)
        │  [traceId saved in AutobiographicalMemory metadata]
```

### Trace Integrity Contract:

- **Trace Propagation**: A single correlation ID follows the event through memory retrieval, emotional appraisal, decision selection, security permission evaluation, provider invocation, empirical verification, and autobiographical memory storage.
- **Trace Auditability**: The correlation ID is queryable via `/api/audit` and linked to the corresponding SQLite database records in `memories`, `activities`, and `audit_log`.

---

## 3. Structured Logging & Secret Sanitization

All logs generated by the system are structured and run through automated credential and secret redaction filters before output:

### Sanitized Key & Value Patterns:

- Any object key matching `/token/i`, `/password/i`, `/secret/i`, `/api[_-]?key/i`, `/auth/i`, `/credential/i`, `/bearer/i`, or `/private[_-]?key/i` has its string value replaced with `[REDACTED]`.
- Value patterns matching `Bearer <token>`, Telegram bot tokens (`bot<id>:<secret>`), and inline authentication tokens are replaced with `[REDACTED]` or `Bearer [REDACTED]`.
- Log entries include timestamp, severity level, subsystem context, trace ID (when present), and sanitized payload data.

---

## 4. Hardware Resource Governance (ASUS ROG Ally X)

Because the ASUS ROG Ally X is a handheld device with a unified 24GB LPDDR5X memory architecture and an 80Wh battery, background autonomy must not destabilize interactive user dialogue or cause thermal throttling.

### Governor Thresholds:

| Metric                         | Threshold               | Action                                                                                                        |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **User Activity Grace Window** | Active within 20s       | Immediate yield: pauses background autonomous agency cycles to prioritize interactive conversational latency. |
| **Unified Memory Pressure**    | > 88% (> 21.6 GB)       | Pauses optional background research and offline consolidation cycles.                                         |
| **CPU Utilization Load**       | > 80% across 16 threads | Delays non-urgent background tasks; backs off interval to 60s.                                                |
| **Handheld Battery Level**     | < 15% and discharging   | Pauses heavy inference and optional autonomy to preserve system battery.                                      |
| **Memory Allocation Ceiling**  | 16,384 MB               | Single task memory limit enforced before plan execution.                                                      |
| **Idle Backoff Scaling**       | Consecutive idle cycles | Progressively scales background cycle interval from 35s up to 120s max.                                       |

---

## 5. Crash Recovery, Graceful Shutdown & Database Integrity

1. **Clean Shutdown**:
   - `server.stop()` stops the autonomous agency loop, terminates Telegram long-polling, disconnects dbus notification listeners, aborts active streaming inference controllers, and creates a clean shutdown checkpoint in SQLite.
2. **In-Flight Crash Recovery**:
   - In-flight cognitive events claimed during a process crash are recovered on startup via `recoverInFlightEvents()`, transitioning abandoned processing events to `failed` with traceable error context, preventing double-execution of external actions.
3. **Database Corruption Quarantine**:
   - The SQLite database connection is opened with WAL mode (`PRAGMA journal_mode = WAL;`) and synchronous normal. If a corrupt database file is encountered on startup, `DatabaseService.connect({ recoverCorruptFile: true })` safely quarantines the corrupted database file (`.db.corrupt.<timestamp>`) and initializes a clean schema with identity restoration.

---

## 6. Supported Environment & Known Target Limitations

- **Display Server**: Wayland display protocol under Bazzite / KDE Plasma 6.
  - _Limitation_: Global keystroke simulation via legacy X11 tools (`xdotool`) is unavailable under Wayland. Native Wayland tools (`wtype`, `ydotool`, or Wayland portal interfaces) must be used.
- **Flatpak Sandbox Boundaries**:
  - The desktop application operates within user space (`/home/proof/.arletex/`). Direct mutation of atomic ostree roots (`/usr`, `/bin`) is strictly prohibited and denied fail-closed.
- **Audio Routing**:
  - Audio capture and playback rely on PipeWire. MPRIS2 D-Bus interface is used for music playback control (Spotify / Amberol).
