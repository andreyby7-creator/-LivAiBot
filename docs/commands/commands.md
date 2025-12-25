# 📋 Команды проекта LivAiBot

## 🚀 Ежедневная разработка

### Основные команды для ежедневной работы

```bash
pnpm run type-check                    # Строгая проверка TS (Turbo)
pnpm run build                         # Полная сборка (JS + типы) (Turbo)
pnpm run dev                           # Dev режим (tsup watch, Turbo)
pnpm run lint:canary                   # Строгий canary линтинг (Turbo)
npx dprint fmt                         # Форматирование всего проекта (npx)
pnpm run test                          # Все тесты (Turbo)
```

## 📦 Install команды

### Установка зависимостей

```bash
pnpm install                           # Установка всех зависимостей
pnpm install --prod                    # Установка только production-зависимостей
pnpm install --frozen-lockfile         # Установка с frozen lockfile (CI)
```

## 🔨 Build команды

### Сборка проекта

```bash
pnpm run build                         # Полная сборка (JS + типы)
pnpm run build:js                      # Только JS
pnpm run build:types                   # Только типы + dprint
pnpm run build:watch                   # Watch режим
pnpm run dev                           # Dev режим (tsup watch)
```

## ✅ Quality команды

### Проверка качества кода

```bash
pnpm run quality                       # Комплексная проверка качества (types + deps)
pnpm run type-coverage                 # Покрытие типами
pnpm run deps:unused                   # Проверка неиспользуемых зависимостей
pnpm run type-check                    # Строгая проверка TS
```

## 🧹 Lint команды

### Линтинг

```bash
pnpm run lint                          # Линтинг (turbo)
pnpm run lint:fix                      # Автоисправление
pnpm run lint:canary                   # Строгий canary линтинг
pnpm run lint:canary:fix               # Строгий + автофикс
```

## 🎨 Format команды

### Форматирование

```bash
npx dprint check                       # Проверка форматирования
npx dprint fmt                         # Форматирование всего проекта
npx dprint fmt "packages/**/*.src/**/*.{ts,tsx}"   # Только исходники
```

## 🧪 Test команды

### Тесты

```bash
pnpm run test                          # Все тесты (Turbo)
pnpm run test:ui                       # Веб-интерфейс для тестов (Turbo)
pnpm run test:coverage                 # Тесты с coverage (Turbo)
pnpm run test:coverage:watch           # Тесты с coverage в watch режиме (Turbo)
pnpm run test:coverage:html            # Тесты с HTML отчетом покрытия (Turbo)
pnpm run coverage:open                 # Открыть HTML отчет покрытия в браузере
pnpm exec vitest run                   # Обычный запуск тестов (в пакете)
pnpm exec vitest run --typecheck       # Проверка типов (в пакете)

# Coverage провайдеры (настраиваются в vitest.config.ts):
# - v8: Современный, быстрый (рекомендуется)
# - istanbul: Альтернативный, иногда лучше для edge cases
# - c8: ESM-friendly, полезен для сложных модулей
```

## 🔍 Pre-commit команды

### Проверка перед коммитом

```bash
pnpm run pre-commit                    # Полная проверка перед коммитом (lint + format + circular deps + dep policy + test)
pnpm run format:check                  # Быстрая проверка форматирования
pnpm run check:circular-deps           # Проверка циклических зависимостей в монорепо
pnpm run check:dependency-policy       # Проверка архитектурных ограничений на зависимости
pnpm run analyze:import-metrics        # Анализ метрик сложности графа импортов
```

## 🧽 Clean команды

### Очистка

```bash
pnpm run clean                         # Очистка кэша и временных файлов (Turbo)
pnpm store prune                       # Очистка неиспользуемого кэша pnpm
```

## 📦 Dependency команды

### Управление зависимостями

```bash
pnpm outdated                           # Проверка устаревших пакетов
pnpm update --interactive               # Интерактивное обновление пакетов
pnpm add -D <package>                   # Добавление dev зависимости
pnpm add <package>                      # Добавление runtime зависимости
```

## 🔧 Debug / Анализ команды

### Отладка и анализ

```bash
pnpm run analyze:bundles                # Анализ бандлов всех пакетов (размеры + dependency graph)
pnpm run analyze:bundles --size-only    # Только анализ размеров (быстрее)
pnpm run analyze:bundles --graph-only   # Только анализ графа зависимостей
pnpm run analyze:bundles --compare=main # Сравнить с main branch
pnpm run analyze:bundles --compare=none # Без сравнения
pnpm run dev:inspect                    # Dev режим с инспектором Node.js
```

## 📊 Output команды

### Вывод результатов

```bash
pnpm exec vitest run --reporter=default                            # Обычный вывод
pnpm exec vitest run --reporter=verbose | tail -10                 # Подробный вывод
pnpm exec vitest run --reporter=verbose --coverage=false | tail -5 # Все тесты без coverage
```
