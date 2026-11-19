#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo " Arletex Clean-Install Environment & Prerequisite Audit"
echo " Target Architecture: Linux (Bazzite / Fedora / Ubuntu)"
echo " Target Device:       ASUS ROG Ally X (or compatible x86_64)"
echo "=========================================================="

FAILED=0
warn() {
  echo -e "\e[33m[WARN]\e[0m $1"
}
ok() {
  echo -e "\e[32m[OK]\e[0m $1"
}
err() {
  echo -e "\e[31m[FAIL]\e[0m $1"
  FAILED=1
}

# 1. System toolchain
echo ""
echo "--- 1. Build & Toolchain Prerequisites ---"
for cmd in git bash curl make cmake; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "Found tool: $cmd ($(command -v "$cmd"))"
  else
    err "Missing build tool: $cmd"
  fi
done

if command -v g++ >/dev/null 2>&1 || command -v clang++ >/dev/null 2>&1; then
  ok "C++ compiler available ($(command -v g++ || command -v clang++))"
else
  err "No C++ compiler found (g++ or clang++ required for native reflex engine)"
fi

# 2. Node.js & pnpm
echo ""
echo "--- 2. Node.js & Workspace Package Manager ---"
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "Node.js version $NODE_VER (>= 20)"
  else
    err "Node.js version $NODE_VER is older than required (>= 20)"
  fi
else
  err "Node.js is not installed"
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM_VER=$(pnpm -v)
  ok "pnpm version $PNPM_VER available"
else
  err "pnpm is not installed (install via corepack or npm i -g pnpm)"
fi

# 3. Python environment
echo ""
echo "--- 3. Python Specialist Environment ---"
PYTHON_BIN=""
if [ -x ".venv/bin/python" ]; then
  PYTHON_BIN=".venv/bin/python"
elif [ -x ".venv/bin/python3" ]; then
  PYTHON_BIN=".venv/bin/python3"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
fi

if [ -n "$PYTHON_BIN" ]; then
  PY_VER=$("$PYTHON_BIN" -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
  ok "Python executable found: $PYTHON_BIN (Python $PY_VER)"
else
  err "Python 3 is not found. Python >= 3.10 required for specialist ML sidecars"
fi

# 4. Vulkan & Graphics Acceleration
echo ""
echo "--- 4. Graphics & Vulkan Acceleration ---"
if command -v vulkaninfo >/dev/null 2>&1; then
  ok "Vulkan diagnostic tool (vulkaninfo) present"
elif command -v vkcube >/dev/null 2>&1; then
  ok "Vulkan tools found"
else
  warn "vulkaninfo not found in PATH; verify GPU Vulkan drivers are installed"
fi

# 5. Display Server & Wayland Tools
echo ""
echo "--- 5. Wayland Desktop Integration Tools ---"
SESSION_TYPE="${XDG_SESSION_TYPE:-unknown}"
echo "Current XDG_SESSION_TYPE: $SESSION_TYPE"
if [ "$SESSION_TYPE" = "wayland" ]; then
  ok "Running under native Wayland session"
else
  warn "Session is '$SESSION_TYPE'. Target ROG Ally X runs KDE Plasma Wayland"
fi

for tool in spectacle grim ydotool wtype wl-copy; do
  if command -v "$tool" >/dev/null 2>&1; then
    ok "Found desktop tool: $tool"
  else
    warn "Optional desktop tool not found: $tool (Wayland screen capture/input may use fallback)"
  fi
done

# 6. Specialist Models Directory
echo ""
echo "--- 6. Specialist Model Storage Check ---"
MODELS_DIR="${ARLETEX_SPECIALISTS_DIR:-${HOME}/models/arle-specialists}"
echo "Checked specialists directory: $MODELS_DIR"
if [ -d "$MODELS_DIR" ]; then
  ok "Specialists directory exists"
else
  warn "Specialists directory does not exist yet. Run model setup before starting specialist server"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "=========================================================="
  echo -e "\e[32m Environment check passed! All core prerequisites met.\e[0m"
  echo " To build the project:  pnpm run build"
  echo " To run test suite:     pnpm test"
  echo " To start application:  ./scripts/run-arletex.sh"
  echo "=========================================================="
  exit 0
else
  echo "=========================================================="
  echo -e "\e[31m Environment check failed. Please install missing prerequisites above.\e[0m"
  echo "=========================================================="
  exit 1
fi
