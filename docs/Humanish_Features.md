# Human-like Features in Arletex

This document describes all 20 enhancements made to bring Arletex's APE (Artificial Psychology Engine) closer to human-like behaviour.

## Status Overview

| #   | Feature                                                                           | Status  |
| --- | --------------------------------------------------------------------------------- | ------- |
| 1   | SymPy math validation                                                             | ✅ Done |
| 2   | `InMemoryApeRepository` with 290 emotion entries                                  | ✅ Done |
| 3   | Fixed import paths in test files                                                  | ✅ Done |
| 4   | Mock Llama server: `http` import + `Server` type                                  | ✅ Done |
| 5   | Mock Llama server port configurable via `MOCK_LLAMA_PORT`                         | ✅ Done |
| 6   | `npm run test:human` script                                                       | ✅ Done |
| 7   | `EmotionModel` – dynamic, persistent, mutable taxonomy                            | ✅ Done |
| 8   | Mutable emotion taxonomy via `EmotionModel.addEmotion` / `removeEmotion`          | ✅ Done |
| 9   | `emotionTemplates.ts` refactored to delegate to `EmotionModel`                    | ✅ Done |
| 10  | `formatMath.ts` – stochastic phrasing (random intro phrase + ±5 threshold jitter) | ✅ Done |
| 11  | `SelfModelEngine` – persistent trait scores + rolling utterance log               | ✅ Done |
| 12  | Simple learning hook: `adjustTraitScore(trait, delta)` after interactions         | ✅ Done |
| 13  | `AudioPerceptionService` stub sensor                                              | ✅ Done |
| 14  | `VisionService` stub sensor                                                       | ✅ Done |
| 15  | Randomness: emotion intensity jitter (±5%) in `EmotionModel.getEmotion`           | ✅ Done |
| 16  | Randomness: response phrasing variation in `formatMath`                           | ✅ Done |
| 17  | Persistent `data/self_model_state.json` (created on startup)                      | ✅ Done |
| 18  | Persistent `data/emotions.json` (seeded then kept up-to-date)                     | ✅ Done |
| 19  | EADDRINUSE-safe mock server (graceful port-in-use handling)                       | ✅ Done |
| 20  | Documentation (`SymPy_Integration.md` + this file)                                | ✅ Done |

---

## Feature Details

### 1–5 — Infrastructure fixes

See [SymPy_Integration.md](./SymPy_Integration.md).

### 6 — `test:human` npm script

```bash
pnpm run test:human
# equivalent to: MOCK_LLAMA_PORT=8081 vitest run
```

Ensures the mock Llama server binds on port **8081** (not 8080) so it never collides with a real llama-server running locally.

### 7–9 — Dynamic EmotionModel

**File:** `packages/core/src/ape/emotionModel.ts`

The `EmotionModel` class:

- Loads emotions from `data/emotions.json` on first use, seeding with 8 built-in templates.
- Exposes `addEmotion()`, `removeEmotion()`, and `adjustIntensity()` for runtime mutation.
- Applies a ±5 % stochastic jitter to `intensity` on every call to `getEmotion()`.
- Persists all changes back to `data/emotions.json` automatically.

```ts
import { emotionModel } from '@arletex/core';

// Add a brand-new emotion at runtime
emotionModel.addEmotion({
  name: 'awe',
  prefix: 'Wide-eyed wonder. Speak with reverence and genuine amazement.',
  intensity: 0.7,
});

// Modulate an existing emotion's baseline intensity
emotionModel.adjustIntensity('rage', -0.1); // cool it down a bit

// Look up with jitter
const tpl = emotionModel.getEmotion('awe');
console.log(tpl?.intensity); // slightly different every call
```

`emotionTemplates.ts` now acts as a thin adapter over `EmotionModel`, keeping backward compatibility via a `Proxy`-backed `EMOTION_TEMPLATES` constant.

### 10 — Stochastic language (`formatMath.ts`)

`formatMath` now:

1. Randomly prepends one of 6 intro phrases ("Here's the math:", "Let me show you:", etc.) — or nothing, 1/6 of the time.
2. Chooses inline (`$...$`) vs block (`$$...$$`) based on a **jittered threshold** (30 ± 5 chars) rather than a fixed 30-char rule.

This means two calls with the same input can produce different output — just like a human would vary their phrasing.

### 11–12 — Persistent self-model & learning hook

**File:** `packages/core/src/ape/selfModelEngine.ts` (augmented — original API preserved)

Three new methods added to the existing `SelfModelEngine`:

| Method                           | Purpose                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `addUtterance(text)`             | Append to rolling 50-utterance log; persisted in `data/self_model_state.json` |
| `adjustTraitScore(trait, delta)` | RL-placeholder: increment/decrement a named trait score                       |
| `getTraitScore(trait)`           | Read the current score for a trait                                            |
| `getRecentUtterances()`          | Return the last ≤50 utterances                                                |

Usage example (call after each successful interaction):

```ts
ape.selfModelEngine.addUtterance(response);
ape.selfModelEngine.adjustTraitScore('helpfulness', +1);
```

### 13–14 — Embodiment sensor stubs

| File                                              | Description                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/core/src/ape/audioPerceptionService.ts` | Returns random `volume`, `pitch`, `sentiment`                               |
| `packages/core/src/ape/visionService.ts`          | Returns random `brightness`, `dominantColor`, `motionDetected`, `faceCount` |

These stubs can be wired into `ApeService` or any emotion-modulation pipeline. When a future real sensor (microphone, camera) is integrated, replace the random values with actual I/O.

```ts
import { AudioPerceptionService } from '@arletex/core';
const audio = new AudioPerceptionService();
const frame = audio.perceive();
// { volume: 0.72, pitch: 183.5, sentiment: 'tense' }
```

### 15–16 — Randomness / stochasticity

| Location                  | Randomness added                        |
| ------------------------- | --------------------------------------- |
| `EmotionModel.getEmotion` | ±5 % intensity jitter per call          |
| `formatMath`              | Random intro phrase + ±5 char threshold |

> [!TIP]
> For deterministic tests, temporarily mock `Math.random` with a fixed seed before calling these functions:
>
> ```ts
> vi.spyOn(Math, 'random').mockReturnValue(0.5);
> ```

### 17–18 — Persistent JSON state

| File                         | Contents                                      |
| ---------------------------- | --------------------------------------------- |
| `data/self_model_state.json` | `{ traitScores: {…}, recentUtterances: […] }` |
| `data/emotions.json`         | Array of `EmotionEntry` objects               |

Both files are created automatically if missing.

> [!CAUTION]
> Do **not** delete `data/self_model_state.json` between sessions if you want trait scores to persist across restarts — that is the entire point of this feature.

### 19 — EADDRINUSE-safe mock server

`tests/setup/mockLlamaServer.ts` now:

- Accepts any port as a parameter.
- Silently resolves (instead of crashing) if `EADDRINUSE` is returned, assuming another instance of the mock is already running.
- Is started from `mockLlamaServerSetup.ts` using `MOCK_LLAMA_PORT` env var (default: 8081).

---

## Running the tests

```bash
# Standard (uses MOCK_LLAMA_PORT=8081 automatically)
pnpm run test:human

# Or manually
MOCK_LLAMA_PORT=8081 pnpm test
```

## File Map

```
packages/core/src/
├── ape/
│   ├── emotionModel.ts          ← NEW: dynamic emotion taxonomy
│   ├── audioPerceptionService.ts ← NEW: audio sensor stub
│   ├── visionService.ts          ← NEW: vision sensor stub
│   └── selfModelEngine.ts        ← AUGMENTED: +trait scores, utterances, persistence
└── utils/
    ├── emotionTemplates.ts       ← REFACTORED: delegates to EmotionModel
    └── formatMath.ts             ← AUGMENTED: stochastic phrasing

data/
├── self_model_state.json         ← CREATED: persistent self-model state
└── emotions.json                 ← CREATED: persistent emotion taxonomy

docs/
├── SymPy_Integration.md          ← existing
└── Humanish_Features.md          ← this file
```
