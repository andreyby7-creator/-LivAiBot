#!/usr/bin/env bash
set -euo pipefail

# Прогон качества для всего backend “одной командой”.
# Запускает make-таргеты в каждом сервисе по очереди.
#
# Использование:
#   bash scripts/backend_check.sh
#

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

services=(
  "services/auth-service"
  "services/bots-service"
  "services/conversations-service"
)

for svc in "${services[@]}"; do
  echo ""
  echo "=============================="
  echo "Backend check: $svc"
  echo "=============================="
  (cd "$ROOT_DIR/$svc" && make lint && make format && make type && make test)
done

echo ""
echo "✅ Backend check: всё прошло"

