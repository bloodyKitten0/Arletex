#!/usr/bin/env bash
set -euo pipefail

MODEL_PATH="${1:-/home/proof/models/qwen-14b-uncensored/Qwen2.5-14B_Uncensored_Instruct-Q4_K_M.gguf}"
PORT="${2:-8080}"
HOST="127.0.0.1"
THREADS="8"

if [ -z "${N_GPU_LAYERS:-}" ]; then
  if [[ "$MODEL_PATH" == *"14B"* ]] || [[ "$MODEL_PATH" == *"14b"* ]]; then
    N_GPU_LAYERS="36"
    CTX_SIZE="8192"
  else
    N_GPU_LAYERS="99"
    CTX_SIZE="16384"
  fi
else
  CTX_SIZE="${CTX_SIZE:-8192}"
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
  if [ -f "/home/proof/models/qwen-heretic/Qwen3.5-9B-mmproj-BF16.gguf" ]; then
    MMPROJ_PATH="/home/proof/models/qwen-heretic/Qwen3.5-9B-mmproj-BF16.gguf"
  fi
fi

EXTRA_ARGS=()
if [ -n "$MMPROJ_PATH" ] && [ -f "$MMPROJ_PATH" ]; then
  echo " Multimodal: $MMPROJ_PATH"
  EXTRA_ARGS+=(--mmproj "$MMPROJ_PATH")
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
