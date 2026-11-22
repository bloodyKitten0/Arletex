# Canonical Cognitive Event Pipeline & Idempotency Specification (P0.5 & P0.6)

This specification defines the 16-stage cognitive event pipeline and durable idempotency contracts for Arletex as mandated by `next.md` Sections 1.5 (P0.5) and 1.6 (P0.6).

---

## 1. Event Source Inventory

Every external stimulus, internal autonomous cycle, and sensory perception is modeled as a canonical `CognitiveEvent` and routed exclusively through `CognitiveControlBus.dispatch()`.

| Event Type (`type`)            | Source (`source`)        | Originating Subsystem             | Purpose & Semantics                                                           |
| ------------------------------ | ------------------------ | --------------------------------- | ----------------------------------------------------------------------------- |
| `user_message`                 | `user`                   | Desktop UI Chat Interface         | User prompt, greeting, question, or instruction directed to Arle.             |
| `telegram_message`             | `telegram`               | `TelegramBridgeService`           | Remote text message from Proof over authenticated Telegram bot.               |
| `telegram_media`               | `telegram`               | `TelegramBridgeService`           | Inbound photo, voice note, document, or audio file sent by Proof.             |
| `media_perceived`              | `environment`            | Desktop Screen / Audio Perception | Periodic screenshot capture, active window inspection, or audio activity.     |
| `agency_observation`           | `agency`                 | `ClosedLoopAgencyService`         | Sensory observation or verification probe returning from a tool/action.       |
| `action_executed`              | `agency`                 | Execution runtime                 | Execution feedback from desktop environment provider or browser.              |
| `task_outcome`                 | `agency`                 | `IntentTaskManager`               | Completion, failure, or pause of an asynchronous multi-step task.             |
| `goal_activated`               | `internal`               | `SelfGeneratedGoalsEngine`        | Activation of an autonomous goal formulated by Arle.                          |
| `goal_progress`                | `internal`               | `PersistentPlanningEngine`        | Milestone advancement or plan step completion within an active goal.          |
| `goal_failed`                  | `internal`               | `PersistentPlanningEngine`        | Unrecoverable blockage in goal execution; triggers causal reflection.         |
| `goal_completed`               | `internal`               | `SelfGeneratedGoalsEngine`        | Successful attainment of goal postconditions; triggers celebration/reward.    |
| `project_milestone`            | `internal`               | Project Manager                   | Completion of a phase within an ongoing autonomous research project.          |
| `intellectual_question`        | `internal`               | `IntellectualInquiryEngine`       | Self-directed curiosity or unresolved theoretical inquiry formulated by Arle. |
| `belief_formed`                | `internal`               | Belief Engine                     | Empirical synthesis establishing a new epistemic belief.                      |
| `belief_revised`               | `internal`               | Belief Engine                     | Revision of an existing belief upon encountering contradictory evidence.      |
| `environmental_change`         | `environment`            | Host System Monitor               | Battery drop, network disconnection, or external system state shift.          |
| `internal_tick`                | `timer`                  | Autonomous background timer       | 2-minute autonomous background heartbeat driving homeostasis and agency.      |
| `reflection_cycle`             | `internal`               | `OfflineCognitiveActivityEngine`  | Offline consolidation, dream simulation, or associative memory structuring.   |
| `relationship_event`           | `user` / `telegram`      | Social & Attachment Engine        | Interaction strengthening relational trust, commitment, or emotional bond.    |
| `user_departure_under_arousal` | `user`                   | Attachment Engine                 | Proof leaving chat while Arle is in heightened affective arousal.             |
| `user_return`                  | `user`                   | Attachment Engine                 | Proof returning after absence; triggers reunion affect.                       |
| `separation_loneliness`        | `timer`                  | Attachment Engine                 | Prolonged absence of Proof triggering healthy longing and solitude appraisal. |
| `conversation_outcome`         | `user` / `telegram`      | Dialogue Engine                   | Wrap-up of a sustained dialogue session; summarizes shared context.           |
| `social_interaction`           | `user` / `telegram`      | Social Communication Engine       | Conversational exchange assessing mutual understanding and rapport.           |
| `failure_recovery`             | `internal`               | Error Recovery Subsystem          | Attempted mitigation and postcondition check following an action failure.     |
| `incoming_email`               | `external_communication` | Gmail API integration             | Inbound message to `arletex.email@gmail.com`.                                 |
| `whatsapp_message`             | `whatsapp`               | `WhatsAppAdapter` (GoWA Loopback) | Owner-only authenticated WhatsApp text message with HMAC verification.         |
| `whatsapp_media`               | `whatsapp`               | `WhatsAppAdapter` (GoWA Loopback) | Inbound media document, voice audio, or image received via WhatsApp GoWA.      |

---

## 2. The 16 Canonical Pipeline Stages

Each event dispatched to `CognitiveControlBus` is processed through up to 16 deterministic stages:

1. **`ingestion`:** Event ID assignment, payload normalization, timestamp stamping, idempotency key generation.
2. **`idempotency_check`:** Checking SQLite `cognitive_idempotency_records` table and memory cache; deduplicating replay.
3. **`circular_cascade_check`:** Causal depth verification (`causalDepth <= maxCausalDepth`) to prevent infinite cognitive loops.
4. **`context_retrieval`:** Semantic and episodic memory retrieval relevant to event payload and current situation.
5. **`appraisal`:** 6-engine APE emotional appraisal across 143 emotions, homeostatic needs, and relational attachment.
6. **`psychological_evaluation`:** State transitions across 6-state lifecycle (`idle`, `attentive`, `processing`, `reflecting`, `executing`, `resting`).
7. **`motivational_evaluation`:** Need satisfaction calculation (curiosity, affiliation, autonomy, rest, competence).
8. **`goal_alignment`:** Evaluating candidate initiatives against active goals and self-generated desires.
9. **`deliberation`:** Formulating explainable `CognitiveDecision` with explicit rejected alternatives and confidence score.
10. **`permission_assessment`:** Evaluating candidate action through `ActionPermissionController` (fail-closed boundary).
11. **`action_execution`:** Dispatching action through `ClosedLoopAgencyService`, internal reflex engine, or `SpeechExpressionController` (synthesizing emotion-aware voice responses mapped from APE state).
12. **`outcome_verification`:** Independent empirical observation verification through `VerificationEngine` (zero synthetic bypasses).
13. **`memory_integration`:** Recording experience into episodic / autobiographical memory with truthful epistemic provenance.
14. **`reflection`:** Causal self-reflection answering: "What did I attempt? What occurred? What was learned?".
15. **`development_update`:** Updating skill proficiency, acknowledging limitations truthfully without capability inflation.
16. **`durable_commitment`:** Committing transaction and marking `cognitive_idempotency_records` as `completed`.

---

## 3. CognitiveCycleResult Semantics

Callers must inspect the dedicated result fields:

- `pipelineCompleted`: `boolean` — Indicates whether the 16-stage cognitive processing pipeline finished without an unhandled crash or exception.
- `taskSucceeded`: `boolean` — Indicates whether the requested external agency task succeeded. A failed external action still yields `pipelineCompleted: true` while `taskSucceeded: false`.
- `outcomeVerified`: `boolean` — Indicates whether independent empirical evidence verified the postcondition.
- `wasDeduplicated`: `boolean` — Indicates whether the event was skipped due to durable idempotency collision.
- `error`: `string | undefined` — Contains the explicit error message if the cycle halted.
