# 📋 **Команды проекта LivAiBot**

## 🚀 **Ежедневная разработка**

### Основные команды для ежедневной работы

```bash
pnpm run dev                             # Dev режим (tsup watch)
pnpm run dev:full                        # Полный запуск (инфра + dev сервер)
pnpm run build                           # Полная сборка (JS + типы)
pnpm run type-check                      # Строгая проверка TS (пакеты отдельно)
pnpm run tsc:check                       # Строгая проверка TS (все ошибки)
pnpm run lint:canary                     # Строгий линтинг
npx dprint fmt                           # Форматирование кода
pnpm run test                            # Все unit тесты
pnpm run project:status                  # Статус проекта (инфра + backend + frontend)
```

## 🚀 **CI/CD команды**

### Для использования в GitHub Actions / GitLab CI

```bash
pnpm run build:ci                        # Сборка для CI (без remote cache)
pnpm run type-check:ci                   # TypeScript проверка для CI (без cache)
pnpm run lint:canary:ci                  # Строгий линтинг для CI (без cache)
pnpm run test:ci                         # Тесты для CI (без cache)
pnpm run quality:ci                      # Комплексная проверка качества (CI)
pnpm run ci                              # Полная CI pipeline (quality + tests)
```

### Отличия CI команд:

- **`TURBO_FORCE=true`** - принудительное использование Turbo (даже при ошибках)
- **`TURBO_REMOTE_CACHE_DISABLED=true`** - отключение remote cache для надежности
- **`cache: false`** в `turbo.json` для test:ci задачи

## 📜 **Контракты (OpenAPI → Zod)**

Источник истины: `services/<service>-service/openapi.json` (генерируется из FastAPI `app.openapi()`).

```bash
# Генерация снапшотов OpenAPI (перезапишет services/*-service/openapi.json)
pnpm run generate:openapi

# Генерация Zod схем из OpenAPI (перезапишет packages/core-contracts/src/validation/zod/generated/*.ts)
pnpm run generate:zod

# Полный pipeline (OpenAPI snapshots + Zod schemas)
pnpm run generate:contracts

# Проверка "дрейфа" контрактов (упадёт, если есть незакоммиченные изменения после генерации)
# Рекомендуется: Turbo сам выполнит генерацию, а потом проверит diff.
pnpm turbo run check:contracts

# Быстрая проверка diff (без генерации) — полезно после `generate:contracts`
pnpm run check:contracts
```

## 🐍 **Backend / Python**

### Virtualenv + зависимости

В проекте используем venv в корне: **`venv/`**.

```bash
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
```

### Инфраструктура (Docker Compose)

```bash
docker compose -f infrastructure/compose/docker-compose.yml up -d  # Запустить инфраструктуру
python3 scripts/infra_check.py                                     # Проверить статус инфраструктуры
docker compose -f infrastructure/compose/docker-compose.yml down   # Остановить инфраструктуру
```

### Локальный запуск backend

```bash
bash scripts/dev_up.sh                    # Поднять все сервисы (требует запущенной инфраструктуры)
bash scripts/dev_down.sh                  # Остановить сервисы
```

### Сервисы отдельно

```bash
cd services/<service> && make run         # auth-service / bots-service / conversations-service
```

### Миграции

```bash
pnpm run db:migrate                       # Все сервисы
pnpm run db:reset                         # Сброс БД + инфра
cd services/<service> && make migrate     # Конкретный сервис
```

### Проверка качества (Python)

```bash
# Индивидуальные проверки для сервиса
cd services/<service> && make lint        # ruff check
cd services/<service> && make format      # ruff format
cd services/<service> && make type        # mypy
cd services/<service> && make test        # pytest
cd services/<service> && make quality     # все проверки для одного сервиса

# Глобальные проверки для всех сервисов
make quality                              # все проверки качества для всех сервисов (auth + bots + conversations + api-gateway)
make quality-fast                         # быстрая проверка (auth + bots + conversations, без api-gateway)
bash scripts/backend_check.sh             # комплексная проверка всего backend
```

## 🐳 **Docker команды**

### Управление контейнерами

```bash
pnpm run docker:status                    # Статус контейнеров
pnpm run docker:logs <service>            # Логи конкретного сервиса
pnpm run docker:shell <service>           # Shell в контейнер
pnpm run docker:health                    # Проверка здоровья
pnpm run docker:clean                     # Очистка контейнеров + volumes
bash scripts/docker-helper.sh <cmd>       # Удобный интерфейс (status, logs, shell, exec, health, clean)
```

## 📦 **Установка зависимостей**

```bash
pnpm install                              # Все зависимости
pnpm install --prod                       # Только production
pnpm install --frozen-lockfile            # CI / lockfile
pnpm add <package>                        # Добавление runtime
pnpm add -D <package>                     # Добавление dev
pnpm outdated                             # Проверка устаревших пакетов
pnpm audit                                # Проверка безопасности зависимостей
npx npm-check-updates -u                  # Обновление пакетов
```

## 🔨 **Сборка / Build**

```bash
pnpm run build                            # JS + типы
pnpm run build:js                         # Только JS
pnpm run build:types                      # Только типы
pnpm run build:watch                      # Watch режим
```

## ✅ **Quality / Lint / Format**

### Проверка качества кода

```bash
pnpm run quality                          # Комплексная проверка (types + deps + lint)
pnpm run lint                             # Линтинг
pnpm run lint:fix                         # Автофикс
pnpm run lint:canary                      # Строгий линтинг
pnpm run lint:canary:fix                  # Строгий + автофикс
pnpm run type-check:eslint                # Проверить все ESLint конфиги
pnpm run type-check                      # Строгая проверка TypeScript
npx dprint check                          # Проверка форматирования
npx dprint fmt                            # Форматирование
```

## 🧪 **Тесты**

### Основные команды тестирования

```bash
pnpm run test                             # Все Unit тесты (Turbo оркестрация)
pnpm run test:file                        # Запуск конкретного тестового файла
pnpm run test:py                          # Все Python тесты
pnpm run test:int                         # Все Integration тесты
pnpm run test:e2e                         # Все E2E тесты (Playwright) - prod
pnpm run test:e2e:demo                    # Все E2E тесты (Playwright) - demo
pnpm run test:e2e:smoke                   # Все E2E тесты (Playwright) - smoke
*Для Production и смок E2E режимов нужно заранее запустить локальный сервер pnpm run dev
pnpm run test:coverage:html               # Coverage отчет HTML
pnpm run coverage:open                    # Открыть coverage в браузере
npm run bench                             # Interactive benchmarks
npm run bench:ci                          # CI mode benchmarks
pnpm bench:ci                             # Turbo + все пакеты в проекте
```

### Тестирование отдельных пакетов

```bash
# Запуск тестов конкретного пакета
turbo run test:ci --filter=@livai/app
turbo run test:ci --filter=@livai/feature-auth
turbo run test:ci --filter=@livai/ui-core

# Запуск конкретного тестового файла
turbo run test:file --filter=@livai/app -- packages/app/tests/unit/types/common.test.ts
turbo run test:file --filter=@livai/feature-auth -- packages/feature-auth/tests/unit/schemas.test.ts

# Локальный запуск в пакете (быстрее для разработки)
cd packages/app && pnpm test -- tests/unit/types/common.test.ts
cd packages/feature-auth && pnpm test -- tests/unit/hooks/useAuth.test.ts
```

## 🔍 **Pre-commit проверки**

### Проверка перед коммитом

```bash
pnpm run pre-commit                       # Lint + format + tests + deps
pnpm run format:check                     # Проверка форматирования
pnpm run check:circular-deps              # Циклические зависимости
node config/eslint/utils/check-zones.mjs  # Валидация архитектурных зон пакетов
node config/eslint/utils/validate-zones.mjs # Валидация конфигурации зон ESLint
pnpm run deps:unused                      # Неиспользуемые зависимости
pnpm run check:dependency-policy          # Архитектурные ограничения
pnpm run analyze:import-metrics           # Метрики графа импортов
```

## 🧹 **Clean команды**

### Очистка

```bash
pnpm run clean                            # Очистка кэша и временных файлов
pnpm store prune                          # Очистка pnpm cache
```

## 🔧 **Debug / Анализ команды**

### Отладка и анализ

```bash
pnpm run analyze:bundles                  # Размеры бандлов + dependency graph
pnpm run analyze:bundles --size-only      # Только анализ размеров (быстрее)
pnpm run analyze:bundles --graph-only     # Только анализ графа зависимостей
pnpm run analyze:bundles --compare=main   # Сравнить с main branch
pnpm run dev:inspect                      # Dev режим с Node inspector
pnpm run docs:generate                    # Генерация PROJECT-OVERVIEW.md
```

## 📝 **Release команды**

### Подготовка к релизу

```bash
pnpm run release:prep                     # Подготовка релиза (tests + quality + changelog)
pnpm run changelog                        # Генерация changelog из git коммитов
```

## 🔒 **Security команды**

### Проверка безопасности

```bash
pnpm run security:snyk                    # Проверка уязвимостей через Snyk
```
