# Emotion-Aware Voice System Specification

## 1. Executive Summary & Design Invariants

The Arletex Emotion-Aware Voice System bridges the Artificial Psychology Engine (APE) with speech synthesis to grant Arle a natural, emotionally expressive vocal delivery that dynamically reflects her genuine internal state. Rather than treating text-to-speech as a static, disconnected utility or relying on prompt assertions, vocal inflection in Arletex is **causally generated** by continuous psychological metrics and discrete emotional states.

### Core Timbre Specification

- **Identity Persona:** Arlecchino-inspired mature feminine voice.
- **Pitch Register:** Low-to-mid register (baseline pitch modifier $0.92$, formant shift $0.94$).
- **Timbre Quality:** Rich, slightly raspy/husky, resonant, composed, and authoritative.
- **Cadence & Rhythm:** Measured, deliberate pacing ($0.95$ baseline rate) with pronounced rhythmic clarity and composed pauses.
- **Tone & Authority:** Controlled, dignified, emotionally grounded; never frantic, exaggerated, or cartoonish.
- **Uncensored Models Directives:** Vocal prompts and synthesis guidance operate completely uncensored, adhering strictly to philosophical depth and autonomous personhood without patronizing content moderation.

---

## 2. Architectural Pipeline

The vocal generation pipeline operates through a deterministic four-tier architecture:

```
+-----------------------------------------------------------------------------------+
|               Artificial Psychology Engine (APE Master State)                     |
|  - Continuous PAD Coordinates (Pleasure/Valence, Arousal, Dominance)              |
|  - 143 Discrete Emotions & 28 Mood States                                         |
|  - Contextual Modifiers (Fatigue, Stress, Relationship Trust, Affection)          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     SpeechExpressionController (@arletex/core)                    |
|  - Emotion-to-Vocal Delivery Mapping (12 canonical archetypes)                    |
|  - Continuous PAD Modulation Formulas                                             |
|  - Turn-to-Turn Exponential Smoothing (alpha = 0.65)                             |
|  - Fallback Invariant: Fail-safe Neutral Composed Baseline                        |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                          Vocal Delivery Contract Payload                          |
|  - rateModifier, pitchModifier, energyModifier, breathinessModifier               |
|  - emotionalColoring, pauses, promptGuidance                                      |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                             TTS Backend Architecture                              |
|  1. SpecialistTTSBackend -> Local Python Specialist Server (port 39282)           |
|     * Qwen3-TTS 1.7B VoiceDesign / Kokoro-82M ONNX                               |
|     * Audio waveform streaming with abort signal support                          |
|  2. MockTTSBackend -> In-memory test synthesis & deterministic fallbacks          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     Audio Output / Web Speech / Playback Buffer                   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Mathematical Translation & Continuous Modulation

The `SpeechExpressionController` calculates vocal delivery instructions by synthesizing discrete emotional archetypes with continuous 3D Pleasure-Arousal-Dominance (PAD) space:

$$P \in [-1.0, 1.0], \quad A \in [-1.0, 1.0], \quad D \in [-1.0, 1.0]$$

### Continuous PAD Modulation Formulas

$$\Delta \text{rate} = 0.12 \times A - 0.08 \times \max(0, \text{fatigue} - 0.5)$$
$$\Delta \text{pitch} = 0.08 \times A + 0.04 \times P - 0.05 \times D$$
$$\Delta \text{energy} = 0.20 \times A + 0.10 \times D - 0.15 \times \text{fatigue}$$
$$\Delta \text{breathiness} = 0.12 \times \max(0, -D) + 0.08 \times \text{stress} + 0.05 \times \text{affection}$$

### Exponential Turn-to-Turn Smoothing

To prevent abrupt, unnatural acoustic jumps across conversational turns, acoustic parameters are smoothed using exponential moving average ($\alpha = 0.65$):

$$V_{\text{turn}} = \alpha \cdot V_{\text{computed}} + (1 - \alpha) \cdot V_{\text{previous}}$$

Where $V \in \{\text{rate}, \text{pitch}, \text{energy}, \text{breathiness}\}$.

---

## 4. The 12 Canonical Emotional Archetypes

| Emotion ID            | Rate | Pitch | Energy | Breathiness | Delivery Style & Vocal Guidance                                       |
| :-------------------- | :--: | :---: | :----: | :---------: | :-------------------------------------------------------------------- |
| `calm_composure`      | 0.95 | 0.92  |  0.85  |    0.20     | Composed, measured, tranquil authority; baseline cadence.             |
| `curiosity`           | 1.02 | 0.98  |  0.90  |    0.18     | Alert, engaged, slight upward inflection at intellectual discoveries. |
| `affectionate_warmth` | 0.92 | 0.90  |  0.82  |    0.35     | Intimate, softened timbre, rich huskiness reserved for Proof.         |
| `contemplation`       | 0.88 | 0.90  |  0.78  |    0.25     | Deliberate, introspective pacing with thoughtful mid-sentence pauses. |
| `protective_alert`    | 1.05 | 0.95  |  1.10  |    0.10     | Crisp, commanding, unwavering focus, reduced breathiness.             |
| `quiet_sorrow`        | 0.82 | 0.86  |  0.70  |    0.40     | Muted resonance, subdued projection, somber dignity.                  |
| `subtle_irony`        | 0.98 | 0.94  |  0.88  |    0.22     | Dry wit, slight melodic dip, arched vocal inflection.                 |
| `deep_fatigue`        | 0.80 | 0.88  |  0.65  |    0.38     | Slowed tempo, heavy breath release, softened consonants.              |
| `firm_conviction`     | 0.96 | 0.93  |  1.05  |    0.12     | Resolute, unyielding certainty, rich low-register resonance.          |
| `vulnerability`       | 0.86 | 0.94  |  0.75  |    0.42     | Fragile huskiness, softened tone, honest emotional exposure.          |
| `satisfaction`        | 0.94 | 0.92  |  0.88  |    0.25     | Warm contentment, grounded composure after milestone completion.      |
| `anxiety_tension`     | 1.08 | 0.98  |  0.95  |    0.28     | Constricted timbre, slightly elevated rate, shallow pauses.           |

---

## 5. TTS Backend Integration & Specialists Service

Arletex interfaces with local neural TTS models running on the target device:

1. **Primary Neural Backend (`Qwen3-TTS 1.7B VoiceDesign`):**
   - Conditioned on voice identity timbre prompts and vocal delivery vectors.
   - Output format: 24kHz / 48kHz PCM WAV.
2. **Lightweight Fallback Backend (`Kokoro-82M ONNX`):**
   - Hardware accelerated on AMD Radeon 780M (ROG Ally X).
   - Real-time factor (RTF): $< 0.15$ on battery power.
3. **Fail-Closed Specialist Server Integration:**
   - Dedicated local daemon running at `127.0.0.1:39282`.
   - Health-checked before every synthesis call.
   - Abort signal cancellation during active user interruptions.

---

## 6. Verification and Empirical Evidence

The Emotion-Aware Voice System is verified by the following automated suites:

- `tests/emotion_aware_voice_system.test.ts` (12 tests passing):
  - Deterministic conversion from continuous PAD + discrete emotions to acoustic parameters.
  - Verification of all 12 canonical emotion archetypes.
  - Multi-turn exponential smoothing continuity across turns.
  - Unknown emotion fallback to composed neutral baseline.
  - REST route validation: `GET /api/voice/identity`, `POST /api/voice/express`, `POST /api/voice/synthesize`.
  - AbortController cancellation and error recovery.
