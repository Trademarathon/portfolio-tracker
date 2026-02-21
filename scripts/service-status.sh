#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.service"
PID_FILE="$STATE_DIR/supervisor.pid"

status="stopped"

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    status="running (PID $pid)"
  fi
fi

echo "Supervisor: $status"

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Web (port 3000): listening"
else
  echo "Web (port 3000): not listening"
fi

if lsof -nP -iTCP:35821 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "API (port 35821): listening"
else
  echo "API (port 35821): not listening"
fi
