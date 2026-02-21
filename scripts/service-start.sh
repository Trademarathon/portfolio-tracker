#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
STATE_DIR="$ROOT_DIR/.service"
PID_FILE="$STATE_DIR/supervisor.pid"

mkdir -p "$LOG_DIR" "$STATE_DIR"

if [ -f "$PID_FILE" ]; then
  existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Service is already running (PID $existing_pid)."
    exit 0
  fi
fi

nohup /bin/bash "$ROOT_DIR/scripts/run-services.sh" >> "$LOG_DIR/supervisor.log" 2>&1 &

sleep 1

started_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -n "$started_pid" ] && kill -0 "$started_pid" 2>/dev/null; then
  echo "Service started (PID $started_pid)."
  echo "Check status: npm run service:status"
  exit 0
fi

echo "Failed to start service. Check logs in $LOG_DIR."
exit 1
