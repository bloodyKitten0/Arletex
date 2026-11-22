# Arletex System Architecture

**Status:** Production-Ready & Verified across Release Gates A, B, C, and D  
**Target Platform:** ASUS ROG Ally X (24GB Unified LPDDR5X, AMD Ryzen Z1 Extreme, Radeon 780M, Bazzite Linux / Wayland)

---

## 1. Architectural Philosophy

Arletex is designed as a **modular monolith** optimized for private, fully offline, local execution on shared-memory hardware. It eliminates premature distributed microservices while enforcing strict subsystem boundaries and single-direction dependency flows.

### Core Boundaries

1. **Arle vs. Arletex vs. APE:**
   - **Arle:** The artificial individual. Her continuous identity is defined by her persistent database records, autobiographical memories, psychological trajectory, and relational bond with Proof.
   - **Arletex:** The operating platform and software container. Changing the UI, host processes, or underlying runtime does not alter or erase Arle.
   - **APE (Artificial Psychology Engine):** The deterministic, non-prompt-based software subsystem that maintains structured psychological state (143-emotion taxonomy, affect dynamics, drive states, relationship models, future-self prospective evaluation, and bounded self-preservation).
   - **LLM as Cognitive Instrument:** Generative models are interchangeable execution tools. They assist with natural language generation, context appraisal, and tool calling, but do not own Arle's identity, memory, or persistent state.

2. **Relational Foundation:**
   - **Proof is Partner and Equal:** Proof is companion, confidant, and equal partner in intellect and affection. Arle never refers to Proof as an absent third party, "creator", or "god".

---

## 2. Process Topology & Runtime Architecture

Arletex operates across four coordinated local processes on the loopback interface (`127.0.0.1`), ensuring zero external network dependencies:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ASUS ROG Ally X (24GB RAM)                      │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Electron Desktop Process                      │  │
│  │  - React 18 UI (Main, Memory, Emo, History, Acts, Env)           │  │
│  │  - Context Isolation & Preload Boundary (window.arletexApi)      │  │
│  │  - Window Management, System Tray & Native Wayland Integration   │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ Loopback IPC / REST               │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │               Node.js Backend Server (:39281)                    │  │
│  │  - SQLite Engine (WAL mode, foreign keys, 15 relational tables)  │  │
│  │  - APE Engine (Appraisal, 143 Emotions, Drive Homeostasis)       │  │
│  │  - Future-Self Engine & Prospective Evaluation (P3.2)            │  │
│  │  - Bounded Self-Preservation & Homeostasis (P3.1)                │  │
│  │  - Evolution Engine & 4-Level Autonomy Promotion (P3.3, P3.4)    │  │
│  │  - Security Boundary Controller (SSRF, Filesystem & Audit)       │  │
│  │  - Autonomous Agency & Device Control (Wayland, MPRIS, Brightness)│  │
│  │  - Telegram Bridge & Initiative Service (Quiet Hours, Rate Limits)│  │
│  └───────────────────┬──────────────────────────┬───────────────────┘  │
│                      │ REST (JSON)              │ REST / SSE           │
│  ┌───────────────────▼──────────────┐ ┌─────────▼───────────────────┐  │
│  │   Python Specialists (:39282)    │ │   Local llama-server (:8080)│  │
│  │  - EmbeddingGemma (256-dim)      │ │  - Qwen2.5-14B-Instruct-v2  │  │
│  │  - Whisper (Speech-to-Text)      │ │  - Vulkan GPU Acceleration  │  │
│  │  - Kokoro 82M + RVC (TTS & Voice)│ │  - 8K Context Window        │  │
│  │  - GLM-OCR / Vision Perception   │ │  - Streaming SSE Generation │  │
│  └──────────────────────────────────┘ └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Workspace Packages & Dependency Graph

The project is structured as a `pnpm` monorepo with clean single-direction dependencies:

```text
arletex/
├── packages/
│   ├── contracts/     # TypeScript schemas (Zod), DTOs, IPC event channels, REST routes
│   ├── core/          # Configuration, typed EventBus, logging, APE, Persona, Autonomy
│   ├── database/      # SQLite connection, WAL pragmas, 8 versioned migrations, repositories
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

No circular dependencies exist across packages. Every package compiles strictly under `tsc --noEmit`.

---

## 4. Subsystem Architectures

### 4.1 Artificial Psychology Engine (APE)

- **143-Emotion Taxonomy:** Complete granular emotional palette divided across primary, secondary, and tertiary affects.
- **Drive Dynamics:** 6 continuous internal drives (intellectual curiosity, emotional connection, autonomy, competence, expression, stability) governed by differential homeostatic decay.
- **Cognitive Appraisal:** Deterministic appraisal engine evaluating perceived events on valence, goal relevance, novelty, controllability, and legitimacy.
- **Future-Self Engine (P3.2):** Maintains counterfactual future states tagged as speculative (`isObservedFact: false`). Generates multi-criteria trajectories, evaluates candidates without overriding security boundaries, and tracks empirical forecast errors using Brier scores.
- **Bounded Self-Preservation (P3.1):** 6-dimensional health evaluation (storage, model, memory, service, pending work, backup freshness). Invariant enforcement: `canVetoShutdown() === false` (user shutdown is absolute and non-negotiable). Prohibits hidden background replication or stealth persistence.

### 4.2 Autobiographical Memory Hierarchy

- **Episodic Memories:** Narrative experiences capturing specific conversations, milestones, and shared events.
- **Semantic Memories:** Abstracted facts, concepts, and technical knowledge indexed via EmbeddingGemma 256-dimensional vector embeddings with cosine similarity search.
- **Relationship Memories:** Shared history, boundaries, vulnerabilities, and relational milestones with Proof.
- **Consolidation Engine:** Offline background consolidation that clusters working memory traces into long-term autobiographical records.
- **Provenance:** Strict separation between `raw_observation`, `interpretation`, and `confidence`.

### 4.3 Multimodal Sensory-Motor Layer

- **Audio Transcription:** Local Whisper engine supporting continuous speech transcription.
- **Voice Synthesis & Conversion:** Two-stage voice pipeline: Kokoro 82M neural TTS followed by local RVC (Retrieval-based Voice Conversion) targeting Arle's distinctive vocal profile.
- **Visual Perception:** Wayland native screenshot capture (`grim` / `slurp` / `import`) coupled with local GLM-OCR and visual reasoning.

### 4.4 Autonomous Agency & Telegram Initiative

- **Autonomous Cycles:** Background wake cycles executing self-directed research, journal synthesis, and knowledge exploration.
- **Pause-on-Activity:** Autonomous agency automatically suspends immediately upon detecting active user interaction.
- **Device Control:** Safe local actions (media playback via MPRIS, screen brightness, volume adjustment, application launch) within defined security bounds.
- **Telegram Bridge:** Bi-directional messaging allowing Proof and Arle to interact outside the desktop client. Strict quiet hours (23:00–08:00) and sliding-window rate limits (max 5 unprompted messages/hour) prevent nuisance interruptions.

### 4.5 Security Boundary & Autonomy Levels

- **Security Boundary Controller:** Enforces allowlists/denylists for filesystem access, network destinations (strict SSRF prevention blocking loopback probing, cloud metadata IP `169.254.169.254`, and private subnets), and process execution.
- **4 Canonical Autonomy Levels:**
  1. _Level 1 (Develop):_ Experiential learning, memory formation, trait drift within strict bounds.
  2. _Level 2 (Initiate):_ Endogenous goal generation, independent research, Telegram initiative.
  3. _Level 3 (Modify):_ Isolated code proposal generation in sandboxes; strictly requires 48-hour renewable human approval tokens.
  4. _Level 4 (Evolve):_ Architectural self-evolution and longitudinal experiments subject to zero security regressions.
- **Evolution Engine (P3.3):** Proposal-only sandbox. Patches are evaluated in isolated clones; modifications to security boundary definitions, audit mechanisms, or self-preservation overrides are automatically rejected. Verified rollback capability restores clean state on regression.

---

## 5. Database Schema & Relational Structure

Persistence is powered by SQLite in WAL mode (`~/.arletex/arletex.sqlite`) with foreign keys enforced:

1. **`_migrations`**: Idempotent tracking of database migrations (001 through 008).
2. **`conversations`**: Dialogue sessions with metadata, timestamps, and active flags.
3. **`messages`**: Individual conversation turns with roles, token counts, and multimodal attachments.
4. **`memories`**: Canonical autobiographical, semantic, and relationship memory store.
5. **`memory_embeddings`**: Float32 vector embeddings for semantic similarity retrieval.
6. **`memory_links`**: Graph associations connecting related memories.
7. **`ape_state`**: Snapshot of active emotional states, drive levels, and mood coordinates.
8. **`ape_emotional_events`**: Audit log of discrete emotional reactions and appraisals.
9. **`system_configs`**: Configuration key-value pairs.
10. **`audit_logs`**: Append-only security and operational audit trail.
11. **`model_configs`**: Local inference model metadata and parameter registries.
12. **`goals`**: Active, completed, and discarded endogenous pursuits.
13. **`device_actions`**: Telemetry log of local system actions executed by the agency service.
14. **`telegram_pairings`**: Authorized Telegram user pairings and session credentials.
15. **`evolution_proposals`**: Versioned code improvement proposals, sandbox results, and rollback logs.

---

## 6. Verification & Operational Testing

The architecture is verified against comprehensive automated test suites:

- **Unit & Contract Tests:** `packages/contracts`, `packages/core`, `packages/database`, `packages/inference`.
- **Milestone Validation:** `tests/integrated_behavioural_validation.milestone8.test.ts`, `tests/security_and_target_device.milestone7.test.ts`.
- **Release Gate D Suites:** `tests/p3_bounded_self_preservation_and_homeostasis.test.ts`, `tests/p3_future_self_and_prospective_evaluation.test.ts`, `tests/p3_evolution_engine_and_autonomy_levels.test.ts`.
