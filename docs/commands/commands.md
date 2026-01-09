# 📋 Команды проекта LivAiBot

## 🚀 Ежедневная разработка

### Основные команды для ежедневной работы

```bash
pnpm run type-check                     # Строгая проверка TS (Turbo)
pnpm run build                          # Полная сборка (JS + типы) (Turbo)
pnpm run dev                            # Dev режим (tsup watch, Turbo)
pnpm run lint:canary                    # Строгий canary линтинг (Turbo)
npx dprint fmt                          # Форматирование всего проекта
pnpm run test                           # Все тесты (Turbo)
```

## 🚀 CI/CD команды

### Для использования в GitHub Actions / GitLab CI

```bash
pnpm run build:ci                       # Сборка для CI (без remote cache)
pnpm run type-check:ci                  # TypeScript проверка для CI (без cache)
pnpm run lint:canary:ci                 # Строгий линтинг для CI (без cache)
pnpm run test:ci                        # Тесты для CI (без cache)
pnpm run quality:ci                     # Комплексная проверка качества (CI)
pnpm run ci                             # Полная CI pipeline (quality + tests)
```

### Отличия CI команд:

- **`TURBO_FORCE=true`** - принудительное использование Turbo (даже при ошибках)
- **`TURBO_REMOTE_CACHE_DISABLED=true`** - отключение remote cache для надежности
- **`cache: false`** в `turbo.json` для test:ci задачи

### Когда использовать:

- **Локально:** обычные команды (`pnpm run build`, `pnpm run test`)
- **CI:** команды с суффиксом `:ci` (`pnpm run build:ci`, `pnpm run test:ci`)

---

## 🐍 Python / Backend команды

### Virtualenv + зависимости (один раз)

В проекте используем venv в корне: **`.venv/`**.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
```

### Инфраструктура (Docker Compose) + проверка

```bash
docker compose -f infrastructure/compose/docker-compose.yml up -d
.venv/bin/python scripts/infra_check.py
```

### Локальный запуск всех backend-сервисов “одной командой”

Поднимает `api-gateway`/`auth-service`/`bots-service`/`conversations-service` на фиксированных портах `8000–8003`
и включает проксирование `/v1/*` в gateway.

```bash
bash scripts/dev_up.sh
bash scripts/dev_status.sh
bash scripts/dev_down.sh
```

### Запуск конкретного сервиса

```bash
cd services/api-gateway && make run
cd services/auth-service && make run
cd services/bots-service && make run
cd services/conversations-service && make run
```

### Миграции (Alembic)

Важно: у каждого сервиса **своя таблица версий Alembic**, поэтому миграции не конфликтуют.

```bash
cd services/auth-service && make migrate
cd services/bots-service && make migrate
cd services/conversations-service && make migrate
```

### Качество кода (Python)

```bash
cd services/api-gateway && make lint && make format && make type && make test
cd services/auth-service && make lint && make format && make type && make test
cd services/bots-service && make lint && make format && make type && make test
cd services/conversations-service && make lint && make format && make type && make test
```

### Качество всего backend “одной командой” (без cd-ошибок)

```bash
bash scripts/backend_check.sh
```

## 📦 Install команды

### Установка зависимостей

```bash
pnpm install                            # Установка всех зависимостей
pnpm install --prod                     # Установка только production-зависимостей
pnpm install --frozen-lockfile          # Установка с frozen lockfile (CI)
```

## 🔨 Build команды

### Сборка проекта

```bash
pnpm run build                          # Полная сборка (JS + типы)
pnpm run build:js                       # Только JS
pnpm run build:types                    # Только типы + dprint
pnpm run build:watch                    # Watch режим
pnpm run dev                            # Dev режим (tsup watch)
```

## ✅ Quality команды

### Проверка качества кода

```bash
pnpm run quality                        # Комплексная проверка качества (types + deps)
pnpm -w run type-coverage               # Покрытие типами
pnpm -w run deps:unused                 # Проверка неиспользуемых зависимостей
pnpm run type-check                     # Строгая проверка TS
```

## 🧹 Lint команды

### Линтинг

```bash
pnpm run lint                           # Линтинг (turbo)
pnpm run lint:fix                       # Автоисправление
pnpm run lint:canary                    # Строгий canary линтинг
pnpm run lint:canary:fix                # Строгий + автофикс
```

## 🎨 Format команды

### Форматирование

```bash
npx dprint check                        # Проверка форматирования
npx dprint fmt                          # Форматирование всего проекта
npx dprint fmt "packages/**/*.src/**/*.{ts,tsx}"   # Только исходники
```

## 🧪 Test команды

### Тесты

#### Основные команды

```bash
pnpm run test                            # Все тесты (Turbo)
pnpm run test:ui                         # Веб-интерфейс для тестов
pnpm run test:coverage:html              # Тесты с HTML отчетом покрытия
pnpm run test:coverage:watch             # Тесты с coverage в watch режиме
pnpm run coverage:open                   # Открыть HTML отчет в браузере
```

#### Coverage анализ

```bash
pnpm run coverage:check                  # Анализ проблем покрытия кода
pnpm run coverage:file <filename>        # Покрытие конкретного файла
```

#### Ключевые особенности

- Автоматически определяет пакет по имени файла
- Предпочитает JSON отчеты (быстрее HTML)
- Показывает: Statements, Functions, Branches, Lines
- Для низкого покрытия дает рекомендации по улучшению

## 🔍 Pre-commit команды

### Проверка перед коммитом

```bash
pnpm run pre-commit                      # Полная проверка перед коммитом (lint + format + circular deps + dep policy + test)
pnpm run format:check                    # Быстрая проверка форматирования
pnpm run check:circular-deps             # Проверка циклических зависимостей в монорепо
pnpm run deps:unused                     # Проверка неиспользуемых зависимостей в проекте
pnpm run check:dependency-policy         # Проверка архитектурных ограничений на зависимости
pnpm run analyze:import-metrics          # Анализ метрик сложности графа импортов
```

## 🧽 Clean команды

### Очистка

```bash
pnpm run clean                           # Очистка кэша и временных файлов (Turbo)
pnpm store prune                         # Очистка неиспользуемого кэша pnpm
```

## 📦 Dependency команды

### Управление зависимостями

```bash
pnpm outdated                            # Проверка устаревших версий пакетов в монорепо
pnpm audit                               # Проверка уязвимостей безопасности в зависимостях
pnpm update --interactive                # Интерактивное обновление пакетов
pnpm add -D <package>                    # Добавление dev зависимости
pnpm add <package>                       # Добавление runtime зависимости
npx npm-check-updates -u                 # Обновление всех зависимостей до последних версий (в конкретном пакете)
```

## 🔧 Debug / Анализ команды

### Отладка и анализ

```bash
pnpm run analyze:bundles                 # Анализ бандлов всех пакетов (размеры + dependency graph)
pnpm run analyze:bundles --size-only     # Только анализ размеров (быстрее)
pnpm run analyze:bundles --graph-only    # Только анализ графа зависимостей
pnpm run analyze:bundles --compare=main  # Сравнить с main branch
pnpm run analyze:bundles --compare=none  # Без сравнения
pnpm run dev:inspect                     # Dev режим с инспектором Node.js
```
