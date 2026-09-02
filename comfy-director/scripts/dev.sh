#!/usr/bin/env bash
# Avvio di sviluppo per Linux/macOS (equivalente ai .bat per Windows, usato anche per
# verificare l'avvio end-to-end in ambienti non Windows). Avvia Bridge (uvicorn --reload
# su :8787) e frontend (vite dev su :5173) in parallelo.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/apps/bridge"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -e ".[dev]"
[ -f .env ] || cp .env.example .env

echo "[Comfy Director] Avvio il Bridge su http://127.0.0.1:8787 ..."
uvicorn bridge.main:app --host 127.0.0.1 --port 8787 --reload &
BRIDGE_PID=$!

cd "$ROOT_DIR/apps/frontend"
[ -d node_modules ] || npm install

echo "[Comfy Director] Avvio il frontend su http://127.0.0.1:5173 ..."
npm run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

trap 'kill "$BRIDGE_PID" "$FRONTEND_PID" 2>/dev/null' EXIT INT TERM
wait
