#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"

LOG_FILES=(
  "$LOG_DIR/supervisor.log"
  "$LOG_DIR/web.out.log"
  "$LOG_DIR/web.err.log"
  "$LOG_DIR/api-server.out.log"
  "$LOG_DIR/api-server.err.log"
)

for file in "${LOG_FILES[@]}"; do
  touch "$file"
done

tail -n 120 -f "${LOG_FILES[@]}"
