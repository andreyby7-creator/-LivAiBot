#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT_DIR/.venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Не найден Python venv: $PY"
  exit 1
fi

check_port() {
  local port="$1"
  "$PY" - "$port" <<'PY'
import socket, sys
port = int(sys.argv[1])
s = socket.socket()
s.settimeout(0.2)
try:
    s.connect(("127.0.0.1", port))
    print("UP")
    sys.exit(0)
except Exception:
    print("DOWN")
    sys.exit(1)
finally:
    s.close()
PY
}

print_line() {
  local name="$1"
  local port="$2"
  local status
  status="$(check_port "$port" || true)"
  printf "%-20s : %-4s (:%s)\n" "$name" "$status" "$port"
}

print_line "api-gateway" 8000
print_line "auth-service" 8001
print_line "bots-service" 8002
print_line "conversations-service" 8003

