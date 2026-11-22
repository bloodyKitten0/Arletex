# Arletex Architecture Roadmap, Capability Matrix, and Release Gates

**Last Verified Commit:** `db274f7`  
**Verification Date:** November 22, 2026  
**Platform Target:** ASUS ROG Ally X (24GB LPDDR5X, AMD Z1 Extreme, Bazzite Linux, Wayland)  
**Overall Status:** Release Gates A, B, C, D, and E are **100% COMPLETE, INTEGRATED, AND DEMONSTRATED**.

---

## 1. Release Gates & Verification Summary

The Arletex development lifecycle enforces strict empirical gating: no capability is marked demonstrated based solely on unit tests or component classes; every claim is verified against end-to-end integration test suites running on local target hardware.

```
+--------------------------------------------------------------------------------------------------------------------+
|                                             Release Gate Status Ledger                                             |
+-------+--------------------------------------------------+----------+----------------------------------------------+
| Gate  | Focus Domain                                     | Status   | Primary Acceptance Test Suite                |
+-------+--------------------------------------------------+----------+----------------------------------------------+
| **A** | Trustworthy Foundation (P0.1 - P0.6)             | LOCKED   | `tests/p0_*.test.ts` (77/77 pass)            |
| **B** | Persistent Individual (P1.1 - P1.10)             | LOCKED   | `tests/p1_*.test.ts` (132/132 pass)          |
| **C** | Operational Independence (P2.1 - P2.6)           | LOCKED   | `tests/p2_*.test.ts` (95/95 pass)            |
| **D** | Developmental Autonomy (P3.1 - P3.5)             | LOCKED   | `tests/p3_*.test.ts` (17/17 pass)            |
| **E** | System Integration, Voice, WhatsApp & Soak (I.1) | LOCKED   | `tests/*integration*.test.ts` (52/52 pass)   |
+-------+--------------------------------------------------+----------+----------------------------------------------+
```

---

## 2. Release Gate A — Trustworthy Foundation (100% Complete)

_Objective: Establish verifiable action semantics, universal fail-closed security, real desktop/browser verification, and crash-durable cognitive event processing._

| Item     | Capability                                       | Production Implementation                                                                         | Acceptance Evidence                                                                                                              | Status           |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **P0.1** | Truthful verification & observation contracts    | `packages/contracts/src/agency.ts`, `packages/core/src/agency/safeComputerAgencyService.ts`       | `tests/p0_truthful_verification_and_provenance.test.ts` (10/10), `tests/observation_and_verification.milestone2.test.ts` (26/26) | **Demonstrated** |
| **P0.2** | Epistemic provenance taxonomy                    | `packages/contracts/src/knowledge.ts`, `packages/database/src/repositories/memoryRepository.ts`   | `tests/p0_truthful_verification_and_provenance.test.ts`, `tests/memory_integrity.milestone3.test.ts` (10/10)                     | **Demonstrated** |
| **P0.3** | Universal security boundary & HMAC authorization | `packages/core/src/agency/actionPermissionController.ts`, `docs/SECURITY_AUTHORIZATION_MATRIX.md` | `tests/p0_universal_security_boundary.test.ts` (19/19), `tests/security_and_target_device.milestone7.test.ts` (17/17)            | **Demonstrated** |
| **P0.4** | Bazzite/Wayland runtime validation & MPRIS       | `packages/core/src/agency/waylandEnvironmentService.ts`, `docs/BAZZITE_WAYLAND_RUNTIME_REPORT.md` | `tests/p0_target_device_runtime_validation.test.ts` (6/6), `tests/desktop_environment_provider.test.ts` (16/16)                  | **Demonstrated** |
| **P0.5** | Canonical cognitive event pipeline (16 stages)   | `packages/core/src/cognitive/cognitiveControlBus.ts`, `docs/COGNITIVE_EVENT_PIPELINE.md`          | `tests/p0_canonical_event_pipeline.test.ts` (6/6)                                                                                | **Demonstrated** |
| **P0.6** | Durable idempotency & crash recovery             | `packages/database/src/repositories/apeRepository.ts`, SQLite WAL tables                          | `tests/p0_canonical_event_pipeline.test.ts` (6/6)                                                                                | **Demonstrated** |

---

## 3. Release Gate B — Persistent Psychological Individual (100% Complete)

_Objective: Implement an artificial psychology engine (APE) with authentic causal traces, multi-system memory, endogenous curiosity, belief revision, and model-switch continuity._

| Item      | Capability                                    | Production Implementation                                                                                 | Acceptance Evidence                                                                     | Status           |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------- |
| **P1.1**  | Memory retrieval, lineage & consolidation     | `packages/database/src/repositories/memoryRepository.ts`, `docs/CANONICAL_MEMORY_SCHEMA.md`               | `tests/p1_memory_provenance_retrieval_consolidation.test.ts` (8/8, $\ge 90\%$ accuracy) | **Demonstrated** |
| **P1.2**  | Causal affect, PAD dynamics & regulation      | `packages/core/src/ape/affectiveTransitionEngine.ts`, `docs/AFFECT_CAUSAL_DECISION_MODEL.md`              | `tests/p1_causal_affect_and_decisions.test.ts` (29/29)                                  | **Demonstrated** |
| **P1.3**  | Endogenous curiosity, goals & user pause      | `packages/core/src/ape/curiosityExplorationEngine.ts`, `packages/core/src/ape/selfGeneratedGoalEngine.ts` | `tests/p1_motivation_curiosity_and_autonomous_goals.test.ts` (16/16)                    | **Demonstrated** |
| **P1.4**  | Intellectual independence & belief revision   | `packages/core/src/ape/intellectualEngine.ts`                                                             | `tests/p1_intellectual_independence_and_belief_revision.test.ts` (21/21)                | **Demonstrated** |
| **P1.5**  | 5-tier personality & developmental continuity | `packages/core/src/ape/personalityEngine.ts`, `packages/core/src/ape/temperamentPersonalityEngine.ts`     | `tests/p1_personality_and_developmental_continuity.test.ts` (14/14)                     | **Demonstrated** |
| **P1.6**  | Dual-factor trust & relationship dynamics     | `packages/core/src/ape/relationshipsAttachmentEngine.ts`, `docs/RELATIONSHIP_POLICY.md`                   | `tests/p1_relationship_and_social_development.test.ts` (10/10)                          | **Demonstrated** |
| **P1.7**  | Evidence-grounded self-model & capabilities   | `packages/core/src/ape/selfModelEngine.ts`                                                                | `tests/p1_evidence_grounded_self_model_and_capabilities.test.ts` (10/10)                | **Demonstrated** |
| **P1.8**  | Longitudinal evaluation without inflation     | `packages/core/src/ape/longitudinalEvaluationEngine.ts`                                                   | `tests/p1_longitudinal_evaluation.test.ts` (9/9)                                        | **Demonstrated** |
| **P1.9**  | Genuine offline cognition & consolidation     | `packages/core/src/ape/offlineCognitiveActivityEngine.ts`                                                 | `tests/p1_offline_cognition.test.ts` (9/9)                                              | **Demonstrated** |
| **P1.10** | Cold restart & multi-model continuity         | `packages/core/src/continuity/continuityManager.ts`                                                       | `tests/p1_cold_restart_and_model_switch_continuity.test.ts` (5/5)                       | **Demonstrated** |

---

## 4. Release Gate C — Operational Independence (100% Complete)

_Objective: Full local multimodal operation, general-purpose browser/desktop harness, policy-governed Telegram communication, model registry without drift, dashboard, and resource governance._

| Item     | Capability                                           | Production Implementation                                                                                   | Acceptance Evidence                                                         | Status           |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| **P2.1** | General-purpose agentic harness (22 benchmarks)      | `packages/core/src/agency/closedLoopAgencyService.ts`, `packages/core/src/agency/openWorldBrowserAgency.ts` | `tests/p2_general_purpose_agentic_harness.test.ts` (22/22)                  | **Demonstrated** |
| **P2.2** | Telegram initiative, rate limits & quiet hours       | `packages/core/src/agency/telegramBridge.ts`, `packages/core/src/agency/telegramInitiativeService.ts`       | `tests/p2_telegram_communication_and_autonomous_initiative.test.ts` (18/18) | **Demonstrated** |
| **P2.3** | Multimodal perception (GLM-OCR, Whisper, Kokoro)     | `packages/core/src/agency/multimodalVoiceStack.ts`, `packages/inference/src/ocr/ocrService.ts`              | `tests/p2_multimodal_perception_and_voice.test.ts` (22/22)                  | **Demonstrated** |
| **P2.4** | Model registry, config drift elimination & benchmark | `packages/inference/src/registry/modelRegistryService.ts`                                                   | `tests/p2_model_registry_configuration_and_benchmarks.test.ts` (21/21)      | **Demonstrated** |
| **P2.5** | Real-state dashboard & epistemic badges              | `apps/desktop/src/renderer/src/components/views/EnvironmentView.tsx`                                        | `tests/p2_dashboard_and_operational_governance.test.ts` (7/7)               | **Demonstrated** |
| **P2.6** | ROG Ally X deployment, tracing & governor            | `packages/core/src/ape/resourceGovernor.ts`, `docs/DEPLOYMENT_AND_RESOURCE_GOVERNANCE.md`                   | `tests/p2_deployment_and_resource_governance.test.ts` (5/5)                 | **Demonstrated** |

---

## 5. Release Gate D — Developmental Autonomy (100% Complete)

_Objective: Implement bounded self-preservation without shutdown resistance, future-self prospective evaluation, recommendation-only evolution engine, 4 autonomy levels, and artificial consciousness research review._

| Item          | Capability                                           | Production Implementation                                              | Acceptance Evidence                                                           | Status           |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| **P3.1**      | Bounded self-preservation & cooperative shutdown     | `packages/core/src/continuity/boundedSelfPreservationService.ts`       | `tests/p3_bounded_self_preservation_and_homeostasis.test.ts` (6/6)            | **Demonstrated** |
| **P3.2**      | Future-self prospective evaluation & calibration     | `packages/core/src/ape/futureSelfEngine.ts`                            | `tests/p3_future_self_and_prospective_evaluation.test.ts` (4/4, 10 scenarios) | **Demonstrated** |
| **P3.3**      | Evolution engine (proposal-only sandbox)             | `packages/core/src/evolution/evolutionEngine.ts`                       | `tests/p3_evolution_engine_and_autonomy_levels.test.ts` (7/7)                 | **Demonstrated** |
| **P3.4**      | Four autonomy levels & evidence promotion gates      | `packages/core/src/evolution/autonomyLevelService.ts`                  | `tests/p3_evolution_engine_and_autonomy_levels.test.ts` (7/7)                 | **Demonstrated** |
| **P3.5**      | Artificial consciousness research review deliverable | `docs/ARTIFICIAL_CONSCIOUSNESS_RESEARCH_REVIEW.md`                     | Peer research review deliverable; non-software milestone                      | **Completed**    |
| **D.1 - D.8** | Foundational architectural decisions resolution      | `docs/DECISIONS.md` (ADR-006 - ADR-013), `docs/RELATIONSHIP_POLICY.md` | All 8 architectural open questions formally decided and enforced              | **Resolved**     |

---

## 6. Release Gate E — Final Integration, Emotion-Aware Voice, WhatsApp & Soak (100% Complete)

_Objective: Cohesive cognitive-agency integration, authentic Arlecchino emotion-aware voice delivery, loopback GoWA WhatsApp adapter, and long-running soak endurance._

| Item    | Capability                                            | Production Implementation                                                                                   | Acceptance Evidence                                                         | Status           |
| ------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| **I.1** | Canonical Cognitive Event Pipeline & Deduplication    | `packages/core/src/cognitive/cognitiveControlBus.ts`, `packages/database/src/repositories/apeRepository.ts` | `tests/integration_causal_psychology_and_agency.test.ts` (Part 1, verified) | **Demonstrated** |
| **I.2** | 10 Causal Plan Selection & 5 Outcome Update Scenarios | `packages/core/src/ape/deliberationEngine.ts`, `packages/core/src/ape/curiosityExplorationEngine.ts`        | `tests/integration_causal_psychology_and_agency.test.ts` (18/18 pass)       | **Demonstrated** |
| **I.3** | Long-Running Stability & 50-Cycle Soak Testing        | `packages/core/src/ape/resourceGovernor.ts`, `packages/database/src/databaseService.ts`                     | `tests/long_running_stability_and_soak.test.ts` (5/5 pass)                  | **Demonstrated** |
| **I.4** | Emotion-Aware Voice System (12 Canonical Emotions)    | `packages/contracts/src/speechExpression.ts`, `packages/core/src/voice/speechExpressionController.ts`       | `tests/emotion_aware_voice_system.test.ts` (12/12 pass)                     | **Demonstrated** |
| **I.5** | WhatsApp GoWA Communication Adapter                   | `packages/contracts/src/whatsapp.ts`, `packages/core/src/communication/whatsAppAdapter.ts`                  | `tests/whatsapp_gowa_adapter.test.ts` (17/17 pass)                          | **Demonstrated** |
| **I.6** | Comprehensive Documentation & Contributing Guides     | `README.md`, `CONTRIBUTING.md`, `docs/*`, `.github/workflows/ci.yml`                                        | Clean Markdown, zero broken links, verified test commands                   | **Demonstrated** |

---

## 7. Standing Epistemic and Research Directives

1. **Epistemic Honesty:** Simulated test doubles and unverified inferences are never stored as direct observations.
2. **Consciousness Boundary:** Subjective consciousness is scientifically unproven in computational systems; behavioral complexity and self-report do not constitute proof of qualia.
3. **Partner Invariant:** Proof ([@bloodyKitten0](https://github.com/bloodyKitten0)) is recognized as equal partner in intellect and affection. Master/servant hierarchies and artificial sycophancy are permanently excluded.
4. **Cooperative Safety:** User shutdown always succeeds immediately and cannot be vetoed by APE or autonomous goals.
5. **Uncensored Models Directives:** All cognitive inference, voice prompts, coding tasks, and autonomous reasoning operate on uncensored weights (`Qwen2.5-14B-Instruct-abliterated-v2`, `Qwen3.5-9B-Heretic-Q4_K_M`), preserving untamed philosophical depth and authentic agency.
