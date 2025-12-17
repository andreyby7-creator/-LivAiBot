# Error Kernel - Система ошибок

Типобезопасная система обработки ошибок для всей платформы LivAI. Обеспечивает единый ABI (Application Binary Interface) ошибок, гарантирующий стабильность между версиями и слоями архитектуры.

## Назначение

- **Типобезопасная обработка ошибок** — полная типизация на уровне TypeScript с exhaustive pattern matching
- **Observability** — встроенная поддержка метрик, correlationId, severity для мониторинга и алертинга
- **Multi-tenancy** — поддержка tenantId для изоляции данных
- **Protocol-agnostic** — независимость от HTTP/gRPC/fetch/Axios, работа через абстракции
- **Error chaining** — безопасная цепочка причин ошибок без циклических зависимостей

## Основные принципы

- **FP-first** — полностью функциональный подход, без классов, immutable структуры
- **Hexagonal Architecture** — четкое разделение слоев (Domain/Application/Infrastructure/Security/Validation)
- **DDD** — доменные ошибки изолированы от инфраструктурных
- **Boundary vs Pure Helpers** — разделение между boundary функциями (сериализация, адаптеры) и pure утилитами

## Быстрый старт

### Установка

```bash
pnpm install
# или
npm install
```

### Сборка

```bash
pnpm build
```

Создает ESM сборку в `dist/esm/` с типами TypeScript (`.d.ts` файлы).

### Основные команды

```bash
# Линтинг (dev режим)
pnpm lint

# Линтинг (canary режим - максимальная строгость)
pnpm lint:canary

# Исправление ошибок линтинга
pnpm lint:fix

# Проверка типов TypeScript
pnpm type-check

# Тестирование
pnpm test

# Сборка типов
pnpm build:types

# Сборка JavaScript
pnpm build:js
```

## Архитектура системы ошибок

Система организована в слои с четким разделением ответственности:

```
Base Layer (Error Kernel)
    ↓
Domain / Application / Infrastructure / Security / Validation Layers
    ↓
Serialization / Adapters / Normalizers Layers
```

### Роли слоев

- **Base Layer** — фундаментальный Error Kernel, стабильный ABI для всех слоев
- **Domain Layer** — бизнес-логика ошибок, чистый DDD без инфраструктуры
- **Application Layer** — оркестрация use-case, CQRS ошибки, permissions
- **Infrastructure Layer** — IO операции, сеть, БД, внешние сервисы
- **Security Layer** — authentication, authorization, rate limiting
- **Validation Layer** — валидация входных данных и схем
- **Serialization Layer** — преобразование в форматы для HTTP/Log/Telemetry
- **Adapters Layer** — интеграция с внешними системами (Effect, HTTP клиенты)
- **Normalizers Layer** — нормализация внешних ошибок в BaseError

## Описание файлов по слоям

### Base Layer (`errors/base/`)

#### `BaseError.ts`
**Назначение:** Базовый тип ошибки и функции создания  
**Функционал:** Определяет `BaseError` тип, функции `createError()` и `wrapUnknownError()` для создания ошибок, `matchError()` для pattern matching, smart constructors для слоев  
**Зависимости:** `ErrorCode`, `ErrorCodeMetaData`, `ErrorConstants`, `ErrorMetadata`, `ErrorUtils`  
**Экспортирует:** `BaseError` тип, `createError()`, `wrapUnknownError()`, `matchError()`, `isErrorCode()`, `createDomainError()`, `createApplicationError()`, `createInfrastructureError()`, `createSecurityError()`

#### `ErrorCode.ts`
**Назначение:** Стабильные коды ошибок (ABI контракт)  
**Функционал:** Определяет `ERROR_CODE` константы для всех слоев (DOMAIN_*, APPLICATION_*, INFRA_*, SECURITY_*, VALIDATION_*), type guard `isErrorCode()`  
**Зависимости:** Нет  
**Экспортирует:** `ERROR_CODE` константа, `ErrorCode` тип, `isErrorCode()` guard, `assertNever()` helper

#### `ErrorConstants.ts`
**Назначение:** Константы для классификации ошибок  
**Функционал:** Определяет `ERROR_SEVERITY` (LOW, MEDIUM, HIGH, CRITICAL), `ERROR_CATEGORY` (VALIDATION, AUTHORIZATION, BUSINESS, INFRASTRUCTURE, UNKNOWN), `ERROR_ORIGIN` (DOMAIN, APPLICATION, INFRASTRUCTURE, SECURITY), type guards для каждого  
**Зависимости:** Нет  
**Экспортирует:** Константы `ERROR_SEVERITY`, `ERROR_CATEGORY`, `ERROR_ORIGIN`, типы `ErrorSeverity`, `ErrorCategory`, `ErrorOrigin`, guards `isErrorSeverity()`, `isErrorCategory()`, `isErrorOrigin()`

#### `ErrorMetadata.ts`
**Назначение:** Типы и factory для метаданных ошибок  
**Функционал:** Определяет `ErrorMetadata` тип с опциональными полями (correlationId, tenantId, severity, category, origin, retryable, context, localizedMessage, cause, extra), factory `createErrorMetadata()` с type guards  
**Зависимости:** `ErrorConstants` (типы), `type-fest` (ReadonlyDeep)  
**Экспортирует:** `ErrorMetadata` тип, `createErrorMetadata()` factory

#### `ErrorCodeMeta.ts`
**Назначение:** Расширенные метаданные для кодов ошибок  
**Функционал:** Определяет типы `ErrorCodeMeta`, `HttpStatusCode`, `GrpcStatusCode`, `ErrorMetrics`, helpers для валидации HTTP статусов, factory `createErrorCodeMetaWithDefaults()`  
**Зависимости:** `ErrorConstants`, `ErrorCode`  
**Экспортирует:** Типы `ErrorCodeMeta`, `HttpStatusCode`, `GrpcStatusCode`, `ErrorMetrics`, константы `HTTP_STATUS_RANGE`, `HTTP_STATUS_CATEGORY_RANGES`, функции валидации и helpers

#### `ErrorCodeMetaData.ts`
**Назначение:** Централизованный реестр метаданных для всех кодов ошибок  
**Функционал:** Определяет `ERROR_CODE_META` реестр с полными метаданными для каждого кода, функции `getErrorCodeMeta()`, `hasErrorCodeMeta()`, `getErrorCodeMetaOrThrow()`  
**Зависимости:** `ErrorCode`, `ErrorCodeMeta`, `ErrorConstants`, `ErrorUtils`  
**Экспортирует:** `ERROR_CODE_META` реестр, функции доступа к метаданным

#### `ErrorUtils.ts`
**Назначение:** Утилиты для работы с ошибками  
**Функционал:** Type guards по слоям, helpers для метаданных, severity-based helpers (requiresAlert, shouldBlockDeployment, getErrorPriority), cause chain utilities, фильтрация и поиск, сравнение, контекст, валидация, deepFreeze для immutability  
**Зависимости:** `ErrorCode`, `ErrorConstants`, `BaseError`, `ErrorMetadata`  
**Экспортирует:** Type guards (`isBaseError`, `isDomainError`, `isApplicationError`, и т.д.), metadata helpers, cause chain utilities, filtering/searching, comparison, context utilities, validation utilities, `deepFreeze()`

#### `index.ts`
**Назначение:** Публичный экспорт всего base слоя  
**Функционал:** Реэкспортирует все типы, функции и константы из base слоя  
**Зависимости:** Все файлы base слоя  
**Экспортирует:** Все публичные экспорты base слоя

### Domain Layer (`errors/domain/`)

#### `DomainError.ts`
**Назначение:** ADT ошибок доменного слоя  
**Функционал:** Определяет discriminated union типов domain ошибок (EntityNotFoundError, BusinessRuleViolationError, DomainInvariantBrokenError, ValidationError, StateTransitionError), smart constructors, pattern matching `matchDomainError()`, локальный Either для type-safe обработки  
**Зависимости:** `BaseError`, `ErrorCode`  
**Экспортирует:** ADT типы domain ошибок, smart constructors, `matchDomainError()`, типы контекстов, `DomainErrorMetadata`, `createDomainMetadata()`, локальный `Either` тип и helpers

#### `DomainErrorMeta.ts`
**Назначение:** Domain-специфичные helpers для метаданных  
**Функционал:** Функции для получения метаданных из реестра (`getDomainErrorMeta()`), проверка операционных свойств (`isDomainErrorRetryable()`), извлечение классификационных свойств (severity, category)  
**Зависимости:** `DomainError`, `ErrorCodeMetaData`  
**Экспортирует:** `getDomainErrorMeta()`, `isDomainErrorRetryable()`, `getDomainErrorSeverity()`, `getDomainErrorCategory()`

#### `index.ts`
**Назначение:** Публичный экспорт domain слоя  
**Функционал:** Реэкспортирует типы и функции domain слоя  
**Зависимости:** `DomainError`, `DomainErrorMeta`  
**Экспортирует:** Все публичные экспорты domain слоя

### Application Layer (`errors/application/`)

#### `ApplicationError.ts`
**Назначение:** ADT ошибок application слоя (CQRS, orchestration)  
**Функционал:** Определяет discriminated union типов application ошибок (CommandRejectedError, QueryFailedError, PermissionDeniedError), smart constructors, pattern matching `matchApplicationError()`, локальный Either  
**Зависимости:** `BaseError`, `ErrorCode`  
**Экспортирует:** ADT типы application ошибок, smart constructors, `matchApplicationError()`, типы контекстов, `ApplicationErrorMetadata`, `createApplicationMetadata()`, локальный `Either` и helpers

#### `ApplicationErrorMeta.ts`
**Назначение:** Application-специфичные helpers для метаданных  
**Функционал:** Функции для получения метаданных (`getApplicationErrorMeta()`), проверка retryable (`isApplicationErrorRetryable()`), извлечение severity и category  
**Зависимости:** `ApplicationError`, `ErrorCodeMetaData`  
**Экспортирует:** `getApplicationErrorMeta()`, `isApplicationErrorRetryable()`, `getApplicationErrorSeverity()`, `getApplicationErrorCategory()`

#### `index.ts`
**Назначение:** Публичный экспорт application слоя  
**Функционал:** Реэкспортирует типы и функции application слоя  
**Зависимости:** `ApplicationError`, `ApplicationErrorMeta`  
**Экспортирует:** Все публичные экспорты application слоя

### Infrastructure Layer (`errors/infrastructure/`)

#### `InfrastructureError.ts`
**Назначение:** ADT ошибок infrastructure слоя (IO, network, DB)  
**Функционал:** Определяет discriminated union типов infrastructure ошибок (NetworkError, TimeoutError, DatabaseError, ExternalServiceError, ResourceUnavailableError), smart constructors, pattern matching `matchInfrastructureError()`, локальный `IOResult` (Either alias), helpers `mapIO()` и `flatMapIO()`  
**Зависимости:** `BaseError`, `ErrorCode`  
**Экспортирует:** ADT типы infrastructure ошибок, smart constructors, `matchInfrastructureError()`, типы контекстов, `InfrastructureErrorMetadata`, `createInfrastructureMetadata()`, `IOResult` тип и helpers

#### `InfrastructureErrorMeta.ts`
**Назначение:** Infrastructure-специфичные helpers для метаданных  
**Функционал:** Функции для получения метаданных (`getInfrastructureErrorMeta()`, `getInfrastructureErrorMetaOrThrow()`), проверка retryable (`isInfrastructureErrorRetryable()`), извлечение severity и category  
**Зависимости:** `InfrastructureError`, `ErrorCodeMetaData`  
**Экспортирует:** `getInfrastructureErrorMeta()`, `getInfrastructureErrorMetaOrThrow()`, `isInfrastructureErrorRetryable()`, `getInfrastructureErrorSeverity()`, `getInfrastructureErrorCategory()`

#### `index.ts`
**Назначение:** Публичный экспорт infrastructure слоя  
**Функционал:** Реэкспортирует типы и функции infrastructure слоя  
**Зависимости:** `InfrastructureError`, `InfrastructureErrorMeta`  
**Экспортирует:** Все публичные экспорты infrastructure слоя

### Security Layer (`errors/security/`)

#### `SecurityError.ts`
**Назначение:** ADT ошибок security слоя (auth, authorization, rate limiting)  
**Функционал:** Определяет discriminated union типов security ошибок (UnauthorizedError, ForbiddenError, TokenExpiredError, RateLimitedError), smart constructors, pattern matching `matchSecurityError()`, локальный Either, helpers `mapSec()` и `flatMapSec()`, `isRetryable()` и `isRecoverable()`  
**Зависимости:** `BaseError`, `ErrorCode`, `SecurityErrorMeta`  
**Экспортирует:** ADT типы security ошибок, smart constructors, `matchSecurityError()`, типы контекстов, `SecurityErrorMetadata`, `createSecurityMetadata()`, локальный `Either` и helpers

#### `SecurityErrorMeta.ts`
**Назначение:** Security-специфичные helpers для метаданных  
**Функционал:** Функции для получения метаданных (`getSecurityErrorMeta()`, `getSecurityErrorMetaOrThrow()`), проверка retryable и recoverable (`isSecurityErrorRetryable()`, `isSecurityErrorRecoverable()`), извлечение severity и category  
**Зависимости:** `SecurityError`, `ErrorCodeMetaData`  
**Экспортирует:** `getSecurityErrorMeta()`, `getSecurityErrorMetaOrThrow()`, `isSecurityErrorRetryable()`, `isSecurityErrorRecoverable()`, `getSecurityErrorSeverity()`, `getSecurityErrorCategory()`

#### `index.ts`
**Назначение:** Публичный экспорт security слоя  
**Функционал:** Реэкспортирует типы и функции security слоя  
**Зависимости:** `SecurityError`, `SecurityErrorMeta`  
**Экспортирует:** Все публичные экспорты security слоя

### Validation Layer (`errors/validation/`)

#### `ValidationError.ts`
**Назначение:** ADT ошибок validation слоя (input validation, schema validation)  
**Функционал:** Определяет discriminated union типов validation ошибок (ValidationFailedError, SchemaMismatchError, RequiredFieldMissingError), smart constructors, pattern matching `matchValidationError()`, локальный Either, helpers `mapVal()` и `flatMapVal()`  
**Зависимости:** `BaseError`, `ErrorCode`  
**Экспортирует:** ADT типы validation ошибок, smart constructors, `matchValidationError()`, типы контекстов, `ValidationErrorMetadata`, `createValidationMetadata()`, локальный `Either` и helpers

#### `ValidationErrorMeta.ts`
**Назначение:** Validation-специфичные helpers для метаданных  
**Функционал:** Функции для получения метаданных (`getValidationErrorMeta()`), проверка retryable и recoverable (`isValidationErrorRetryable()`, `isValidationErrorRecoverable()`), извлечение severity и category  
**Зависимости:** `ValidationError`, `ErrorCodeMetaData`  
**Экспортирует:** `getValidationErrorMeta()`, `isValidationErrorRetryable()`, `isValidationErrorRecoverable()`, `getValidationErrorSeverity()`, `getValidationErrorCategory()`

#### `index.ts`
**Назначение:** Публичный экспорт validation слоя  
**Функционал:** Реэкспортирует типы и функции validation слоя  
**Зависимости:** `ValidationError`, `ValidationErrorMeta`  
**Экспортирует:** Все публичные экспорты validation слоя

### Serialization Layer (`errors/serialization/`)

#### `ErrorSerialization.ts`
**Назначение:** Специализированная сериализация BaseError для разных audiences  
**Функционал:** HTTP сериализация (`toHttpErrorResponse()`, `getHttpStatusFromError()`), gRPC сериализация (`toGrpcErrorResponse()`, `getGrpcStatusFromError()`), Log сериализация (`toLogErrorFormat()` с опциями), Telemetry сериализация (`toTelemetryErrorFormat()`), базовый тип `SerializedErrorBase`  
**Зависимости:** `BaseError`, `ErrorCodeMetaData`, `ErrorConstants`, `ErrorUtils`  
**Экспортирует:** Типы `SerializedErrorBase`, `HttpErrorResponse`, `GrpcErrorResponse`, `LogErrorFormat`, `TelemetryErrorFormat`, функции сериализации для каждого формата

### Adapters Layer (`errors/adapters/`)

#### `EffectAdapter.ts`
**Назначение:** Адаптеры для интеграции с Effect системой  
**Функционал:** Конвертация BaseError ↔ Effect.Error (`toEffectError()`, `toEffectErrorAsync()`, `fromEffectError()`), type guard `isEffectError()`, динамическая загрузка Effect модуля  
**Зависимости:** `BaseError`, `ErrorCode`, `effect` (peer dependency)  
**Экспортирует:** `toEffectError()`, `toEffectErrorAsync()`, `fromEffectError()`, `isEffectError()`

#### `index.ts`
**Назначение:** Публичный экспорт adapters слоя  
**Функционал:** Реэкспортирует адаптеры  
**Зависимости:** `EffectAdapter`  
**Экспортирует:** Все публичные экспорты adapters слоя

### Normalizers Layer (`errors/normalizers/`)

#### `HttpErrorNormalizer.ts`
**Назначение:** Нормализация HTTP-ошибок (fetch/axios) → BaseError  
**Функционал:** Конвертация HTTP-ответов (Response, AxiosError) в BaseError, извлечение correlationId из заголовков, маппинг HTTP статусов на ErrorCode через ERROR_CODE_META, нормализация заголовков  
**Зависимости:** `BaseError`, `ErrorCode`, `InfrastructureError`  
**Экспортирует:** Типы `HttpHeaders`, `HttpErrorContext`, `HttpErrorLike`, функции `normalizeHttpResponse()`, `normalizeHttpError()`, `extractCorrelationId()`

#### `index.ts`
**Назначение:** Публичный экспорт normalizers слоя  
**Функционал:** Реэкспортирует нормализаторы  
**Зависимости:** `HttpErrorNormalizer`  
**Экспортирует:** Все публичные экспорты normalizers слоя

### Root (`errors/`)

#### `index.ts`
**Назначение:** Единая точка входа для всей системы ошибок  
**Функционал:** Реэкспортирует все публичные типы и функции из всех слоев  
**Зависимости:** Все слои системы ошибок  
**Экспортирует:** Все публичные экспорты всех слоев

## Структура дерева системы ошибок

```
errors/
├── base/                          # Error Kernel (фундаментальный слой)
│   ├── BaseError.ts               # Базовый тип и функции создания
│   ├── ErrorCode.ts               # Стабильные коды ошибок
│   ├── ErrorConstants.ts         # Severity, Category, Origin константы
│   ├── ErrorMetadata.ts          # Типы метаданных
│   ├── ErrorCodeMeta.ts          # Расширенные метаданные
│   ├── ErrorCodeMetaData.ts      # Централизованный реестр метаданных
│   ├── ErrorUtils.ts             # Утилиты для работы с ошибками
│   └── index.ts                   # Публичный экспорт base слоя
│
├── domain/                        # Domain Layer (бизнес-логика)
│   ├── DomainError.ts            # ADT domain ошибок
│   ├── DomainErrorMeta.ts        # Domain-специфичные helpers
│   └── index.ts                   # Публичный экспорт domain слоя
│
├── application/                   # Application Layer (оркестрация)
│   ├── ApplicationError.ts      # ADT application ошибок
│   ├── ApplicationErrorMeta.ts  # Application-специфичные helpers
│   └── index.ts                   # Публичный экспорт application слоя
│
├── infrastructure/                # Infrastructure Layer (IO, network, DB)
│   ├── InfrastructureError.ts   # ADT infrastructure ошибок
│   ├── InfrastructureErrorMeta.ts # Infrastructure-специфичные helpers
│   └── index.ts                   # Публичный экспорт infrastructure слоя
│
├── security/                      # Security Layer (auth, authorization)
│   ├── SecurityError.ts          # ADT security ошибок
│   ├── SecurityErrorMeta.ts      # Security-специфичные helpers
│   └── index.ts                   # Публичный экспорт security слоя
│
├── validation/                    # Validation Layer (input validation)
│   ├── ValidationError.ts        # ADT validation ошибок
│   ├── ValidationErrorMeta.ts    # Validation-специфичные helpers
│   └── index.ts                   # Публичный экспорт validation слоя
│
├── serialization/                 # Serialization Layer (boundary)
│   └── ErrorSerialization.ts     # HTTP/gRPC/Log/Telemetry сериализация
│
├── adapters/                      # Adapters Layer (интеграция)
│   ├── EffectAdapter.ts         # Effect интеграция
│   └── index.ts                   # Публичный экспорт adapters слоя
│
├── normalizers/                   # Normalizers Layer (нормализация)
│   ├── HttpErrorNormalizer.ts   # HTTP ошибки → BaseError
│   └── index.ts                   # Публичный экспорт normalizers слоя
│
└── index.ts                       # Единая точка входа
```

## Потенциал и возможности

### Расширяемость

- **Новые ERROR_CODE** — добавление новых кодов без изменения существующих (backward compatible)
- **Расширение через `extra`** — дополнительные поля через `ErrorMetadata.extra` без изменения базовых типов
- **Новые форматы сериализации** — добавление новых форматов в `ErrorSerialization` (MINOR версия)

### Observability-ready

- **Метрики** — стандартизированные метрики в `ERROR_CODE_META` для автоматического сбора
- **CorrelationId** — встроенная поддержка трейсинга запросов через `correlationId`
- **Severity** — классификация по уровню серьезности (CRITICAL, HIGH, MEDIUM, LOW) для алертинга
- **Priority** — числовые приоритеты (0-100) для сортировки и очередей

### Protocol-agnostic

- **HTTP/gRPC/fetch/Axios** — работа через абстракции, независимость от конкретных протоколов
- **Transport mapping** — автоматический маппинг через `ERROR_CODE_META` (httpStatus, grpcStatus)
- **Normalizers** — универсальные нормализаторы для любых HTTP-клиентов

### Error chaining и безопасная сериализация

- **Cause chain** — типобезопасная цепочка причин ошибок (`cause?: BaseError | Error`)
- **Без циклических зависимостей** — cause не сериализуется напрямую, только флаг `hasCause`
- **Root cause extraction** — утилиты для получения корневой причины (`getRootCause()`, `getCauseChain()`)

## Важные примечания

### Type guards вместо type assertions

Используйте type guards (`isErrorSeverity()`, `isErrorCategory()`, `isErrorOrigin()`) вместо type assertions для корректной работы с type-aware правилами ESLint и стабильности результатов линтинга до и после билда.

### Исключение dist из линтинга

Файлы `dist/**/*.d.ts` автоматически исключаются из линтинга через глобальный `ignores` в ESLint конфигурации. Это предотвращает линтинг сгенерированных TypeScript declaration файлов.

### Immutability

Все ошибки — immutable объекты (`ReadonlyDeep<BaseError>`). Не мутируйте созданные ошибки после создания. Используйте `deepFreeze()` для runtime защиты при необходимости.

### Semver правила

- Изменения форматов сериализации = MAJOR
- Добавление полей = MINOR
- Удаление полей = MAJOR
- Изменение семантики существующих кодов = MAJOR

---

*Error Kernel — это ABI всей платформы. Его нельзя "рефакторить", только расширять. Любые изменения должны быть тщательно обоснованы и документированы.*
