#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

MODEL_PATH="${1:-${ARLETEX_MODEL_PATH:-${HOME}/models/qwen-14b-abliterated/Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M.gguf}}"
PORT="${2:-8080}"
HOST="127.0.0.1"
THREADS="8"

if [ -z "${N_GPU_LAYERS:-}" ]; then
  if [[ "$MODEL_PATH" == *"14B"* ]] || [[ "$MODEL_PATH" == *"14b"* ]]; then
    N_GPU_LAYERS="36"
    CTX_SIZE="8192"
  elif [[ "$MODEL_PATH" == *"9B"* ]] || [[ "$MODEL_PATH" == *"9b"* ]]; then
    N_GPU_LAYERS="28"
    CTX_SIZE="4096"
  else
    N_GPU_LAYERS="28"
    CTX_SIZE="4096"
  fi
else
  CTX_SIZE="${CTX_SIZE:-4096}"
fi

LLAMA_SERVER="/home/linuxbrew/.linuxbrew/bin/llama-server"

if [ ! -f "$LLAMA_SERVER" ]; then
  if command -v llama-server >/dev/null 2>&1; then
    LLAMA_SERVER="$(command -v llama-server)"
  else
    echo "ERROR: llama-server executable not found."
    exit 1
  fi
fi

if [ ! -f "$MODEL_PATH" ]; then
  echo "ERROR: Model file not found at: $MODEL_PATH"
  exit 1
fi

echo "=========================================================="
echo " Starting Arletex Local Inference (llama-server)"
echo " Binary:    $LLAMA_SERVER"
echo " Model:     $MODEL_PATH"
echo " Host/Port: $HOST:$PORT"
echo " Context:   $CTX_SIZE"
echo " Offload:   Vulkan (ngl: $N_GPU_LAYERS)"
echo " Threads:   $THREADS"
echo "=========================================================="

MMPROJ_PATH="${MMPROJ_PATH:-}"
if [ -z "$MMPROJ_PATH" ] && [[ "$MODEL_PATH" == *"9B"* ]]; then
  DEFAULT_MMPROJ="${HOME}/models/qwen-heretic/Qwen3.5-9B-mmproj-BF16.gguf"
  if [ -f "$DEFAULT_MMPROJ" ]; then
    MMPROJ_PATH="$DEFAULT_MMPROJ"
  fi
fi

EXTRA_ARGS=()
if [ -n "$MMPROJ_PATH" ] && [ -f "$MMPROJ_PATH" ]; then
  echo " Multimodal: $MMPROJ_PATH"
  EXTRA_ARGS+=(--mmproj "$MMPROJ_PATH")
fi

LORA_PATH="${LORA_PATH:-}"
if [ -z "$LORA_PATH" ] && [ -f "$PROJECT_DIR/models/lora/medicine_specialist/adapter_model.gguf" ]; then
  LORA_PATH="$PROJECT_DIR/models/lora/medicine_specialist/adapter_model.gguf"
fi

if [ -n "$LORA_PATH" ] && [ -f "$LORA_PATH" ] && [[ "$LORA_PATH" == *".gguf" ]]; then
  echo " LoRA Adapter: $LORA_PATH"
  EXTRA_ARGS+=(--lora "$LORA_PATH")
fi

exec "$LLAMA_SERVER" \
  -m "$MODEL_PATH" \
  "${EXTRA_ARGS[@]}" \
  --host "$HOST" \
  --port "$PORT" \
  -c "$CTX_SIZE" \
  --parallel 1 \
  -t "$THREADS" \
  -ngl "$N_GPU_LAYERS"
