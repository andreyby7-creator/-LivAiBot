#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_DIR="$ROOT_DIR/.dev/pids"

if [[ ! -d "$PIDS_DIR" ]]; then
  echo "Нет $PIDS_DIR — похоже, dev_up ещё не запускали."
  exit 0
fi

stop_pidfile() {
  local name="$1"
  local pidfile="$PIDS_DIR/$name.pid"
  if [[ ! -f "$pidfile" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$pidfile" 2>/dev/null || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "🛑 Останавливаю $name (pid=$pid)"
    kill "$pid" 2>/dev/null || true
    # дадим шанс корректно завершиться
    sleep 0.3
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pidfile"
}

stop_pidfile "api-gateway"
stop_pidfile "auth-service"
stop_pidfile "bots-service"
stop_pidfile "conversations-service"

echo "Готово."

