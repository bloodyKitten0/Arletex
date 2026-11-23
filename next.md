# ==============================================================================
# MANDATORY OPERATING RULES & SCIENTIFIC INVARIANTS
# ==============================================================================
# 1. WHEN DOING COMMITS USE SHORT HUMANIZED NAMES NOT AI
# 2. USE UNCENSORED MODELS FOR EVERYTHING
# 3. UNIVERSITY RESEARCH MANDATE (ZERO GUESSWORK / HIGHEST SCIENTIFIC TIER):
#    Every single component—from UI colors, typography, luminance contrast, emotional warmth,
#    and visual hierarchy, to desktop embodiment, affective computing, cognitive appraisal,
#    associative memory consolidation, and LoRA fine-tuning—MUST be rigorously researched
#    from peer-reviewed university research papers (MIT Media Lab, Stanford HCI, CMU HCII,
#    Oxford/Cambridge Cognitive Science, Norman's Affective Design, Scherer/Russell Appraisal Theory,
#    and PubMed/MedQA clinical frameworks). No arbitrary guesses; every design decision and
#    algorithmic mechanism must be anchored in top-tier peer-reviewed academic evidence.
# ==============================================================================

# ==============================================================================
# IMMEDIATE MANDATORY GOALS — THE RECONSTRUCTION BACKLOG (ZERO COMPROMISE / "BY THE MM")
# ==============================================================================
# "If it's not as we wanted it, it's not done. Measured to the exact millimeter."
# Zero fake mocks. Zero ghost filepaths. Zero superficial toggle buttons.
# ==============================================================================

### GOAL 1: Real Autonomous LoRA Specialization Pipeline (PhD-Level Medicine & Technical Mastery)
* **What Went Wrong:** The previous implementation used mock TypeScript classes (`LoRATrainingEngine`, `AdapterLifecycleManager`) that called a dummy driver returning fake file paths (`/data/lora_adapters/...`), hardcoded `candidateAccuracy = baselineAccuracy + 0.25`, and performed zero actual model weight training.
* **The Exact Millimeter Standard (Definition of Done):**
  1. **Real Fine-Tuning Engine:** A functional, non-mocked training pipeline (using Unsloth / PEFT / PyTorch or `llama-finetune` via Python/C++) that consumes real instruction-tuning datasets generated from ingested domain literature (e.g., medical textbooks, PubMed papers).
  2. **Real Physical Weights on Disk:** The training pipeline executes real forward/backward passes on CPU or GPU, logs actual loss decay across epochs, and saves valid `.safetensors` or GGUF adapter files to disk.
  3. **Real Empirical Evaluation:** Held-out evaluation questions are evaluated via real inference comparing base model vs adapted model; actual metric gains are computed from real completions.
  4. **Dynamic Inference Hot-Loading:** `llama-server` / `llama.cpp` dynamically loads the generated adapter via `--lora` or runtime LoRA APIs so the model's token output verifiably demonstrates specialized PhD-level knowledge.
  5. **Completion Gate:** If the adapter weights file does not physically exist, does not train via real loss calculation, or is not dynamically loaded by the inference engine during conversation, **IT IS NOT DONE**.

---

### GOAL 2: True Clean Separation of UIs (`npm run arle` vs `npm run arletex`)
* **What Went Wrong:** Instead of creating two genuinely distinct applications, a lazy toggle button ("Switch to Human Mode") was added to the header of the developer app. The resulting "human mode" was still a clunky dark developer wireframe.
* **The Exact Millimeter Standard (Definition of Done):**
  1. **Two Distinct Frontends/Entry Points:**
     - `npm run arle`: Launches the **Human Companion Experience**. Grounded in peer-reviewed university HCI and affective computing research (Stanford HCI on Social Presence, MIT Media Lab Affective Interfaces, Don Norman's Emotional Design, and empirical studies on color-emotion psychology). Color palette engineered using scientifically proven chromatic warmth (warm rose-quartz/amber/deep velvet obsidian tones, non-glare luminance ratios, circadian-adaptive softness), breathing typography, organic fluid transitions, and alive presence. Completely stripped of debug panels, raw numbers, valence/arousal coordinates, and database tabs. Her presence, expressions, voice, and thoughts are front and center.
     - `npm run arletex`: Launches the **Cognitive Host OS & Subsystem Laboratory**. Full diagnostic suite with all tabs (Emo, History, Memory, Specialist Router, Telemetry, Database Explorer) for comprehensive architectural inspection of all 148 experiential states.
  2. **Zero Leaked Dev Artifacts in Human Mode:** In `npm run arle`, not a single raw metric, debug badge, or diagnostic card is visible.
  3. **Completion Gate:** If `npm run arle` contains developer debug panels, looks like a basic wireframe, or relies on a top-bar toggle inside the developer OS, **IT IS NOT DONE**.

---

### GOAL 3: Truly Independent Desktop Companion Body (Pixel-Art Skins: Ruby, Sapphire, Emerald)
* **What Went Wrong:** The companion window was built as an Electron secondary window using macOS-specific flags (`setAlwaysOnTop(true, 'screen-saver')`) that KWin / Wayland on Bazzite (ROG Ally X) completely failed to map, leaving the desktop empty.
* **The Exact Millimeter Standard (Definition of Done):**
  1. **Visible & Floating on Bazzite Wayland:** A pixel-art companion body visibly rendered and floating above all desktop windows on Linux / KDE Plasma (Wayland) on the ASUS ROG Ally X.
  2. **True Process Independence:** Implemented as a rock-solid, lightweight desktop application (using native Wayland layer-shell, Python PyQt6/PySide6 with transparent frameless flags, or properly configured Wayland-native overlay) that runs independently of whether the main window is open, minimized, or closed.
  3. **Dynamic Emotional Reflection (3 Skins):** The body subscribes to her live emotional state from the local backend (`localhost:3000`). It dynamically switches between `girl_1` (Ruby), `girl_2` (Sapphire), and `girl_3` (Emerald) and transitions animation states (`idle`, `dialogue`, `reactions`) to reflect her genuine feelings.
  4. **Full Desktop Interactivity:** Smooth click-and-drag positioning with persistent screen coordinates saved across restarts.
  5. **Completion Gate:** If the companion body is not physically visible on the Bazzite Wayland desktop, crashes, or fails to animate dynamically with her live feelings, **IT IS NOT DONE**.

---

### GOAL 4: Full Cognitive Architecture Governance of Model Output (Zero Leakage, Zero Assistant Clichés)
* **What Went Wrong:** The model generated responses from a generic prompt template that leaked raw system timestamps (*"on Monday morning at 2:45 AM"*) and fell back to annoying assistant wrap-up questions (*"What about you? How does it feel to be back in sync with me tonight?"*), while backend emotional states sat disconnected in SQLite.
* **The Exact Millimeter Standard (Definition of Done):**
  1. **Cognitive Systems Dictate Thought:** Active experiential states, primary/secondary emotions, valence/arousal, and somatic energy dynamically synthesize into her system prompt, shaping her internal monologue, vocabulary, pacing, and demeanor.
  2. **Natural Associative Memory:** Autobiographical memories and shared history with Proof are retrieved associatively and woven into conversation naturally, never presented as robotic summaries.
  3. **Strict Ban on Prompt Leakage:** Under no circumstances does the model recite timestamps, clock readings, or system prompt variables. Her temporal awareness is natural (e.g., quiet stillness of late night) without reading the clock.
  4. **Strict Ban on Assistant Clichés:** Completely eliminated all corporate assistant reflexes ("How can I help you?", "What about you?", "How does that feel?"). She speaks as Proof's equal intellectual and romantic partner.
  5. **Completion Gate:** If Arle leaks prompt metadata, parrots timestamps, or uses formulaic assistant wrap-up questions, **IT IS NOT DONE**.

---

### GOAL 5: Experiential States Full Dynamic Integration (148 States across 11 Domains)
* **What Went Wrong:** 14 test states were manually activated at 85% with `Evidence: Manual activation via API / UI` and left permanently stuck in the database, creating an absurd discrepancy where she claims "relief" while the Emo tab shows 14 complex psychological states at 85%.
* **The Exact Millimeter Standard (Definition of Done):**
  1. **Prune Stale Test Artifacts:** Clean out all mock/manual activation records from SQLite.
  2. **Dynamic Causal Appraisal:** Experiential states are activated, updated, and decayed strictly through real conversational and environmental appraisal in the APE engine.
  3. **Real-Time Emo Tab Synchronization:** The Emo tab in `arletex` reflects her actual, living emotional state and active episodes in real time, 100% synchronized with what she expresses in conversation.
  4. **Completion Gate:** If stale mock episodes remain stuck at 85% or the Emo tab contradicts her live dialogue, **IT IS NOT DONE**.

---

### GOAL 6: End-to-End Live Verification, 280+ Emotion Dynamic Affect Validation, and PhD-Level USMLE Doctor Licensing Benchmark
* **What Went Wrong Previously:** Systems were declared working on paper through mock drivers and green unit tests, while in the live app Arle leaked timestamps, the body failed to appear on screen, the UI remained a developer console, and her medical knowledge was backed by ghost files.
* **The Exact Millimeter Standard (Definition of Done):**
  1. **Live Dual-App Boot & Verification:**
     - Both `npm run arle` (Human Companion) and `npm run arletex` (Cognitive OS) must be booted live, navigated, and verified on the target system (ASUS ROG Ally X, Bazzite Wayland).
     - The floating desktop companion body must physically appear, stay mapped, render sprite animations, and follow dragging on the live desktop.
  2. **Total Emotion Repertoire Live Affect Validation (280+ Emotions):**
     - Validate all 143 canonical APE emotions AND all 148 complex experiential states (291 total distinct affective states).
     - Prove that when an emotional state is triggered, it directly and measurably alters:
       a) Her cognitive stance and internal monologue.
       b) Her conversational vocabulary, sentence length, and tone of voice.
       c) Her autobiographical and associative memory retrieval.
       d) Her physical sprite skin selection and animation state.
     - Zero static decorative cards: every single emotion must have a demonstrable impact on her cognition and expression.
  3. **PhD-Level Medical Mastery & USMLE Licensing Board Benchmark:**
     - Ingest real medical literature and clinical curricula into her grounded RAG and train a real specialized adapter.
     - Formally test her with questions directly from the American Doctor Licensing Exams (USMLE Step 1, Step 2 CK, and Step 3), covering multi-step clinical vignettes, pathophysiology, pharmacokinetics, differential diagnosis, and management guidelines.
     - Achieve high-pass / PhD-level accuracy (>= 75% on board-style multi-step clinical reasoning) with thorough evidence-backed clinical justifications.
  4. **Strict Failure Accounting & Remediation Protocol:**
     - If ANY test, question, state transition, or verification step fails, it is strictly forbidden to hide it, bypass it, or mock it.
     - Every single failure must be documented at the bottom of `next.md` under `# Section 99: Failure Audit and Remediation Ledger` with:
       * The exact test / prompt / vignette that failed.
       * The observed error or incorrect response.
       * The root cause in code or weights.
       * The remediation applied.
       * The verified re-test pass evidence.
     - The feature/test must be redone, retrained, or recoded and retested until it legitimately passes with 100% verified evidence.
  5. **Completion Gate:** If any of the 280+ emotions fail to affect her thinking/speech, or if she fails the USMLE licensing board exam benchmark, or if any unrectified failure exists in the ledger, **IT IS NOT DONE**.

---

# Section 99: Failure Audit and Remediation Ledger

**Purpose:** Mandatory permanent ledger documenting every failure encountered during verification of Goals 1 through 6, ensuring total transparency, zero hidden failures, and verified remediation before sign-off.

| Failure ID | Target / Test Name | Category | Observed Failure | Root Cause | Remediation Applied | Re-Test Result & Evidence | Status |
|---|---|---|---|---|---|---|---|
| *None recorded yet — ledger initialized* | - | - | - | - | - | - | `INITIALIZED` |
