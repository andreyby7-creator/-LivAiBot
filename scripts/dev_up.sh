#!/usr/bin/env bash
set -euo pipefail

# Локальный запуск “одной командой” для API контуров.
# Поднимает (если не подняты) сервисы на фиксированных портах:
# - api-gateway: 8000
# - auth-service: 8001
# - bots-service: 8002
# - conversations-service: 8003
#
# Запуск:
#   bash scripts/dev_up.sh
#
# Остановка:
#   bash scripts/dev_down.sh
#

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT_DIR/venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Не найден Python venv: $PY"
  echo "Сначала создай окружение и установи зависимости:"
  echo "  python3 -m venv venv && venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt"
  exit 1
fi

mkdir -p "$ROOT_DIR/.dev/pids" "$ROOT_DIR/.dev/logs"

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

start_service() {
  local name="$1"
  local workdir="$2"
  local port="$3"
  local app="$4"
  local extra_env="$5"

  if check_port "$port" >/dev/null 2>&1; then
    echo "✅ $name уже запущен (порт $port)"
    return 0
  fi

  echo "🚀 Запускаю $name (порт $port)"
  local pidfile="$ROOT_DIR/.dev/pids/$name.pid"
  local logfile="$ROOT_DIR/.dev/logs/$name.log"

  # shellcheck disable=SC2086
  (cd "$workdir" && env $extra_env "$PY" -m uvicorn "$app" --host 127.0.0.1 --port "$port") >>"$logfile" 2>&1 &
  echo $! >"$pidfile"

  # Подождём чуть-чуть, чтобы сервис запустился
  sleep 2

  # Проверяем, что процесс всё ещё работает (упрощенная проверка)
  if kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "✅ $name запущен (порт $port, PID: $(cat "$pidfile"))"
    return 0
  else
    echo "❌ $name не запустился. Логи: $logfile"
    return 1
  fi
}

# Общие env для gateway-прокси (фиксируем “один раз”)
GATEWAY_ENV="PROXY_ENABLED=true AUTH_SERVICE_URL=http://localhost:8001 BOTS_SERVICE_URL=http://localhost:8002 CONVERSATIONS_SERVICE_URL=http://localhost:8003"

start_service "api-gateway" "$ROOT_DIR/services/api-gateway" 8000 "api_src.main:app" "$GATEWAY_ENV"
start_service "auth-service" "$ROOT_DIR/services/auth-service" 8001 "auth_src.main:app" ""
start_service "bots-service" "$ROOT_DIR/services/bots-service" 8002 "bots_src.main:app" ""
start_service "conversations-service" "$ROOT_DIR/services/conversations-service" 8003 "conversations_src.main:app" ""

echo ""
echo "Готово. Проверки:"
echo "  curl -i http://localhost:8000/healthz"
echo "  curl -i http://localhost:8000/v1/auth/healthz"
echo "  curl -i http://localhost:8000/v1/bots/healthz"
echo "  curl -i http://localhost:8000/v1/conversations/healthz"

