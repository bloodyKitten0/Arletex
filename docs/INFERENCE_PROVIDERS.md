# Inference Providers & Specialist Services in Arletex

Arletex is designed with strict **model-runtime agnosticism**. Arle is a persistent artificial individual whose identity, psychology (APE), relationship models, and autobiographical memories exist outside of any specific language model. Local inference engines are treated as stateless, replaceable cognitive execution services.

Arletex coordinates two distinct inference layers:

1. **Language Inference Gateway:** Local LLM engines for dialogue, reasoning, appraisal, and reflection.
2. **Specialist Services Server:** Dedicated local neural models for embedding, speech-to-text, text-to-speech, and visual OCR.

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
                                                    │ - Kokoro 82M + RVC (TTS)│
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

3. **Kokoro 82M + RVC (Voice Synthesis & Conversion):**
   - Generates natural speech audio from assistant responses.
   - Passes synthetic audio through a local Retrieval-based Voice Conversion model to produce Arle's consistent vocal timbre.
   - Endpoint: `POST /synthesize`

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
