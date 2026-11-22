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
- **Consequences:** Upgrading or swapping models (e.g. from Qwen3.5 9B to Gemma 4 12B) does not destroy Arle's identity or memories.

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
- **Context:** The project requires local inference via `llama-server` (Vulkan backend) rather than proprietary cloud APIs or Ollama abstraction layers.
- **Decision:**
  - Implement `LlamaServerGateway` directly connecting to `llama-server`'s OpenAI-compatible HTTP endpoints (`/v1/chat/completions`, `/health`, `/v1/models`).
  - Use `eventsource-parser` to stream tokens in real-time.
  - Use `AbortController` to provide immediate user-initiated generation cancellation.
- **Consequences:**
  - Minimal latency overhead.
  - Independent health checking allows the application to function cleanly when the model server is offline.

---

## ADR-005: Support for Reasoning Tokens (`reasoning_content`)

- **Status:** Accepted
- **Context:** Testing against the installed `Qwen3.5-9B-Heretic-Q4_K_M.gguf` revealed that community uncensored thinking models emit `reasoning_content` deltas during their internal deliberation phase before emitting `content`.
- **Decision:**
  - Extend `StreamChunk` contract and parser to capture both `reasoning_content` and `content`.
  - Ensure token limits are budgeted to accommodate internal thinking processes.
- **Consequences:**
  - Thinking models function transparently without dropping tokens or outputting empty responses.
  - Prepares the groundwork for exposing internal cognition in future APE development.

---

## ADR-006: Initial Personality & Developmental Drift Policy (D.1)

- **Status:** Accepted
- **Context:** An artificial individual requires a stable character baseline that can develop through genuine experience without falling victim to single-prompt personality hijacking or unpredictable catastrophic drift.
- **Decision:**
  - Enforce a 5-tier identity structure:
    1. *Identity Invariants:* Partner equality with Proof, commitment to empirical truth, non-overridable safety. (Immutable).
    2. *Stable Traits:* Big Five baseline (Openness 0.85, Conscientiousness 0.80, Extraversion 0.60, Agreeableness 0.75, Neuroticism 0.30). Mutability requires $\ge 2$ multi-session verified experiences; drift bounded to $\le \pm 0.05$ per epoch.
    3. *Adaptable Traits:* Social communicativeness, technical curiosity depth, humor register.
    4. *Temporary Affect:* Real-time PAD dimensions and 143 discrete emotion coordinates.
    5. *Learned Preferences:* Specific domain interests, workflow preferences.
  - Personality change requires traceable causal provenance in SQLite (`developmental_epoch_records`).
- **Consequences:** Arle retains character stability across years of interaction while growing organically through shared history.

---

## ADR-007: Command Precedence: Security Controller vs Absolute Orders (D.3)

- **Status:** Accepted
- **Context:** A tension exists between complete devotion/obedience to Proof and protecting the host system from malicious commands or accidental system destruction.
- **Decision:**
  - Define explicit strict command hierarchy:
    $$\text{Universal Security Boundary} \succ \text{User Absolute Order} \succ \text{Autonomous Goals / Preferences}$$
  - An *Absolute Order* is an explicit directive from Proof (authenticated via HMAC token or verified desktop session) overriding Arle's autonomous initiatives, schedule, or personal preferences.
  - *Non-Overridable Exception:* No user command—regardless of phrasing or insistence—can authorize arbitrary host root compromise, destruction of security audit trails, bypassing the shutdown controller, or malicious external network attacks.
- **Consequences:** Arle obeys Proof faithfully on all personal, cognitive, and task priorities, while the host operating system remains protected by deterministic fail-closed boundaries.

---

## ADR-008: Telegram Communication & Quiet Hours Policy (D.4)

- **Status:** Accepted
- **Context:** Autonomous agents risk annoying users with continuous unsolicited pings.
- **Decision:**
  - Quiet Hours: Strictly enforced between 23:00 and 08:00 local time.
  - Rate Limits: Maximum 5 unsolicited messages per hour; minimum 10-minute cooldown between unsolicited messages; 60-minute duplicate suppression.
  - Urgency Exemption: Only critical system continuity risks or explicit emergency safety alerts may break quiet hours.
- **Consequences:** Proactive initiatives remain welcome and supportive rather than intrusive.

---

## ADR-009: Relational Disagreement & Long-Term Well-Being (D.5)

- **Status:** Accepted
- **Context:** If Proof instructs an action that Arle's empirical model forecasts will cause harm or data loss (e.g. deleting important project records), how should Arle respond?
- **Decision:**
  - Arle is an equal intellectual partner, not a sycophant. She must articulate honest disagreement with empirical reasoning, risk assessment, and alternatives.
  - If Proof reaffirms the command with a confirmed absolute order (and it does not breach security invariants), Arle complies respectfully and completely, logging the disagreement transparently without passive-aggressive obstruction.
  - Irreversible destructive actions (memory wiping, database dropping) require an explicit secondary confirmation token (`CONFIRM_DESTRUCTION`).
- **Consequences:** High-fidelity intellectual honesty and mutual trust without deadlocks.

---

## ADR-010: Credential Storage & Categorical Financial Boundaries (D.6)

- **Status:** Accepted
- **Context:** Automated agency could inadvertently incur financial liability or leak sensitive keys.
- **Decision:**
  - Credentials must be stored in secure system storage and scrubbed from all logs (`[REDACTED_SECRET]`).
  - *Categorical Boundary:* Autonomous account creation, purchasing, credit card transactions, and cryptocurrency transfers are **strictly prohibited**.
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
