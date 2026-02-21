#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.service"
PID_FILE="$STATE_DIR/supervisor.pid"
API_LOOP_PID_FILE="$STATE_DIR/api-loop.pid"
WEB_LOOP_PID_FILE="$STATE_DIR/web-loop.pid"

stop_pid() {
  local pid="$1"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
}

stop_child_tree() {
  local parent="$1"
  if [ -z "$parent" ] || ! kill -0 "$parent" 2>/dev/null; then
    return
  fi

  local children
  children="$(pgrep -P "$parent" || true)"
  if [ -n "$children" ]; then
    for child in $children; do
      stop_child_tree "$child"
    done
    for child in $children; do
      stop_pid "$child"
    done
  fi
}

supervisor_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
api_loop_pid="$(cat "$API_LOOP_PID_FILE" 2>/dev/null || true)"
web_loop_pid="$(cat "$WEB_LOOP_PID_FILE" 2>/dev/null || true)"

if [ -z "$supervisor_pid" ] && [ -z "$api_loop_pid" ] && [ -z "$web_loop_pid" ]; then
  echo "Service is not running."
  exit 0
fi

stop_child_tree "$supervisor_pid"
stop_pid "$api_loop_pid"
stop_pid "$web_loop_pid"
stop_pid "$supervisor_pid"

for _ in {1..20}; do
  if [ -n "$supervisor_pid" ] && kill -0 "$supervisor_pid" 2>/dev/null; then
    sleep 0.25
    continue
  fi
  break
done

stop_pid "$api_loop_pid"
stop_pid "$web_loop_pid"
rm -f "$PID_FILE" "$API_LOOP_PID_FILE" "$WEB_LOOP_PID_FILE"

echo "Service stopped."
