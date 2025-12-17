# 🔷 Core Contracts Structure v3.0

```
core-contracts/
├── package.json                       # Зависимости Core (Effect + FP экосистема) БЕЗ author & общих devDeps (в корне) | JSON
├── tsconfig.json                      # Строгая TS конфигурация (noImplicitAny, exactOptionalPropertyTypes) | JSON
├── tsconfig.build.json                # Конфигурация сборки типов (tsc --build) | JSON
├── tsup.config.ts                     # Конфигурация сборки ESM (entry points, externals) | TypeScript
├── vitest.config.ts                   # Конфигурация тестирования (coverage, globals, setup) | TypeScript
├── vitest.setup.ts                    # Глобальная настройка тестов (mocks, globals) | TypeScript
├── LICENSE                            # MIT лицензия | Text
├── .gitignore                         # Исключаемые файлы (dist, coverage, logs) | Git
│
├── src/
│   ├── _boundaries.md                 # Архитектурные границы и правила зависимостей | Markdown
│   ├── index.ts                       # Публичный API Core (barrel export, semver-safe) | TypeScript
│   │
│   ├── io/
│   │   ├── index.ts                   # Центральный экспорт IO (effect, schema) | TypeScript + Effect-TS
│   │   │
│   │   ├── effect/
│   │   │   ├── index.ts               # Реэкспорт Effect API + project-safe aliases | TypeScript + Effect-TS
│   │   │   ├── adapters.ts            # Safe-обёртки Effect (tryPromise, fromUnknownError) | TypeScript + Effect-TS
│   │   │   │
│   │   │   ├── operators/
│   │   │   │   ├── retry.ts           # Применение retry-политик (НЕ сами политики) | TypeScript + Effect-TS
│   │   │   │   ├── timeout.ts         # Timeout операторы (fail / fallback) | TypeScript + Effect-TS
│   │   │   │   └── logging.ts         # Structured logging boundary (без конкретного логгера) | TypeScript + Effect-TS
│   │   │   │
│   │   │   └── runtime/
│   │   │       ├── index.ts           # Runtime контракты и API | TypeScript + Effect-TS
│   │   │       ├── Runtime.ts         # Runtime интерфейс / contract | TypeScript + Effect-TS
│   │   │       └── ManagedRuntime.ts  # Runtime helpers (optional) | TypeScript + Effect-TS
│   │   │
│   │   └── schema/
│   │       ├── index.ts               # Реэкспорт Schema + safe helpers | TypeScript + @effect/schema
│   │       ├── adapters.ts            # Custom validators / transformers | TypeScript + @effect/schema
│   │       │
│   │       └── validators/
│   │           ├── email.ts           # Email validation (RFC + project rules) | TypeScript + @effect/schema
│   │           ├── uuid.ts            # UUID / ULID validation | TypeScript + @effect/schema
│   │           └── date.ts            # ISO date validation (timezone-safe) | TypeScript + @effect/schema
│   │
│   ├── fp/
│   │   ├── index.ts                   # Центральный экспорт FP (schedule, layers, utils) | TypeScript
│   │   │
│   │   ├── schedule/
│   │   │   ├── index.ts               # Экспорт retry / backoff политик | TypeScript + Effect-TS Schedule
│   │   │   ├── retry.ts               # Retry-политики (exponential, jitter, maxAttempts) | TypeScript + Effect-TS Schedule
│   │   │   └── adapters.ts            # Комбинаторы Schedule (compose, until) | TypeScript + Effect-TS Schedule
│   │   │
│   │   ├── layers/
│   │   │   ├── index.ts               # Layer контракты (без infra реализаций) | TypeScript + Effect-TS
│   │   │   └── testing.ts             # Testing Layers API (in-memory, deterministic) | TypeScript + Effect-TS
│   │   │
│   │   └── utils/
│   │       ├── index.ts               # Минимальный набор FP утилит | TypeScript
│   │       ├── pipe.ts                # Data-first композиция | TypeScript
│   │       ├── compose.ts             # Function-first композиция | TypeScript
│   │       └── lift.ts                # Lift чистых значений в Effect | TypeScript + Effect-TS
│   │
│   ├── domain/
│   │   ├── index.ts                   # Экспорт Domain API | TypeScript
│   │   │
│   │   ├── model/
│   │   │   ├── index.ts               # Domain models (value objects, DTOs) | TypeScript
│   │   │   ├── EntityId.ts            # Stable ID abstraction (UUID / ULID) | TypeScript
│   │   │   └── ValueObject.ts         # Equality-by-value base class | TypeScript
│   │   │
│   │   ├── aggregates/
│   │   │   ├── index.ts               # Aggregate Roots и Base Entities | TypeScript + DDD
│   │   │   ├── AggregateRoot.ts       # Базовый AggregateRoot + domain events | TypeScript + Immutable
│   │   │   └── BaseEntity.ts          # Entity с identity и equality | TypeScript + Immutable
│   │   │
│   │   ├── events/
│   │   │   ├── index.ts               # Domain Events (НЕ integration events) | TypeScript + ADT
│   │   │   └── DomainEvent.ts         # Базовый domain event | TypeScript + ADT
│   │   │
│   │   ├── invariants/
│   │   │   ├── index.ts               # Business invariants (must-never-break) | TypeScript
│   │   │   └── invariant.ts           # Pure invariant guard | TypeScript
│   │   │
│   │   ├── specifications/
│   │   │   ├── index.ts               # Query / policy specifications | TypeScript
│   │   │   └── Specification.ts       # AND / OR / NOT composition | TypeScript
│   │   │
│   │   ├── policies/
│   │   │   ├── index.ts               # Decision policies (discounts, limits, flags) | TypeScript
│   │   │   └── Policy.ts              # Policy interface for business decisions | TypeScript
│   │   │
│   │   ├── ports/
│   │   │   ├── index.ts               # Domain Ports (interfaces для IO layer) | TypeScript
│   │   │   └── Repository.ts          # Base repository interface | TypeScript
│   │   │
│   │   └── errors/
│   │       ├── index.ts               # Domain-specific errors | TypeScript + ADT
│   │       ├── DomainError.ts         # Pure domain failures | TypeScript + ADT
│   │       └── RuleViolationError.ts  # Business rule violations | TypeScript + ADT
│   │
│   ├── errors/
│   │   ├── README.md                  # Error Kernel архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API ошибок | TypeScript + ADT
│   │   │
│   │   ├── base/
│   │   │   ├── BaseError.ts           # Discriminated union base (_tag) | TypeScript + ADT
│   │   │   ├── ErrorCode.ts           # Stable error codes (semver-safe) | TypeScript
│   │   │   └── ErrorMetadata.ts       # Correlation / timestamp / context | TypeScript
│   │   │
│   │   ├── shape/
│   │   │   └── ErrorShape.ts          # Error contract for consumers (HTTP/RPC/UI) | TypeScript
│   │   │
│   │   ├── domain/
│   │   │   ├── DomainError.ts         # Pure domain failures | TypeScript + ADT
│   │   │   └── RuleViolationError.ts  # Business rule violations | TypeScript + ADT
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── InfrastructureError.ts # IO / network / DB failures | Стек: TypeScript + ADT
│   │   │   └── TimeoutError.ts        # Operation timeout | TypeScript + ADT
│   │   │
│   │   └── normalizers/
│   │       ├── ErrorNormalizer.ts     # unknown → CoreError (boundary only) | TypeScript + FP
│   │       └── HttpErrorNormalizer.ts # HTTP → CoreError mapping | TypeScript + FP
│   │
│   ├── logging/
│   │   ├── README.md                  # Logging система архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API логирования | TypeScript
│   │   │
│   │   ├── base/
│   │   │   ├── ILogger.ts             # Интерфейс логгера (FAANG-level contract) | TypeScript
│   │   │   ├── LogLevel.ts            # Уровни логирования (DEBUG, INFO, WARN, ERROR, FATAL) | TypeScript
│   │   │   ├── LogContext.ts          # Контекст логирования (correlationId, traceId, tenantId, userId) | TypeScript
│   │   │   ├── LogEntry.ts            # Иммутабельная запись лога | TypeScript
│   │   │   └── index.ts               # Публичный экспорт base слоя | TypeScript
│   │   │
│   │   ├── core/
│   │   │   ├── StructuredLogger.ts    # Основной структурированный логгер | TypeScript
│   │   │   ├── LoggerBuilder.ts       # Builder для создания логгеров | TypeScript
│   │   │   ├── NoOpLogger.ts          # Заглушка для тестов | TypeScript
│   │   │   └── index.ts               # Публичный экспорт core слоя | TypeScript
│   │   │
│   │   ├── tracing/
│   │   │   ├── DistributedTracing.ts # Генерация/извлечение trace IDs | TypeScript
│   │   │   ├── TraceContext.ts        # Контекст трассировки (W3C Trace Context) | TypeScript
│   │   │   └── index.ts               # Публичный экспорт tracing слоя | TypeScript
│   │   │
│   │   ├── outputs/
│   │   │   ├── ILogOutput.ts          # Интерфейс выходного канала | TypeScript
│   │   │   ├── ConsoleLogOutput.ts   # Консольный вывод | TypeScript
│   │   │   ├── FileLogOutput.ts       # Файловый вывод | TypeScript
│   │   │   └── index.ts               # Публичный экспорт outputs слоя | TypeScript
│   │   │
│   │   ├── adapters/
│   │   │   ├── ElkAdapter.ts          # Адаптер для ELK Stack | TypeScript
│   │   │   ├── SentryAdapter.ts       # Адаптер для Sentry (error tracking) | TypeScript
│   │   │   ├── PostHogAdapter.ts      # Адаптер для PostHog (analytics) | TypeScript
│   │   │   └── index.ts               # Публичный экспорт adapters слоя | TypeScript
│   │   │
│   │   ├── enrichers/
│   │   │   ├── ILogEnricher.ts        # Интерфейс обогатителя | TypeScript
│   │   │   ├── TenantEnricher.ts      # Добавление tenantId | TypeScript
│   │   │   ├── UserEnricher.ts        # Добавление userId | TypeScript
│   │   │   ├── ErrorEnricher.ts       # Интеграция с системой ошибок | TypeScript
│   │   │   └── index.ts               # Публичный экспорт enrichers слоя | TypeScript
│   │   │
│   │   ├── filters/
│   │   │   ├── ILogFilter.ts          # Интерфейс фильтра | TypeScript
│   │   │   ├── LevelFilter.ts         # Фильтр по уровню | TypeScript
│   │   │   ├── TenantFilter.ts        # Фильтр по tenant | TypeScript
│   │   │   └── index.ts               # Публичный экспорт filters слоя | TypeScript
│   │   │
│   │   ├── formatters/
│   │   │   ├── ILogFormatter.ts       # Интерфейс форматтера | TypeScript
│   │   │   ├── JsonFormatter.ts       # JSON формат (для ELK) | TypeScript
│   │   │   ├── PrettyFormatter.ts      # Человекочитаемый формат (dev) | TypeScript
│   │   │   └── index.ts               # Публичный экспорт formatters слоя | TypeScript
│   │   │
│   │   ├── redaction/
│   │   │   ├── ILogRedactionPolicy.ts # Интерфейс политики очистки | TypeScript
│   │   │   ├── DefaultRedactionPolicy.ts # Базовая политика (пароли, токены) | TypeScript
│   │   │   └── index.ts               # Публичный экспорт redaction слоя | TypeScript
│   │   │
│   │   ├── sampling/
│   │   │   ├── ILogSamplingStrategy.ts # Интерфейс стратегии сэмплирования | TypeScript
│   │   │   ├── RateSamplingStrategy.ts # Сэмплирование по частоте | TypeScript
│   │   │   └── index.ts               # Публичный экспорт sampling слоя | TypeScript
│   │   │
│   │   ├── audit/
│   │   │   ├── AuditLogger.ts         # Специализированный логгер для аудита | TypeScript
│   │   │   ├── AuditEntry.ts          # Тип записи аудита | TypeScript
│   │   │   ├── ActivityFilter.ts      # Фильтр активности пользователей | TypeScript
│   │   │   └── index.ts               # Публичный экспорт audit слоя | TypeScript
│   │   │
│   │   ├── metrics/
│   │   │   ├── IMetricsCollector.ts   # Интерфейс сборщика метрик | TypeScript
│   │   │   ├── AiUsageMetrics.ts      # AI метрики (tokens, requests, latency) | TypeScript
│   │   │   ├── BusinessMetrics.ts     # Бизнес-метрики (conversions, retention) | TypeScript
│   │   │   ├── SystemMetrics.ts       # Системные метрики (CPU, memory, errors) | TypeScript
│   │   │   └── index.ts               # Публичный экспорт metrics слоя | TypeScript
│   │   │
│   │   └── utils/
│   │       ├── context-merge.ts      # Объединение контекстов | TypeScript
│   │       ├── validation.ts          # Валидация логов | TypeScript
│   │       └── index.ts               # Публичный экспорт utils слоя | TypeScript
│   │
│   ├── context/
│   │   ├── _rules.ts                  # Context layer rules (NO business logic) | TypeScript
│   │   ├── index.ts                   # Экспорт context API | TypeScript + Effect-TS
│   │   │
│   │   ├── correlation/
│   │   │   └── CorrelationContext.ts  # traceId / requestId propagation | TypeScript + Effect-TS
│   │   │
│   │   └── tenant/
│   │       └── TenantContext.ts       # tenantId isolation (NO auth logic) | TypeScript + Effect-TS
│   │
│   ├── time/
│   │   ├── README.md                  # Time utilities архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API времени (barrel export) | TypeScript + Effect-TS
│   │   │
│   │   ├── TimeProvider.ts            # Effect-based TimeProvider (Clock service) | TypeScript + Effect-TS
│   │   ├── constants.ts               # Константы времени (MILLISECONDS, TIMEOUTS, INTERVALS) | TypeScript
│   │   ├── time-utils.ts              # Утилиты для работы с датами (diff, add, isPast, etc.) | TypeScript
│   │   └── RealTimeProvider.ts        # Реализация TimeProvider через Effect.Clock | TypeScript + Effect-TS
│   │
│   ├── config/
│   │   ├── README.md                  # Config архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API конфигурации (barrel export) | TypeScript + Effect-TS
│   │   │
│   │   ├── IConfigProvider.ts         # Интерфейс провайдера конфигурации | TypeScript + Effect-TS
│   │   ├── ConfigValue.ts             # Типизированное значение конфигурации | TypeScript
│   │   ├── CoreConfig.ts              # Базовая конфигурация (port, host, apiUrl, nodeEnv) | TypeScript + Effect-TS
│   │   └── EnvConfigProvider.ts       # Провайдер из env переменных (Effect-based) | TypeScript + Effect-TS
│   │
│   ├── resilience/
│   │   ├── README.md                  # Resilience архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API resilience (barrel export) | TypeScript + Effect-TS
│   │   │
│   │   ├── CircuitBreaker.ts          # Circuit Breaker (Effect.retry + Effect.catchAll) | TypeScript + Effect-TS
│   │   ├── RetryPolicy.ts             # Retry политики (Effect Schedule-based) | TypeScript + Effect-TS
│   │   ├── TimeoutPolicy.ts           # Timeout политики (Effect.timeout) | TypeScript + Effect-TS
│   │   ├── Backpressure.ts            # Backpressure (Effect-based rate limiting) | TypeScript + Effect-TS
│   │   └── ResilienceTypes.ts          # Типы для resilience паттернов | TypeScript
│   │
│   ├── rate-limiting/
│   │   ├── README.md                  # Rate Limiting архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API rate limiting (barrel export) | TypeScript + Effect-TS
│   │   │
│   │   ├── IRateLimiter.ts            # Интерфейс rate limiter (Effect-based) | TypeScript + Effect-TS
│   │   ├── IRateLimitPolicy.ts        # Интерфейс политики rate limiting | TypeScript
│   │   ├── TokenBucket.ts             # Token Bucket алгоритм (Effect + Ref) | TypeScript + Effect-TS
│   │   └── RateLimitTypes.ts          # Типы для rate limiting | TypeScript
│   │
│   ├── health/
│   │   ├── README.md                  # Health Checks архитектурный контракт | Markdown
│   │   ├── index.ts                   # Публичный API health checks (barrel export) | TypeScript + Effect-TS
│   │   │
│   │   ├── IHealthCheck.ts            # Интерфейс health check (Effect-based) | TypeScript + Effect-TS
│   │   ├── IHealthCheckAggregator.ts  # Агрегатор health checks | TypeScript + Effect-TS
│   │   ├── IHealthCheckProvider.ts    # Провайдер health checks | TypeScript + Effect-TS
│   │   └── HealthTypes.ts             # Типы health status (healthy, degraded, unhealthy) | TypeScript
│   │
│   └── targets/
│       ├── public.ts                  # Runtime-specific exports (adapter API) | TypeScript
│       ├── node.ts                    # Node runtime bindings | TypeScript + Node.js
│       ├── browser.ts                 # Browser runtime bindings | TypeScript + Web APIs
│       └── shared.ts                  # Runtime-agnostic exports | TypeScript
│
├── tests/
│   ├── index.ts                       # Test utilities export | TypeScript + Vitest
│   │
│   ├── contracts/
│   │   ├── index.ts                   # Contract test utilities | TypeScript + Vitest
│   │   ├── errors.contract.test.ts    # Error contract stability tests | TypeScript + Vitest
│   │   ├── domain.contract.test.ts    # Domain contract stability tests | TypeScript + Vitest
│   │   └── ports.contract.test.ts     # Domain ports contract tests | TypeScript + Vitest
│   │
│   ├── unit/
│   │   ├── index.ts                   # Unit tests (pure functions, domain logic) | TypeScript + Vitest
│   │   │
│   │   └── errors/
│   │       └── base/
│   │           └── base.test.ts       # Golden tests для Error Kernel ABI stability | TypeScript + Vitest
│   │   ├── io.test.ts                 # IO layer tests | TypeScript + Vitest + Effect-TS
│   │   ├── fp.test.ts                 # FP utilities tests | TypeScript + Vitest
│   │   ├── domain.test.ts             # Domain logic tests | TypeScript + Vitest
│   │   └── errors.test.ts             # Error handling tests | TypeScript + Vitest + ADT
│   │
│   └── integration/
│       └── index.test.ts              # Integration tests | TypeScript + Vitest + Effect-TS
│
├── dist/                              # Артефакты сборки (ESM, .d.ts) | -
├── coverage/                          # Отчеты покрытия тестирования | -
├── reports/                           # Различные отчеты (lint, audit, etc.) | -
│
├── docs/
│   ├── README.md                      # Core philosophy + dependency rules | Markdown
│   └── MIGRATION.md                   # Migration guide v2 → v3 | Markdown
│
├── node_modules/                      # Установленные зависимости | -
│
├── README.md                          # Core-Contracts overview (public-facing) | Markdown
```

## 📦 Dependencies (16 декабря 2025)

**Repository metadata, author, общие devDependencies** находятся в корневом `package.json` монопепозитория.

### Core Effect Ecosystem:
- **@effect/schema** - Runtime validation & codecs
- **@effect/platform** - Cross-platform utilities (FileSystem, Clock, Console)
- **@effect/printer-ansi** - ANSI terminal output for logging
- **@effect/typeclass** - Type classes (Eq, Ord, Monoid, Semigroup)
- **@effect/match** - Pattern matching for Effect types
- **effect** - Core FP library with Effects, Either, Option

### Functional Programming:
- **fp-ts** - TypeScript FP library (HKTs, type classes, optics)
- **monocle-ts** - Lenses for immutable data structures
- **newtype-ts** - Branded types for domain modeling

```json
{
  "name": "@livai/core-contracts",
  "version": "3.0.0",
  "type": "module",
  "dependencies": {
    "@effect/schema": "^0.75.5",
    "@effect/platform": "^0.74.0",
    "@effect/printer-ansi": "^0.44.0",
    "@effect/typeclass": "^0.38.0",
    "@effect/match": "^0.40.0",
    "effect": "^3.19.12",
    "fp-ts": "^2.16.11",
    "monocle-ts": "^2.3.13",
    "newtype-ts": "^0.3.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "typescript": "^5.9.3",
    "vitest": "^4.0.16"
  },
  "peerDependencies": {
    "typescript": ">=5.6.0"
  }
}
```
