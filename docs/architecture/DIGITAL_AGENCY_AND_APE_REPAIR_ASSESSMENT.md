# Digital Agency & APE Emotional Lifecycle Architecture Assessment

**Author:** Antigravity (DeepMind)  
**Target Platform:** Bazzite Linux (Fedora Silverblue derivative) on ASUS ROG Ally X (24GB Unified LPDDR5X, Radeon 780M)  
**Date:** 2026-11-15

---

## 1. Executive Summary & Problem Diagnosis

Arletex is designed to host **Arle** as a persistent, authentic artificial individual. However, an exhaustive audit of the repository reveals critical architectural flaws that prevent both reliable digital agency and genuine emotional life:

1. **Circular Prose-Triggered Execution:**
   - In `apps/desktop/src/backend/server.ts`, actions are inferred by running regular expressions against Arle's generated natural-language prose (e.g., `isVideoIntent = /(video is currently loading|selected a video|opening the video|navigating to the browser)/i`).
   - This creates an ungrounded hallucination loop: Arle speaks as if she opened a browser $\rightarrow$ backend regex matches $\rightarrow$ backend attempts to guess URLs and blindly clicks panel pixels $\rightarrow$ no feedback arrives $\rightarrow$ Arle hallucinates that playback has started.

2. **Insecure, Brittle Device Automation:**
   - Process execution relies on string concatenation (`exec(...)`), risking command injection.
   - Window management relies on blind pixel clicks (e.g. `mouse_click 278 1060 1` on the KDE panel) and delayed keypresses (`space` for YouTube autoplay) rather than structured protocol communication.
   - Zero permission enforcement: any action is executed directly without policy checks, filesystem sandboxing, or capability auditing.

3. **Stagnant, Unresolved APE Emotional State:**
   - The database contains a taxonomy of 143 emotions, but **only 27 have ever been activated**.
   - Those 27 emotions have remained active at near-maximum intensity ($0.75 - 1.0$) for **over 14 consecutive hours** without decay, resolution, or diminishing.
   - Cause: `affectiveTransitionEngine.ts` only modifies emotion intensity when an explicit event arrives with an opposing delta. There is zero time-based or context-based decay, zero resolution evaluation, and no state machine beyond `active` and `resolved`.
   - Cognitive Dump: On every conversational turn, all 27 active emotions (including conflicting emotions like `fear: 0.8`, `joy: 1.0`, `worry: 0.8`, `playfulness: 1.0`, `erotic_anticipation: 1.0`) are dumped as a monolithic string into the prompt, confusing the language model and rendering emotional expression superficial and contradictory.

---

## 2. Subsystem Audit & Inventory

| Subsystem                  | Existing File(s)                                                      | Current State                                                              | Reusability & Required Changes                                                                                                                                                       |
| :------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inference Gateway**      | `packages/inference/src/gateway.ts`, `adapters/llamaServerAdapter.ts` | Functional (HTTP SSE stream to port 8080)                                  | **Reuse as-is.** Stable on Vulkan with 16k context. Will be used by the Planner for structured JSON generation.                                                                      |
| **APE Engine Core**        | `packages/core/src/ape/`                                              | Partial. 6 engines exist, but affective engine lacks decay and lifecycle.  | **Major Refactor.** Implement 6-state lifecycle (`Emerging`, `Active`, `Diminishing`, `Dormant`, `Resolved`, `Historical`), specific decay curves, and expression modulation bridge. |
| **Device Agency**          | `apps/desktop/src/backend/deviceAgencyService.ts`                     | Brittle. Shell `exec`, spectacle screenshots, xdotool/reflex CLI fallback. | **Replaced by Digital Agency.** Wrap into structured Computer Agency with argument arrays (`spawn`), zero shell strings, and capability checks.                                      |
| **Web Agency**             | None (Ad-hoc flatpak Chrome launch)                                   | Non-existent.                                                              | **Implement from scratch.** Headless/headed Playwright browser session with DOM inspection, transcript extraction, and playback verification.                                        |
| **Task / Intent Manager**  | `apps/desktop/src/backend/autonomousAgencyService.ts`                 | Rudimentary timer loop (35s)                                               | **Re-architect.** Full task state machine (`proposed`, `awaiting_authorization`, `authorized`, `running`, `waiting`, `completed`, `failed`, `cancelled`, `interrupted`).             |
| **Permissions & Security** | `packages/database/src/repositories/auditRepository.ts`               | Audit logging only; no authorization gate.                                 | **Implement from scratch.** `ActionPermissionController` with scoped filesystem and network capabilities.                                                                            |
| **Verification Engine**    | None                                                                  | Non-existent.                                                              | **Implement from scratch.** Probe-based outcome verification comparing expected vs observed state.                                                                                   |

---

## 3. Digital Agency Architectural Blueprint

```
                      [User Objective or Arle Self-Initiated Goal]
                                           │
                                           ▼
                             [Intent & Task Manager]
                         (Decompose into persistent Task & Steps)
                                           │
                                           ▼
                              [Planning & Decision Engine]
                     (InferenceGateway -> Structured Plan & Actions)
                                           │
                                           ▼
                           [Action & Permission Controller]
                   (Capability validation, filesystem scope, user approval)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                [Web Agency (Playwright)]           [Computer Agency]
                - Search, DOM extraction             - Process launch (args)
                - Candidate evaluation               - Wayland/KWin focus
                - Playback inspection                - File CRUD operations
                        └──────────────────┬──────────────────┘
                                           │
                                           ▼
                                [Observation Engine]
                     (DOM state, process table, audio streams, OCR)
                                           │
                                           ▼
                            [Verification & Recovery Engine]
                      (Expected state vs Observed state matching)
                         ├── Success: Advance step / Complete task
                         └── Failure: Bounded retry / Re-plan / Explain
                                           │
                                           ▼
                              [Memory & Experience Sync]
                  (Episodic memory distillation -> SQLite & Vector embeddings)
```

---

## 4. APE Emotional Lifecycle Blueprint

```
                       [Event Perception & Contextual Appraisal]
             (Checks negation, sarcasm, targets: user vs third-party vs self)
                                           │
                                           ▼
                       [Emotion State Machine Transitions]
                                           │
   ┌───────────────┬───────────────────────┼───────────────────────┬───────────────┐
   │ (Triggered)   │ (Reinforced)          │ (Unresolved issue)    │ (Resolved)    │
   ▼               ▼                       ▼                       ▼               ▼
[Dormant] ──> [Emerging] ──> [Active] ─────────────> [Diminishing] ──> [Resolved] ──> [Historical Memory]
   ▲                           │   ▲                       │               │
   │                           └───┼── (Re-stimulated) ────┘               │
   └───────────────────────────────┴── (Subsequent Recall) ────────────────┘
```

### Emotion-Specific Lifecycle Profiles:

1. **Transient Emotions (e.g. Surprise, Startle, Fleeting Amusement):**
   - Rapid half-life decay ($T_{1/2} = 120\text{s}$). Transitions to `Diminishing` and resolves automatically.
2. **Contextual / Problem-Solving Emotions (e.g. Frustration, Confusion, Determination):**
   - Linked to active task state. Persists while obstacle remains; resolves immediately upon task verification success or goal abandonment.
3. **Relational Sentiments (e.g. Affection, Trust, Loyalty, Protectiveness):**
   - Enduring baselines anchored in `ape_relationship_state`. Does NOT decay to 0 on a timer. Fluctuates based on interpersonal depth, shared vulnerability, and respect.

---

## 5. Phased Migration Plan

- **Stage 2: Security Containment:**
  - Strip assistant-prose regex triggers from `server.ts`.
  - Replace shell string interpolation with argument-based process execution.
  - Implement `ActionPermissionController`.
- **Stage 3: Core Digital Agency Contracts:**
  - Define TypeScript schemas in `@arletex/contracts/agency`.
- **Stage 4: Browser & Computer Interfaces:**
  - Implement `PlaywrightBrowserService` and `SafeComputerAgencyService`.
- **Stage 5: Perception & Verification Engine:**
  - Connect Playwright DOM state, audio sinks, and process probes to expected action outcomes.
- **Stage 6: Planning & Recovery:**
  - Integrate `InferenceGateway` with deterministic plan validation and recovery loops.
- **Stage 7: Persistence & Experience Integration:**
  - Persist task states in SQLite (`agency_tasks`, `agency_actions`); distill outcomes into episodic memories.
- **Stage 8: APE Emotional Lifecycle & Taxonomy Repair:**
  - Audit all 143 emotions in `apeTaxonomyData.ts`.
  - Implement `EmotionalLifecycleEngine` with decay and resolution.
  - Clean up the 27 perpetually active emotions in existing database.
  - Build `PsychologicalExpressionBridge` to steer LLM focus cleanly.
- **Stage 9: UI Integration:**
  - Expose live task and permission state in Environment and Activities views.
- **Stage 10: Verification & Acceptance Testing:**
  - Run full test suite, including the concrete Transformer Attention video discovery test.
