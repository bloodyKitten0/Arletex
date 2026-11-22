#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

PORT="${LLAMA_PORT:-8080}"
SPECIALIST_PORT="${ARLETEX_SPECIALISTS_PORT:-39282}"
MODEL_PATH="${1:-${ARLETEX_MODEL_PATH:-${HOME}/models/qwen-heretic/Qwen3.5-9B-Heretic-Q4_K_M.gguf}}"

echo "=========================================================="
echo " Starting Arletex (Arle Artificial Individual)"
echo " Cognitive Engine:    Qwen 3.5-9B Heretic (Multimodal Vision)"
echo " Cognitive Port:      $PORT (Vulkan on Radeon 780M)"
echo " Specialist Services: EmbeddingGemma, Whisper, Kokoro"
echo " Specialist Port:     $SPECIALIST_PORT"
echo " UI Specification:    v0.2 (6 Primary Sections + Telemetry)"
echo " Device Profile:      ASUS ROG Ally X (24GB Unified LPDDR5X)"
echo "=========================================================="

# 1. Start llama-server if not already running
if ! curl -s "http://127.0.0.1:$PORT/v1/models" >/dev/null 2>&1; then
  echo "Starting llama-server Vulkan inference engine..."
  ./scripts/start-llama-server.sh "$MODEL_PATH" "$PORT" >/tmp/arletex-llama.log 2>&1 &
  LLAMA_PID=$!

  cleanup() {
    echo ""
    echo "Stopping Arletex and releasing memory..."
    "$PROJECT_DIR/scripts/stop-llama.sh" "$PORT" 2>/dev/null || true
    if [ -n "${SPECIALISTS_PID:-}" ]; then
      kill "$SPECIALISTS_PID" 2>/dev/null || true
    fi
    exit 0
  }
  trap cleanup INT TERM EXIT

  echo "Waiting for inference engine to come online..."
  for i in {1..30}; do
    if curl -s "http://127.0.0.1:$PORT/v1/models" >/dev/null 2>&1; then
      echo "Vulkan engine is online and ready!"
      break
    fi
    sleep 1
  done
else
  echo "Cognitive inference engine is already online on port $PORT."
  cleanup() {
    exit 0
  }
  trap cleanup INT TERM EXIT
fi

# 2. Start specialist ML services if not already running
if ! curl -s "http://127.0.0.1:$SPECIALIST_PORT/health" >/dev/null 2>&1; then
  echo "Starting Specialist ML Services on port $SPECIALIST_PORT..."
  PYTHON_BIN="${PYTHON_BIN:-}"
  if [ -z "$PYTHON_BIN" ]; then
    if [ -x "$PROJECT_DIR/.venv/bin/python" ]; then
      PYTHON_BIN="$PROJECT_DIR/.venv/bin/python"
    elif [ -x "$PROJECT_DIR/.venv/bin/python3" ]; then
      PYTHON_BIN="$PROJECT_DIR/.venv/bin/python3"
    elif command -v python3 >/dev/null 2>&1; then
      PYTHON_BIN="$(command -v python3)"
    else
      PYTHON_BIN="python"
    fi
  fi
  "$PYTHON_BIN" apps/desktop/py-services/specialists_server.py "$SPECIALIST_PORT" >/tmp/arletex-specialists.log 2>&1 &
  SPECIALISTS_PID=$!
  echo "Waiting for specialist services to come online..."
  for i in {1..20}; do
    if curl -s "http://127.0.0.1:$SPECIALIST_PORT/health" >/dev/null 2>&1; then
      echo "Specialist ML services online and ready!"
      break
    fi
    sleep 1
  done
else
  echo "Specialist ML services already online on port $SPECIALIST_PORT."
fi

# 3. Launch the Electron Desktop application
echo "Building latest distribution (native C++ engine + core + packages + desktop)..."
pnpm run build

echo "Opening Arletex Desktop App..."
pnpm start
