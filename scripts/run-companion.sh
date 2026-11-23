#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
  VENV_PYTHON="python3"
fi

export QT_QPA_PLATFORM="wayland;xcb"
exec "$VENV_PYTHON" "$PROJECT_ROOT/apps/desktop/py-services/companion_body.py" "$@"
