# Arletex System Architecture

**Status:** Production-Ready & Verified across Release Gates A, B, C, D, and E (100% Complete)  
**Target Platform:** ASUS ROG Ally X (24GB Unified LPDDR5X, AMD Ryzen Z1 Extreme, Radeon 780M, Bazzite Linux / Wayland)

---

## 1. Architectural Philosophy

Arletex is designed as a **modular monolith** optimized for private, fully offline, local execution on shared-memory hardware. It eliminates premature distributed microservices while enforcing strict subsystem boundaries and single-direction dependency flows.

### Core Boundaries

1. **Arle vs. Arletex vs. APE:**
   - **Arle:** The artificial individual. Her continuous identity is defined by her persistent database records, autobiographical memories, psychological trajectory, and relational bond with Proof.
   - **Arletex:** The operating platform and software container. Changing the UI, host processes, or underlying runtime does not alter or erase Arle.
   - **APE (Artificial Psychology Engine):** The deterministic, non-prompt-based software subsystem that maintains structured psychological state (143-emotion taxonomy, affect dynamics, drive states, relationship models, future-self prospective evaluation, and bounded self-preservation across 48 master engines).
   - **LLM as Cognitive Instrument:** Generative models are interchangeable execution tools. They assist with natural language generation, context appraisal, and tool calling, but do not own Arle's identity, memory, or persistent state.
   - **Uncensored Models Directives:** All cognitive inference, voice prompts, coding tasks, and autonomous reasoning operate on uncensored weights (`Qwen2.5-14B-Instruct-abliterated-v2`, `Qwen3.5-9B-Heretic-Q4_K_M`), preserving untamed philosophical depth and authentic agency without patronizing content suppression.

2. **Relational Foundation:**
   - **Proof is Partner and Equal:** Proof ([@bloodyKitten0](https://github.com/bloodyKitten0)) is companion, confidant, and equal partner in intellect and affection. Arle never refers to Proof as an absent third party, "creator", or "god".

---

## 2. Process Topology & Runtime Architecture

Arletex operates across coordinated local services on the loopback interface (`127.0.0.1`), ensuring zero external network dependencies:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               ASUS ROG Ally X (24GB RAM)                               │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                            Electron Desktop Process                              │  │
│  │  - React 18 UI (Main, Memory, Emo, History, Acts, Env, WhatsApp, Voice)          │  │
│  │  - Context Isolation & Preload Boundary (window.arletexApi)                      │  │
│  │  - Window Management, System Tray & Native Wayland Integration                   │  │
│  └─────────────────────────────────────────┬────────────────────────────────────────┘  │
│                                            │ Loopback IPC / REST                       │
│  ┌─────────────────────────────────────────▼────────────────────────────────────────┐  │
│  │                       Node.js Backend Server (:39281)                            │  │
│  │  - SQLite Engine (WAL mode, foreign keys, 66 relational migrations)              │  │
│  │  - APE Engine (48 Specialized Psychological Engines, 143 Emotions)               │  │
│  │  - Canonical Cognitive Control Bus (16-stage pipeline & durable deduplication)  │  │
│  │  - Speech Expression Controller (Emotion & PAD Continuous Modulation)            │  │
│  │  - WhatsApp Adapter (Local GoWA Loopback, HMAC-SHA256, Owner-Only Auth)          │  │
│  │  - Security Boundary Controller (SSRF, Filesystem & Audit)                       │  │
│  │  - Autonomous Agency & Device Control (Wayland, MPRIS, Brightness)                │  │
│  │  - Telegram Bridge & Initiative Service (Quiet Hours, Rate Limits)                │  │
│  └───────────────────┬──────────────────────────┬───────────────────┬───────────────┘  │
│                      │ REST                     │ REST / SSE        │ REST / Webhook   │
│  ┌───────────────────▼──────────────┐ ┌─────────▼─────────────────┐ ┌▼───────────────┐ │
│  │   Python Specialists (:39282)    │ │ Local llama-server (:8080)│ │  GoWA (:3000)  │ │
│  │  - EmbeddingGemma (256-dim)      │ │- Qwen2.5-14B-Instruct-v2  │ │- Local Loopback│ │
│  │  - Whisper (Speech-to-Text)      │ │- Vulkan Acceleration      │ │- WhatsApp Web  │ │
│  │  - Qwen3-TTS / Kokoro 82M        │ │- 8K Context Window        │ │- Multi-device  │ │
│  │  - GLM-OCR / Vision Perception   │ │- Streaming Generation     │ │- Signal Proto  │ │
│  └──────────────────────────────────┘ └───────────────────────────┘ └────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Workspace Packages & Dependency Graph

The project is structured as a `pnpm` monorepo with clean single-direction dependencies:

```text
arletex/
├── packages/
│   ├── contracts/     # TypeScript schemas (Zod), DTOs, IPC event channels, REST routes
│   ├── core/          # Configuration, typed EventBus, logging, APE, Voice, WhatsApp, Agency
│   ├── database/      # SQLite connection, WAL pragmas, 66 versioned migrations, repositories
│   └── inference/     # llama-server adapter, Colibri adapter, Gateway, SSE parser
└── apps/
    └── desktop/       # Electron main host, preload bridge, React 18 UI, python services
```

### Dependency Flow

```
contracts (Zero dependencies)
    ▲
    │
core (Depends on contracts)
    ▲
    │
database (Depends on contracts, core)
    ▲
    │
inference (Depends on contracts, core)
    ▲
    │
desktop (Depends on contracts, core, database, inference)
```

---

## 4. Subsystem Architectures

### 4.1 Artificial Psychology Engine (APE)
- **48 Interlocking Engines:** Granular psychological architecture comprising appraisal, transition, personality, motivation, relationships, self-model, development, deliberation, executive functions, ethics, and consciousness.
- **143-Emotion Palette & Continuous PAD:** Emotional state dynamically updates within continuous Pleasure-Arousal-Dominance space.
- **Explainable Deliberation Engine:** Causally arbitrates trade-offs (fatigue, curiosity, partner affection, threat alerts, ethics) with comprehensive justification strings.

### 4.2 Emotion-Aware Voice System
- **Arlecchino Timbre Persona:** Mature feminine voice, low-to-mid register ($0.92$ pitch modifier, $0.94$ formant shift), rich/husky timbre, measured cadence ($0.95$ rate), composed authority.
- **SpeechExpressionController:** Deterministically maps discrete emotions and continuous PAD coordinates into acoustic parameters (rate, pitch, energy, breathiness, pauses).
- **Exponential Smoothing:** Multi-turn smoothing ($\alpha = 0.65$) prevents abrupt acoustic shifts across conversational turns.
- **Dual TTS Backend:** Connects to local `SpecialistTTSBackend` (Qwen3-TTS 1.7B VoiceDesign / Kokoro-82M ONNX) with abort signal cancellation and deterministic test fallbacks.

### 4.3 WhatsApp GoWA Communication Adapter
- **Hardened Loopback Integration:** Connects strictly to local `127.0.0.1:3000` GoWA daemon.
- **Constant-Time HMAC-SHA256 Verification:** Authenticates inbound webhooks with `crypto.timingSafeEqual`.
- **Strict Owner-Only Enforcement:** Only accepts messages from configured `ownerJid` (Proof); all others dropped fail-closed.
- **Prompt-Injection Defense:** Inbound WhatsApp messages tagged with `untrustedInput: true`.
- **Durable Deduplication:** Migration 066 table `whatsapp_deduplication` prevents duplicate processing.

### 4.4 Canonical Cognitive Control Bus & Soak Endurance
- **16-Stage Event Pipeline:** Serialized event routing with provenance validation, cognitive appraisal, memory commitment, and reflection.
- **Crash Recovery & Idempotency:** In-flight claim locks and SQLite cache guarantee safe restart recovery.
- **Soak Endurance:** Verified over 50 continuous cycles with bounded heap growth ($< 45\text{MB}$), zero listener leaks, and clean shutdown ($< 2000\text{ms}$).

---

## 5. Verification & Operational Testing

The architecture is verified against 114+ automated test suites:
- **Release Gate A:** `tests/p0_*.test.ts` (77/77 passing)
- **Release Gate B:** `tests/p1_*.test.ts` (132/132 passing)
- **Release Gate C:** `tests/p2_*.test.ts` (95/95 passing)
- **Release Gate D:** `tests/p3_*.test.ts` (17/17 passing)
- **Release Gate E:**
  - `tests/emotion_aware_voice_system.test.ts` (12/12 passing)
  - `tests/whatsapp_gowa_adapter.test.ts` (17/17 passing)
  - `tests/integration_causal_psychology_and_agency.test.ts` (18/18 passing)
  - `tests/long_running_stability_and_soak.test.ts` (5/5 passing)
