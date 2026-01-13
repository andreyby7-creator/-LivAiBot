#!/usr/bin/env bash

# Docker helper скрипт для LivAi проекта
# Упрощает работу с Docker контейнерами

set -euo pipefail

COMPOSE_FILE="infrastructure/compose/docker-compose.yml"
PROJECT_NAME="livai"

function show_help() {
    cat << EOF
LivAi Docker Helper

USAGE:
    $0 <command> [options]

COMMANDS:
    status          Показать статус всех контейнеров
    logs <service>  Показать логи сервиса (или всех если не указан)
    shell <service> Зайти в shell контейнера
    restart <service> Перезапустить сервис
    exec <service> <cmd> Выполнить команду в контейнере
    clean           Остановить и удалить все контейнеры/volume
    health          Проверить здоровье всех сервисов

SERVICES:
    postgres, redis, clickhouse, minio, qdrant

EXAMPLES:
    $0 status
    $0 logs postgres
    $0 shell postgres
    $0 exec postgres "psql -U livai -d livai"
    $0 health

EOF
}

function docker_compose() {
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" "$@"
}

function get_containers() {
    docker_compose ps --format "table {{.Name}}\t{{.Service}}\t{{.Status}}\t{{.Ports}}"
}

function check_health() {
    echo "🔍 Проверка здоровья инфраструктуры..."

    # Postgres
    if docker_compose exec -T postgres pg_isready -U livai -d livai >/dev/null 2>&1; then
        echo "✅ Postgres: OK"
    else
        echo "❌ Postgres: FAIL"
    fi

    # Redis
    if docker_compose exec -T redis redis-cli ping | grep -q PONG; then
        echo "✅ Redis: OK"
    else
        echo "❌ Redis: FAIL"
    fi

    # ClickHouse
    if docker_compose exec -T clickhouse clickhouse-client --query "SELECT 1" >/dev/null 2>&1; then
        echo "✅ ClickHouse: OK"
    else
        echo "❌ ClickHouse: FAIL"
    fi

    # MinIO
    if curl -s http://localhost:9000/minio/health/ready >/dev/null 2>&1; then
        echo "✅ MinIO: OK"
    else
        echo "❌ MinIO: FAIL"
    fi

    # Qdrant
    if curl -s http://localhost:6333/collections >/dev/null 2>&1; then
        echo "✅ Qdrant: OK"
    else
        echo "❌ Qdrant: FAIL"
    fi
}

case "${1:-help}" in
    status)
        echo "📊 Статус контейнеров:"
        get_containers
        ;;
    logs)
        if [ -n "${2:-}" ]; then
            docker_compose logs -f "$2"
        else
            docker_compose logs -f
        fi
        ;;
    shell)
        if [ -z "${2:-}" ]; then
            echo "❌ Укажите сервис для shell доступа"
            exit 1
        fi
        docker_compose exec "$2" sh
        ;;
    restart)
        if [ -z "${2:-}" ]; then
            echo "❌ Укажите сервис для перезапуска"
            exit 1
        fi
        docker_compose restart "$2"
        echo "✅ Сервис $2 перезапущен"
        ;;
    exec)
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            echo "❌ Укажите сервис и команду"
            exit 1
        fi
        docker_compose exec "$2" sh -c "$3"
        ;;
    clean)
        echo "🧹 Очистка всех контейнеров и volumes..."
        docker_compose down -v --remove-orphans
        echo "✅ Очистка завершена"
        ;;
    health)
        check_health
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ Неизвестная команда: $1"
        echo ""
        show_help
        exit 1
        ;;
esac