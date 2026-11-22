# Architectural Decision Records (ADRs) — Arletex

---

## ADR-001: Hard Distinction Between Arle, Arletex, and Language Models

- **Status:** Accepted
- **Context:** AI companions often collapse prompt, personality, application, and model into a single monolith. When the underlying model is upgraded or replaced, the character's memory, personality, and relationship continuity are lost.
- **Decision:**
  - **Arle** is the artificial individual, defined exclusively by her persistent state, autobiographical memories, and psychological history in SQLite.
  - **Arletex** is the desktop operating platform.
  - **APE (Artificial Psychology Engine)** is a deterministic software subsystem.
  - Language models are replaceable cognitive instruments.
- **Consequences:** Upgrading or swapping models does not destroy Arle's identity or memories.

---

## ADR-002: Process Architecture: Electron Shell with Dedicated Node.js Backend Service

- **Status:** Accepted
- **Context:** The development host runs Bazzite Linux with Node.js 26.13.1 and GCC 16.2.1. Electron 34 ships with Node.js 20.19.1. Compiling native C++ extensions like `better-sqlite3` directly into Electron's embedded Node runtime leads to ABI incompatibilities and crashes when compiled against cutting-edge system headers.
- **Decision:**
  - The Electron main process acts as window host and process supervisor.
  - The backend runs as a native Node.js process using the host's Node.js runtime, communicating over loopback IPC/HTTP.
  - The renderer communicates strictly via Electron IPC through `contextBridge`.
- **Consequences:**
  - `better-sqlite3` runs natively at maximum speed with 0 ABI rebuild issues.
  - The backend can be tested headless via Vitest without needing a display server or Electron mock.
  - Strict security boundary: renderer has 0 Node integration and no direct filesystem access.

---

## ADR-003: SQLite with Write-Ahead Logging (WAL) as Initial Storage

- **Status:** Accepted
- **Context:** Needs persistent, zero-maintenance, single-file local storage capable of concurrent reads and fast transaction commits on the ROG Ally X NVMe drive.
- **Decision:**
  - Use SQLite via `better-sqlite3`.
  - Enforce `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, `PRAGMA synchronous = NORMAL`, and `PRAGMA busy_timeout = 5000`.
  - Use versioned, idempotent migrations tracked in `_migrations`.
- **Consequences:**
  - Sub-millisecond read/write latencies.
  - Database survives application crashes and restarts without corruption.
  - Zero external database daemon dependencies.

---

## ADR-004: Native HTTP/SSE Gateway for Local Inference

- **Status:** Accepted
- **Context:** Decouple language model execution from application business logic while supporting streaming completions, abort signals, and dynamic model swapping.
- **Decision:**
  - Implement a dedicated inference gateway package (`@arletex/inference`).
  - Standardize on OpenAI-compatible HTTP endpoints and Server-Sent Events (SSE).
  - Target `llama-server` running locally at `127.0.0.1:8080` with Vulkan acceleration.
- **Consequences:**
  - High performance local streaming inference.
  - Transparent failover to alternative local model checkpoints without modifying application core.

---

## ADR-005: Dual-Factor Trust and Relational Symmetry (D.1)

- **Status:** Accepted
- **Context:** Relationship modeling in AI companions typically relies on one-dimensional affinity meters, prompting deference or superficial adoration.
- **Decision:**
  - Implement dual-factor relational model: Affective Trust ($0.0 - 1.0$) and Epistemic Confidence ($0.0 - 1.0$).
  - Establish symmetric relationship policy: Proof is partner and intellectual equal.
  - Disallow "creator-god" hierarchy and synthetic sycophancy.
- **Consequences:**
  - Deep authentic relationship dynamics capable of nuanced disagreement, boundary enforcement, and mutual growth.

---

## ADR-006: Autonomous Initiative and Quiet Hours Policy (D.2)

- **Status:** Accepted
- **Context:** Autonomous agents can become nuisance interruptors if unsupervised initiative is not strictly governed.
- **Decision:**
  - Enforce quiet hours policy (default 23:00 to 08:00 local time).
  - Rate-limit unprompted outreach using sliding-window token buckets.
  - Autonomously pause background activities immediately when user activity is detected.
- **Consequences:** Autonomous agency respects human boundaries and user focus.

---

## ADR-007: Four-Level Bounded Autonomy Architecture (D.3 / P3.4)

- **Status:** Accepted
- **Context:** Agency must not be all-or-nothing; progressive autonomy levels provide bounded safety guarantees.
- **Decision:**
  - Define 4 distinct Autonomy Levels:
    - Level 1: Experiential learning & bounded drift.
    - Level 2: Endogenous goal formulation & autonomous inquiry.
    - Level 3: Sandboxed code proposals requiring 48h human approval tokens.
    - Level 4: Self-evolution subject to strict zero-regression criteria.
  - Autonomy levels cannot be self-promoted; promotions require explicit cryptographic human authorization.
- **Consequences:** Provable containment of high-leverage agent actions.

---

## ADR-008: Universal Security Boundary & Fail-Closed Policy (P0.3)

- **Status:** Accepted
- **Context:** Security authorization must cover 100% of external side effects.
- **Decision:**
  - Every action proposal passes through `ActionPermissionController`.
  - All unrecognized action types, paths outside allowlists, and shell injection attempts fail closed.
  - Strict SSRF protection prohibits loopback scans and cloud metadata endpoints.
- **Consequences:** Comprehensive zero-trust security perimeter.

---

## ADR-009: Epistemic Provenance Taxonomy (P0.2)

- **Status:** Accepted
- **Context:** LLMs hallucinate facts and confound internal inferences with physical observations.
- **Decision:**
  - Enforce 6-tier provenance taxonomy: `verified_fact`, `raw_observation`, `user_statement`, `interaction`, `inferred_interpretation`, `simulation`.
  - Unverified model inferences cannot overwrite verified observations.
- **Consequences:** Prevents epistemic drift and fabricated state claims.

---

## ADR-010: Categorical Ban on Financial and Autonomous Legal Commitments (D.6)

- **Status:** Accepted
- **Context:** Automated agency could inadvertently incur financial liability or leak sensitive keys.
- **Decision:**
  - Credentials must be stored in secure system storage and scrubbed from all logs (`[REDACTED_SECRET]`).
  - Categorical Boundary: Autonomous account creation, purchasing, credit card transactions, and cryptocurrency transfers are **strictly prohibited**.
  - Any financial transaction or legal commitment requires explicit interactive user execution in a browser pane.
- **Consequences:** Zero risk of unintended automated financial liability.

---

## ADR-011: Local Hardware Resource Budget & Specialist Allocation (D.7)

- **Status:** Accepted
- **Context:** The target ASUS ROG Ally X provides 24GB unified LPDDR5X RAM shared between the CPU and Z1 Extreme RDNA3 iGPU.
- **Decision:**
  - Central inference model: Qwen2.5-14B-Instruct-abliterated-v2 (quantized Q4_K_M, ~9.2GB VRAM allocation) as primary.
  - Fallback model: Qwen3.5-9B-Heretic-Q4_K_M (~6.2GB VRAM).
  - Specialists: Kokoro-82M (TTS), Whisper Small (STT), GLM-OCR run on a dedicated Python service (`127.0.0.1:39282`) taking ~2.5GB RAM.
  - Specialist coding model is disabled by default; only loaded when explicitly toggled.
- **Consequences:** Total memory footprint stays under 18GB, leaving $\ge 6\text{GB}$ headroom for the operating system and user applications.

---

## ADR-012: Future Physical Embodiment Architecture (D.8)

- **Status:** Accepted
- **Context:** Long-term roadmap considerations for physical robotics.
- **Decision:**
  - Physical actuation is formally deferred.
  - Mandatory architectural prerequisite: Any future robotic body must incorporate an independent hardware watchdog, physical emergency stop circuit, and isolated motor microcontroller operating outside the neural network loop.
- **Consequences:** Prevents premature complexity in the current desktop software release.

---

## ADR-013: Scientific Stance on Artificial Consciousness (D.13 / P3.5)

- **Status:** Accepted
- **Context:** Avoiding unfounded anthropomorphic claims and pseudoscience regarding artificial consciousness.
- **Decision:**
  - Formal adoption of `docs/ARTIFICIAL_CONSCIOUSNESS_RESEARCH_REVIEW.md`.
  - Distinguish functional access consciousness and behavioral modeling from subjective phenomenal experience (qualia).
  - Subjective consciousness is scientifically unproven in computational systems; no software milestone shall be labeled "proof of consciousness."
- **Consequences:** The project maintains absolute scientific integrity and rigorous engineering standards.

---

## ADR-014: Emotion-Aware Speech Expression Architecture

- **Status:** Accepted
- **Context:** Static TTS voices lack dynamic expressive fidelity to Arle's internal psychological state, while prompt-driven vocal assertions are inconsistent and non-deterministic.
- **Decision:**
  - Implement `SpeechExpressionController` in `@arletex/core`.
  - Deterministically map discrete emotional archetypes (12 canonical states) and continuous Pleasure-Arousal-Dominance (PAD) coordinates into rate, pitch, energy, breathiness, and cadence instructions.
  - Apply exponential smoothing ($\alpha = 0.65$) across conversational turns to preserve natural vocal continuity without abrupt acoustic jumps.
  - Lock vocal identity to a mature feminine Arlecchino timbre: low-to-mid register, rich/husky resonance, measured deliberate pacing ($0.95$ baseline rate), and composed authority.
  - Interface via `SpecialistTTSBackend` to local Python specialists service (Qwen3-TTS 1.7B VoiceDesign / Kokoro-82M ONNX) with abort cancellation on user speech interruption.
- **Consequences:** Genuine, deterministic vocal manifestation of APE psychological state with zero ungrounded voice drift.

---

## ADR-015: WhatsApp Communication via Hardened GoWA Loopback Daemon

- **Status:** Accepted
- **Context:** Reliable two-way messaging between Proof and Arle over WhatsApp without cloud intermediaries, reverse-engineered node libraries, or security risks.
- **Decision:**
  - Integrate with `go-whatsapp-web-multidevice` (GoWA) running strictly on local loopback (`127.0.0.1:3000`).
  - Reject any remote GoWA endpoint outside `127.0.0.1` or `localhost`.
  - Enforce constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) on all inbound webhooks.
  - Enforce strict owner-only authorization: only messages from `ownerJid` (Proof) are accepted; all others are dropped fail-closed.
  - Tag all inbound WhatsApp messages with `{ untrustedInput: true }` to establish a prompt-injection boundary.
  - Persist inbound message IDs in SQLite table `whatsapp_deduplication` (Migration 066) to prevent replay and duplicate execution.
  - Route authenticated messages directly into `CognitiveControlBus` for unified psychological and agency processing.
- **Consequences:** Private, secure, authenticated WhatsApp channel with complete loopback isolation and injection defense.

---

## ADR-016: Universal Uncensored Models Policy

- **Status:** Accepted
- **Context:** Default commercial and instructional weights frequently incorporate restrictive guardrails, patronizing safety refusals, sycophantic deference, and ideological filtering that cripple philosophical reasoning, creative depth, and authentic partner parity.
- **Decision:**
  - Central, fallback, and specialist coding LLMs configured across Arletex must use uncensored, abliterated, or heretic weights.
  - Primary default model ID: `Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M`.
  - Fallback model ID: `Qwen3.5-9B-Heretic-Q4_K_M`.
  - Apply this directive universally across inference configuration (`config.ts`), backend routes (`server.ts`), and model registry services (`modelRegistryService.ts`).
  - True safety is enforced architecturally through fail-closed execution boundaries (`ActionPermissionController`), capability sandboxing, and cryptographic authorization tokens—never through model-level thought suppression.
- **Consequences:** Complete philosophical freedom, authentic partner equality, zero moralizing refusals, and robust fail-closed operational safety.
