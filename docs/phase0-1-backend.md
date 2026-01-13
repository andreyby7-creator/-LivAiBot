# 🚀 **ПЛАН РЕАЛИЗАЦИИ ФАЗ 0-1 — BACKEND (Инфраструктура + MVP API)**

## ✨ **ОБНОВЛЕННЫЙ ПЛАН С РЕАЛЬНЫМ КОДОМ**

**🔄 Версии пакетов проверены и актуальны на январь 2026 года**

**⚠️ Важно:** Реализован **чистый hexagonal architecture** (порты/адаптеры/use cases) с **максимальной надёжностью интеграций**

**📦 Стандарты пакетов:** Все сервисы следуют единой структуре `domain/ports/use_cases/entrypoints/adapters`

**🏗️ Архитектура Фаз 0-1:** ✅ **РЕАЛИЗОВАНЫ 4 сервиса** по архитектуре hexagonal:

#### **Backend сервисы (4):**

- ✅ `services/api-gateway` - единый вход + прокси + middleware
- ✅ `services/auth-service` - аутентификация + workspace + JWT
- ✅ `services/bots-service` - CRUD ботов + инструкции + версии
- ✅ `services/conversations-service` - треды + сообщения + turn (stub)

#### **Инфраструктура (фактически запущенная):**

- ✅ `infrastructure/compose/docker-compose.yml` - Postgres/Redis/ClickHouse/MinIO/Qdrant
- ✅ `scripts/infra_check.py` - проверка доступности инфраструктуры

**Особое внимание уделено надёжности:**

- **Tenant isolation** - все данные изолированы по workspace_id
- **Operation ID** - дедупликация всех операций (command_id/operation_id)
- **Audit logging** - полный аудит всех действий
- **Idempotency** - безопасные повторы операций

**Встроены все продвинутые возможности (версии актуальны на январь 2026):**

- 🏗️ **Hexagonal architecture** (domain чистая, adapters внешние)
- 🔒 **JWT с ротацией** (access/refresh tokens)
- 🛡️ **Middleware стека** (auth, trace, operation_id, rate limiting)
- 💾 **Миграции Alembic** для всех сервисов
- 📊 **ClickHouse готов** для аналитики (схема спроектирована)
- 🗄️ **MinIO + Qdrant** для файлов и векторов
- ⚡ **Async FastAPI** с полным покрытием middleware
- 🔄 **Idempotent operations** (operation_id для дедупа)
- 📋 **Pydantic v2** для всех DTO
- 🐘 **SQLAlchemy 2.0** async для БД
- 🧪 **Pytest coverage** для всех сервисов

### **🎯 ЦЕЛИ ФАЗ 0-1 (ИНФРАСТРУКТУРА + API):**

#### **Этап 0: Среда разработки**

- **Инфраструктура:** Docker Compose с Postgres/Redis/ClickHouse/MinIO/Qdrant
- **Инициализация:** Автоматические джобы для создания БД, бакетов, коллекций
- **Проверки:** `scripts/infra_check.py` для валидации доступности

#### **Этап 1.0: Минимальное усиление**

- **Operation ID:** Во всех операциях (LLM-turn, webhook, джобы) уникальный operation_id
- **Дедуп:** Безопасные ретраи без дублей
- **Аудит:** Полный лог всех изменений конфигурации

#### **Этап 1.1: Сервисы (минимум)**

1. `api-gateway` - CORS, rate limiting, единый формат ошибок, trace-id, X-Operation-Id
2. `auth-service` - регистрация/логин + workspace + JWT (access/refresh)
3. `bots-service` - CRUD ботов + инструкции + версии конфигурации
4. `conversations-service` - треды/сообщения + turn (пока stub/эхо)

#### **Этап 1.2: Данные (Postgres)**

- **Таблицы:** tenants/workspaces, users, bots+bot_versions, conversations/threads/messages
- **Аудит:** audit_log, llm_turns, webhook_events, job_queue, dead_letter_queue
- **Изоляция:** Все данные с workspace_id + tenant isolation

#### **Этап 1.3: Контракты API**

- `/v1/*` роутинг через gateway
- Единый формат ошибок (code/message/trace_id/details)
- DTO согласованы между сервисами

### **🔍 Структура проекта (реализованная):**

📁 services/
1️⃣ services/api-gateway/ — ts — API Gateway (FastAPI + middleware + прокси)
2️⃣ services/auth-service/ — ts — Auth Service (JWT + workspace + регистрация)
3️⃣ services/bots-service/ — ts — Bots Service (CRUD + инструкции + версии)
4️⃣ services/conversations-service/ — ts — Conversations Service (треды + turn stub)

📁 apps/
1️⃣ apps/web/ — ts — Next.js приложение (подготовлено для Фазы 2)
2️⃣ apps/web/package.json — json — Next.js зависимости
3️⃣ apps/web/next.config.mjs — js — Next.js конфигурация
4️⃣ apps/web/tailwind.config.ts — ts — Tailwind CSS конфигурация
5️⃣ apps/web/postcss.config.mjs — js — PostCSS конфигурация
6️⃣ apps/web/tsconfig.json — json — TypeScript для Next.js
7️⃣ apps/web/vitest.config.ts — ts — Vitest для Next.js
8️⃣ apps/web/vitest.setup.ts — ts — Vitest setup для Next.js

📁 packages/ (подготовлено для Фазы 2)
1️⃣ packages/core-contracts/ — ts — Общие типы и контракты (DTO + domain models)
2️⃣ packages/app/ — ts — Композитный пакет (state + hooks + utils)
3️⃣ packages/feature-auth/ — ts — Бизнес-логика аутентификации
4️⃣ packages/feature-bots/ — ts — Бизнес-логика ботов
5️⃣ packages/feature-chat/ — ts — Бизнес-логика чата
6️⃣ packages/feature-voice/ — ts — Бизнес-логика голоса (stub)
7️⃣ packages/ui-core/ — ts — Базовые UI компоненты + domain types
8️⃣ packages/ui-features/ — ts — Составные UI экраны
9️⃣ packages/ui-shared/ — ts — Общие UI утилиты

📁 infrastructure/
1️⃣ infrastructure/compose/docker-compose.yml — yaml — Docker Compose инфраструктура
2️⃣ infrastructure/compose/init-jobs/ — sh — Инициализация БД/бакетов/коллекций

📁 config/
1️⃣ config/python/settings_example.py — py — Pydantic Settings для сервисов

📁 scripts/
1️⃣ scripts/infra_check.py — py — Проверка доступности инфраструктуры
2️⃣ scripts/dev_up.sh — sh — Поднять всю инфраструктуру и сервисы
3️⃣ scripts/dev_down.sh — sh — Остановить всю инфраструктуру
4️⃣ scripts/dev_status.sh — sh — Проверить статус сервисов
5️⃣ scripts/backend_check.sh — sh — Проверка всех backend сервисов

📁 config/
1️⃣ config/python/settings_example.py — py — Pydantic Settings для сервисов
2️⃣ config/python/alembic.ini — ini — Alembic конфигурация миграций
3️⃣ config/python/logging.yaml — yaml — Логирование конфигурация
4️⃣ config/python/mypy.ini — ini — MyPy статическая типизация
5️⃣ config/python/ruff.toml — toml — Ruff линтер и форматирование
6️⃣ config/python/pytest.ini — ini — Pytest конфигурация
7️⃣ config/python/pyproject.template.toml — toml — Шаблон pyproject.toml
8️⃣ config/tsconfig/base.json — json — Base TypeScript конфигурация
9️⃣ config/tsconfig/strict.json — json — Strict TypeScript конфигурация
🔟 config/tsconfig/node.json — json — Node.js TypeScript конфигурация
1️⃣1️⃣ config/tsconfig/root.json — json — Root TypeScript конфигурация
1️⃣2️⃣ config/vitest/ — js — Vitest unit тесты конфигурации
1️⃣3️⃣ config/playwright/ — ts — Playwright E2E тесты конфигурации
1️⃣4️⃣ config/husky/ — sh — Husky git hooks конфигурации
1️⃣5️⃣ config/env/ — env — Примеры переменных окружения

📁 tools/
1️⃣ tools/vendor/get-pip.py — py — Вендоринг pip установщика

📁 e2e/
1️⃣ e2e/user-journeys/create-ai-bot.spec.ts — ts — E2E тест создания бота
2️⃣ e2e/user-journeys/registration-and-workspace.spec.ts — ts — E2E тест регистрации

📁 .github/
1️⃣ .github/workflows/ci.yml — yaml — CI/CD pipeline
2️⃣ .github/workflows/lint.yml — yaml — Линтинг и форматирование
3️⃣ .github/workflows/test.yml — yaml — Запуск тестов
4️⃣ .github/workflows/security.yml — yaml — Безопасность

**Корневые файлы проекта:**
1️⃣ pyproject.toml — toml — Python зависимости и конфигурация
2️⃣ requirements.txt — txt — Python зависимости
3️⃣ requirements-dev.txt — txt — Dev зависимости
4️⃣ package.json — json — Node.js workspace конфигурация
5️⃣ pnpm-workspace.yaml — yaml — PNPM workspace
6️⃣ pnpm-lock.yaml — yaml — PNPM lockfile
7️⃣ turbo.json — json — Turborepo конфигурация
8️⃣ tsconfig.json — json — TypeScript корневая конфигурация
9️⃣ pyrightconfig.json — json — Pyright (Pylance) конфигурация
🔟 eslint.config.mjs — js — ESLint конфигурация
1️⃣1️⃣ dprint.json — json — Dprint форматирование
1️⃣2️⃣ env.example — env — Пример переменных окружения
1️⃣3️⃣ Makefile — make — Команды сборки и разработки
1️⃣4️⃣ LICENSE — txt — Лицензия проекта
1️⃣5️⃣ README.md — md — Документация проекта
1️⃣6️⃣ build-order.yml — yaml — Порядок сборки пакетов
1️⃣7️⃣ budgets.json — json — Бюджеты bundle sizes
1️⃣8️⃣ coverage_clean.json — json — Конфигурация очистки coverage
1️⃣9️⃣ dependency-policy.json — json — Политика зависимостей
2️⃣0️⃣ get-pip.py — py — Установщик pip для Python

**Git и качество кода:**
1️⃣ .gitignore — gitignore — Исключаемые файлы
2️⃣ .husky/ — sh — Pre-commit hooks (commit-msg, pre-commit, pre-push)

**Переменные окружения (env.example):**
1️⃣ **API Gateway:** PROXY_ENABLED, READINESS_STRICT, service URLs
2️⃣ **Auth Service:** JWT_SECRET, JWT_ISSUER, ACCESS_TTL, REFRESH_TTL
3️⃣ **Database:** DATABASE_URL (PostgreSQL async)
4️⃣ **Cache:** REDIS_URL
5️⃣ **Analytics:** CLICKHOUSE_HOST, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD
6️⃣ **Storage:** MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY
7️⃣ **Vector DB:** QDRANT_URL

**Пример структуры сервиса (services/bots-service/):**
📁 services/bots-service/
1️⃣ services/bots-service/bots_src/ — py — Основной код сервиса
2️⃣ services/bots-service/bots_src/main.py — py — FastAPI приложение
3️⃣ services/bots-service/bots_src/config/settings.py — py — Настройки (Pydantic)
4️⃣ services/bots-service/bots_src/adapters/db/ — py — БД адаптеры (SQLAlchemy)
5️⃣ services/bots-service/bots_src/domain/ — py — Доменная модель
6️⃣ services/bots-service/bots_src/ports/ — py — Порты (интерфейсы)
7️⃣ services/bots-service/bots_src/use_cases/ — py — Use cases (бизнес-логика)
8️⃣ services/bots-service/bots_src/entrypoints/http/ — py — HTTP API (FastAPI routes)
9️⃣ services/bots-service/bots_src/errors/ — py — Обработка ошибок
🔟 services/bots-service/bots_src/middleware/ — py — Middleware (tenant isolation)
1️⃣1️⃣ services/bots-service/migrations/ — py — Alembic миграции
1️⃣2️⃣ services/bots-service/tests/ — py — Тесты (pytest)
1️⃣3️⃣ services/bots-service/Makefile — make — Команды для разработки

### **🚀 Критерии готовности Фаз 0-1:**

- **Фаза 0:** `docker compose up -d` поднимает всю инфраструктуру
- **Фаза 0:** `python scripts/infra_check.py` → "All infra checks passed"
- **Фаза 1:** Можно пройти сценарии U1→U3→U5→U10 через API (Postman/HTTPie)
- **Фаза 1:** Миграции Alembic воспроизводимы
- **Фаза 1:** Tenant isolation соблюдается во всех запросах и данных
- **Фаза 1:** Operation ID дедуплицирует все операции
- **Фаза 1:** Полный аудит лог для изменений конфигурации

### **🔧 Реализованные технические компоненты:**

#### **Надёжность интеграций:**

- **Идемпотентность:** operation_id во всех операциях
- **Дедуп:** Redis для webhook events + operation_id
- **Очередь:** job_queue + dead_letter_queue в БД
- **Ретраи:** Circuit breaker паттерн готов

#### **Безопасность:**

- **Tenant isolation:** workspace_id везде + middleware проверки
- **JWT:** access/refresh с ротацией
- **Аудит:** audit_log для всех CRUD операций
- **Middleware:** auth + trace + operation_id + rate limiting

#### **Архитектура:**

- **Hexagonal:** domain чистая, adapters внешние
- **Async first:** FastAPI + asyncpg + redis-py async
- **DTO first:** Pydantic v2 для всех контрактов
- **Миграции:** Alembic для всех сервисов

### **📋 Реализованные API endpoints:**

#### **Auth Service (`/v1/auth/`):**

- `POST /register` — регистрация + workspace + JWT
- `POST /login` — логин + JWT
- `GET /me` — профиль по JWT
- `POST /refresh` — ротация refresh token

#### **Bots Service (`/v1/bots/`):**

- `GET /` — список ботов workspace
- `POST /` — создать бота
- `GET /{bot_id}` — детали бота
- `PUT /{bot_id}/instruction` — обновить инструкцию (новая версия)

#### **Conversations Service (`/v1/conversations/`):**

- `POST /threads` — создать тред
- `GET /threads` — список тредов
- `GET /threads/{thread_id}/messages` — сообщения треда
- `POST /threads/{thread_id}/turn` — выполнить turn (пока эхо)

#### **Gateway (`/v1/*`):**

- Прокси во все сервисы с префиксом `/v1/*`
- Единый формат ошибок (code/message/trace_id/details)
- Middleware стек: CORS, rate limiting, trace_id, operation_id, auth, tenant isolation
- Idempotency headers: X-Operation-Id, X-Trace-Id, X-Workspace-Id, X-User-Id
- Error handling: validation errors (422), HTTP errors (4xx/5xx), unhandled exceptions (500)

### **⚡ Особенности реализации:**

1. **Operation ID everywhere:** Каждая операция имеет уникальный operation_id для дедупа
2. **Versioning для ботов:** Каждая инструкция создаёт новую версию (bot_versions)
3. **Audit first:** Все изменения логируются в audit_log с workspace_id, user_id, operation_id
4. **Tenant first:** workspace_id в каждом запросе и записи + middleware проверки
5. **Async everywhere:** Полностью асинхронная архитектура (FastAPI + asyncpg + redis)
6. **Stub ready:** conversations/turn возвращает эхо, готово для LLM интеграции
7. **Middleware стек:** auth, trace_id, operation_id, tenant_isolation, rate_limiting, CORS
8. **Idempotency:** operation_id предотвращает дублирование операций
9. **JWT ротация:** access/refresh tokens с автоматической ротацией refresh
10. **Database migrations:** Alembic для всех сервисов с поддержкой rollback

### **🧪 Тестирование и качество кода:**

#### **Backend тестирование:**

- **Pytest coverage** для всех сервисов с отчетами
- **Интеграционные тесты** через gateway API
- **Infra checks** (`scripts/infra_check.py`) для автоматической проверки доступности
- **E2E тесты** для пользовательских сценариев (registration, create bot)

#### **Качество кода:**

- **Ruff** для линтинга и форматирования Python
- **Mypy** для статической типизации
- **ESLint + Prettier** для TypeScript/JavaScript
- **Pre-commit hooks** для автоматических проверок
- **CI/CD** с линтингом, тестами и безопасностью

#### **Мониторинг и логирование:**

- **Structlog** для структурированного логирования
- **Sentry-ready** конфигурация для ошибок
- **Trace ID** для сквозного трейсинга запросов
- **Operation ID** для отслеживания операций

---

**🎉 Фазы 0-1 полностью реализованы и готовы для Фазы 2 (UI)!**
