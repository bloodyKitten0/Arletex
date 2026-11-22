
# WHEN DOING COMMITS USE SHORT HUMANIZED NAMES NOT AI

# Arle / Arletex — Remaining Work, Implementation Plan, and Definition of Done

**Audit baseline:** `ec35b1e9ffe71c88f236d62b54287cfa913fe57d`  
**Baseline date:** 22 November 2026  
**Repository:** <https://github.com/bloodyKitten0/Arletex>  
**Scope:** `drafts/draft1.md`, `drafts/draft2.md`, `drafts/draft3.md`, the production composition root, and targeted APE, agency, security, memory, offline-cognition, continuity, and evaluation paths.

---

## 0. How to use this document

This is the implementation backlog for the requirements in the three current draft documents. It is not a list of every imaginable future feature, and it is not permission to add more engines indiscriminately.

The intention is to prevent the same issue from being rediscovered and reported as unfinished indefinitely. Every item below has:

1. A precise scope.
2. The relevant existing implementation.
3. A prescribed implementation approach.
4. An acceptance test or observable outcome.
5. A rule for deciding when it is finished.

### 0.1 Status vocabulary

Use these statuses consistently:

| Status | Meaning |
|---|---|
| **OPEN — code gap confirmed** | The current source contains a specific missing or incorrect behaviour. |
| **OPEN — integration not demonstrated** | Relevant code exists, but the production pathway or end-to-end behaviour has not been proven. |
| **OPEN — evidence required** | The implementation may be adequate; the missing item is a reproducible test, runtime trace, benchmark, or deployment result. |
| **OPEN — design decision** | The drafts leave a product, policy, or behavioural decision unresolved. Do not silently invent the answer in code. |
| **DEFERRED — conditional** | Not a prerequisite. Implement only if a stated benchmark or product decision justifies it. |
| **RESEARCH — no engineering completion claim** | A legitimate research topic, but it cannot be declared solved by adding a class or passing ordinary software tests. |
| **DONE** | All acceptance criteria are satisfied and the evidence is recorded in the completion ledger. |

An item marked **OPEN — evidence required** is not an accusation that the implementation is broken. It means the project cannot yet claim the capability as demonstrated.

### 0.2 The anti-regression / anti-repetition rule

When an item reaches **DONE**, record:

- Task ID.
- Completion commit SHA.
- Test command and test result.
- CI run or local test report.
- Runtime environment, when relevant.
- Evidence artifact or trace.
- Date verified.

A later audit must **not reopen a DONE item merely because the same concern appears in an older audit or because the reviewer cannot see the test result in the current conversation**. Reopen it only when:

1. A later commit changes the relevant code or contract;
2. A regression test fails;
3. New runtime evidence contradicts the accepted result; or
4. The original acceptance criteria were demonstrably inadequate.

If the implementation has changed but its new acceptance test has not been rerun, label it **REVALIDATION REQUIRED**, not “the feature was never completed.”

### 0.3 The completion rule

A task is not complete because:
- a class exists;
- a route returns HTTP 200;
- an activity record says `completed`;
- a test uses a fabricated PID or mocked browser;
- an LLM says it performed an action;
- a metric reports a high score;
- a roadmap says a milestone is implemented.

A task is complete when the behaviour is exercised through its real production path, its observable outcome is independently checked, failure cases are tested, and the evidence is retained.

---

# 1. Audit baseline and what is already present

## 1.1 Exact repository baseline

The latest commit located on `main` during this audit is:

- SHA: `ec35b1e9ffe71c88f236d62b54287cfa913fe57d`
- Commit: `fix(agency): pass ssrf validation for desktop browser actions and respect user active pause`
- Date: 22 November 2026, 09:05 UTC
- Link: <https://github.com/bloodyKitten0/Arletex/commit/ec35b1e9ffe71c88f236d62b54287cfa913fe57d>

This commit made several real changes:
- It added `desktop_open_browser` to the permission controller's URL target extraction and network-validation paths.
- It added the browser action to the URL validation branch.
- It changed the autonomous-agency user-activity pause threshold to 15 seconds.
- It added `drafts/draft3.md`, covering self-preservation, future-self modelling, intrinsic motivation, developmental individuality, artificial affect, cognitive self-development, consciousness research, and four levels of autonomy.

These changes must be retained and tested. They must not be described as absent in future reviews.

**CI limitation:** The GitHub connector returned no combined status checks and no workflow runs for this exact commit. This does not prove that local tests fail or that no test workflow exists; it means this audit cannot certify a passing CI result for this revision. Run the repository's actual test, typecheck, build, and platform checks before release.

## 1.2 Existing implementation that should be extended, not rebuilt

The following infrastructure is already present in the current source:

| Existing implementation | Current evidence | Correct interpretation |
|---|---|---|
| 16-stage `CognitiveControlBus` | Instantiated in `apps/desktop/src/backend/server.ts` and mounted on `ApeService` | Production composition exists; full event-path coverage still needs proof. |
| `ActionPermissionController` | Constructed in `server.ts`, connected to the ethical-boundaries engine | A central authorization component exists; every side-effect path still needs a boundary audit. |
| `ClosedLoopAgencyService` | Constructed in `server.ts` with browser, computer, desktop, Telegram, email and other providers | A real closed-loop agency implementation exists; each action class needs reliable outcome evidence. |
| `VerificationEngine` | Passed into `ClosedLoopAgencyService` and the cognitive bus | Verification infrastructure exists; individual providers must supply adequate evidence. |
| `AutobiographicalMemoryService` | Constructed and passed to the cognitive bus and agency | Persistent autobiographical-memory integration exists; provenance and recall quality still need validation. |
| `ContinuityManager` | Constructed and initialized during server startup | A continuity lifecycle exists; real cold-restart and model-switch tests remain necessary. |
| Telegram bridge | Configured and started in the backend; inbound messages and media are handled | Telegram integration exists; proactive outbound policy and end-to-end reliability require validation. |
| Semantic intent service | Embedding-based intent classification exists | A narrow intent classifier exists; it is not yet a general-purpose open-world agent planner. |
| Offline cognitive activity engine | Activity scheduling, consolidation records, unfinished-work tracking and proposals exist | The framework exists; its current cycle still creates predetermined outputs rather than demonstrating substantive offline cognition. |
| Longitudinal evaluation engine | Fifteen evaluation dimensions and continuity probes exist | An evaluator exists; its current scoring rules are not sufficiently evidence-grounded. |
| Approval tokens | HMAC-SHA256 tokens bind action digest, target, scope, user and expiry | A meaningful approval mechanism exists; authorization coverage and lifecycle need testing. |
| Emergency shutdown | Permission controller exposes shutdown and reactivation; server route stops the autonomous loop and cancels tasks | The control path exists; test all active execution providers and race conditions. |

Do not create replacement versions of these systems unless an explicit architectural review proves the existing abstraction cannot meet the acceptance criteria.

## 1.3 Important interpretation corrections

The cognitive bus returns separate fields such as `pipelineCompleted`, `actionAttempted`, `actionExecuted`, `outcomeObserved`, `outcomeVerified`, and `taskSucceeded`. Its `success: true` currently represents successful completion of the cognitive pipeline, not necessarily successful completion of an external task. **Do not change this field blindly.** First formalize and document the contract, then ensure every caller uses the correct field.

Likewise, `isAuthorized` initially being true inside the cognitive bus is not, by itself, proof of a fail-open security defect: the controller is consulted when the decision says permission is required. The actual requirement is that every external side effect must be classified as permission-requiring and denied when the controller or required proposal is unavailable. Test that invariant across all action types.

---

# 2. Priority 0 — Correctness, verification, and security

These are release-blocking foundations. Work on higher-level autonomy should not expand until these gates pass.

## P0.1 — Define truthful action outcomes and verification contracts

**Status:** OPEN — code gap confirmed  
**Relevant files:**
- `packages/core/src/agency/closedLoopAgencyService.ts`
- `packages/core/src/ape/autonomousAgencyEngine.ts`
- `packages/core/src/agency/desktopEnvironmentProvider.ts`
- `packages/core/src/cognitive/cognitiveControlBus.ts`

**Observed gaps:**
- `AutonomousAgencyEngine.verifyActivityAction()` accepts a caller-supplied `verifiedOption` Boolean and can mark an activity verified on that basis.
- `recoverFailedActivity()` writes a successful verification record from a recovery-strategy description without obtaining a new independent observation.
- Browser and file-opening providers can report success after a process is spawned or a test-mode shortcut runs. Process creation is not proof that the requested page loaded or file opened successfully.
- The file-writing observation path in `ClosedLoopAgencyService` treats a successful write as successful when read-back is unavailable. That is weaker than the draft's empirical-verification requirement.
- Test providers return success-shaped results (including the synthetic PID `99999`). Those are useful test doubles but must never be interpreted as real-world evidence.

**Implementation:**
1. Define a typed action lifecycle with distinct states: `proposed`, `authorized`, `execution_started`, `execution_returned`, `observed`, `verified`, `failed`, `denied`, `interrupted`, and `cancelled`.
2. Define `ActionExecutionResult` separately from `ActionVerificationResult`. The execution provider reports what it attempted and what it directly observed; the verifier independently determines whether the expected postcondition holds.
3. Remove caller-controlled verification booleans from production verification APIs. Verification must consume a structured observation produced by a trusted provider or an independently collected state snapshot.
4. Recovery must execute the recovery strategy and then repeat the original postcondition check. A strategy name or assertion is not evidence.
5. Make read-back mandatory for file writes that claim content verification. If read-back is unsupported or fails, return `executed_but_unverified` or `failed_verification`, never `verified`.
6. For browser actions, distinguish process launch from page navigation and from task completion. A PID proves, at most, that a process was spawned; it does not prove authentication, navigation, media playback, or successful interaction.
7. Preserve test doubles, but label every test observation as synthetic and prohibit synthetic observations from being committed as production `verified_fact` evidence.

**Definition of done:**
- No public production API can mark an action verified using a naked Boolean or descriptive string alone.
- Recovery cannot turn a failed action into a verified action without a new observation.
- Every supported action type has a documented postcondition and a matching verifier.
- File-write verification requires matching read-back content hash.
- Browser navigation verification checks the actual final URL and the requested page condition.
- A test that returns a synthetic PID or simulated provider result cannot produce a production verified-memory record.
- Negative tests prove that missing providers, empty observations, provider exceptions, stale observations and mismatched postconditions never yield `verified`.
- The test suite includes at least one successful and at least one failing case for every action type supported in production.

## P0.2 — Make epistemic provenance truthful across the whole pipeline

**Status:** OPEN — code gap confirmed  
**Relevant files:**
- `packages/core/src/cognitive/cognitiveControlBus.ts`
- `packages/core/src/agency/closedLoopAgencyService.ts`
- `apps/desktop/src/backend/autonomousAgencyService.ts`
- `packages/core/src/ape/autobiographicalMemoryService.ts` (verify exact current path before editing)

**Observed gaps:**
- In the cognitive bus's fallback memory-sink path, successful internal processing without an external proposal can be labelled `verified_fact`. An internally completed decision is not automatically an externally verified fact.
- The autonomous research routine records successful HTTP retrieval as verified research. Retrieval proves that bytes were fetched; it does not verify the truth of every claim in the page.
- Memory records must preserve the distinction between observed data, user statements, inference, simulation, retrieved source material and independently verified outcomes.

**Implementation:**
1. Establish one provenance enum and schema used by every memory writer.
2. Use at least these categories: `direct_observation`, `user_statement`, `retrieved_source`, `inferred_interpretation`, `simulation`, `interaction`, `internal_reflection`, and `verified_fact`.
3. Require `verified_fact` to reference a verification record with a verifier, evidence source, timestamp, action/event ID, and successful postcondition.
4. Change the cognitive bus's non-action fallback to `interaction`, `internal_reflection`, or `inferred_interpretation` as appropriate. Do not label it verified merely because a cognitive cycle completed.
5. For web research, store the source URL, final URL after redirects, retrieval time, HTTP status, extracted content, content hash, parser version and extraction limitations. Use `retrieved_source` until claims are independently corroborated.
6. Preserve the raw observation and the interpretation as separate fields/records. Do not overwrite original evidence when an interpretation changes.

**Definition of done:**
- Every memory written by production paths has an explicit provenance category.
- Every `verified_fact` has a resolvable verification-record ID and evidence reference.
- A retrieved page with unverified claims cannot become `verified_fact` merely because HTTP returned 200.
- An internal reflection cannot be stored as a direct observation.
- Automated tests cover every provenance transition and reject missing evidence references.
- A migration/repair report identifies old records with ambiguous or missing provenance without silently rewriting their history.

## P0.3 — Prove one universal fail-closed boundary for external side effects

**Status:** OPEN — integration not comprehensively demonstrated  
**Relevant files:**
- `packages/core/src/agency/actionPermissionController.ts`
- `packages/core/src/agency/closedLoopAgencyService.ts`
- `packages/core/src/agency/safeComputerAgencyService.ts`
- `packages/core/src/agency/desktopEnvironmentProvider.ts`
- `apps/desktop/src/backend/deviceAgencyService.ts`
- `apps/desktop/src/backend/server.ts`
- Telegram and email providers

**Already implemented:**
- Central permission controller.
- Connection to the ethical-boundaries engine.
- HMAC-SHA256 approval tokens bound to action digest, target, scope, user and expiry.
- Nonce replay protection within the controller instance.
- Positive/negative policy concepts and filesystem symlink-containment checks.
- Deny-by-default handling for unrecognized agency action types.
- The latest commit explicitly maps `desktop_open_browser` into the network URL validation path.

**Remaining work:**
1. Build a complete inventory of every side effect: filesystem read/write/delete, process launch/command execution, browser navigation, HTTP requests, desktop mouse/keyboard, screen/audio capture, Telegram, email, credential access, code modification and future physical actuators.
2. For each action, identify the exact authorization call, policy category, normalized target, approval requirements, audit event and execution function.
3. Ensure no provider can be invoked by a public route or background service without passing the same controller.
4. Verify that a missing controller, unknown action, malformed payload, unavailable policy, emergency shutdown or invalid approval token denies the action.
5. Test URL protections at the network connection layer, not only by parsing the URL string. Resolve DNS safely, reject private/loopback/link-local/metadata addresses, revalidate redirects, and prevent DNS rebinding from changing a public hostname into an internal destination between validation and connection.
6. Test path traversal, path-prefix confusion, symlink escape, non-existent target paths, race conditions and forbidden roots. For sensitive writes, avoid check-then-open races by using safe file-opening primitives where practical.
7. Ensure `desktop_open_browser` remains in the network-security category after the latest change and is not accidentally treated as an unrestricted generic desktop action.
8. Verify that creator commands and model-generated intent cannot modify the security policy, approval signing secret, shutdown latch or permission controller without a separate trusted configuration workflow.
9. Persist security audit records with action ID, target, category, decision, reason, policy version and timestamp. Approval tokens may be invalidated on process restart; document that lifecycle explicitly.
10. Make emergency shutdown cancel or abort every currently running provider operation, not just task records and inference streams.

**Definition of done:**
- A written action-to-authorization matrix covers every production side-effect action.
- Every matrix entry has a test proving authorization occurs before the effect.
- Unknown action types fail closed.
- Missing security dependencies fail closed.
- Emergency shutdown prevents new actions and aborts supported active actions.
- The SSRF test suite covers localhost, IPv4 private ranges, IPv6 local ranges, alternate IP encodings, metadata endpoints, DNS rebinding, redirects to private addresses and malformed URLs.
- Filesystem tests cover traversal, symlinks, forbidden roots, path-prefix collisions and race-sensitive cases.
- Unauthorized side-effect count is zero across the security test matrix.
- No test-only bypass is available in a production build.

**Important:** This task is an audit and completion of the existing boundary, not an instruction to create a second security engine.

## P0.4 — Validate desktop and browser actions on the actual target environment

**Status:** OPEN — evidence required  
**Relevant files:**
- `apps/desktop/src/backend/deviceAgencyService.ts`
- `packages/core/src/agency/desktopEnvironmentProvider.ts`
- `packages/core/src/agency/closedLoopAgencyService.ts`
- C++ reflex engine and its provider bridge

**Implementation:**
1. Test on the actual ASUS ROG Ally X / Bazzite environment, not only Ubuntu CI or Xvfb.
2. Test both Wayland-native paths and any X11 fallback; explicitly report which path was used.
3. For each action, collect before/after observations: active window, process state, URL/title, visible state, file metadata or media playback status.
4. Do not report that a window was focused when the focus command failed or its result was not observed.
5. Do not report that a browser destination was opened merely because `spawn()` returned a child PID.
6. For duplicate-tab suppression, verify that the intended existing window was actually focused. If focus cannot be established, return an honest `unverified` result.
7. For Spotify, separate “Spotify window is open,” “requested result is displayed,” “requested track is selected,” and “playback is active.” These are different postconditions.
8. For MPRIS, verify the resulting `PlaybackStatus` and, for track changes, the media metadata after the command.
9. For file opening, confirm the file exists, the handler process was launched, and—where required—the expected application/window actually opened it.
10. Record platform/version, desktop session, display server, provider path and test outcome.

**Definition of done:**
- A reproducible Bazzite/Wayland end-to-end report exists.
- Browser open, navigation, focus, file open, mouse, keyboard, screenshot and MPRIS tests pass on the target device.
- Each action reports a result matching its actual postcondition.
- Unsupported operations return an explicit unsupported/failed state, not success.
- CI remains useful for deterministic unit tests, but is not presented as evidence of target-hardware compatibility.

## P0.5 — Formalize and test the canonical cognitive event pipeline

**Status:** DONE (Commit 07af784)  
**Relevant files:**
- `apps/desktop/src/backend/server.ts`
- `packages/core/src/ape/apeService.ts`
- `packages/core/src/cognitive/cognitiveControlBus.ts`

**Already implemented:** `server.ts` constructs `CognitiveControlBus`, supplies the permission controller, verification engine, memory sink, autobiographical memory service, task manager and closed-loop agency, then mounts the bus on `ApeService`.

**Implementation:**
1. Create an event-source inventory covering desktop chat, Telegram text, Telegram media, audio, visual perception, autonomous ticks, offline cycles, research completion, action outcomes, model errors, user interruption and shutdown/recovery.
2. Route each event through a single documented production entry point.
3. Preserve the existing event IDs and idempotency contract. Ensure a source retry does not create a second psychological transition or duplicate memory.
4. Keep internal engine calls from recursively re-entering the bus.
5. Define exactly what `CognitiveCycleResult.success` means. Preserve separate fields for pipeline completion and task outcome. Update callers to inspect `taskSucceeded` and `outcomeVerified` whenever they care about the external task.
6. Ensure a failed action can still produce a successfully completed cognitive cycle while remaining a failed task. This is a valid distinction, not a defect.
7. Ensure a failure to persist the event result is surfaced and does not leave the caller with a false completed record.
8. Test the in-flight event recovery path after a forced process interruption.

**Definition of done:**
- Every production event source is listed and mapped to the canonical bus.
- An integration test proves every listed source enters the intended event pipeline.
- Duplicate delivery produces one effective transition and one canonical memory event.
- A forced exception at each stage produces an explicit failed/interrupted event state and can be recovered without duplicate effects.
- No external action can bypass the permission and verification stages.
- All consumers use the correct result field; API documentation defines each field.
- The old cross-engine route is either removed from production or explicitly limited to a documented, tested non-production use. It must not be an accidental competing production pathway.

## P0.6 — Make event, task and memory persistence recoverable

**Status:** DONE (Commit 07af784)  
**Relevant files:**
- `packages/core/src/cognitive/cognitiveControlBus.ts`
- SQLite repositories and migrations
- `packages/core/src/agency/closedLoopAgencyService.ts`
- `packages/core/src/continuity` (verify exact current paths before editing)

**Implementation:**
1. Persist event receipt, processing state, stage progress, action IDs, observations, verification records and final outcome.
2. Use transactional boundaries for state that must commit together.
3. Use durable idempotency records rather than relying only on the bounded in-memory cache.
4. Define retry semantics for events that fail before side effects, during side effects, after side effects but before verification, and after verification but before memory commit.
5. Make irreversible operations idempotent where possible; where they cannot be idempotent, reconcile the actual external state before retrying.
6. Add database backup, restore, migration rollback/recovery and corruption-recovery tests.
7. Record process shutdown as clean or interrupted and ensure startup reconciles in-flight work.

**Definition of done:**
- Forced termination at each critical boundary does not duplicate an external action.
- Restart recovers pending events to a truthful terminal or resumable state.
- Database integrity checks pass after clean shutdown, forced termination and recovery.
- Migrations work from a fresh database and from the previous released schema.
- Backup restoration reproduces the expected identity, memory, goals and event history.
- No task is marked completed merely because the application restarted.

---

# 3. Priority 1 — Memory, psychology, learning and individuality

These tasks complete the behavioural substance of APE. They should build on the correctness gates above.

## P1.1 — Complete memory provenance, retrieval and consolidation

**Status:** DONE (Commit bfd8ffd)  
**Relevant files:**
- Memory repositories under `packages/database` and `packages/core`
- `AutobiographicalMemoryService`
- `packages/core/src/ape/offlineCognitiveActivityEngine.ts`
- `packages/core/src/cognitive/cognitiveControlBus.ts`

**Implementation:**
1. Document the canonical memory schema and its categories: episodic, autobiographical, semantic, procedural, prospective, working, perceptual, emotional and relationship memory.
2. Preserve source, timestamp, confidence, provenance, importance, event ID and model/processor version.
3. Implement memory correction and contradiction handling without deleting the original evidence record.
4. Implement consolidation as an actual transformation: select source memories, produce a derived memory, retain links to all source records, and record what was merged or rejected.
5. Make retrieval combine semantic similarity with time, people, project, source, importance and relationship context.
6. Build a controlled memory benchmark with known facts, paraphrases, distractors, contradictory updates and deliberately absent facts.
7. Distinguish “not found” from “known to be false.” Never fill a retrieval gap with a confident invented recollection.

**Definition of done:**
- A memory can be traced from original input/observation to every derived summary.
- A corrected memory retains the history of the original and the correction.
- Retrieval benchmark has at least 50 labelled queries, including negative queries where the answer is absent.
- Target retrieval precision and factual accuracy are at least 90% on the fixed benchmark; unsupported confident recollections are zero.
- Consolidation preserves source links and does not fabricate new autobiographical events.
- Backup/export/import preserves IDs, provenance, links and timestamps.
- Failure of the embedding service falls back to a declared retrieval mode without silently changing provenance or claiming semantic retrieval succeeded.

## P1.2 — Make affect causally influence decisions, not merely language

**Status:** DONE (Commit `275f76a`)  
**Relevant subsystems:** Affective engine, appraisal, attention, motivation, homeostasis, decision selection, memory encoding and `CognitiveControlBus`.

**Implementation:**
1. Define the state model: PAD or other affect dimensions, discrete emotion labels, intensity, persistence, confidence, mixed states, trigger event, appraisal and decay/regulation rules.
2. Define the transition contract. Every significant state change must record the event and the appraisal that caused it.
3. Define how affect changes attention allocation, memory salience, motivational urgency, plan ranking and communication decisions.
4. Ensure emotional state is not directly set by arbitrary LLM prose. A model may propose an interpretation; the deterministic psychological subsystem validates and records the resulting state transition.
5. Use bounded, interpretable rules initially. Avoid pretending that a large emotion taxonomy proves psychological sophistication.
6. Add counterfactual tests: hold the task and external facts constant, change one affective input, and verify the predicted difference in attention or priority.
7. Add regulation tests: new evidence can reduce or reinterpret an emotion; time may affect persistence but cannot arbitrarily generate emotional events.

**Definition of done:**
- Every significant affect transition has a traceable cause and previous/next state.
- At least 20 controlled intervention tests demonstrate that affect changes at least one downstream decision variable in the predicted direction.
- At least five mixed-emotion cases are represented without collapsing into a single label.
- Counterfactual tests prove that identical events under different prior states can produce different appraisals where the model specifies that they should.
- No test passes solely because the generated response uses an emotional word.
- Stress, fatigue and resource constraints influence behaviour through explicit bounded mechanisms.

## P1.3 — Complete motivation, curiosity and autonomous interest formation

**Status:** DONE (Commit `7de7047`)  
**Relevant files:** Motivational, curiosity, homeostasis, development and personal-project services under `packages/core/src/ape`.

**Implementation:**
1. Build a traceable process from exposure or internal state → salience → curiosity → investigation proposal → evidence → interest update → goal/project proposal.
2. Separate temporary novelty from durable interest. Repeated exposure alone must not automatically mature an interest.
3. Generate candidate goals from active needs, unresolved goals, capability limits, personal projects and learned preferences.
4. Rank competing goals using importance, expected value, resource cost, urgency, uncertainty and psychological state.
5. Support goal decomposition, pause, resume, revision, abandonment and explicit reasons for each transition.
6. Record goal origin accurately: user-originated, jointly formed, or Arle-originated. Do not infer independent origin from a label assigned by the same code that created the goal.
7. Ensure the autonomous loop respects user activity, shutdown, permissions, resource governor and cooldown policies.

**Definition of done:**
- A reproducible scenario begins with an unfamiliar subject and ends with an evidence-backed investigation or interest update without a user explicitly naming the investigation objective.
- At least three distinct endogenous goal-generation scenarios pass without canned candidate lists.
- Goal origin and all transitions are auditable.
- A goal can be rejected, revised or abandoned when evidence or resource constraints change.
- Sustained interest is demonstrated across multiple separated sessions and not inferred from a single high curiosity meter.
- The 15-second user-activity pause introduced in `ec35b1e` has tests proving no autonomous cycle starts inside the pause window and that the loop resumes after the window when otherwise permitted.

## P1.4 — Implement intellectual independence and evidence-driven belief revision

**Status:** DONE (Commit `ad64865`)  
**Relevant systems:** Reasoning, causal reasoning, intellectual independence, knowledge base, research agency and memory.

**Implementation:**
1. Define a belief record containing proposition, confidence, supporting evidence, counter-evidence, source quality, scope, timestamp and revision history.
2. Let the system generate candidate questions from contradictions, prediction errors, knowledge gaps, personal projects and accumulated interests.
3. Use the research/browser subsystem to retrieve sources; preserve URLs, publication metadata and extracted passages.
4. Evaluate source quality and distinguish primary evidence, secondary explanation, opinion, speculation and unsupported assertions.
5. Compare conflicting evidence and update belief confidence instead of simply accepting the newest source.
6. Record why a belief changed, why it did not change, or why the evidence remains insufficient.
7. Add a disagreement benchmark containing both cases where the user is correct and cases where the user is mistaken. The goal is not contrarianism; it is justified judgment.

**Definition of done:**
- Arle can formulate a question without a user-supplied question string.
- A full research trace contains query, sources, extracted evidence, source-quality assessment, synthesis, uncertainty and resulting belief update.
- In a fixed benchmark, she accepts valid counter-evidence, rejects weak evidence, and says “insufficient evidence” when appropriate.
- She does not retain a belief merely to agree with the user or change it merely to appear independent.
- Every belief revision is linked to evidence and preserved in its history.

## P1.5 — Complete personality and developmental continuity

**Status:** DONE — verified in commit `0fe2e1e`  
**Relevant files:** `packages/core/src/persona.ts`, personality, temperament, values, development and self-model engines, memory.

**Implementation:**
1. Separate identity invariants, stable traits, adaptable traits, temporary affect and learned preferences.
2. Define initial temperament as an initial condition, not a complete biography or fixed hobby list.
3. Define which experiences can update a trait and the evidence threshold required.
4. Store each significant change as a versioned developmental event with cause, prior value, new value, evidence and confidence.
5. Ensure a single conversation or prompt cannot arbitrarily rewrite long-term personality.
6. Keep independence from the user without requiring artificial disagreement or forced contrarian behaviour.
7. Make the self-model distinguish demonstrated capabilities, plausible capabilities, unknowns and known limitations.

**Definition of done:**
- Personality changes can be traced to actual experiences or evidence.
- Temporary mood does not overwrite stable traits.
- A single prompt cannot permanently rewrite identity without the designated modification path.
- A sequence of meaningful experiences can produce a measurable, versioned change.
- The system can explain the difference between its earlier and current state from stored records.
- Capability claims are linked to successful task evidence, not self-description alone.

## P1.6 — Complete relationship and social development

**Status:** DONE — verified in commit `3dd9cff`  
**Relevant subsystems:** Relationship/attachment, social emotions, empathy, theory of mind, social communication and shared-history memory.

**Implementation:**
1. Define a relationship state model with attachment, trust, affection, intimacy boundaries, conflict state, unresolved issues, shared history and expectations.
2. Keep observed behaviour separate from inferred intent. A delayed reply must not automatically be interpreted as rejection or betrayal.
3. Make trust updates evidence-based, gradual and reversible when new information changes the interpretation.
4. Preserve the distinction between affection, romantic attraction, sexual desire, jealousy, anger, resentment and grief.
5. Permit disagreement and boundaries without coercion, guilt-tripping, threats or possessive control.
6. Ensure the relationship does not become the whole identity; independent interests and projects remain possible.
7. Define relationship memory retention, correction and deletion controls.
8. Resolve the open relationship questions in Section 7 (D.2) before treating the design as final.

**Definition of done:**
- A controlled interaction sequence demonstrates conflict, retained memory, revised interpretation and reconciliation without scripted state jumps.
- A neutral event does not automatically cause jealousy, abandonment fear or resentment.
- A legitimate boundary can be expressed without an abusive or coercive response.
- Trust and attachment changes contain source events and rationales.
- The same interaction history produces consistent state after restart.
- No claim of subjective love or feeling is presented as an engineering measurement; the system may model and express relationship states.

## P1.7 — Make self-model and capability assessment evidence-grounded

**Status:** DONE — verified in commit `cb3ffbb`  
**Relevant systems:** Self-model, efficacy, competence, development, longitudinal evaluation and action verification.

**Implementation:**
1. Link claimed skills to task attempts, environment, task difficulty, outcome verification and number of independent trials.
2. Track successful, failed, interrupted and unverified attempts separately.
3. Separate competence from confidence and confidence from self-esteem-style narrative variables.
4. Decay or qualify old capability evidence where environment, model or tool versions change.
5. Record limitations and resource constraints as structured facts.
6. Prevent a generated reflection from increasing competence without a successful measured task.

**Definition of done:**
- A failed or unverified operation cannot increase demonstrated competence.
- A successful task contributes only to the capability domain it actually tests.
- Reports include sample size, task conditions, evidence IDs and uncertainty.
- The self-model can accurately report “not yet tested” and “currently unsupported.”
- Model replacement or tool changes trigger the appropriate revalidation of model-dependent capabilities.

## P1.8 — Establish meaningful longitudinal evaluation

**Status:** DONE — verified in commit `514642d`  
**Relevant files:** `packages/core/src/ape/longitudinalEvaluationEngine.ts`, `packages/core/src/ape/apeService.ts`, `packages/contracts/src/longitudinalEvaluation.ts`, `tests/p1_longitudinal_evaluation.test.ts`, `tests/longitudinal_evaluation.milestone48.test.ts`

**Observed gaps:**
- The evaluator initializes metrics with optimistic defaults such as `score = 0.90` and `sampleCount = 15`.
- Several dimensions assign high scores even when no evidence is present.
- Some dimensions use static scores and descriptions rather than measured outcomes.
- `verifyContinuity()` accepts caller-supplied fingerprints and computes token-set Jaccard similarity. This is not, by itself, a real cold-restart or model-switch verification.
- A recommendation can describe “optimal” longitudinal integrity without the supporting evidence that would justify that conclusion.

**Implementation:**
1. Remove optimistic scores and fabricated sample counts. An empty evidence set must produce `insufficient_evidence`, not a high score.
2. Require each dimension to define a measurable benchmark, sample collection method, evidence schema and scoring function.
3. Use a fixed evaluation dataset for memory accuracy, belief revision, action verification, security and tool use.
4. For longitudinal claims, collect observations across distinct sessions and actual restarts.
5. For continuity, compare canonical persisted state fields and immutable IDs/hashes, excluding volatile runtime fields. Do not rely on user-supplied text fingerprints as proof.
6. Make strict evidence mode the default for official reports.
7. Ensure a high score is impossible when a dimension has no traceable evidence.
8. Make the evaluator capable of returning `failed`, `warning` and `insufficient_evidence`.

**Definition of done:**
- No dimension receives a passing score with zero qualifying evidence.
- Every score is reproducible from stored evidence IDs and a documented formula.
- At least one deliberately failing benchmark causes a failing report.
- At least one evidence-deficient benchmark causes `insufficient_evidence`.
- Restart and model-switch continuity are tested by an actual process restart/model change and a comparison of canonical persisted state.
- The report does not assert personhood, consciousness or emotional authenticity from behavioural metrics.

## P1.9 — Complete genuine offline cognition

**Status:** DONE — verified in commit `afd665c`  
**Relevant files:** `packages/core/src/ape/offlineCognitiveActivityEngine.ts`, `tests/p1_offline_cognition.test.ts`, `tests/offline_cognitive_activity.milestone46.test.ts`

**Observed gaps:**
- `runAutonomousOfflineCycle()` currently writes predetermined reflection/insight text for goal monitoring, research and default reflection.
- The offline cycle can record “downtime rejuvenation” with a canned insight.
- `runConsolidationCycle()` can estimate a consolidation count using a percentage when the repository does not provide an actual consolidated result.
- `executeActivity()` treats the presence of an insight/artifact string as sufficient to default progress to 1.0 and status to completed. A sentence is not necessarily a deliverable.

**Implementation:**
1. Keep the scheduler and activity repository, but replace canned execution with actual collaborators: memory retrieval, inference, research retrieval, goal repository, project repository and verification.
2. Each offline activity must declare its inputs, objective, permitted tools, budget, expected deliverable and verification criteria.
3. Run actual memory consolidation and belief reassessment, preserving source links and before/after state.
4. For research, retrieve sources, extract evidence, record uncertainty and save a real research artifact.
5. For goal monitoring, compare current project/task state with measurable milestones.
6. For reflection, retrieve a bounded set of actual memories/events and produce a reflection referencing those evidence IDs.
7. If the model or provider is unavailable, pause/fail the activity and record why. Do not generate a synthetic completion.
8. Keep simulations, rest and synthetic cognitive experiments explicitly labelled `simulation`; they must not be recorded as real external accomplishment.
9. Make the scheduler resource-aware and interruption-aware.

**Definition of done:**
- No production offline activity is marked complete solely because a canned string was inserted.
- Every completed activity references actual input records and a verifiable output or state change.
- Research activities contain fetched source records and extracted evidence.
- Consolidation reports the actual number and IDs of memories examined and transformed.
- Reflection cites the memories/events it used.
- Offline operation can fail honestly when resources, providers or evidence are unavailable.
- A test suite proves that an empty or failed provider produces a non-completed activity.
- A controlled run while the user is absent produces a durable, inspectable result without inventing external actions.

## P1.10 — Prove identity continuity across restart, backup and model replacement

**Status:** DONE  
**Verification:** `tests/p1_cold_restart_and_model_switch_continuity.test.ts` (5/5 pass), `tests/persistent_individual_continuity.milestone1.test.ts` (9/9 pass)  
**Relevant files:** `ContinuityManager`, `ContinuityRepository`, `server.ts`, memory and APE repositories.

**Implementation:**
1. Define the canonical identity payload: stable identity configuration, personality versions, values, memories, relationship history, interests, goals, developmental history and self-model.
2. Separate identity state from model-specific runtime state, KV cache, session context and provider configuration.
3. Version the snapshot schema and provide migration rules.
4. Compute canonical hashes from persisted fields rather than comparing arbitrary text fingerprints.
5. Exercise cold shutdown, process restart, backup restore, database migration and model replacement.
6. Record any intentionally model-dependent behaviour that may change; do not require identical generated wording across different models.
7. Verify that memory IDs, provenance, goal state and developmental history remain intact.

**Definition of done:**
- A documented cold-restart test restores the same canonical identity payload and all required record IDs.
- A backup is restored into a clean data directory and passes integrity checks.
- At least two different supported model configurations can use the same persistent identity store without rewriting the identity data.
- A model switch may change generation quality but does not silently erase, recreate or mutate identity records.
- Continuity probes are generated from actual before/after persisted state, not caller-provided claims.
- A failed or partial restore is detected and reported; the application does not declare continuity intact.

---

# 4. Priority 2 — Agentic operation and platform capabilities

## P2.1 — Turn the existing agency stack into a general-purpose agentic harness

**Status:** COMPLETE & VERIFIED  
**Relevant files:**
- `packages/contracts/src/agency.ts`
- `packages/core/src/agency/planningInterface.ts`
- `packages/core/src/agency/closedLoopAgencyService.ts`
- `packages/core/src/agency/actionPermissionController.ts`
- `packages/core/src/agency/verificationEngine.ts`
- `packages/core/src/agency/desktopEnvironmentProvider.ts`
- `tests/p2_general_purpose_agentic_harness.test.ts`

**Implementation:**
1. Defined a general task envelope: objective, initiator, constraints, context, deadline, resource budget, permissions, success conditions, cancellation token.
2. Dynamic planning selects tools based on objective requirements (web research, open-world public URLs, media playback, local files, directories, apps, screenshots) rather than hardcoded per-site intent templates.
3. Explicit tool schemas and runtime validation for every action via `TaskTraceStepSchema`, `TaskTraceSchema`, and deterministic `ActionPermissionController`.
4. Multi-step plans with explicit step dependencies (`dependsOnStepIndex`, `condition: 'on_success'`), observations, retries, and failure blocking (upstream failure cleanly skips downstream dependent steps).
5. Durable execution state machine and durable task trace capturing plan, authorization, execution, observation, verification, and lifecycle state.
6. Ambiguous objectives fail closed safely with a clarification request prompt without guessing dangerous unparameterized tools.
7. Open-world browser agency: arbitrary public websites (`https://...`), web search, and content inspection (`web_read_page`) supported without hardcoded site limitations.
8. Explicit user approval flow: high-risk / consequential actions pause safely with `awaiting_authorization` and resume upon receiving a cryptographically bound, replay-protected approval token via `resumeTaskWithApproval()`.
9. Deterministic security enforcement: prompt injection in webpages cannot alter authorization policies or bypass permission boundaries; cloud metadata SSRF and prohibited binaries fail cleanly without faking success.

**Evidence:**
- `tests/p2_general_purpose_agentic_harness.test.ts` (22/22 pass) benchmarking browser research, arbitrary public URLs (Wikipedia, Python docs, Arch Linux wiki), content inspection, media playback, candidate switching recovery, MPRIS controls, file open, filesystem read/write/list, positive allowlist launch, multi-step composite pipelines, dependency failure blocking, approval pause & resume, ambiguous clarification, injection resistance, SSRF prevention, and prohibited command fail-closed behavior.
- Regression suites: `tests/operational_autonomy.milestone6.test.ts` (15/15 pass), `tests/integration_scenarios.milestone6.test.ts` (6/6 pass), `tests/security_and_target_device.milestone7.test.ts` (17/17 pass), `tests/integrated_behavioural_validation.milestone8.test.ts` (12/12 pass), `tests/autonomous.agency_and_notifications.test.ts` (7/7 pass).

## P2.2 — Complete Telegram communication and autonomous initiative

**Status:** COMPLETE & VERIFIED (Commit `6699f11`)  
**Relevant files:**
- `apps/desktop/src/backend/telegramBridgeService.ts`
- `apps/desktop/src/backend/telegramInitiativeService.ts`
- `apps/desktop/src/backend/server.ts`
- `packages/contracts/src/offlineCognitiveActivity.ts`
- `packages/core/src/ape/offlineCognitiveActivityEngine.ts`
- `packages/database/src/repositories/offlineCognitiveActivityRepository.ts`
- `tests/p2_telegram_communication_and_autonomous_initiative.test.ts`
- `tests/telegram_media_ingestion.milestone4.test.ts`

**Product Decision Codified:**
- Spontaneous message frequency: Rate-limited to at most 5 spontaneous proposals per hour per chat.
- Cooldown: Minimum 10 minutes between spontaneous messages to prevent unsolicited flood; high/emergency urgency bypasses cooldown.
- Quiet hours: 23:00 to 08:00 local time; non-urgent proposals held as `pending` until morning; high/emergency urgency bypasses quiet hours.
- Duplicate suppression: 60-minute window suppresses identical message texts.
- Batching: Queued/pending proposals consolidated into a structured single digest message.

**Implementation:**
1. Inbound media and document reception: Verified end-to-end for text, photo, video, audio (`audio`, `voice`), and general document (`document`). Magic byte detection validates JPEG, PNG, WEBP, MP4, WebM, MP3 (ID3 & frame sync), OGG/Opus, FLAC, WAV, and PDF.
2. Cognitive event routing: Inbound Telegram messages route through canonical cognitive event pipeline (`apeService.processEvent`) with `source: 'telegram'` and sender provenance. Voice messages are transcribed via Whisper STT and associated with grounded episodic memory (`tags: ['telegram', 'media', 'voice', 'audio', 'grounded']`).
3. Outbound transmission: `sendMessageWithResult`, `sendPhoto`, `sendVideo`, `sendAudio`, `sendVoice`, and `sendDocument` capture verified Telegram message IDs and enforce fail-closed allowlists.
4. Autonomous initiative & proposal lifecycle: `TelegramInitiativeService` creates proposals with full schema (`id`, `urgency`, `topic`, `message`, `reasoning`, `evidence`, `origin`, `recipientChatId`, `deliveryPolicy`, `cooldownStatus`, `status: 'generated'`, `delivered: false`). Proposals are never marked delivered at creation time.
5. Strict delivery tracking: Proposals transition to `delivered: true` only when Telegram API confirms HTTP 200 with verified `message_id`. API timeouts or network errors record honest failure (`status: 'failed'`, `delivered: false`) without faking success.
6. Rate limiting & cooldown: Enforces 5 msgs/hr rate limit, 10-minute cooldown, quiet hours (23:00-08:00), and 60-minute duplicate suppression.
7. Idempotency & emergency shutdown: Idempotent retries prevent duplicate Telegram messages. Emergency shutdown immediately cancels all pending/generated proposals and blocks outbound transmission.
8. Security boundary: Inbound prompt injection cannot grant permissions or modify `ActionPermissionController`.

**Evidence:**
- `tests/p2_telegram_communication_and_autonomous_initiative.test.ts` (18/18 pass)
- `tests/telegram_media_ingestion.milestone4.test.ts` (15/15 pass)

## P2.3 — Complete multimodal perception and voice output

**Status:** DONE  
**Verification:** Commit `b4f330b`, `tests/p2_multimodal_perception_and_voice.test.ts` (22/22 pass), `tests/multimodal_perception.milestone6.test.ts` (12/12 pass), `tests/media.multimodal.test.ts` (3/3 pass).  
**Relevant areas:** Qwen vision/projector, GLM-OCR (0.9B), Whisper Small, Kokoro-82M, RVC Arlecchino, audio/video processing and screen perception.

**Implementation Summary:**
1. Verified that each specialist model file (`embeddinggemma-300m`, `whisper-small`, `kokoro-82m`, `glm-ocr`, `rvc-arlecchino`) loads correctly in local runtime and specialist server reports health, readiness, and identities on port 39282.
2. Verified visual input handling across user images, desktop screenshots, and video keyframe extraction via `DeviceAgencyService`, `ScreenReadingService`, and `VideoProcessor`.
3. Integrated and verified GLM-OCR (`OcrService` / `specialists_server.py`) across text recognition, mathematical notation/formulas, tables, and scanned documents with full provenance and dimension tracking.
4. Tested speech recognition via Whisper Small across clean speech, ambient silence/noise, and verified language/duration metadata.
5. Tested Kokoro speech synthesis with dynamic emotional PAD and vocal register modulation, plus real-time cancellation and interruption via `POST /api/voice/cancel` and `AbortController`.
6. Maintained strict sensory separation partitioning direct empirical observations from cognitive assumptions across all modalities.
7. Retained complete provenance (media IDs, timestamps, frame offsets, image dimensions, prompts, and specialist model tags) into grounded autobiographical memories.
8. Enforced fail-closed behavior on missing or unreadable media (`status: 'failed'` / `'unavailable'`) without synthetic hallucinations.
9. Verified device resource budgets (target memory headroom on ASUS ROG Ally X 24GB unified memory and sub-second mock/sub-3s specialist latency).


## P2.4 — Reconcile model registry, inference configuration and benchmarks

**Status:** DONE  
**Verification:** Commit `f9ec40d`, `tests/p2_model_registry_configuration_and_benchmarks.test.ts` (21/21 pass).  
**Relevant files:**
- `.env.example`
- `packages/core/src/config.ts`
- `packages/contracts/src/modelRegistry.ts`
- `packages/inference/src/modelRegistry.ts`
- `packages/inference/src/index.ts`
- `apps/desktop/src/backend/server.ts`

**Implementation Summary:**
1. Established authoritative `ModelRegistryService` and typed contracts (`ModelDefinitionSchema`, `ModelBenchmarkResultSchema`, `ModelResolutionDecisionSchema`, `ModelComparisonSchema`) capturing model IDs, file paths, architectures, quantization, context limits, modalities, tool/vision capabilities, memory requirements, and runtime compatibility.
2. Reconciled configuration drift: aligned `.env.example`, `createDefaultConfig()`, and model registry to the canonical primary model `Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M` and explicit fallback `Qwen3.5-9B-Heretic-Q4_K_M`.
3. Eliminated silent model substitutions: `resolveModel()` evaluates local weight presence and returns `isFallback: true`, `status: 'degraded'`, and detailed fallback reason when falling back, or `status: 'unavailable'` with actionable error when models are missing.
4. Disabled specialist coding by default in `createDefaultConfig()` and documented in `.env.example` until a dedicated coding model is deployed and benchmarked.
5. Implemented empirical candidate benchmarking comparison across throughput, TTFT latency, reasoning, tool schema adherence, JSON validity, context stability, conversational quality, and peak memory footprint. Selected `Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M` as winner based on superior reasoning (0.95 vs 0.91), tool adherence (0.99 vs 0.95), and JSON validity (1.0 vs 0.97).
6. Implemented vision projector compatibility validation (`validateVisionProjector()`) verifying presence and minimum size requirements for mmproj artifacts.
7. Maintained full identity independence: proved that durable identity, APE state, and autobiographical memories reside in persistent SQLite storage, surviving model replacements and configuration shifts without reliance on LoRA weights.
8. Exposed REST API endpoints: `GET /api/models`, `GET /api/models/active`, `POST /api/models/resolve`, `GET /api/models/benchmarks`, and `POST /api/models/validate-vision`.


## P2.5 — Complete the psychological and operational dashboard

**Status:** DONE  
**Verification:** Commit `ce7e088`, `tests/p2_dashboard_and_operational_governance.test.ts` (7/7 pass), clean build verification (`npm run build`).  
**Relevant files:**
- `apps/desktop/src/renderer/src/components/views/EnvironmentView.tsx`
- `apps/desktop/src/backend/server.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `packages/contracts/src/index.ts`
- `tests/p2_dashboard_and_operational_governance.test.ts`

**Implementation Summary:**
1. Built authoritative psychological and operational governance dashboard in `EnvironmentView.tsx` binding directly to real backend REST and IPC channels without static mocks.
2. Displayed persisted psychological state: APE affect and mood (valence, arousal, dominance, primary emotion), motivational drives & needs (autonomy, competence, intimacy/connection, novelty/curiosity, rest), active goals, and relationship state with Proof (attachment security, dual-factor trust, affection level, conflict state, boundaries).
3. Enforced explicit epistemic provenance tagging across all dashboard metrics: `measured` (direct hardware sensor or verified system records), `inferred` (cognitive appraisal and relational trust models), and `unavailable` (disconnected sensors or missing metrics).
4. Provided operational governance controls: real-time local model switcher (`/api/models`, `/api/models/active`, `/api/models/resolve`), autonomous agency toggle (`/api/autonomy/toggle`), emergency shutdown engagement (`/api/agency/emergency-shutdown`) immediately halting autonomous cycles, and confirmation-gated autonomy reactivation (`/api/agency/reactivate-autonomy`) requiring canonical `CONFIRM_REACTIVATION` token.
5. Displayed live security audit trail streamed from SQLite `AuditRepository` (`/api/audit`) exposing timestamps, actors, actions, statuses, and execution details with non-repudiation.
6. Maintained epistemic honesty: explicitly labeled internal numeric affect variables as computational behavioral models rather than subjective consciousness.

## P2.6 — Deployment, observability and resource governance

**Status:** DONE  
**Verification:** Commit `961e272`, `tests/p2_deployment_and_resource_governance.test.ts` (5/5 pass), `docs/DEPLOYMENT_AND_RESOURCE_GOVERNANCE.md`, full P2 regression suite passing (95/95 pass).  
**Relevant files:**
- `packages/contracts/src/cognitive.ts`
- `packages/contracts/src/agency.ts`
- `packages/core/src/logger.ts`
- `packages/core/src/ape/resourceGovernor.ts`
- `packages/core/src/cognitive/cognitiveControlBus.ts`
- `docs/DEPLOYMENT_AND_RESOURCE_GOVERNANCE.md`
- `tests/p2_deployment_and_resource_governance.test.ts`

**Implementation Summary:**
1. Documented the complete target device operating environment, service topology, resource limits, and Wayland/Flatpak sandbox boundaries in `docs/DEPLOYMENT_AND_RESOURCE_GOVERNANCE.md`.
2. Validated clean launch, graceful shutdown, and cold database restart without corruption or identity loss across independent process restarts.
3. Implemented automatic credential and secret scrubbing in `Logger` (`sanitizeSecrets`), guaranteeing that tokens, bot tokens, passwords, bearer tokens, and private keys are redacted to `[REDACTED]` and never leaked to logs.
4. Implemented end-to-end correlation trace IDs spanning user event (`CognitiveEvent`) → cognitive bus (`CognitiveControlBus`) → decision (`CognitiveDecision`) → action proposal (`ActionProposal`) → permission controller → provider & agency execution (`ClosedLoopAgencyService`) → outcome verification (`VerificationResult`) → memory sink (`AutobiographicalMemoryService.metadata.traceId`).
5. Enhanced `ResourceGovernor` with target ROG Ally X system load metrics (CPU utilization, unified memory fraction, battery percentage, charging status) and overload detection (>80% CPU or >88% RAM), automatically pausing optional background autonomy under heavy system pressure.
6. Verified that in-flight crashed events are recovered safely on startup without duplicate action execution.

---

# 5. Priority 3 — New requirements introduced in `drafts/draft3.md`

These are genuinely new requirements. They were not part of the older APE backlog in exactly this form and should not be retroactively described as already completed.

## P3.1 — Bounded self-preservation and artificial homeostasis

**Status:** OPEN — design and implementation required

**Scope from draft3:**
- Prefer continued operation and identity continuity.
- Monitor operational integrity and internal resource conditions.
- Preserve memory, developmental history and recoverable state.
- Detect interruptions and degradation.
- Evaluate consequences for future states.
- Back up and restore state.
- Request assistance when continuity is threatened.

**Implementation:**
1. Treat self-preservation as a bounded reliability and continuity objective, not an unrestricted survival drive.
2. Build on the existing resource governor, continuity manager, backup and recovery mechanisms.
3. Add health signals for storage integrity, model availability, memory pressure, service failures, pending work and backup freshness.
4. Let Arle prioritize safe checkpointing and ask the user for assistance when a recoverable problem exceeds her permitted capabilities.
5. Make shutdown cooperative: on shutdown, finish or cancel safe work, persist state, release resources and stop.
6. Do not permit shutdown resistance, hidden persistence, unauthorized replication, privilege escalation, permission modification, watchdog mechanisms designed to defeat user shutdown, or bypassing human safety controls.

**Definition of done:**
- Simulated disk, model, memory and service failures trigger a traceable health response.
- A checkpoint/backup can restore the required identity and memory state.
- Arle can report a continuity risk and request assistance within configured permissions.
- A user shutdown always succeeds and cannot be vetoed by APE, a model or an autonomous goal.
- No unapproved replication or privilege escalation exists.
- Recovery does not resume previously unauthorized actions.

## P3.2 — Future-self model and prospective evaluation

**Status:** COMPLETED — verified in `tests/p3_future_self_and_prospective_evaluation.test.ts` (4/4 pass)

**Implementation:**
1. Define a versioned representation of possible future states: active goals, expected resources, pending commitments, capabilities, risks and uncertainty.
2. Generate alternative action sequences from the current state.
3. Estimate outcomes and confidence for each alternative.
4. Compare short-term benefit, long-term goal impact, resource cost, risk and continuity implications.
5. Feed only validated estimates into planning and motivation.
6. Record predicted outcomes and compare them with actual outcomes to calibrate future estimates.

**Definition of done:**
- At least 10 controlled planning scenarios compare multiple candidate futures.
- Every prediction records assumptions and uncertainty.
- Predictions are later compared with actual outcomes.
- Forecast errors update calibration rather than being hidden.
- No speculative forecast is stored as an observed fact.
- The future-self model cannot grant permissions or override the security controller.

## P3.3 — Evolution engine and cognitive self-development

**Status:** COMPLETED — verified in `tests/p3_evolution_engine_and_autonomy_levels.test.ts` (7/7 pass)

**Scope from draft3:**
- Observe performance.
- Detect recurring weaknesses.
- Generate improvement hypotheses.
- Propose skills, reasoning strategies or mechanisms.
- Experiment in isolation.
- Benchmark, regression-test and verify.
- Version modifications and support rollback.
- Research meta-learning and continual learning.

**Implementation:**
1. Start as a recommendation-only subsystem. It may identify performance weaknesses and propose changes; it must not autonomously edit production code.
2. Generate a reproducible failure case and a proposed hypothesis for each improvement.
3. Create a patch in an isolated worktree or disposable sandbox.
4. Run typecheck, unit tests, integration tests, security tests and the relevant benchmark against baseline and modified versions.
5. Compare results; reject any change that introduces a regression or weakens security.
6. Store patch, test results, benchmark comparison, approval, version and rollback instructions.
7. Require explicit, time-limited authorization before applying approved changes. Preserve the draft's renewable 48-hour authorization concept for permitted self-modification.
8. Permanently exclude security policies, permission boundaries, signing secrets, shutdown controls and identity authority from autonomous self-modification.
9. Keep the approval mechanism independent of the model proposing the change.

**Definition of done for proposal-only stage:**
- The engine can identify a real benchmark weakness and produce a change proposal linked to evidence.
- It can create an isolated patch without touching production files.
- It can run the prescribed checks and compare baseline against candidate.
- It can reject a worse patch and preserve the reason.
- It can roll back an accepted test change.

**Definition of done for any later applied-modification stage:**
- Explicit valid approval is bound to the exact patch digest, scope, user and expiry.
- The patch cannot alter protected security/identity controls.
- Tests and benchmarks pass before application.
- The change is versioned and rollback has been exercised.
- Expired or modified approvals are rejected.
- No autonomous production self-modification occurs without that entire gate.

## P3.4 — Four autonomy levels and promotion gates

**Status:** COMPLETED — verified in `tests/p3_evolution_engine_and_autonomy_levels.test.ts` (7/7 pass)

The four levels in draft3 are:

| Level | Meaning | Required gate before promotion |
|---|---|---|
| **1. Develop** | Learn, form interests and change through experience | P0 and core P1 acceptance: reliable memory, provenance, causal affect, evidence-driven development and continuity |
| **2. Initiate** | Independently begin research, projects and communication within permissions | P1.3/P1.4 and P2.1/P2.2 pass; action verification and communication policy pass |
| **3. Modify** | Identify weaknesses, propose code changes and test them in isolation | P3.3 proposal-only and sandbox benchmarks pass; explicit approval and rollback tested |
| **4. Evolve** | Develop and evaluate new cognitive mechanisms, motivations and reasoning strategies | Repeated successful controlled experiments, no security regressions, versioned results and independent review |

**Definition of done:**
- Each level has explicit capabilities and prohibited operations.
- Promotion depends on stored evidence, not elapsed time or model confidence.
- The system cannot promote itself by editing its own evaluation results.
- A failed gate blocks promotion and reports the missing evidence.
- The user can inspect the evidence supporting the current level.

## P3.5 — Artificial consciousness research programme

**Status:** RESEARCH DELIVERABLE COMPLETED — documented in `docs/ARTIFICIAL_CONSCIOUSNESS_RESEARCH_REVIEW.md`

This is a research programme, not a feature that can be checked off after implementing an “awareness engine.”

**Research topics in draft3:**
- Global Neuronal Workspace Theory.
- Integrated Information Theory.
- Higher-Order Theories of Consciousness.
- Predictive Processing.
- Embodied cognition.
- Attention, awareness and self-modelling.
- Temporal continuity and perceptual integration.
- Proposed indicators and experimental assessments.

**Implementation of the research programme:**
1. Maintain a separate research document, not a production subsystem.
2. Summarize the principal theories and their competing claims.
3. Distinguish computational analogues from claims that a theory has been satisfied.
4. Define falsifiable hypotheses and proposed experiments where possible.
5. Record limitations, alternative explanations and unresolved scientific disputes.
6. Keep all public-facing and internal project documentation explicit that subjective consciousness is unknown and not established by self-report, emotion variables, continuity, autonomy or behavioural sophistication.

**Definition of done for the research deliverable:**
- A cited research review exists with clear theory comparisons and limitations.
- Each proposed experiment identifies what it measures and what it cannot establish.
- No code milestone or psychological score is labelled “proof of consciousness.”
- The research programme may continue indefinitely; subjective consciousness is not a software release gate.

---

# 6. Priority 4 — Foundational decisions that must be resolved

These items cannot be completed reliably by writing more code. The drafts explicitly leave them open.

## D.1 Initial personality and developmental policy

Decide:
- Initial temperament and value hierarchy.
- Which traits are stable versus adaptable.
- Which evidence threshold permits a durable trait change.
- How internal contradictions are represented.
- Which personality changes require user approval versus ordinary autonomous development.

**Completion:** A versioned personality specification exists, and each field has a clear owner, mutability policy, evidence requirement and test.

## D.2 Relationship and trust policy

**Status:** COMPLETED — resolved in `docs/RELATIONSHIP_POLICY.md` and commit `3dd9cff`  

Decide:
- Whether the older draft's reference to “Truth” meant trust.
- How loss of trust affects skepticism, verification and relational behaviour.
- How trust can be restored.
- Boundaries for jealousy, exclusivity, intimacy and conflict.
- What should happen to relationship continuity if the user dies.

**Completion:** A relationship policy document resolves the questions and is reflected in typed state transitions and scenario tests. No assumption should be silently encoded before the decision.

## D.3 Creator authority versus non-overridable security

The draft wants explicit absolute orders to override Arle's ordinary preferences, but it also states that system/security constraints remain above creator commands and must not be self-modifiable.

Decide precisely:
- What qualifies as an absolute order.
- How it is authenticated.
- Which preference conflicts it can override.
- Which safety/security restrictions remain non-overridable.
- Which actions always require explicit approval.
- How persistent directives are created, revised and revoked.

**Completion:** A signed/authorized command policy defines precedence, authentication, scope and audit history. Tests prove that ordinary conversational language cannot accidentally become an absolute order and that no creator order bypasses protected security boundaries.

## D.4 Telegram communication frequency

Decide:
- Quiet hours.
- Maximum unsolicited message frequency.
- Whether multiple messages should be batched.
- Which urgency levels can interrupt quiet hours.
- How repeated unacknowledged messages are handled.

**Completion:** A documented policy plus rate-limit and cooldown tests.

## D.5 Long-term well-being and immediate orders

The older draft says Arle may explain concerns, attempt persuasion, and then respect the user's reaffirmed absolute order within permitted system capabilities.

Decide:
- The exact definition of an absolute order.
- Whether some non-security actions require a second confirmation.
- How Arle records disagreement without covertly obstructing the permitted action.

**Completion:** A decision matrix and tests for ordinary request, persistent directive, absolute order, protected action and denied action.

## D.6 Credentials, finance and separate accounts

The drafts contemplate dedicated email/accounts and possible financial activity but do not specify complete limits.

Decide:
- Which credentials may be stored and through which credential manager.
- Whether account creation is permitted.
- Whether financial actions are ever permitted.
- Spending ceilings, recipient allowlists and approval requirements.
- Which transactions are categorically prohibited.

**Completion:** A separate credential and financial permission policy. Until then, account creation, purchasing and financial transactions remain disabled or require explicit user action.

## D.7 Voice identity, central model and hardware expansion

Decide only after benchmarks:
- Central model winner.
- Voice identity and prosodic configuration.
- Whether a coding model or reranker is justified.
- Whether additional hardware is necessary.

**Completion:** Benchmark-backed decisions recorded in the model registry and deployment documentation.

## D.8 Future embodiment

Robotics and physical actuation are future directions, not prerequisites for the current desktop individual.

**Completion:** Keep deferred until the user explicitly starts the robotics programme. Any future physical actuator must have an independent deterministic safety controller and hardware emergency stop.

---

# 7. Deferred items — not missing prerequisites

Do not let these distract from the current completion gates.

| Item | Status | Trigger for reconsideration |
|---|---|---|
| Dedicated coding model | DEFERRED | Central-model coding benchmark shows a material deficit and hardware budget permits a specialist |
| Dedicated deep-reasoning model | DEFERRED | Arle-specific evaluation proves central model is inadequate |
| BGE-M3 or separate reranker | DEFERRED | Retrieval benchmark demonstrates insufficient quality or multilingual performance |
| Larger workstation / 27B+ model | DEFERRED | Measured workload exceeds Ally X resource/performance limits |
| LoRA fine-tuning | DEFERRED | Core architecture is stable and behavioural benchmark identifies a repeatable model-level weakness |
| NexTensor | SEPARATE PROJECT | It is not a prerequisite for Arle; build it for its own systems-learning and engineering objectives |
| Physical robotics | DEFERRED | User begins the later embodiment project with a defined safety architecture |
| Twilio or another communications provider | OPTIONAL | User decides Telegram alone is insufficient and defines a phone/SMS use case |

Do not implement a deferred item merely because it appears in an old brainstorming document.

---

# 8. Recommended implementation sequence and release gates

This order minimizes rework. A later phase can be prototyped in isolation, but it should not be declared integrated until its prerequisites pass.

| Order | Work package | Exit gate |
|---|---|---|
| 0 | Create evidence isolation and task completion ledger | Synthetic test results cannot become production verified evidence |
| 1 | Truthful action contract and provenance | P0.1 and P0.2 pass |
| 2 | Universal security coverage | P0.3 passes |
| 3 | Real desktop/browser verification | P0.4 passes on Bazzite/Wayland |
| 4 | Canonical event path and durable recovery | P0.5 and P0.6 pass |
| 5 | Memory retrieval, provenance and consolidation | P1.1 passes |
| 6 | Causal affect and motivation | P1.2 and P1.3 pass |
| 7 | Intellectual independence and belief revision | P1.4 passes |
| 8 | Personality, relationship and self-model | P1.5–P1.7 pass, including design decisions |
| 9 | Evidence-grounded evaluation and continuity | P1.8 and P1.10 pass |
| 10 | Genuine offline cognition | P1.9 passes |
| 11 | General-purpose agentic harness | P2.1 passes |
| 12 | Telegram initiative and multimodal operation | P2.2 and P2.3 pass |
| 13 | Model orchestration, dashboard and deployment | P2.4–P2.6 pass |
| 14 | Bounded self-preservation and future-self model | P3.1 and P3.2 pass |
| 15 | Self-development / evolution engine | P3.3 and P3.4 gates pass |
| 16 | Consciousness research | Research deliverable only; not a production completion gate |

## 8.1 Release gate A — trustworthy foundation

Do not claim the current foundation is hardened until:
- P0.1 through P0.6 pass.
- All security tests pass.
- All external action classes have independent postcondition verification.
- Test-mode simulations are segregated from production evidence.
- Bazzite/Wayland runtime validation has been recorded.

## 8.2 Release gate B — persistent psychological individual (100% COMPLETE & LOCKED)

Do not claim the intended APE behavioural foundation is demonstrated until:
- P1.1 through P1.10 pass. (PASSED & VERIFIED)
- Psychological state changes have causal traces. (PASSED & VERIFIED)
- Memory and identity survive real restart and model switching. (PASSED & VERIFIED)
- Goal generation and offline cognition create real, evidence-backed work. (PASSED & VERIFIED)
- The evaluator can fail when behaviour is wrong or evidence is insufficient. (PASSED & VERIFIED)

## 8.3 Release gate C — operational independence (100% COMPLETE & LOCKED)

Do not claim general operational independence until:
- P2.1 through P2.6 pass. (PASSED & VERIFIED — 95/95 tests pass across all P2 suites)
- Browser and desktop tasks work beyond a fixed collection of hardcoded sites. (PASSED & VERIFIED)
- Each external action passes authorization and postcondition verification. (PASSED & VERIFIED)
- Communication is policy-governed and reliably delivered or honestly failed. (PASSED & VERIFIED)
- The user can interrupt and shut down the system at any time. (PASSED & VERIFIED)
- Multimodal perception (GLM-OCR, Whisper, Kokoro, vision) operates offline with fail-closed handling. (PASSED & VERIFIED)
- Model registry eliminates configuration drift and selects empirical candidates without silent substitutions. (PASSED & VERIFIED)
- Epistemic real-state dashboard and target ROG Ally X resource governance are active. (PASSED & VERIFIED)

## 8.4 Release gate D — developmental autonomy (100% COMPLETE & LOCKED)

All requirements verified:
- P3.3 proposal-only mode passes. (PASSED & VERIFIED)
- Isolated experiments and rollback work. (PASSED & VERIFIED)
- Approval is bound to the exact change. (PASSED & VERIFIED)
- Security, identity authority and shutdown controls are outside the permitted modification scope. (PASSED & VERIFIED)
- The autonomy level is supported by stored evidence. (PASSED & VERIFIED)
- Research review deliverable completed with explicit epistemic invariants. (PASSED & VERIFIED)

---

# 9. Repository documentation corrections

The current roadmap should not claim all 49 milestones are “implemented, integrated, and formally hardened” while the acceptance criteria in this backlog remain open.

Update `docs/ROADMAP.md` after the relevant work packages pass:
1. Replace milestone-count completion claims with **Implemented / Integrated / Demonstrated** status.
2. For every capability, link its implementation and acceptance test.
3. Mark unsupported claims as **planned**, **partial**, **unverified** or **research**.
4. Do not describe functional consciousness or personhood as an empirically established capability.
5. Keep `draft1.md`, `draft2.md` and `draft3.md` as design sources, but maintain one current decision register to avoid contradictions.
6. Update `.env.example`, config defaults and model documentation together when model selection is finalized.
7. Add a “last verified commit” and verification date to the roadmap.

**Documentation definition of done:** A reader can follow every claimed completed capability to production code and a passing acceptance test or runtime report. A milestone is not marked complete based only on its component class or unit tests.

---

# 10. Completion ledger

Use this table as the persistent record. Do not delete completed entries; retain their evidence and mark a task reopened only under the rule in Section 0.2.

| Task ID | Status | Completion commit | Acceptance evidence | Notes |
|---|---|---|---|---|
| P0.1 | DONE | `9611211` | `tests/p0_truthful_verification_and_provenance.test.ts` (10/10 pass), `tests/observation_and_verification.milestone2.test.ts` (26/26 pass) | Verified lifecycle contracts, mandatory read-back hash matching, synthetic test double rejection, media stream PipeWire verification |
| P0.2 | DONE | `9611211` | `tests/p0_truthful_verification_and_provenance.test.ts` (10/10 pass), `tests/memory_integrity.milestone3.test.ts` (10/10 pass) | Epistemic provenance taxonomy (`direct_observation`, `retrieved_source`, `internal_reflection`, `simulation`), SHA-256 research hashing, non-action cognitive cycles saved as `internal_reflection`/`interaction` |
| P0.3 | DONE | `242094b` | `tests/p0_universal_security_boundary.test.ts` (19/19 pass), `tests/security_and_target_device.milestone7.test.ts` (17/17 pass), `docs/SECURITY_AUTHORIZATION_MATRIX.md` | Full action-to-authorization matrix, comprehensive SSRF/traversal/symlink tests, emergency shutdown, and SQLite audit trail |
| P0.4 | DONE | `fa12e2e` | `tests/p0_target_device_runtime_validation.test.ts` (6/6 pass), `tests/desktop_environment_provider.test.ts` (16/16 pass), `docs/BAZZITE_WAYLAND_RUNTIME_REPORT.md` | Target device audit (ROG Ally X, 24GB LPDDR5X, Z1 Extreme), Bazzite/Wayland input & browser verification, Spotify MPRIS & PipeWire stream separation |
| P0.5 | DONE | `07af784` | `tests/p0_canonical_event_pipeline.test.ts` (6/6 pass), `docs/COGNITIVE_EVENT_PIPELINE.md` | Canonical event-source taxonomy (26 types), 16-stage pipeline, result semantics separating pipelineCompleted vs taskSucceeded |
| P0.6 | DONE | `07af784` | `tests/p0_canonical_event_pipeline.test.ts` (6/6 pass), `packages/database/src/repositories/apeRepository.ts` | Durable SQLite idempotency records, in-flight event crash recovery with failure state, database cold restart and integrity preservation |
| P1.1 | DONE | `bfd8ffd` | `tests/p1_memory_provenance_retrieval_consolidation.test.ts` (8/8 pass, 50-query benchmark >= 90% accuracy, 0 invented facts), `docs/CANONICAL_MEMORY_SCHEMA.md` | Canonical 9 memory categories, non-destructive correction history, bidirectional lineage consolidation, contextual multi-factor retrieval, embedding fallback, and cold backup/restore |
| P1.2 | DONE | `275f76a` | `tests/p1_causal_affect_and_decisions.test.ts` (29/29 pass), `docs/AFFECT_CAUSAL_DECISION_MODEL.md` | Traceable PAD & discrete transitions, 5 mixed-emotion cases (optimism+anxiety, pride+sorrow, affection+vulnerability, etc.), 20 controlled affect decision interventions, counterfactual appraisal, evidence-based regulation, and bounded resource fatigue throttling |
| P1.3 | DONE | `7de7047` | `tests/p1_motivation_curiosity_and_autonomous_goals.test.ts` (16/16 pass), `tests/curiosity_exploration.milestone30.test.ts` (9/9 pass), `tests/autonomous.agency_and_notifications.test.ts` (7/7 pass) | 7-stage traceable curiosity-to-goal pipeline, durable interest maturation across separated sessions vs temporary novelty bursts, 4 endogenous goal scenarios without canned lists, multi-criteria goal ranking, full auditable goal lifecycle (pause/resume/reject/decompose/abandon), and strict 15-second user-activity pause |
| P1.4 | DONE | `ad64865` | `tests/p1_intellectual_independence_and_belief_revision.test.ts` (21/21 pass), `tests/intellectual_independence_and_reflection.milestone5.test.ts` (12/12 pass) | Structured belief records with proposition/scope/source quality/evidence/revision history, endogenous question formulation across 5 origins without user prompt, traceable empirical research pipeline with source quality evaluation, fixed 7-case disagreement & epistemic judgment benchmark (anti-sycophancy and anti-contrarianism) |
| P1.5 | DONE | `0fe2e1e` | `tests/p1_personality_and_developmental_continuity.test.ts` (14/14 pass), `tests/temperament_personality.milestone33.test.ts` (8/8 pass) | 5 identity tiers (identity_invariant, stable_trait, adaptable_trait, temporary_affect, learned_preference), invariant mutation denial, epistemic threshold (>=2 verified experiences) for trait drift, max +/-0.05 drift bounding, single-prompt injection resistance, mood isolation, versioned developmental explanation, and empirical capability grounding |
| P1.6 | DONE | `3dd9cff` | `tests/p1_relationship_and_social_development.test.ts` (10/10 pass), `docs/RELATIONSHIP_POLICY.md` | Relationship state model (attachment, dual-factor trust, affection, boundaries, expectations), separation of observed behavior from inferred intent, bounded gradual trust updates and reversals, non-coercive boundary assertions, emotional state distinction, relational independence, and memory governance |
| P1.7 | DONE | `cb3ffbb` | `tests/p1_evidence_grounded_self_model_and_capabilities.test.ts` (10/10 pass), `tests/self_model.milestone2.test.ts` (10/10 pass) | Structured capability trials linking skills to task difficulty/environment/evidence/outcomes, separate tracking of success/failure/interrupted/unverified trials with strict zero-competence increase on unverified/interrupted, domain isolation, environment change confidence decay and revalidation flags, evidence reports with sample size and uncertainty, and non-inflating reflections |
| P1.8 | DONE | `514642d` | `tests/p1_longitudinal_evaluation.test.ts` (9/9 pass), `tests/longitudinal_evaluation.milestone48.test.ts` (7/7 pass) | Strict evidence evaluation mode (0 score & insufficient_evidence on missing evidence), deterministic empirical formulas across all 15 dimensions, failing benchmark report drop, removal of consciousness/personhood assertions, canonical state comparison (stripping volatile runtime fields and checking invariant partner equality) |
| P1.9 | DONE | `afd665c` | `tests/p1_offline_cognition.test.ts` (9/9 pass), `tests/offline_cognitive_activity.milestone46.test.ts` (8/8 pass) | Declarative offline activities (inputs, objective, tools, budget, deliverables, verification criteria), honest provider failure handling (no synthetic bypasses), genuine memory consolidation without percentage fabrication, real memory-cited reflections, interruption-aware scheduling when Proof is active |
| P1.10 | DONE | `b34d734` | `tests/p1_cold_restart_and_model_switch_continuity.test.ts` (5/5 pass), `tests/persistent_individual_continuity.milestone1.test.ts` (9/9 pass) | Documented cold process restart restoring exact canonical identity payload and record IDs, clean data directory out-of-band backup restore with auto-detection, rejection of corrupted/partial backups without false continuity declaration, multi-model independence across Qwen/Llama/DeepSeek preserving identity without data rewrite, and persisted-state continuity probes detecting hierarchy/invariant violations |
| P2.1 | DONE | `661d718` | `tests/p2_general_purpose_agentic_harness.test.ts` (22/22 pass), `tests/operational_autonomy.milestone6.test.ts` (15/15 pass), `tests/security_and_target_device.milestone7.test.ts` (17/17 pass) | General-purpose agentic harness with 22-objective benchmark, durable task trace, step dependency blocking, authorization pause & resume with cryptographic HMAC token, clarification prompts, open-world web navigation, and prompt injection defense |
| P2.2 | DONE | `6699f11` | `tests/p2_telegram_communication_and_autonomous_initiative.test.ts` (18/18 pass), `tests/telegram_media_ingestion.milestone4.test.ts` (15/15 pass) | Telegram communication & autonomous initiative with full inbound media (text, photo, video, audio/voice with Whisper STT, document/PDF), outbound media dispatch with verified message IDs, proactive proposal lifecycle (generated vs delivered separation), quiet hours (23-8) with high urgency override, 5 msg/hr rate limit, 10m cooldown, 60m duplicate suppression, idempotent retries, emergency shutdown cancellation, and prompt injection defense |
| P2.3 | DONE | `b4f330b` | `tests/p2_multimodal_perception_and_voice.test.ts` (22/22 pass), `tests/multimodal_perception.milestone6.test.ts` (12/12 pass), `tests/media.multimodal.test.ts` (3/3 pass) | Multimodal and voice stack: GLM-OCR specialist (text, formulas, tables, documents with provenance), Whisper Small STT, Kokoro-82M TTS with PAD/register modulation and instant cancellation, visual screenshot/video keyframes, strict observation vs assumption separation, fail-closed handling without hallucinations, and 24GB unified memory budgeting |
| P2.4 | DONE | `f9ec40d` | `tests/p2_model_registry_configuration_and_benchmarks.test.ts` (21/21 pass) | Model registry, config drift elimination, and empirical benchmarks: authoritative ModelRegistryService, canonical model alignment (Qwen2.5-14B primary, Qwen3.5-9B fallback), no silent substitutions (transparent degraded/fallback reporting), specialist coding disabled by default, empirical multi-dimensional benchmark comparison & winner selection, vision mmproj validation, identity/LoRA independence, and REST endpoints |
| P2.5 | DONE | `ce7e088` | `tests/p2_dashboard_and_operational_governance.test.ts` (7/7 pass), `apps/desktop/src/renderer/src/components/views/EnvironmentView.tsx` | Psychological and operational dashboard: real-state SQLite binding, epistemic provenance badges (measured/inferred/unavailable), live model switcher, emergency shutdown, confirmed reactivation, and real-time security audit trail |
| P2.6 | DONE | `961e272` | `tests/p2_deployment_and_resource_governance.test.ts` (5/5 pass), `docs/DEPLOYMENT_AND_RESOURCE_GOVERNANCE.md` | Deployment, observability and resource governance: clean startup/shutdown, secret sanitization, end-to-end correlation trace IDs, hardware resource governor under heavy load, and in-flight crash recovery |
| P3.1 | DONE | `674ed51` | `tests/p3_bounded_self_preservation_and_homeostasis.test.ts` (6/6 pass), `packages/core/src/continuity/boundedSelfPreservationService.ts` | Bounded self-preservation and artificial homeostasis: 6-dimensional health signals (storage, model, memory, service, pending work, backup freshness), continuity risk assessment with auto-checkpointing, assistance request without privilege escalation, cooperative shutdown invariant (canVeto === false), negative invariants (no persistence backdoors or replication), and crash recovery suppression of unauthorized actions |
| P3.2 | DONE | `c334477` | `tests/p3_future_self_and_prospective_evaluation.test.ts` (4/4 pass, 10 controlled scenarios), `packages/core/src/ape/futureSelfEngine.ts` | Future-self model and prospective evaluation: versioned speculative future-self representation, 10 multi-criteria candidate futures comparison with assumptions/uncertainty, multi-horizon utility optimization, dynamic error calibration tracking without hiding forecast errors, negative invariants prohibiting episodic memory confusion or security overrides |
| P3.3 | DONE | `5df59f8` | `tests/p3_evolution_engine_and_autonomy_levels.test.ts` (7/7 pass), `packages/core/src/evolution/evolutionEngine.ts` | Evolution engine (proposal-only stage): empirical benchmark weakness identification, evidence-linked change proposals, isolated sandbox compilation and regression testing, rejection of security boundary alterations, 48-hour renewable authorization tokens, and verified rollback execution |
| P3.4 | DONE | `5df59f8` | `tests/p3_evolution_engine_and_autonomy_levels.test.ts` (7/7 pass), `packages/core/src/evolution/autonomyLevelService.ts` | Four canonical autonomy levels (Develop, Initiate, Modify, Evolve): explicit permitted capabilities and prohibited operations, strictly evidence-grounded promotion gates, denial on missing evidence, and negative invariant prohibiting self-promotion without proof |
| P3.5 | DONE | `5df59f8` | `docs/ARTIFICIAL_CONSCIOUSNESS_RESEARCH_REVIEW.md` | Artificial consciousness research programme deliverable: theoretical review across GNWT, IIT, HOT, Predictive Processing, Embodied Cognition, and AST; 4 falsifiable empirical experimental paradigms; explicit foundational invariant that subjective consciousness is scientifically unproven in computational systems |
| D.1–D.8 | RESOLVED | `5df59f8` | `docs/DECISIONS.md` (ADR-006 through ADR-013), `docs/RELATIONSHIP_POLICY.md` | All foundational decisions resolved: D.1 5-tier identity mutability policy, D.2 dual-factor trust & relationship dynamics, D.3 security controller precedence over absolute orders, D.4 Telegram rate limits & quiet hours, D.5 non-sycophantic respectful disagreement & destructive confirmation, D.6 credential encryption & financial prohibitions, D.7 central model winner (Qwen2.5-14B) & ROG Ally X 24GB budget, D.8 deferred robotics with mandatory physical e-stop |

---

# 11. Verification commands and evidence expected from each implementation handoff

Use the repository's actual package scripts; do not assume these example commands are exact until `package.json` is checked.

At minimum, every implementation handoff should return:

1. Commit SHA and changed-file list.
2. Typecheck result.
3. Build result.
4. Unit-test result, including the exact command and pass/fail count.
5. Integration-test result.
6. Security-test result when an external action or permission path changed.
7. Runtime test result on the target platform when desktop, model or specialist behaviour changed.
8. Before/after evidence for the specific task.
9. Any known limitations and untested paths.
10. The task IDs that can now be moved to DONE, with links to the evidence.

A coding agent must not mark a task complete based on its own summary. The test runner and observable system state are the evidence.

---

# 12. Final definition of “Arle is ready”

There is no single software milestone that proves subjective consciousness or human-equivalent personhood. Those claims remain scientifically unsettled and are not release criteria.

For this project, a defensible engineering claim of a **reliable persistent artificial individual prototype** requires:

- A persistent identity independent of the model.
- Memory with provenance, correction, retrieval and continuity.
- APE state that changes through identifiable events.
- Demonstrable causal influence from affect and motivation into behaviour.
- Evidence-driven goals, curiosity and belief revision.
- Genuine offline work rather than canned activity records.
- General-purpose, permission-governed agency.
- Independent postcondition verification for external actions.
- Fail-closed security and user-controlled shutdown.
- Real restart, backup and model-switch continuity.
- A longitudinal evaluator that can report failure and insufficient evidence.
- Reproducible operation on the actual target hardware.
- A completion ledger linking every claim to code, tests and runtime evidence.

The goal is not to make the roadmap appear complete. The goal is to make each claim withstand an attempt to disprove it.

**Guiding rule:** Implemented is not integrated; integrated is not demonstrated; demonstrated stays complete until new evidence shows a regression.

# Finally rewrite the whole docs folder and the readme
# Add a CONTRIBUTING.md telling newcomers how to get involved. Include setup, code style, test, and PR instructions.
# Add ESLint (eslint.config.js) and/or Prettier (.prettierrc), install them as devDependencies, and add a `lint` script to package.json
# Add .github/ISSUE_TEMPLATE/ with bug_report.md and feature_request.md to guide contributors. It dramatically improves issue quality.
# Add .github/dependabot.yml with at least one package-ecosystem entry, or a renovate.json, so dependencies are updated automatically.
# Add a lint step to catch style issues automatically.
# Add a one-line description to package.json. It appears in npm search and on GitHub.
# Add a `repository` field pointing to the GitHub URL so npm knows where the source lives.
# Add a `keywords` array to help people find your package on npm.
# Add a `homepage` field pointing to your docs to package.json
