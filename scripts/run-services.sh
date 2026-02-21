#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
STATE_DIR="$ROOT_DIR/.service"
SUPERVISOR_PID_FILE="$STATE_DIR/supervisor.pid"
API_LOOP_PID_FILE="$STATE_DIR/api-loop.pid"
WEB_LOOP_PID_FILE="$STATE_DIR/web-loop.pid"

mkdir -p "$LOG_DIR" "$STATE_DIR"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log() {
  printf "[%s] %s\n" "$(timestamp)" "$*"
}

resolve_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return
  fi

  if [ -x "/opt/homebrew/bin/npm" ]; then
    echo "/opt/homebrew/bin/npm"
    return
  fi

  if [ -x "/usr/local/bin/npm" ]; then
    echo "/usr/local/bin/npm"
    return
  fi

  return 1
}

NPM_BIN="$(resolve_npm || true)"
if [ -z "$NPM_BIN" ]; then
  log "npm not found. Install Node.js/npm first."
  exit 1
fi

WEB_MODE="${SERVICE_WEB_MODE:-prod}"
WEB_COMMAND=("$NPM_BIN" run start)

echo "$$" > "$SUPERVISOR_PID_FILE"

cleanup() {
  set +e
  log "Stopping background services..."
  if [ -n "${API_LOOP_PID:-}" ]; then
    kill "$API_LOOP_PID" 2>/dev/null || true
  fi
  if [ -n "${WEB_LOOP_PID:-}" ]; then
    kill "$WEB_LOOP_PID" 2>/dev/null || true
  fi

  if [ -n "${API_LOOP_PID:-}" ]; then
    wait "$API_LOOP_PID" 2>/dev/null || true
  fi
  if [ -n "${WEB_LOOP_PID:-}" ]; then
    wait "$WEB_LOOP_PID" 2>/dev/null || true
  fi

  rm -f "$API_LOOP_PID_FILE" "$WEB_LOOP_PID_FILE"
  if [ -f "$SUPERVISOR_PID_FILE" ] && [ "$(cat "$SUPERVISOR_PID_FILE" 2>/dev/null)" = "$$" ]; then
    rm -f "$SUPERVISOR_PID_FILE"
  fi
  set -e
}

trap cleanup INT TERM EXIT

if [ "$WEB_MODE" = "dev" ]; then
  WEB_COMMAND=("$NPM_BIN" run dev:next)
  log "SERVICE_WEB_MODE=dev. Using Next.js dev server."
elif [ ! -f "$ROOT_DIR/.next/BUILD_ID" ]; then
  log "No production build found. Running build first..."
  set +e
  (
    cd "$ROOT_DIR"
    "$NPM_BIN" run build >> "$LOG_DIR/build.log" 2>&1
  )
  build_exit=$?
  set -e
  if [ "$build_exit" -ne 0 ]; then
    WEB_COMMAND=("$NPM_BIN" run dev:next)
    log "Production build failed. Falling back to dev web mode."
  else
    log "Build completed."
  fi
fi

run_service_with_restart() {
  local service_name="$1"
  shift
  local out_log="$LOG_DIR/${service_name}.out.log"
  local err_log="$LOG_DIR/${service_name}.err.log"

  while true; do
    log "Starting ${service_name}..."
    set +e
    (
      cd "$ROOT_DIR"
      "$@" >> "$out_log" 2>> "$err_log"
    )
    local exit_code=$?
    set -e
    log "${service_name} exited with code ${exit_code}. Restarting in 3 seconds."
    sleep 3
  done
}

run_service_with_restart "api-server" "$NPM_BIN" run api-server &
API_LOOP_PID=$!
echo "$API_LOOP_PID" > "$API_LOOP_PID_FILE"

run_service_with_restart "web" "${WEB_COMMAND[@]}" &
WEB_LOOP_PID=$!
echo "$WEB_LOOP_PID" > "$WEB_LOOP_PID_FILE"

wait
