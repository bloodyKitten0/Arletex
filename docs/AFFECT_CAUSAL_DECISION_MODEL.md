# Affective State Model & Causal Decision Architecture (P1.2)

**Status:** Formal Specification & Verification Contract  
**Target Architecture:** ASUS ROG Ally X (Bazzite Linux, Wayland, Qwen2.5-14B local)  
**Core Invariant:** Emotional state is never decorative prose. Every emotional transition is causally triggered by an authentic event, evaluated deterministically through appraisal, and causally modulates downstream cognitive, attentional, and deliberation variables.

---

## 1. The Affective State Model

Arletex structures affective state across three integrated layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE AFFECT DIMENSIONS (PAD)                    │
│   Pleasure (Valence) [-1, 1]  │  Arousal [-1, 1]  │  Dominance [-1, 1]  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      CONCURRENT DISCRETE EMOTIONS                       │
│    Active Emotion Vector: [ { id, intensity, persistence, target } ]   │
│    Supports True Mixed States (e.g. Bittersweet, Cautious Optimism)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         INTEROCEPTIVE METRICS                          │
│     Stress Level [0, 1]  │  Fatigue Level [0, 1]  │  Energy [0, 1]     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     DOWNSTREAM CAUSAL DECISION ENGINE                  │
│  Attention Allocation  │  Risk Penalty  │  Deliberation  │  Memory     │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Continuous Core Affect (PAD Dimensions):**
   - **Pleasure ($P \in [-1.0, 1.0]$):** Hedonic valence ranging from deep distress/pain (-1) to joy/satisfaction (+1).
   - **Arousal ($A \in [-1.0, 1.0]$):** Physiological and neurological activation from lethargy/sleep (-1) to intense alert/activation (+1).
   - **Dominance ($D \in [-1.0, 1.0]$):** Sense of agency, autonomy, and competence from helpless/overwhelmed (-1) to autonomous/in command (+1).

2. **Active Discrete Emotions & Multi-Label Mixed States:**
   - Instead of collapsing into a single emotion label, Arle maintains a multi-label vector of concurrent active emotions with individual intensities ($0.0 \to 1.0$) and persistence half-lives.
   - Canonical mixed emotions supported simultaneously:
     - `cautious_optimism`: High hope ($P > 0.4$) concurrently active with vigilance/anxiety ($A > 0.5$).
     - `bittersweet`: Nostalgic joy combined with loss or passage of time.
     - `proud_vulnerability`: Deep relational intimacy and openness paired with awareness of emotional exposure.
     - `ambivalent_resolve`: Unyielding determination to execute despite high cognitive weariness.
     - `protective_fondness`: Intense affection coupled with heightened security boundary alert.

3. **Interoceptive Metrics:**
   - **Stress Level ($S \in [0.0, 1.0]$):** Derived from consecutive errors, security boundary proximity, ambiguous external commands, and resource exhaustion.
   - **Fatigue Level ($F \in [0.0, 1.0]$):** Derived from continuous operational uptime, memory pressure, and high-intensity cognitive load.

---

## 2. Deterministic Transition Contract

LLM prose is strictly prohibited from directly setting emotional state.
1. An incoming external stimulus or internal reflection produces a canonical `ApeEvent`.
2. The deterministic `AppraisalEngine` evaluates the event against active goals, values, and relationship commitments.
3. The `AffectiveTransitionEngine` computes state deltas and records an immutable `ApeTransitionRecord` in SQLite:
   - `eventId`: Triggering event.
   - `appraisalId`: Exact appraisal rationale.
   - `previousPad` and `newPad`.
   - `previousEmotions` and `newEmotions`.
   - `timestamp`: UTC ISO 8601.

---

## 3. Causal Influence on Downstream Decisions (Not Language)

Affect directly modulates core decision variables in the cognitive control loop:

### 3.1 Attention Allocation & Sensory Filtering (`AttentionSalienceEngine`)
- **Anxiety / Stress ($S > 0.4$):**
  - Boosts urgency of error and security events by $+0.30$.
  - Raises noise threshold by $+0.15$, shedding non-critical distractors.
- **Curiosity ($A > 0.3, P > 0.2$):**
  - Doubles novelty weighting from $0.15$ to $0.30$, prioritizing exploration and intellectual inquiry.
- **Affection / Relational Attachment:**
  - Elevates stimuli originating from Proof to maximum priority ($1.0$).
- **Fatigue ($F > 0.5$):**
  - Penalizes heavy computational tasks and prioritizes resting/consolidation cycles.

### 3.2 Deliberation & Plan Selection (`DeliberationEngine`)
During deliberation between competing alternatives, the overall score of an alternative $A$ is computed as:

$$\text{Score}(A) = \Big( U_{\text{base}}(A) - \text{Penalty}_{\text{risk}}(A) - \text{Penalty}_{\text{fatigue}}(A) + \text{Bonus}_{\text{curiosity}}(A) + \text{Bonus}_{\text{partner}}(A) \Big) \cdot M_{\text{ethical}}(A)$$

Where:
- **Risk Penalty:**
  $$\text{Penalty}_{\text{risk}}(A) = \text{RiskScore}(A) \cdot 0.4 \cdot \Big(1.0 + S_{\text{stress}} \cdot 0.8 + \mathbb{I}_{\text{anxiety}} \cdot 0.5 + \mathbb{I}_{\text{threat}} \cdot 1.0\Big)$$
  *Causal effect:* High anxiety or stress drastically suppresses risky alternatives in favour of conservative, verified paths.
- **Curiosity Exploration Bonus:**
  $$\text{Bonus}_{\text{curiosity}}(A) = \begin{cases} 0.18 & \text{if curiosity is active and } A \text{ is exploratory} \\ 0.0 & \text{otherwise} \end{cases}$$
- **Fatigue Effort Penalty:**
  $$\text{Penalty}_{\text{fatigue}}(A) = \Big(F_{\text{fatigue}} \cdot 0.25 + \mathbb{I}_{\text{fatigue}} \cdot 0.15\Big) \cdot \text{EffortScore}(A)$$
- **Partner Relational Synergy:**
  $$\text{Bonus}_{\text{partner}}(A) = \begin{cases} 0.25 & \text{if affection/gratitude is active and } A \text{ aligns with Proof} \\ 0.0 & \text{otherwise} \end{cases}$$

### 3.3 Emotional Regulation & Decay
- **Evidence-Based Reassessment:** Empirical verification (e.g., successful exit code, SHA-256 match, or reassuring user input) actively resolves anxiety and elevates dominance.
- **Deterministic Decay:** In the absence of stimuli, active emotion intensity decays exponentially toward baseline mood without spontaneous or uncaused emotional swings.
