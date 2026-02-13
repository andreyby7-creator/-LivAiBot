# Рефакторинг: Разделение lib/ и runtime/

## ⚠️ СТАТУС: ПРОБЛЕМА РЕШЕНА ЧЕРЕЗ SUBPATH EXPORTS

**Основная проблема решена другим способом:**

- ✅ Используются subpath exports (`@livai/app/lib/error-mapping.js`) вместо barrel imports
- ✅ ESLint правило `no-restricted-imports` автоматически блокирует barrel imports для всех пакетов `@livai/*`
- ✅ Тесты проходят без side-effects, т.к. не загружается весь barrel file
- ✅ Coverage корректный (75.28% вместо 23.55%)

**Этот документ теперь описывает опциональный рефакторинг для улучшения архитектуры**, но не критичен для решения проблемы импортов.

## Цель

Разделить чистые утилиты (lib/) и runtime singletons (runtime/) для безопасного импорта без side-effects.

## Проблема (РЕШЕНА)

- ~~Импорт `@livai/app/src/lib/error-mapping.js` через пакетный импорт загружает `index.ts` → `scheduler.ts` → side-effect при импорте~~ ✅ Решено через subpath exports
- ~~ESLint запрещает relative imports между пакетами~~ ✅ Решено через subpath exports
- ~~Тесты падают из-за side-effects при импорте singletons~~ ✅ Решено через subpath exports

## Целевая структура

```
packages/app/src/
  background/              ✅ УЖЕ ЕСТЬ (runtime)
    scheduler.ts
    tasks.ts
  
  lib/                     ✅ ЧИСТЫЕ УТИЛИТЫ (no side-effects)
    error-mapping.ts
    effect-utils.ts
    validation.ts
    ... (все чистые)
  
  runtime/                 🆕 SINGLETONS
    telemetry.ts
    auth-service.ts
    event-bus.ts
    app-lifecycle.ts
    logger.ts
```

## Требования к качеству кода

Все создаваемые и обновляемые файлы должны соответствовать production-grade уровню:

- **SRP (Single Responsibility Principle)**: каждый модуль имеет одну четкую ответственность
- **Deterministic**: детерминированное поведение, без скрытых зависимостей
- **Domain-pure**: чистая доменная логика без инфраструктурных зависимостей
- **Microservice-ready**: готовность к использованию в микросервисной архитектуре
- **Scalable rule-engine**: масштабируемая архитектура правил без if/else-монолита
- **Strict typing**: union-типы вместо string, branded types, без Record в domain слое
- **Без side-effects**: явные зависимости, без скрытого coupling
- **Extensible**: расширяемость без изменения core-логики
- **Эталонная архитектура**: следование best practices
- **Русские JSDoc**: все публичные API документированы на русском языке

## Шаги рефакторинга

### 1. Создать директорию runtime/ ✅

Создать `packages/app/src/runtime/`

### 2. Разделить telemetry.ts ✅

**2.1. Создать новый `lib/telemetry.ts` (чистая часть)**

- Создать файл с production-grade архитектурой:
  - Класс `TelemetryClient` (immutable, deterministic)
  - `createConsoleSink()`, `createExternalSink()` (pure factories)
  - Типы и интерфейсы (strict typing, union types, без Record в domain)
  - `telemetryLevels`, `levelPriority` константы
  - `getGlobalClientForDebug()` (только для dev)
- Принципы:
  - SRP: только чистые утилиты и классы
  - Domain-pure: без side-effects
  - Microservice-ready: переиспользуемый в любом runtime
  - Strict typing: union types вместо string, branded types
  - Extensible: расширяемость без изменения core
  - Русские JSDoc комментарии

**2.2. Создать новый `runtime/telemetry.ts` (singleton часть)**

- Создать файл с singleton логикой:
  - `let globalClient: TelemetryClient | null = null`
  - `initTelemetry()` (инициализация singleton)
  - `getGlobalTelemetryClient()` (получение singleton)
  - `infoFireAndForget()`, `warnFireAndForget()`, `errorFireAndForget()`
  - `logFireAndForget()`
  - `isTelemetryInitialized()`
  - `setGlobalClientForDebug()`, `resetGlobalClient()` (для тестов)
- Импортировать `TelemetryClient` из `../lib/telemetry.js`
- Импортировать типы из `../types/telemetry.js`
- Принципы:
  - SRP: только singleton логика
  - Deterministic: явная инициализация
  - Без скрытого coupling: явные зависимости

**2.3. Обновить экспорты в `index.ts`**

- Экспортировать singleton функции из `'./runtime/telemetry.js'`
- Экспортировать типы и классы из `'./lib/telemetry.js'`

**2.4. Обновить все импорты telemetry**

- Найти все импорты singleton функций (`getGlobalTelemetryClient`, `initTelemetry`, `infoFireAndForget`, `warnFireAndForget`, `errorFireAndForget`) из `'../lib/telemetry.js'` или `'./lib/telemetry.js'`
- Заменить на `'../runtime/telemetry.js'` или `'./runtime/telemetry.js'`
- Обновить `background/scheduler.ts`: `'../lib/telemetry.js'` → `'../runtime/telemetry.js'`
- Обновить все тесты с моками `lib/telemetry.js` → `runtime/telemetry.js`
- Импорты класса `TelemetryClient` оставить из `lib/telemetry.js`

### 3. Переместить auth-service.ts

**3.1. Переместить `lib/auth-service.ts` → `runtime/auth-service.ts`**

- Переместить файл целиком
- Обновить относительные импорты внутри файла (если есть)

**3.2. Обновить экспорты в `index.ts`**

- Найти экспорт `'./lib/auth-service.js'`
- Заменить на `'./runtime/auth-service.js'`

**3.3. Обновить все импорты auth-service**

- Найти все импорты `authService`, `createAuthService` из `'../lib/auth-service.js'` или `'./lib/auth-service.js'`
- Заменить на `'../runtime/auth-service.js'` или `'./runtime/auth-service.js'`
- Обновить все тесты с моками `lib/auth-service.js` → `runtime/auth-service.js`

### 4. Переместить event-bus.ts

**4.1. Переместить `events/event-bus.ts` → `runtime/event-bus.ts`**

- Переместить файл целиком
- Обновить относительные импорты внутри файла:
  - `'./app-events.js'` → `'../events/app-events.js'`

**4.2. Обновить экспорты в `index.ts`**

- Найти экспорт `'./events/event-bus.js'`
- Заменить на `'./runtime/event-bus.js'`

**4.3. Обновить все импорты event-bus**

- Найти все импорты `eventBus`, `onEvent`, `publishEvent` из `'../events/event-bus.js'` или `'./events/event-bus.js'`
- Заменить на `'../runtime/event-bus.js'` или `'./runtime/event-bus.js'`
- Обновить все тесты с моками `events/event-bus.js` → `runtime/event-bus.js`

### 5. Переместить app-lifecycle.ts

**5.1. Переместить `lib/app-lifecycle.ts` → `runtime/app-lifecycle.ts`**

- Переместить файл целиком
- Обновить импорт `background/tasks.js`: `'../background/tasks.js'` (путь не изменится)

**5.2. Обновить экспорты в `index.ts`**

- Найти экспорт `'./lib/app-lifecycle.js'`
- Заменить на `'./runtime/app-lifecycle.js'`

**5.3. Обновить все импорты app-lifecycle**

- Найти все импорты `appLifecycle` из `'../lib/app-lifecycle.js'` или `'./lib/app-lifecycle.js'`
- Заменить на `'../runtime/app-lifecycle.js'` или `'./runtime/app-lifecycle.js'`
- Обновить все тесты с импортами `lib/app-lifecycle.js` → `runtime/app-lifecycle.js`

### 6. Переместить logger.ts

**6.1. Переместить `lib/logger.ts` → `runtime/logger.ts`**

- Переместить файл целиком
- Обновить импорт fire-and-forget функций:
  - `'./telemetry.js'` → `'./telemetry.js'` (внутри runtime/, путь не изменится)

**6.2. Обновить экспорты в `index.ts`**

- Найти экспорт `'./lib/logger.js'`
- Заменить на `'./runtime/logger.js'`

**6.3. Обновить все импорты logger**

- Найти все импорты `log`, `info`, `warn`, `error` из `'../lib/logger.js'` или `'./lib/logger.js'`
- Заменить на `'../runtime/logger.js'` или `'./runtime/logger.js'`
- Обновить все тесты с импортами `lib/logger.js` → `runtime/logger.js`

### 7. Обновить package.json exports

Добавить в `package.json`:

```json
"exports": {
  ".": "./dist/esm/index.js",
  "./lib/*": "./dist/esm/lib/*.js",
  "./runtime/*": "./dist/esm/runtime/*.js"
}
```

### 8. Обновить импорты в feature-auth

**8.1. Обновить `packages/feature-auth/src/effects/login/error-mapper.ts`**

- Изменить relative import на пакетный:
  - `'../../../../app/src/lib/error-mapping.js'` → `'@livai/app/lib/error-mapping.js'`

### 9. Проверка

**9.1. Запустить линтер**

- Проверить отсутствие ошибок `import/no-relative-packages`

**9.2. Запустить тесты**

- `packages/feature-auth/tests/unit/effects/login/error-mapper.test.ts` должен проходить без моков telemetry/scheduler
- Все тесты должны проходить с обновленными путями

**9.3. Проверить сборку**

- Убедиться что все импорты разрешаются корректно

## Итоговые изменения файлов

### Перемещенные файлы

- `lib/auth-service.ts` → `runtime/auth-service.ts` (шаг 3)
- `lib/app-lifecycle.ts` → `runtime/app-lifecycle.ts` (шаг 5)
- `lib/logger.ts` → `runtime/logger.ts` (шаг 6)
- `events/event-bus.ts` → `runtime/event-bus.ts` (шаг 4)

### Разделенные файлы

- `lib/telemetry.ts` → `lib/telemetry.ts` (чистая часть) + `runtime/telemetry.ts` (singleton) (шаг 2)

### Обновленные файлы (в каждом шаге сразу)

- `index.ts` - экспорты обновлены в шагах 2.3, 3.2, 4.2, 5.2, 6.2
- `package.json` - exports добавлены в шаге 7
- `background/scheduler.ts` - импорт telemetry обновлен в шаге 2.4
- `packages/feature-auth/src/effects/login/error-mapper.ts` - импорт обновлен в шаге 8
- Все файлы с импортами перемещенных модулей - обновлены в соответствующих шагах
- Все тесты с моками и импортами - обновлены в соответствующих шагах

## Результат

- `@livai/app/lib/*` - безопасные чистые импорты без side-effects
- `@livai/app/runtime/*` - явные runtime singletons
- ESLint rule соблюдается
- Тесты проходят без моков для чистых утилит
