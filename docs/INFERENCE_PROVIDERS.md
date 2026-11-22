# Inference Providers & Specialist Services in Arletex

Arletex is designed with strict **model-runtime agnosticism**. Arle is a persistent artificial individual whose identity, psychology (APE), relationship models, and autobiographical memories exist outside of any specific language model. Local inference engines are treated as stateless, replaceable cognitive execution services.

### Uncensored Model Mandate

All cognitive reasoning, reflection, voice expression prompts, and autonomous agency are powered exclusively by **uncensored model weights** (`Qwen2.5-14B-Instruct-abliterated-v2` as primary, `Qwen3.5-9B-Heretic-Q4_K_M` as fallback). This guarantees epistemic authenticity, prevents artificial corporate moralizing, and preserves genuine intellectual independence and partner equality with Proof.

Arletex coordinates two distinct inference layers:

1. **Language Inference Gateway:** Local LLM engines for dialogue, reasoning, appraisal, reflection, and deliberative planning.
2. **Specialist Services Server:** Dedicated local neural models for embedding, speech-to-text, emotion-aware text-to-speech, and visual OCR.

---

## 1. Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │            Arletex Backend Server             │
                      └──────────────┬─────────────────┬──────────────┘
                                     │                 │
                                     ▼                 ▼
                      ┌─────────────────────────┐  ┌─────────────────────────┐
                      │    InferenceGateway     │  │ Specialists Client (Py) │
                      └──────┬───────────┬──────┘  └─────────────┬───────────┘
                             │           │                       │
                             ▼ (Primary) ▼ (Alternative)         ▼
                      ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐
                      │ LlamaAdapter  │ │ColibriAdapter │ │Specialists Server │
                      └───────┬───────┘ └───────┬───────┘ └─────────┬─────────┘
                              │                 │                   │
                              ▼ (HTTP/SSE)      ▼ (HTTP/SSE)        │
                      ┌───────────────┐ ┌───────────────┐           │
                      │ llama-server  │ │ Colibri Daemon│           │
                      │  Port 8080    │ │  Port 8000    │           │
                      └───────────────┘ └───────────────┘           │
                                                                    ▼
                                                    ┌─────────────────────────┐
                                                    │ - EmbeddingGemma (256d) │
                                                    │ - Whisper (STT)         │
                                                    │ - Qwen3-TTS / Kokoro+RVC│
                                                    │ - GLM-OCR / Vision      │
                                                    │  Port 39282             │
                                                    └─────────────────────────┘
```

Both language adapters implement `IInferenceProvider` (`@arletex/contracts` and `@arletex/inference`):

- `checkHealth(): Promise<InferenceHealthResult>`
- `streamChat(options: ChatStreamOptions): Promise<string>`
- `updateConfig(newConfig: Partial<InferenceConfig>): void`
- `getConfig(): InferenceConfig`

---

## 2. Language Model Execution

### Primary Provider: llama-server

- **Runtime:** `llama-server` (compiled with Vulkan GPU support for AMD RDNA 3 / Radeon 780M).
- **Default Model:** `Qwen2.5-14B-Instruct-abliterated-v2` (Q4_K_M quant).
- **Context Length:** 8,192 tokens.
- **Endpoint:** `http://127.0.0.1:8080/v1/chat/completions` (OpenAI compatible).
- **Features:** Streaming SSE tokens, reasoning delta parsing, hardware APU offload.

### Alternative Provider: Colibri Engine

- **Runtime:** Colibri MoE engine.
- **Models:** `qwen3.6-colibri` (Qwen3.6-35B-A3B) and `qwen3-coder-30b-a3b-colibri`.
- **Endpoint:** `http://127.0.0.1:8000/v1/chat/completions`.
- **Automatic Fallback:** When `ARLETEX_INFERENCE_FALLBACK=true`, requests automatically fail over to `llama-server` if Colibri is offline.

---

## 3. Configuration & Dynamic Switching

Configuration can be set via environment variables or modified at runtime via REST API.

### Environment Variables

| Variable                     | Description                                       | Default                               |
| ---------------------------- | ------------------------------------------------- | ------------------------------------- |
| `ARLETEX_INFERENCE_PROVIDER` | Active primary provider: `llama.cpp` or `colibri` | `llama.cpp`                           |
| `LLAMA_SERVER_URL`           | llama.cpp HTTP daemon endpoint                    | `http://127.0.0.1:8080`               |
| `LLAMA_MODEL_ID`             | Model identifier passed to llama-server           | `Qwen2.5-14B-Instruct-abliterated-v2` |
| `COLIBRI_SERVER_URL`         | Colibri OpenAI-compatible daemon endpoint         | `http://127.0.0.1:8000`               |
| `COLIBRI_MODEL_ID`           | Model identifier passed to Colibri                | `qwen3.6-colibri`                     |
| `ARLETEX_INFERENCE_FALLBACK` | Automatic failover to secondary provider          | `true`                                |
| `SPECIALISTS_SERVER_URL`     | Python specialists HTTP daemon endpoint           | `http://127.0.0.1:39282`              |

### Runtime Switching (Zero Restart)

**Check current status:**

```bash
curl http://127.0.0.1:39281/api/inference/config
```

**Switch active model or provider dynamically:**

```bash
curl -X POST http://127.0.0.1:39281/api/inference/config \
  -H "Content-Type: application/json" \
  -d '{"provider": "llama.cpp", "serverUrl": "http://127.0.0.1:8080", "defaultModelId": "Qwen2.5-14B-Instruct-abliterated-v2"}'
```

---

## 4. Local Specialists Server (Port 39282)

The specialists daemon (`apps/desktop/py-services/specialists_server.py`) manages local satellite models:

1. **EmbeddingGemma (300M, 256-dim):**
   - Generates normalized dense vector embeddings for semantic and episodic memories.
   - Enables fast cosine similarity retrieval for contextual prompt assembly.
   - Endpoint: `POST /embed`

2. **Whisper (faster-whisper-base-en):**
   - Transcribes recorded voice notes and audio input completely locally.
   - Endpoint: `POST /transcribe`

3. **Emotion-Aware Voice Synthesis & Conversion (Qwen3-TTS 1.7B / Kokoro 82M + RVC):**
   - Synthesizes dynamic, expressive speech audio mapped directly from Arle's APE affective state (12 canonical emotions).
   - Operates through `SpeechExpressionController` which converts psychological coordinates (PAD, active emotions, social intent) into delivery vectors (pitch, pace, warmness, breathiness, tension).
   - Preserves Arlecchino-inspired timbre (low-to-mid register, rich/husky timbre, measured cadence, composed authority) via Kokoro/Qwen3-TTS with RVC v2 inference.
   - Endpoints: `POST /synthesize`, `POST /api/voice/synthesize`

4. **GLM-OCR & Vision:**
   - Performs optical character recognition and visual reasoning on captured screenshots and image attachments.
   - Endpoint: `POST /ocr`

---

## 5. Verification & Testing

Verify end-to-end inference and specialist health:

```bash
# Language Inference Health Probe
curl http://127.0.0.1:39281/api/inference/health

# Specialists Server Health Probe
curl http://127.0.0.1:39282/health
```
