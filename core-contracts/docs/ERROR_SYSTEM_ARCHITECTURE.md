# 🏗️ Архитектурный план системы ошибок Core Contracts

## 📋 Оглавление

1. [Принципы и цели](#принципы-и-цели)
2. [Структура директорий](#структура-директорий)
3. [Детальная структура файлов](#детальная-структура-файлов)
4. [План реализации по шагам](#план-реализации-по-шагам)
5. [Интеграция метаданных](#интеграция-метаданных)
6. [Расширяемость и версионирование](#расширяемость-и-версионирование)
7. [Golden Tests для метаданных](#golden-tests-для-метаданных)
8. [Performance Considerations](#performance-considerations)
9. [CI/CD и автоматические проверки](#cicd-и-автоматические-проверки)
10. [Интеграция с архитектурой проекта](#интеграция-с-архитектурой-проекта)
11. [Использование решений из существующей системы](#использование-решений-из-существующей-системы)
12. [Чек-лист реализации](#-чек-лист-реализации)
13. [Дополнительные замечания](#дополнительные-замечания)

---

## 🎯 Принципы и цели

### Архитектурные принципы

1. **Hexagonal Architecture (Ports & Adapters)**
   - `base/` = Core Domain (порты)
   - `serialization/` = Adapter (адаптеры для внешних представлений)
   - `domain/`, `application/`, `infrastructure/`, `security/` = Domain Layers (бизнес-логика)

2. **DDD (Domain-Driven Design)**
   - Каждый слой = отдельный bounded context
   - Domain-специфичные ошибки изолированы
   - Общий Error Kernel как shared kernel

3. **Clean Architecture**
   - Зависимости направлены внутрь (к `base/`)
   - Слои не зависят от внешних представлений
   - Четкое разделение ответственности

4. **Functional Programming**
   - Immutability (`ReadonlyDeep`)
   - Pure functions
   - ADT (Algebraic Data Types)
   - Pattern matching

5. **Файл = микросервис**
   - Каждый файл = самодостаточный модуль
   - Четкие границы ответственности
   - Минимальные зависимости между файлами
   - Один файл = одна ответственность

### Цели системы

- ✅ **Единый источник истины** для метаданных ошибок
- ✅ **Type-safe** на всех уровнях
- ✅ **Runtime-safe** через guards и валидацию
- ✅ **Observability-ready** (метрики, трейсинг, логирование)
- ✅ **Protocol-agnostic** (HTTP, gRPC, WebSocket)
- ✅ **Extensible** без breaking changes
- ✅ **Versioned** через SemVer политику

---

## 📁 Структура директорий

```
src/errors/
├── base/                          # Error Kernel (Core Domain)
│   ├── BaseError.ts              # Базовый тип и конструкторы
│   ├── ErrorCode.ts              # Стабильные коды ошибок (ABI)
│   ├── ErrorConstants.ts         # Константы (Severity, Category, Origin)
│   ├── ErrorMetadata.ts          # Типы метаданных
│   ├── ErrorCodeMeta.ts          # Типы и утилиты для метаданных кодов
│   ├── ErrorCodeMetaData.ts      # Данные метаданных (ERROR_CODE_META)
│   ├── ErrorUtils.ts             # Утилиты для работы с ошибками
│   └── index.ts                  # Публичный экспорт base слоя
│
├── domain/                        # Domain Layer (DDD)
│   ├── DomainError.ts            # Domain ADT и smart constructors
│   ├── DomainErrorMeta.ts        # Domain-специфичные метаданные
│   └── index.ts                  # Публичный экспорт domain слоя
│
├── application/                   # Application Layer (Use Cases)
│   ├── ApplicationError.ts       # Application ADT и smart constructors
│   ├── ApplicationErrorMeta.ts  # Application-специфичные метаданные
│   └── index.ts                  # Публичный экспорт application слоя
│
├── infrastructure/                # Infrastructure Layer (IO, Runtime)
│   ├── InfrastructureError.ts    # Infrastructure ADT и smart constructors
│   ├── InfrastructureErrorMeta.ts # Infrastructure-специфичные метаданные
│   └── index.ts                  # Публичный экспорт infrastructure слоя
│
├── security/                      # Security Layer (Auth, Permissions)
│   ├── SecurityError.ts          # Security ADT и smart constructors
│   ├── SecurityErrorMeta.ts      # Security-специфичные метаданные
│   └── index.ts                  # Публичный экспорт security слоя
│
├── validation/                    # Validation Layer (Input Validation)
│   ├── ValidationError.ts        # Validation ADT и smart constructors
│   ├── ValidationErrorMeta.ts   # Validation-специфичные метаданные
│   └── index.ts                  # Публичный экспорт validation слоя
│
├── serialization/                 # Serialization Boundary (Adapter)
│   ├── ErrorSerialization.ts     # HTTP/Log/Telemetry сериализация
│   └── index.ts                  # Публичный экспорт serialization
│
├── registry/                      # Error Registry (опционально, для будущего)
│   ├── ErrorRegistry.ts          # Централизованный реестр метаданных
│   └── index.ts
│
├── index.ts                       # Публичный экспорт всей системы ошибок
└── README.md                      # Документация системы ошибок
```

---

## 📄 Детальная структура файлов

### 🔹 Base Layer (`base/`)

#### `BaseError.ts` (Микросервис: Core Error Type)
**Ответственность:** Базовый тип ошибки и функции создания
**Зависимости:** `ErrorCode.ts`, `ErrorMetadata.ts`, `ErrorConstants.ts`
**Экспортирует:**
- `BaseError` (тип)
- `createError()` (конструктор)
- `wrapUnknownError()` (обертка)
- `matchError()` (pattern matching)
- `isBaseError()` (type guard)

**Статус:** ✅ Реализовано

---

#### `ErrorCode.ts` (Микросервис: Error Code ABI)
**Ответственность:** Стабильные коды ошибок (ABI контракт)
**Зависимости:** Нет
**Экспортирует:**
- `ERROR_CODE` (константа)
- `ErrorCode` (тип)
- `isErrorCode()` (type guard)
- `assertNever()` (exhaustive helper)

**Статус:** ✅ Реализовано

---

#### `ErrorConstants.ts` (Микросервис: Error Classification Constants)
**Ответственность:** Константы для классификации ошибок
**Зависимости:** Нет
**Экспортирует:**
- `ERROR_SEVERITY`, `ErrorSeverity`, `isErrorSeverity()`
- `ERROR_CATEGORY`, `ErrorCategory`, `isErrorCategory()`
- `ERROR_ORIGIN`, `ErrorOrigin`, `isErrorOrigin()`

**Статус:** ✅ Реализовано

---

#### `ErrorMetadata.ts` (Микросервис: Error Metadata Types)
**Ответственность:** Типы и конструкторы метаданных
**Зависимости:** `ErrorConstants.ts`
**Экспортирует:**
- `ErrorMetadata` (тип)
- `createErrorMetadata()` (factory)

**Статус:** ✅ Реализовано

---

#### `ErrorCodeMeta.ts` (Микросервис: Error Code Metadata Types & Utilities)
**Ответственность:** Типы, интерфейсы и утилиты для метаданных кодов
**Зависимости:** `ErrorCode.ts`, `ErrorConstants.ts`
**Экспортирует:**
- `HttpStatusCode`, `GrpcStatusCode` (типы)
- `ErrorMetrics`, `SemVerPolicy` (интерфейсы)
- `ErrorCodeMeta` (интерфейс)
- `DEFAULT_ERROR_CODE_META` (константа)
- `createErrorCodeMetaWithDefaults()` (factory)
- `toSnakeCase()`, `generateMetricName()` (утилиты)
- `isErrorCodeMeta()`, `assertErrorCodeMeta()` (guards)

**Статус:** ✅ Реализовано (289 строк)

**Улучшения из существующей системы:**
- ⏳ Расширить `HttpStatusCode` для поддержки всех стандартных HTTP кодов (100-599)
- ⏳ Добавить функции валидации HTTP статусов (`isValidHttpStatusCode`, `validateHttpStatusCode`)
- ⏳ Добавить HTTP Status категории (informational, success, redirect, client error, server error)

---

#### `ErrorCodeMetaData.ts` (Микросервис: Error Code Metadata Registry)
**Ответственность:** Централизованный реестр метаданных для всех кодов
**Зависимости:** `ErrorCode.ts`, `ErrorCodeMeta.ts`, `ErrorConstants.ts`
**Экспортирует:**
- `ERROR_CODE_META` (константа: `Record<ErrorCode, ErrorCodeMeta>`)
- `getErrorCodeMeta()` (helper для получения метаданных)
- `hasErrorCodeMeta()` (проверка наличия метаданных)

**Структура данных:**
```typescript
export const ERROR_CODE_META: ReadonlyDeep<Record<ErrorCode, ErrorCodeMeta>> = {
  [ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND]: createErrorCodeMetaWithDefaults({
    layer: ERROR_ORIGIN.DOMAIN,
    kind: 'entity',
    category: ERROR_CATEGORY.BUSINESS,
    severity: ERROR_SEVERITY.ERROR,
    retryable: false,
    recoverable: true,
    httpStatus: 404,
    grpcStatus: 5, // NOT_FOUND
    metrics: generateMetricName(ERROR_ORIGIN.DOMAIN, 'entity', ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND),
    description: 'Domain entity not found'
  }),
  // ... остальные коды
}
```

**Статус:** ⏳ Требует реализации

---

#### `ErrorUtils.ts` (Микросервис: Error Utilities)
**Ответственность:** Утилиты для работы с ошибками
**Зависимости:** `BaseError.ts`, `ErrorConstants.ts`
**Экспортирует:**
- Layer guards (`isDomainError`, `isApplicationError`, etc.)
- Metadata helpers (`hasCorrelationId`, `isRetryable`, etc.)
- Severity helpers (`requiresAlert`, `shouldBlockDeployment`, etc.)
- Cause chain utilities (`getCauseChain`, `getRootCause`, etc.)
- Filtering/searching (`filterErrorsBySeverity`, `findErrorByCode`, etc.)
- Transformation (`toSerializableError`, `sanitizeError`, etc.)
- Comparison (`areErrorsEqual`, `hasSameCode`, etc.)
- Context utilities (`mergeErrorContexts`, `extractContextValue`, etc.)

**Статус:** ✅ Реализовано

---

### 🔹 Domain Layer (`domain/`)

#### `DomainError.ts` (Микросервис: Domain Error ADT)
**Ответственность:** Domain-специфичные ошибки и smart constructors
**Зависимости:** `base/BaseError.ts`, `base/ErrorCode.ts`
**Экспортирует:**
- Domain ADT типы (`EntityNotFoundError`, `BusinessRuleViolationError`, etc.)
- `DomainError` (union type)
- Smart constructors (`createEntityNotFoundError`, `createBusinessRuleViolationError`, etc.)
- `matchDomainError()` (exhaustive pattern matching)
- Domain validation helpers (`validateEntityExists`, `validateBusinessRule`, etc.)

**Интеграция с метаданными:**
- Smart constructors используют `ERROR_CODE_META` для автоматического заполнения `severity`, `category`, `origin`
- Метаданные извлекаются через `getErrorCodeMeta()` из `ErrorCodeMetaData.ts`

**Статус:** ✅ Реализовано (требует интеграции с метаданными)

---

#### `DomainErrorMeta.ts` (Микросервис: Domain-Specific Metadata Helpers)
**Ответственность:** Domain-специфичные helpers для работы с метаданными
**Зависимости:** `base/ErrorCodeMeta.ts`, `base/ErrorCodeMetaData.ts`
**Экспортирует:**
- `getDomainErrorMeta()` (получение метаданных для domain кодов)
- `isDomainErrorRetryable()` (проверка retryable для domain кодов)
- `getDomainErrorSeverity()` (получение severity для domain кодов)

**Статус:** ⏳ Требует реализации

---

### 🔹 Application Layer (`application/`)

#### `ApplicationError.ts` (Микросервис: Application Error ADT)
**Ответственность:** Application-специфичные ошибки (use cases, orchestration)
**Зависимости:** `base/BaseError.ts`, `base/ErrorCode.ts`
**Экспортирует:**
- Application ADT типы (`CommandRejectedError`, `QueryFailedError`, etc.)
- `ApplicationError` (union type)
- Smart constructors (`createCommandRejectedError`, `createQueryFailedError`, etc.)
- `matchApplicationError()` (exhaustive pattern matching)

**Статус:** ⏳ Требует реализации

---

#### `ApplicationErrorMeta.ts` (Микросервис: Application-Specific Metadata Helpers)
**Ответственность:** Application-специфичные helpers для метаданных
**Зависимости:** `base/ErrorCodeMeta.ts`, `base/ErrorCodeMetaData.ts`
**Экспортирует:**
- `getApplicationErrorMeta()`
- `isApplicationErrorRetryable()`
- `getApplicationErrorSeverity()`

**Статус:** ⏳ Требует реализации

---

### 🔹 Infrastructure Layer (`infrastructure/`)

#### `InfrastructureError.ts` (Микросервис: Infrastructure Error ADT)
**Ответственность:** Infrastructure-специфичные ошибки (IO, network, DB)
**Зависимости:** `base/BaseError.ts`, `base/ErrorCode.ts`
**Экспортирует:**
- Infrastructure ADT типы (`NetworkError`, `TimeoutError`, `DatabaseError`, etc.)
- `InfrastructureError` (union type)
- Smart constructors (`createNetworkError`, `createTimeoutError`, etc.)
- `matchInfrastructureError()` (exhaustive pattern matching)

**Статус:** ⏳ Требует реализации

---

#### `InfrastructureErrorMeta.ts` (Микросервис: Infrastructure-Specific Metadata Helpers)
**Ответственность:** Infrastructure-специфичные helpers для метаданных
**Зависимости:** `base/ErrorCodeMeta.ts`, `base/ErrorCodeMetaData.ts`
**Экспортирует:**
- `getInfrastructureErrorMeta()`
- `isInfrastructureErrorRetryable()` (обычно `true` для network/timeout)
- `getInfrastructureErrorSeverity()`

**Статус:** ⏳ Требует реализации

---

### 🔹 Security Layer (`security/`)

#### `SecurityError.ts` (Микросервис: Security Error ADT)
**Ответственность:** Security-специфичные ошибки (auth, permissions)
**Зависимости:** `base/BaseError.ts`, `base/ErrorCode.ts`
**Экспортирует:**
- Security ADT типы (`UnauthorizedError`, `ForbiddenError`, `TokenExpiredError`, etc.)
- `SecurityError` (union type)
- Smart constructors (`createUnauthorizedError`, `createForbiddenError`, etc.)
- `matchSecurityError()` (exhaustive pattern matching)

**Статус:** ⏳ Требует реализации

---

#### `SecurityErrorMeta.ts` (Микросервис: Security-Specific Metadata Helpers)
**Ответственность:** Security-специфичные helpers для метаданных
**Зависимости:** `base/ErrorCodeMeta.ts`, `base/ErrorCodeMetaData.ts`
**Экспортирует:**
- `getSecurityErrorMeta()`
- `isSecurityErrorRetryable()` (обычно `false`)
- `getSecurityErrorSeverity()` (обычно `HIGH` или `CRITICAL`)

**Статус:** ⏳ Требует реализации

---

### 🔹 Validation Layer (`validation/`)

#### `ValidationError.ts` (Микросервис: Validation Error ADT)
**Ответственность:** Validation-специфичные ошибки (input validation)
**Зависимости:** `base/BaseError.ts`, `base/ErrorCode.ts`
**Экспортирует:**
- Validation ADT типы (`ValidationFailedError`, `SchemaMismatchError`, etc.)
- `ValidationError` (union type)
- Smart constructors (`createValidationFailedError`, `createSchemaMismatchError`, etc.)
- `matchValidationError()` (exhaustive pattern matching)

**Примечание:** Validation ошибки маппятся на `ERROR_ORIGIN.APPLICATION` с `ERROR_CATEGORY.VALIDATION`

**Статус:** ⏳ Требует реализации

---

#### `ValidationErrorMeta.ts` (Микросервис: Validation-Specific Metadata Helpers)
**Ответственность:** Validation-специфичные helpers для метаданных
**Зависимости:** `base/ErrorCodeMeta.ts`, `base/ErrorCodeMetaData.ts`
**Экспортирует:**
- `getValidationErrorMeta()`
- `isValidationErrorRetryable()` (обычно `false`)
- `getValidationErrorSeverity()` (обычно `MEDIUM` или `LOW`)

**Статус:** ⏳ Требует реализации

---

### 🔹 Serialization Layer (`serialization/`)

#### `ErrorSerialization.ts` (Микросервис: Error Serialization Boundary)
**Ответственность:** Сериализация ошибок для внешних представлений
**Зависимости:** `base/BaseError.ts`, `base/ErrorUtils.ts`
**Экспортирует:**
- `SerializedErrorBase` (тип)
- `HttpErrorResponse`, `toHttpErrorResponse()` (HTTP)
- `LogErrorFormat`, `toLogErrorFormat()` (Logs)
- `TelemetryErrorFormat`, `toTelemetryErrorFormat()` (Telemetry)

**Статус:** ✅ Реализовано

---

### 🔹 Adapters Layer (`adapters/`)

#### `EffectAdapter.ts` (Микросервис: Effect Integration Adapter)
**Ответственность:** Адаптеры для интеграции с Effect системой
**Зависимости:** `base/BaseError.ts` (НЕ зависит от Effect напрямую - опциональная зависимость)
**Экспортирует:**
- `toEffectError(error: BaseError): Effect.Error` (конвертация BaseError → Effect.Error)
- `fromEffectError(error: Effect.Error): BaseError` (конвертация Effect.Error → BaseError)
- `isEffectError(value: unknown): boolean` (type guard)

**Примечание:** 
- Effect НЕ является обязательной зависимостью для Error Kernel
- Адаптеры опциональны и могут быть реализованы в отдельном пакете
- Если Effect используется в проекте, адаптеры упрощают интеграцию

**Статус:** ⏳ Опционально (реализовать если используется Effect)

---

## 🚀 План реализации по шагам

### Этап 0: Улучшение HTTP Status валидации (опционально, из существующей системы)

#### Шаг 0.1: Расширение HTTP Status поддержки
**Цель:** Улучшить валидацию HTTP статусов на основе проверенных решений из существующей системы

**Задачи:**
1. Расширить `HttpStatusCode` тип в `ErrorCodeMeta.ts`:
   - Текущий: ограниченный union `400 | 401 | 403 | ...`
   - Новый: полный union всех стандартных HTTP кодов (100-599)
   - Или: использовать более гибкий подход с runtime валидацией
2. Добавить функции валидации HTTP статусов:
   - `isValidHttpStatusCode(code: number): boolean` - простая проверка диапазона
   - `validateHttpStatusCode(code: unknown): ValidationResult<number>` - структурированная валидация
   - `getHttpStatusCategory(code: HttpStatusCode): 'informational' | 'success' | 'redirect' | 'client' | 'server'` - категория статуса
3. Добавить константы для HTTP Status категорий:
   - `HTTP_STATUS_CATEGORY` - маппинг категорий
   - `HTTP_STATUS_RANGE` - диапазоны (MIN: 100, MAX: 599)

**Источник:** `/home/boss/Projects/effect/foundation/errors/core/constants/http-types.ts`

**Что НЕ копируем:**
- ❌ Effect интеграцию (Error Kernel независим)
- ❌ Branded types (у нас проще подход)
- ❌ HTTP Status Cache (оверхед для начала)
- ❌ Codegen систему (слишком сложно)

**Критерии готовности:**
- ✅ `HttpStatusCode` поддерживает все стандартные коды (100-599)
- ✅ Функции валидации работают корректно
- ✅ HTTP Status категории определены
- ✅ Unit тесты покрывают валидацию
- ✅ Обратная совместимость сохранена (существующий код работает)

**Оценка:** ~1-2 часа

**Примечание:** Этот шаг опционален. Можно использовать текущий ограниченный `HttpStatusCode` и расширить позже при необходимости.

---

### Этап 1: Завершение Base Layer (Error Kernel)

#### Шаг 1.1: Реализация `ErrorCodeMetaData.ts`
**Цель:** Создать централизованный реестр метаданных для всех кодов из `ERROR_CODE`

**Задачи:**
1. Создать файл `base/ErrorCodeMetaData.ts`
2. Импортировать необходимые зависимости:
   - `ERROR_CODE`, `ErrorCode` из `ErrorCode.ts`
   - `ErrorCodeMeta`, `createErrorCodeMetaWithDefaults`, `generateMetricName` из `ErrorCodeMeta.ts`
   - `ERROR_ORIGIN`, `ERROR_CATEGORY`, `ERROR_SEVERITY` из `ErrorConstants.ts`
3. Определить `ERROR_CODE_META` как `ReadonlyDeep<Record<ErrorCode, ErrorCodeMeta>>`
4. Заполнить метаданные для всех кодов из `ERROR_CODE`:
   - Domain коды (`DOMAIN_*`)
   - Application коды (`APPLICATION_*`)
   - Infrastructure коды (`INFRA_*`)
   - Security коды (`SECURITY_*`)
   - Validation коды (`VALIDATION_*`)
   - Fallback (`UNKNOWN_ERROR`)
5. Добавить runtime валидацию полноты реестра:
   - Функция `validateErrorCodeMetaCompleteness()` для проверки, что все коды имеют метаданные
   - Вызывать при инициализации (в development режиме) или в тестах
6. Добавить helpers:
   - `getErrorCodeMeta(code: ErrorCode): ErrorCodeMeta | undefined`
   - `hasErrorCodeMeta(code: ErrorCode): boolean`
   - `getErrorCodeMetaOrThrow(code: ErrorCode): ErrorCodeMeta` (throws если метаданные отсутствуют)
7. Добавить JSDoc комментарии для всех экспортируемых функций
8. Экспортировать из `base/index.ts`

**Критерии готовности:**
- ✅ Все коды из `ERROR_CODE` имеют метаданные
- ✅ Runtime валидация полноты реестра реализована
- ✅ TypeScript компилируется без ошибок
- ✅ Строгий TS и canary linting проходят
- ✅ Unit тесты покрывают `getErrorCodeMeta()`, `hasErrorCodeMeta()`, `getErrorCodeMetaOrThrow()`
- ✅ Unit тесты проверяют полноту реестра

**Оценка:** ~2-3 часа

---

#### Шаг 1.2: Интеграция метаданных в `BaseError.ts`
**Цель:** Автоматически заполнять метаданные из `ERROR_CODE_META` при создании ошибок

**Задачи:**
1. Обновить `createError()` для использования метаданных:
   - Если метаданные существуют в `ERROR_CODE_META`, автоматически заполнять `severity`, `category`, `origin`, `retryable`, `recoverable`
   - Переданные метаданные имеют приоритет над метаданными из реестра
2. Обновить `wrapUnknownError()` аналогично
3. Добавить helper `getErrorMetaFromCode(code: ErrorCode): Partial<ErrorMetadata> | undefined`

**Критерии готовности:**
- ✅ `createError()` автоматически заполняет метаданные из реестра
- ✅ Переданные метаданные перезаписывают значения из реестра
- ✅ Unit тесты покрывают новую функциональность

**Оценка:** ~1-2 часа

---

#### Шаг 1.3: Обновление `base/index.ts`
**Цель:** Экспортировать новые типы и функции из base layer

**Задачи:**
1. Добавить экспорт `ErrorCodeMeta` типов и утилит из `ErrorCodeMeta.ts`:
   - Типы: `ErrorCodeMeta`, `HttpStatusCode`, `GrpcStatusCode`, `ErrorMetrics`, `SemVerPolicy`
   - Константы: `DEFAULT_ERROR_CODE_META`
   - Функции: `createErrorCodeMetaWithDefaults()`, `generateMetricName()`, `toSnakeCase()`
   - Guards: `isErrorCodeMeta()`, `assertErrorCodeMeta()`, `isGrpcStatusCode()`
2. Добавить экспорт `ERROR_CODE_META`, `getErrorCodeMeta`, `hasErrorCodeMeta` из `ErrorCodeMetaData.ts`
3. Проверить, что все публичные API экспортируются
4. Убедиться, что нет циклических зависимостей

**Критерии готовности:**
- ✅ Все публичные API доступны через `base/index.ts`
- ✅ Нет циклических зависимостей
- ✅ TypeScript компилируется без ошибок

**Оценка:** ~15 минут

---

### Этап 2: Интеграция метаданных в Domain Layer

#### Шаг 2.1: Обновление `DomainError.ts`
**Цель:** Интегрировать метаданные в domain smart constructors

**Задачи:**
1. Обновить smart constructors для использования метаданных из `ERROR_CODE_META`:
   - `createEntityNotFoundError()` → автоматически заполняет `severity`, `category`, `origin` из метаданных
   - `createBusinessRuleViolationError()` → аналогично
   - `createDomainInvariantBrokenError()` → аналогично
   - `createValidationError()` → аналогично
   - `createStateTransitionError()` → аналогично
2. Убрать хардкод значений `origin` и `category` из конструкторов
3. Сохранить возможность переопределения через параметры

**Критерии готовности:**
- ✅ Все smart constructors используют метаданные из реестра
- ✅ Обратная совместимость сохранена
- ✅ Unit тесты обновлены и проходят

**Оценка:** ~1 час

---

#### Шаг 2.2: Создание `DomainErrorMeta.ts`
**Цель:** Domain-специфичные helpers для работы с метаданными

**Задачи:**
1. Создать файл `domain/DomainErrorMeta.ts`
2. Реализовать helpers:
   - `getDomainErrorMeta(code: ErrorCode): ErrorCodeMeta | undefined`
   - `isDomainErrorRetryable(code: ErrorCode): boolean`
   - `getDomainErrorSeverity(code: ErrorCode): ErrorSeverity`
   - `getDomainErrorCategory(code: ErrorCode): ErrorCategory`
3. Экспортировать из `domain/index.ts`

**Критерии готовности:**
- ✅ Helpers работают только с domain кодами (`DOMAIN_*`)
- ✅ Type-safe на уровне типов
- ✅ Unit тесты покрывают все helpers

**Оценка:** ~30 минут

---

### Этап 3: Реализация остальных слоев

#### Шаг 3.1: Application Layer
**Цель:** Создать Application Error ADT и smart constructors

**Задачи:**
1. Создать `application/ApplicationError.ts`:
   - Определить ADT типы (`CommandRejectedError`, `QueryFailedError`, `PermissionDeniedError`)
   - Реализовать smart constructors
   - Реализовать `matchApplicationError()`
2. Создать `application/ApplicationErrorMeta.ts`:
   - Реализовать helpers для метаданных
3. Создать `application/index.ts`:
   - Экспортировать публичный API
4. Добавить Application коды в `ERROR_CODE_META` (если еще не добавлены)

**Критерии готовности:**
- ✅ Application ADT реализован
- ✅ Smart constructors используют метаданные
- ✅ Unit тесты покрывают функциональность

**Оценка:** ~2 часа

---

#### Шаг 3.2: Infrastructure Layer
**Цель:** Создать Infrastructure Error ADT и smart constructors

**Задачи:**
1. Создать `infrastructure/InfrastructureError.ts`:
   - Определить ADT типы (`NetworkError`, `TimeoutError`, `DatabaseError`, etc.)
   - Реализовать smart constructors
   - Реализовать `matchInfrastructureError()`
2. Создать `infrastructure/InfrastructureErrorMeta.ts`
3. Создать `infrastructure/index.ts`
4. Добавить Infrastructure коды в `ERROR_CODE_META` (если еще не добавлены)

**Критерии готовности:**
- ✅ Infrastructure ADT реализован
- ✅ Smart constructors используют метаданные
- ✅ Unit тесты покрывают функциональность

**Оценка:** ~2 часа

---

#### Шаг 3.3: Security Layer
**Цель:** Создать Security Error ADT и smart constructors

**Задачи:**
1. Создать `security/SecurityError.ts`:
   - Определить ADT типы (`UnauthorizedError`, `ForbiddenError`, `TokenExpiredError`, etc.)
   - Реализовать smart constructors
   - Реализовать `matchSecurityError()`
2. Создать `security/SecurityErrorMeta.ts`
3. Создать `security/index.ts`
4. Добавить Security коды в `ERROR_CODE_META` (если еще не добавлены)

**Критерии готовности:**
- ✅ Security ADT реализован
- ✅ Smart constructors используют метаданные
- ✅ Unit тесты покрывают функциональность

**Оценка:** ~2 часа

---

#### Шаг 3.4: Validation Layer
**Цель:** Создать Validation Error ADT и smart constructors

**Задачи:**
1. Создать `validation/ValidationError.ts`:
   - Определить ADT типы (`ValidationFailedError`, `SchemaMismatchError`, etc.)
   - Реализовать smart constructors
   - Реализовать `matchValidationError()`
   - **Важно:** Маппить на `ERROR_ORIGIN.APPLICATION` с `ERROR_CATEGORY.VALIDATION`
2. Создать `validation/ValidationErrorMeta.ts`
3. Создать `validation/index.ts`
4. Добавить Validation коды в `ERROR_CODE_META` (если еще не добавлены)

**Критерии готовности:**
- ✅ Validation ADT реализован
- ✅ Smart constructors используют метаданные
- ✅ Правильный маппинг на `APPLICATION` origin
- ✅ Unit тесты покрывают функциональность

**Оценка:** ~2 часа

---

### Этап 4: Обновление публичного API

#### Шаг 4.1: Создание/обновление `errors/index.ts`
**Цель:** Создать единую точку входа для всей системы ошибок

**Задачи:**
1. Создать файл `src/errors/index.ts` (если не существует):
   - Экспортировать `base/` (Error Kernel) - **обязательно**
   - Экспортировать `domain/` (Domain Layer) - **обязательно** (уже используется)
   - Экспортировать `serialization/` (Serialization Boundary) - **обязательно** (уже используется)
   - Экспортировать `application/` (Application Layer) - когда будет реализован
   - Экспортировать `infrastructure/` (Infrastructure Layer) - когда будет реализован
   - Экспортировать `security/` (Security Layer) - когда будет реализован
   - Экспортировать `validation/` (Validation Layer) - когда будет реализован
   - Экспортировать `adapters/` (Adapters) - опционально, если используется Effect
2. Добавить JSDoc комментарий с описанием структуры экспортов
3. Добавить комментарии о том, какие слои обязательны, а какие опциональны
4. Проверить отсутствие циклических зависимостей

**Критерии готовности:**
- ✅ Файл `errors/index.ts` создан и экспортирует все реализованные слои
- ✅ Все слои доступны через единую точку входа
- ✅ Нет циклических зависимостей
- ✅ TypeScript компилируется без ошибок
- ✅ Комментарии указывают на опциональные слои

**Оценка:** ~15 минут

---

#### Шаг 4.2: Обновление `src/index.ts`
**Цель:** Интегрировать новую систему ошибок в главный экспорт пакета

**Задачи:**
1. Обновить `src/index.ts`:
   - Проверить экспорт `errors/base/index.js` и `errors/domain/index.js`
   - Добавить экспорт `errors/index.js` (если требуется единая точка входа)
   - Или оставить экспорт отдельных слоев для более granular импортов
2. Решить стратегию экспорта:
   - Вариант A: Экспортировать `errors/index.js` (все слои через единую точку)
   - Вариант B: Экспортировать отдельные слои (`errors/base`, `errors/domain`, etc.)
   - **Рекомендация:** Вариант B для лучшего tree-shaking и явности зависимостей

**Критерии готовности:**
- ✅ Главный экспорт пакета обновлен
- ✅ Стратегия экспорта документирована
- ✅ Нет breaking changes для существующих импортов

**Оценка:** ~15 минут

---

### Этап 5: Интеграция метаданных в Serialization

#### Шаг 5.1: Обновление `ErrorSerialization.ts`
**Цель:** Использовать метаданные для автоматического определения HTTP/gRPC статусов

**Задачи:**
1. Обновить `toHttpErrorResponse()`:
   - Использовать `getErrorCodeMeta()` для получения `httpStatus` из метаданных
   - Параметр `status` становится опциональным (fallback на метаданные)
   - Если метаданные отсутствуют, использовать переданный `status` или 500 по умолчанию
2. Добавить новую функцию `toGrpcErrorResponse()`:
   - Использовать `grpcStatus` из метаданных
   - Возвращать gRPC формат ошибки
3. Обновить `toTelemetryErrorFormat()`:
   - Использовать метаданные для более точной классификации
   - Добавить поля из метаданных (`kind`, `retryable`, `recoverable`)
4. Добавить helpers:
   - `getHttpStatusFromError(error: BaseError): number` (из метаданных или fallback)
   - `getGrpcStatusFromError(error: BaseError): GrpcStatusCode` (из метаданных или fallback)

**Критерии готовности:**
- ✅ `toHttpErrorResponse()` использует метаданные для HTTP статусов
- ✅ `toGrpcErrorResponse()` реализована и использует метаданные
- ✅ `toTelemetryErrorFormat()` использует метаданные
- ✅ Helpers для получения статусов реализованы
- ✅ Unit тесты покрывают новую функциональность

**Оценка:** ~1-2 часа

---

### Этап 6: Опциональные интеграции

#### Шаг 6.1: Effect Adapters (опционально)
**Цель:** Создать адаптеры для интеграции с Effect системой (если используется)

**Задачи:**
1. ✅ Создать файл `adapters/EffectAdapter.ts`:
   - ✅ Реализовать `toEffectError()` для конвертации BaseError → Effect.Error
   - ✅ Реализовать `toEffectErrorAsync()` для асинхронной конвертации с fallback на динамический импорт
   - ✅ Реализовать `fromEffectError()` для конвертации Effect.Error → BaseError
   - ✅ Реализовать `isEffectError()` type guard
2. ✅ Добавить опциональную зависимость на `effect` в `package.json` (peerDependency)
3. ✅ Создать `adapters/index.ts` для экспорта
4. ⏳ Добавить unit тесты для адаптеров (Этап 7)

**Критерии готовности:**
- ✅ Адаптеры реализованы (если Effect используется в проекте)
- ✅ Effect является peerDependency (не обязательной зависимостью)
- ⏳ Unit тесты покрывают адаптеры (Этап 7)
- ✅ Документация описывает использование адаптеров (JSDoc комментарии)

**Оценка:** ~1-2 часа (только если используется Effect)

**Примечание:** Этот шаг опционален. Effect адаптеры нужны только если проект использует Effect для error handling. Error Kernel остается независимым от Effect.

---

### Этап 7: Тестирование и документация

#### Шаг 7.1: Unit тесты
**Цель:** Покрыть тестами всю новую функциональность

**Задачи:**
1. Тесты для `ErrorCodeMetaData.ts`:
   - `getErrorCodeMeta()` для всех кодов
   - `hasErrorCodeMeta()` для всех кодов
   - `getErrorCodeMetaOrThrow()` (success и error cases)
   - Валидация структуры `ERROR_CODE_META` через `isErrorCodeMeta()`
   - Проверка полноты реестра (все коды из `ERROR_CODE` имеют метаданные)
   - Проверка отсутствия дубликатов
2. Тесты для интеграции метаданных в `BaseError.ts`:
   - `createError()` автоматически заполняет метаданные из реестра
   - Переданные метаданные перезаписывают значения из реестра
   - Fallback на `DEFAULT_ERROR_CODE_META` если метаданные отсутствуют
   - `wrapUnknownError()` аналогично
3. Тесты для layer-specific helpers:
   - `DomainErrorMeta.ts` helpers
   - `ApplicationErrorMeta.ts` helpers
   - `InfrastructureErrorMeta.ts` helpers
   - `SecurityErrorMeta.ts` helpers
   - `ValidationErrorMeta.ts` helpers
4. Тесты для новых слоев (Application, Infrastructure, Security, Validation):
   - Smart constructors используют метаданные
   - Pattern matching работает корректно
   - ADT типы корректны
5. Golden tests для метаданных:
   - Snapshot тесты для `ERROR_CODE_META` структуры
   - Проверка стабильности метаданных между версиями
6. Интеграционные тесты:
   - Полный flow от создания ошибки до сериализации
   - Использование метаданных в разных слоях

**Критерии готовности:**
- ✅ Покрытие тестами > 85%
- ✅ Все тесты проходят
- ✅ Golden tests настроены
- ✅ Интеграционные тесты покрывают основные сценарии

**Оценка:** ~4-5 часов

---

#### Шаг 7.2: Обновление документации
**Цель:** Обновить README и создать ADR для метаданных

**Задачи:**
1. Обновить `errors/README.md`:
   - Добавить раздел о метаданных (`ErrorCodeMeta` система)
   - Описать использование `ERROR_CODE_META`
   - Примеры интеграции метаданных в smart constructors
   - Примеры использования layer-specific helpers
   - Описание процесса добавления нового кода с метаданными
2. Обновить JSDoc комментарии:
   - Все экспортируемые функции должны иметь полные JSDoc комментарии
   - Примеры использования в JSDoc
   - Описание параметров и возвращаемых значений
3. Создать ADR для системы метаданных (если требуется):
   - Решение о централизованном реестре метаданных
   - Решение о структуре `ErrorCodeMeta`
   - Решение о интеграции метаданных в конструкторы
4. Обновить архитектурный план (этот документ) с учетом реализованных изменений

**Критерии готовности:**
- ✅ Документация актуальна
- ✅ Примеры работают
- ✅ JSDoc комментарии полные и актуальные
- ✅ ADR создан (если требуется)

**Оценка:** ~1-2 часа

---

## 🔗 Интеграция метаданных

### Принципы интеграции

1. **Автоматическое заполнение:** Smart constructors автоматически заполняют метаданные из `ERROR_CODE_META`
2. **Приоритет переданных значений:** Явно переданные метаданные перезаписывают значения из реестра
3. **Fallback:** Если метаданные отсутствуют, используются значения по умолчанию из `DEFAULT_ERROR_CODE_META`
4. **Type-safe:** Все операции типобезопасны на уровне TypeScript

### Пример интеграции в Domain Layer

```typescript
// До интеграции
export const createEntityNotFoundError = (context: EntityContext): EntityNotFoundError =>
  createError(
    ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
    `${context.entityType} with ID ${context.entityId} not found`,
    {
      origin: "domain" as const,  // ❌ Хардкод
      category: "business" as const, // ❌ Хардкод
      context,
      extra: createDomainMetadata()
    }
  ) as EntityNotFoundError

// После интеграции (вариант 1: через getErrorCodeMeta)
export const createEntityNotFoundError = (context: EntityContext): EntityNotFoundError => {
  const meta = getErrorCodeMeta(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)
  return createError(
    ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
    `${context.entityType} with ID ${context.entityId} not found`,
    {
      // ✅ Автоматически из метаданных (если meta существует)
      ...(meta && {
        origin: meta.layer,
        category: meta.category,
        severity: meta.severity,
        retryable: meta.retryable,
        recoverable: meta.recoverable
      }),
      // Явно переданные значения (имеют приоритет)
      context,
      extra: createDomainMetadata()
    }
  ) as EntityNotFoundError
}

// После интеграции (вариант 2: через createError с автоматическим заполнением)
// createError() автоматически заполняет метаданные из ERROR_CODE_META
export const createEntityNotFoundError = (context: EntityContext): EntityNotFoundError =>
  createError(
    ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
    `${context.entityType} with ID ${context.entityId} not found`,
    {
      // ✅ createError() автоматически добавит метаданные из ERROR_CODE_META
      // Явно переданные значения (имеют приоритет над метаданными)
      context,
      extra: createDomainMetadata()
    }
  ) as EntityNotFoundError
```

### Пример использования метаданных в Serialization

```typescript
// Использование метаданных для автоматического определения HTTP статуса
export const toHttpErrorResponse = (
  error: ReadonlyDeep<BaseError>,
  status?: number  // Опциональный, используется fallback на метаданные
): HttpErrorResponse => {
  const meta = getErrorCodeMeta(error.code)
  const httpStatus = status ?? meta?.httpStatus ?? 500
  
  return {
    status: httpStatus,
    body: {
      error: toSerializedErrorBase(error),
      ...(hasCause(error) && { hasCause: true })
    }
  }
}

// Использование метаданных для gRPC
export const toGrpcErrorResponse = (
  error: ReadonlyDeep<BaseError>
): GrpcErrorResponse => {
  const meta = getErrorCodeMeta(error.code)
  const grpcStatus = meta?.grpcStatus ?? 13 // INTERNAL по умолчанию
  
  return {
    code: grpcStatus,
    message: error.message,
    details: {
      code: error.code,
      severity: getErrorSeverity(error),
      ...(hasCorrelationId(error) && { correlationId: error.correlationId })
    }
  }
}
```

---

## 🔄 Расширяемость и версионирование

### Добавление нового кода ошибки

1. **Добавить код в `ErrorCode.ts`:**
   ```typescript
   export const ERROR_CODE = {
     // ... существующие коды
     NEW_DOMAIN_ERROR: "NEW_DOMAIN_ERROR",
   } as const
   ```

2. **Добавить метаданные в `ErrorCodeMetaData.ts`:**
   ```typescript
   export const ERROR_CODE_META = {
     // ... существующие метаданные
     [ERROR_CODE.NEW_DOMAIN_ERROR]: createErrorCodeMetaWithDefaults({
       layer: ERROR_ORIGIN.DOMAIN,
       kind: 'entity',
       category: ERROR_CATEGORY.BUSINESS,
       severity: ERROR_SEVERITY.ERROR,
       retryable: false,
       recoverable: true,
       httpStatus: 404,
       grpcStatus: 5, // NOT_FOUND
       metrics: generateMetricName(ERROR_ORIGIN.DOMAIN, 'entity', ERROR_CODE.NEW_DOMAIN_ERROR),
       description: 'New domain error description'
     }),
   } as const
   ```

3. **Создать smart constructor в соответствующем слое** (если требуется)

4. **Обновить тесты:**
   - Unit тесты для нового кода
   - Golden tests (snapshot) для метаданных

5. **Проверить полноту реестра:**
   - Запустить `validateErrorCodeMetaCompleteness()` в тестах

### SemVer политика

- **Добавление нового кода:** `MINOR` (согласно `semver.add`)
- **Изменение метаданных существующего кода:** `MAJOR` (согласно `semver.change`)
- **Удаление кода:** `MAJOR` (согласно `semver.remove`)

### Добавление метаданных для существующих кодов

Если код уже определен в `ERROR_CODE`:
1. Добавить метаданные в `ERROR_CODE_META`
2. Обновить smart constructors для использования метаданных (если требуется)
3. Переданные метаданные имеют приоритет над реестром (это поведение системы, не миграция)
4. Обновить тесты для проверки автоматического заполнения метаданных

### Обработка отсутствующих метаданных

**Стратегия fallback:**
1. Если метаданные отсутствуют в `ERROR_CODE_META`:
   - Использовать `DEFAULT_ERROR_CODE_META` для базовых значений
   - Логировать предупреждение в development режиме
   - В production: использовать безопасные defaults (severity: MEDIUM, httpStatus: 500)
2. Runtime валидация:
   - `validateErrorCodeMetaCompleteness()` должна вызываться в тестах
   - В development: предупреждение если метаданные отсутствуют
   - В production: fallback на defaults без ошибок

---

## ⚡ Performance Considerations

### Оптимизации

1. **Lazy loading метаданных:**
   - `ERROR_CODE_META` загружается один раз при инициализации модуля
   - `getErrorCodeMeta()` использует прямой доступ к объекту (O(1))

2. **Tree-shaking:**
   - Метаданные не используются напрямую в runtime коде (только через helpers)
   - TypeScript и bundler могут tree-shake неиспользуемые метаданные

3. **Memory:**
   - `ERROR_CODE_META` - frozen объект, занимает фиксированную память
   - Метаданные не копируются при создании ошибок (используются только для заполнения)

4. **Runtime overhead:**
   - Минимальный: один lookup в объекте при создании ошибки
   - Можно оптимизировать через Map если количество кодов станет очень большим (>1000)

### Рекомендации

- ✅ Использовать `getErrorCodeMeta()` только при создании ошибок (не в hot paths)
- ✅ Кэшировать результаты `getErrorCodeMeta()` если вызывается часто
- ✅ Мониторить размер bundle после добавления метаданных

---

## 🔍 CI/CD и автоматические проверки

### Рекомендуемые проверки

1. **Type checking:**
   - `tsc --noEmit` (strict mode)
   - Проверка отсутствия `any` типов

2. **Linting:**
   - Canary linting (`lint:canary`)
   - Проверка соответствия code style

3. **Тесты:**
   - Unit тесты (`test:ci`)
   - Golden tests (snapshot tests для метаданных)
   - Покрытие > 85%

4. **Валидация метаданных:**
   - Автоматическая проверка полноты `ERROR_CODE_META`
   - Проверка отсутствия дубликатов
   - Проверка корректности структуры через `isErrorCodeMeta()`

5. **Build:**
   - Проверка успешной сборки (`build`)
   - Проверка отсутствия циклических зависимостей

### Пример CI/CD скрипта

```bash
# Проверка полноты метаданных
pnpm run test:ci -- tests/unit/errors/base/error-code-meta.test.ts

# Проверка golden tests
pnpm run test:ci -- tests/unit/errors/base/error-code-meta-golden.test.ts

# Type checking
pnpm run type-check

# Linting
pnpm run lint:ci

# Build
pnpm run build
```

---

## ✅ Критерии завершения

### Функциональные критерии

- ✅ Все коды из `ERROR_CODE` имеют метаданные в `ERROR_CODE_META`
- ✅ Все smart constructors используют метаданные из реестра
- ✅ Все слои (Domain, Application, Infrastructure, Security, Validation) реализованы
- ✅ Layer-specific helpers реализованы для всех слоев
- ✅ Unit тесты покрывают всю функциональность (>85%)
- ✅ Документация обновлена

### Технические критерии

- ✅ TypeScript компилируется без ошибок (strict mode)
- ✅ Canary linting проходит без ошибок
- ✅ Нет циклических зависимостей
- ✅ Все файлы следуют принципу "Файл = микросервис"

### Архитектурные критерии

- ✅ Следование Hexagonal Architecture
- ✅ Следование DDD принципам
- ✅ Следование Clean Architecture
- ✅ FP-first подход (immutability, pure functions)
- ✅ Четкое разделение ответственности между слоями

---

## 📊 Оценка времени

| Этап | Шаги | Оценка времени |
|------|------|----------------|
| Этап 1: Base Layer | 3 шага | ~4-6 часов |
| Этап 2: Domain Layer | 2 шага | ~1.5 часа |
| Этап 3: Остальные слои | 4 шага | ~8 часов |
| Этап 4: Публичный API | 1 шаг | ~15 минут |
| Этап 5: Тестирование и документация | 2 шага | ~4-5 часов |
| **Итого** | **12 шагов** | **~18-21 час** |

---

## 🎯 Приоритеты реализации

1. **Высокий приоритет:**
   - Этап 1 (Base Layer) - критично для всей системы
   - Этап 2 (Domain Layer) - уже используется в проекте

2. **Средний приоритет:**
   - Этап 3 (Application, Infrastructure) - нужны для полноты системы
   - Этап 0 (HTTP Status улучшения) - полезно, но не критично

3. **Низкий приоритет:**
   - Этап 3 (Security, Validation) - можно реализовать по мере необходимости
   - Этап 6 (Effect Adapters) - только если используется Effect
   - Этап 7 (Документация) - можно делать параллельно с реализацией

---

---

## 🧪 Golden Tests для метаданных

### Назначение

Golden tests (snapshot tests) гарантируют стабильность структуры метаданных между версиями и предотвращают случайные изменения.

### Реализация

1. **Создать файл `tests/unit/errors/base/error-code-meta-golden.test.ts`:**
   ```typescript
   import { ERROR_CODE_META } from '../../../src/errors/base/ErrorCodeMetaData.js'
   import { ERROR_CODE } from '../../../src/errors/base/ErrorCode.js'
   
   describe('ERROR_CODE_META Golden Tests', () => {
     it('should have metadata for all error codes', () => {
       const codes = Object.values(ERROR_CODE)
       const metaKeys = Object.keys(ERROR_CODE_META)
       
       expect(metaKeys).toHaveLength(codes.length)
       codes.forEach(code => {
         expect(ERROR_CODE_META).toHaveProperty(code)
       })
     })
     
     it('should match snapshot structure', () => {
       expect(ERROR_CODE_META).toMatchSnapshot()
     })
   })
   ```

2. **Обновлять snapshot при добавлении новых кодов:**
   ```bash
   pnpm run test -- -u tests/unit/errors/base/error-code-meta-golden.test.ts
   ```

### Критерии

- ✅ Все коды из `ERROR_CODE` имеют метаданные
- ✅ Структура метаданных стабильна (snapshot tests)
- ✅ Изменения метаданных требуют явного обновления snapshot

---

## 📝 Дополнительные замечания

### Edge Cases

1. **Отсутствующие метаданные:**
   - Если код не найден в `ERROR_CODE_META`, используется `DEFAULT_ERROR_CODE_META`
   - Логируется предупреждение в development режиме
   - В production: silent fallback на defaults

2. **Циклические зависимости:**
   - `ErrorCodeMetaData.ts` не должен импортировать слои (domain, application, etc.)
   - Все слои импортируют только `base/`
   - `base/` не импортирует слои

3. **Типобезопасность:**
   - Использовать `as const` для всех констант
   - Использовать `ReadonlyDeep` для всех immutable структур
   - Избегать `any` типов

4. **Производительность:**
   - `ERROR_CODE_META` загружается один раз при инициализации модуля
   - `getErrorCodeMeta()` - O(1) операция (прямой доступ к объекту)
   - Не создавать новые объекты при каждом вызове

### Стратегия реализации (Greenfield проект)

**Важно:** Это greenfield проект, миграция не требуется. Все реализуется с нуля с использованием метаданных.

1. **Поэтапная реализация:**
   - Начать с Base Layer (Этап 1) - создать `ErrorCodeMetaData.ts` и интегрировать в `BaseError.ts`
   - Затем Domain Layer (Этап 2) - обновить существующие smart constructors
   - Остальные слои (Application, Infrastructure, Security, Validation) - реализовать по мере необходимости

2. **Приоритет метаданных:**
   - Переданные метаданные имеют приоритет над реестром (это поведение системы)
   - `createError()` автоматически заполняет метаданные из `ERROR_CODE_META`
   - Явно переданные значения перезаписывают значения из реестра

3. **Проверочный список реализации:**
   - [ ] Все коды из `ERROR_CODE` имеют метаданные в `ERROR_CODE_META`
   - [ ] `createError()` автоматически заполняет метаданные
   - [ ] Все smart constructors используют метаданные из реестра
   - [ ] Unit тесты покрывают использование метаданных
   - [ ] Golden tests настроены
   - [ ] Документация актуальна

### Использование метаданных в коде

При создании ошибок метаданные заполняются автоматически из реестра:

```typescript
// Автоматическое заполнение метаданных из ERROR_CODE_META
const error = createError(
  ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
  "Not found"
  // ✅ Метаданные (severity, category, origin, retryable, etc.) заполняются автоматически
)

// Переопределение метаданных (если требуется)
const error = createError(
  ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
  "Not found",
  {
    severity: ERROR_SEVERITY.CRITICAL  // ✅ Перезаписывает значение из реестра
    // Остальные метаданные берутся из ERROR_CODE_META
  }
)
```

**Рекомендация:** Использовать метаданные из реестра по умолчанию, переопределять только при необходимости.

---

---

## 🔗 Интеграция с архитектурой проекта

### Связь с другими слоями

#### Domain Layer (`packages/domains/`)
- **Использует:** `errors/base` (BaseError, ErrorCode)
- **Использует:** `errors/domain` (DomainError, smart constructors)
- **Не использует:** Application/Infrastructure ошибки (domain чистый)

#### Application Layer (`packages/application-core/`)
- **Использует:** `errors/base` (BaseError)
- **Использует:** `errors/domain` (DomainError для обработки domain ошибок)
- **Использует:** `errors/application` (ApplicationError для orchestration ошибок)
- **CQRS интеграция:**
  - Commands могут возвращать `ApplicationError` при отклонении
  - Queries могут возвращать `ApplicationError` при неудаче
  - Event Handlers могут использовать `ApplicationError` для обработки событий

#### Infrastructure Layers (`packages/infrastructure-*/`)
- **Использует:** `errors/base` (BaseError для wrapping)
- **Использует:** `errors/infrastructure` (InfrastructureError для IO ошибок)
- **Использует:** `errors/security` (SecurityError для auth/permissions)
- **AI Infrastructure:** Может использовать специфичные ошибки для AI операций
- **External API Infrastructure:** Может использовать специфичные ошибки для внешних API

#### API Layer (`api/`)
- **Использует:** `errors/serialization` (toHttpErrorResponse, toGrpcErrorResponse)
- **Использует:** Все слои ошибок для обработки и маппинга
- **Валидация:** Использует `errors/validation` для input validation

#### Effect Integration (если используется)
- **Использует:** `errors/adapters/EffectAdapter` для конвертации BaseError ↔ Effect.Error
- **Необязательно:** Effect может работать напрямую с BaseError через адаптеры

### Observability Integration

Система ошибок интегрируется с observability через метаданные:

1. **Метрики:**
   - `ErrorMetrics` из `ErrorCodeMeta` используются для Prometheus/OpenTelemetry
   - Counter и Histogram имена генерируются автоматически

2. **Трейсинг:**
   - `correlationId` из `ErrorMetadata` используется для distributed tracing
   - Интеграция с OpenTelemetry через `correlationId`

3. **Логирование:**
   - `toLogErrorFormat()` используется для structured logging
   - Severity из метаданных определяет уровень логирования

4. **Алертинг:**
   - `requiresAlert()` и `shouldBlockDeployment()` используются для SRE automation
   - Severity из метаданных определяет критичность алертов

---

## 🔄 Использование решений из существующей системы

### Анализ существующей системы (`/home/boss/Projects/effect/foundation/errors`)

Существующая система содержит много функциональности, но большая часть является оверхедом для нашей greenfield системы. Ниже перечислено, что действительно полезно и необходимо.

### ✅ Что используем (только необходимое)

#### 1. HTTP Status валидация (`core/constants/http-types.ts`)

**Что берем:**
- Функции валидации HTTP статусов:
  - `isValidHttpStatusCode(code: number): boolean` - простая проверка диапазона 100-599
  - `validateHttpStatusCode(code: unknown): ValidationResult<number>` - структурированная валидация
- Константы диапазонов:
  - `HTTP_STATUS_RANGE` - MIN: 100, MAX: 599
  - Категории: informational (100-199), success (200-299), redirect (300-399), client (400-499), server (500-599)

**Адаптация:**
- Убираем Effect зависимости (чистые функции)
- Убираем branded types (используем union types)
- Упрощаем `ValidationResult` до простого типа без Effect

**Где использовать:**
- В `ErrorCodeMeta.ts` для расширения `HttpStatusCode` типа
- В `ErrorCodeMetaData.ts` для валидации метаданных
- В `ErrorSerialization.ts` для валидации HTTP статусов

#### 2. Error Semantics (`core/error-semantics.ts`)

**Что берем:**
- Константы `ErrorSeverity` с числовыми значениями (LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4)
- Маппинги `SeverityLabels` и `SeverityValues` для конвертации между числовыми и строковыми значениями
- Утилиты `SeverityRank` для сравнения severity

**Адаптация:**
- У нас уже есть `ERROR_SEVERITY` как строковые константы
- Можно добавить числовые значения для сравнения и сортировки
- Добавить helpers для конвертации между форматами

**Где использовать:**
- В `ErrorUtils.ts` для функций сравнения severity
- В `ErrorCodeMeta.ts` для расширения severity метаданных

### ❌ Что НЕ используем (оверхед)

#### 1. Effect интеграция
- **Почему:** Error Kernel должен быть независимым от Effect
- **Где:** `core/sub-errors/sub-error-core.ts`, `core/cache/`, `engine/`
- **Решение:** Используем чистые функции без Effect

#### 2. Codegen система
- **Почему:** Слишком сложно для начала, можно добавить позже при необходимости
- **Где:** `codegen/` директория
- **Решение:** Ручное определение метаданных, codegen можно добавить позже

#### 3. HTTP Status Cache
- **Почему:** Оверхед для начала, можно добавить позже для оптимизации
- **Где:** `core/utils/http-status-cache.ts`
- **Решение:** Прямая валидация без кеширования (достаточно быстро)

#### 4. UI Mapping система
- **Почему:** Можно добавить позже, когда будет нужен UI слой
- **Где:** `core/ui-mapping/`, `runtime/ui-error-registry/`
- **Решение:** Используем базовые метаданные, UI mapping добавим позже

#### 5. Sub-error система
- **Почему:** У нас своя система ошибок (BaseError + DomainError)
- **Где:** `core/sub-errors/`
- **Решение:** Используем нашу систему, не нужна миграция

#### 6. Runtime metadata система
- **Почему:** Слишком сложно, можно добавить позже
- **Где:** `runtime/metadata/`
- **Решение:** Используем статический `ERROR_CODE_META` реестр

#### 7. Множество валидаторов
- **Почему:** У нас уже есть свои guards и валидаторы
- **Где:** `core/validators/`
- **Решение:** Используем существующие `isErrorCodeMeta`, `assertErrorCodeMeta`

### 📋 План интеграции полезных решений

**Этап 0 (опционально):** Улучшение HTTP Status валидации
- Расширить `HttpStatusCode` тип
- Добавить функции валидации
- Добавить HTTP Status категории

**В будущем (если потребуется):**
- HTTP Status Cache для оптимизации (если будет bottleneck)
- UI Mapping система (когда появится UI слой)
- Codegen система (если метаданных станет очень много)

---

## 🎯 Важные замечания для greenfield проекта

### Отсутствие миграции

Это **greenfield проект** - все реализуется с нуля. Не требуется:
- ❌ Миграция существующего кода
- ❌ Обратная совместимость со старыми версиями
- ❌ Постепенный переход на новую систему

### Что это означает

1. **Свобода реализации:**
   - Можно сразу использовать метаданные везде
   - Не нужно поддерживать старые паттерны
   - Можно применять лучшие практики с самого начала

2. **Фокус на качестве:**
   - Все smart constructors сразу используют метаданные
   - Все коды имеют метаданные с самого начала
   - Нет технического долга от старых решений

3. **Простота:**
   - Нет необходимости в fallback механизмах для старого кода
   - Нет необходимости в адаптерах для совместимости
   - Чистая архитектура без компромиссов

---

## ✅ Чек-лист реализации

### 📋 Быстрая навигация по шагам

**Используйте этот чек-лист для отслеживания прогресса реализации. Каждый шаг содержит ссылку на детальное описание.**

---

### ✅ Этап 0: Улучшение HTTP Status валидации (опционально) — **ВЫПОЛНЕНО**

- [x] **[Шаг 0.1: Расширение HTTP Status поддержки](#шаг-01-расширение-http-status-поддержки)** (~1-2 часа, опционально) — **ВЫПОЛНЕНО**
  - ✅ Расширить `HttpStatusCode` тип для поддержки всех стандартных кодов (100-599)
  - ✅ Добавить функции валидации HTTP статусов (`isValidHttpStatusCode`, `isHttpStatusCode`, `validateHttpStatusCode`)
  - ✅ Добавить HTTP Status категории (`HttpStatusCategory`, `HTTP_STATUS_CATEGORY_RANGES`, `getHttpStatusCategory`)

---

### ✅ Этап 1: Завершение Base Layer (Error Kernel) — **ВЫПОЛНЕНО**

- [x] **[Шаг 1.1: Реализация `ErrorCodeMetaData.ts`](#шаг-11-реализация-errorcodemetadatats)** (~2-3 часа) — **ВЫПОЛНЕНО**
  - ✅ Создать централизованный реестр метаданных `ERROR_CODE_META`
  - ✅ Заполнить метаданные для всех кодов из `ERROR_CODE`
  - ✅ Добавить runtime валидацию полноты реестра
  - ✅ Добавить helpers: `getErrorCodeMeta()`, `hasErrorCodeMeta()`, `getErrorCodeMetaOrThrow()`

- [x] **[Шаг 1.2: Интеграция метаданных в `BaseError.ts`](#шаг-12-интеграция-метаданных-в-baseerrorts)** (~1-2 часа) — **ВЫПОЛНЕНО**
  - ✅ Обновить `createError()` для автоматического заполнения метаданных из реестра
  - ✅ Обновить `wrapUnknownError()` аналогично
  - ✅ Добавить helper `getErrorMetaFromCode()` (экспортируется для использования в других слоях)

- [x] **[Шаг 1.3: Обновление `base/index.ts`](#шаг-13-обновление-baseindexts)** (~15 минут) — **ВЫПОЛНЕНО**
  - ✅ Экспортировать `ErrorCodeMeta` типы и утилиты
  - ✅ Экспортировать `ERROR_CODE_META` и helpers из `ErrorCodeMetaData.ts`
  - ✅ Проверить отсутствие циклических зависимостей

---

### ✅ Этап 2: Интеграция метаданных в Domain Layer — **ВЫПОЛНЕНО**

- [x] **[Шаг 2.1: Обновление `DomainError.ts`](#шаг-21-обновление-domainerrorts)** (~1 час) — **ВЫПОЛНЕНО**
  - ✅ Обновить smart constructors для использования метаданных из `ERROR_CODE_META`
  - ✅ Убрать хардкод значений `origin` и `category`
  - ✅ Сохранить возможность переопределения через параметры

- [x] **[Шаг 2.2: Создание `DomainErrorMeta.ts`](#шаг-22-создание-domainerrormetats)** (~30 минут) — **ВЫПОЛНЕНО**
  - ✅ Создать domain-специфичные helpers для работы с метаданными
  - ✅ Реализовать: `getDomainErrorMeta()`, `isDomainErrorRetryable()`, `getDomainErrorSeverity()`, `getDomainErrorCategory()`
  - ✅ Экспортировать из `domain/index.ts`

---

### ✅ Этап 3: Реализация остальных слоев — **ВЫПОЛНЕНО**

- [x] **[Шаг 3.1: Application Layer](#шаг-31-application-layer)** (~2 часа)
  - [x] Создать `application/ApplicationError.ts` с ADT типами и smart constructors
  - [x] Создать `application/ApplicationErrorMeta.ts` с helpers
  - [x] Создать `application/index.ts` для экспорта
  - [x] Добавить Application коды в `ERROR_CODE_META`

- [x] **[Шаг 3.2: Infrastructure Layer](#шаг-32-infrastructure-layer)** (~2 часа)
  - [x] Создать `infrastructure/InfrastructureError.ts` с ADT типами и smart constructors
  - [x] Создать `infrastructure/InfrastructureErrorMeta.ts` с helpers
  - [x] Создать `infrastructure/index.ts` для экспорта
  - [x] Добавить Infrastructure коды в `ERROR_CODE_META`

- [x] **[Шаг 3.3: Security Layer](#шаг-33-security-layer)** (~2 часа, низкий приоритет)
  - [x] Создать `security/SecurityError.ts` с ADT типами и smart constructors
  - [x] Создать `security/SecurityErrorMeta.ts` с helpers
  - [x] Создать `security/index.ts` для экспорта
  - [x] Добавить Security коды в `ERROR_CODE_META`

- [x] **[Шаг 3.4: Validation Layer](#шаг-34-validation-layer)** (~2 часа, низкий приоритет)
  - [x] Создать `validation/ValidationError.ts` с ADT типами и smart constructors
  - [x] **Важно:** Маппить на `ERROR_ORIGIN.APPLICATION` с `ERROR_CATEGORY.VALIDATION`
  - [x] Создать `validation/ValidationErrorMeta.ts` с helpers
  - [x] Создать `validation/index.ts` для экспорта
  - [x] Добавить Validation коды в `ERROR_CODE_META`

---

### ✅ Этап 4: Обновление публичного API — **ВЫПОЛНЕНО**

- [x] **[Шаг 4.1: Создание/обновление `errors/index.ts`](#шаг-41-созданиеобновление-errorsindexts)** (~15 минут)
  - [x] Создать единую точку входа для всей системы ошибок
  - [x] Экспортировать все реализованные слои
  - [x] Добавить JSDoc комментарии с описанием структуры

- [x] **[Шаг 4.2: Обновление `src/index.ts`](#шаг-42-обновление-srcindexts)** (~15 минут)
  - [x] Интегрировать новую систему ошибок в главный экспорт пакета
  - [x] Решить стратегию экспорта (granular vs единая точка входа)

---

### ✅ Этап 5: Интеграция метаданных в Serialization — **ВЫПОЛНЕНО**

- [x] **[Шаг 5.1: Обновление `ErrorSerialization.ts`](#шаг-51-обновление-errorserializationts)** (~1-2 часа)
  - [x] Обновить `toHttpErrorResponse()` для использования `httpStatus` из метаданных
  - [x] Добавить функцию `toGrpcErrorResponse()` с использованием `grpcStatus` из метаданных
  - [x] Обновить `toTelemetryErrorFormat()` для использования метаданных
  - [x] Добавить helpers: `getHttpStatusFromError()`, `getGrpcStatusFromError()`

---

### ✅ Этап 6: Опциональные интеграции — **ВЫПОЛНЕНО**

- [x] **[Шаг 6.1: Effect Adapters (опционально)](#шаг-61-effect-adapters-опционально)** (~1-2 часа, только если используется Effect)
  - [x] Создать `adapters/EffectAdapter.ts` для интеграции с Effect системой
  - [x] Реализовать `toEffectError()` и `fromEffectError()`
  - [x] Добавить опциональную зависимость на `effect` (peerDependency)

---

### 🧪 Этап 7: Тестирование и документация

- [ ] **[Шаг 7.1: Unit тесты](#шаг-71-unit-тесты)** (~4-5 часов)
  - Тесты для `ErrorCodeMetaData.ts` (полнота реестра, helpers)
  - Тесты для интеграции метаданных в `BaseError.ts`
  - Тесты для layer-specific helpers
  - Тесты для новых слоев (Application, Infrastructure, Security, Validation)
  - Golden tests для метаданных (snapshot tests)
  - Интеграционные тесты (полный flow от создания до сериализации)

- [ ] **[Шаг 7.2: Обновление документации](#шаг-72-обновление-документации)** (~1-2 часа)
  - Обновить `errors/README.md` с разделом о метаданных
  - Обновить JSDoc комментарии для всех экспортируемых функций
  - Создать ADR для системы метаданных (если требуется)
  - Обновить архитектурный план с учетом реализованных изменений

---

### 📊 Статистика реализации

**Всего шагов:** 16 (включая опциональные)  
**Общая оценка времени:** ~22-30 часов (+ опционально)

**По приоритетам:**
- 🔴 **Высокий приоритет:** Этап 1 (3 шага) + Этап 2 (2 шага) = **~6-9 часов**
- 🟡 **Средний приоритет:** Этап 3 (4 шага) + Этап 0 (1 шаг, опционально) = **~8-10 часов**
- 🟢 **Низкий приоритет:** Этап 4-7 (6 шагов) = **~8-11 часов**

---

### 🎯 Рекомендуемый порядок выполнения

1. **Сначала:** Этап 1 (Base Layer) — критично для всей системы
2. **Затем:** Этап 2 (Domain Layer) — уже используется в проекте
3. **Параллельно:** Этап 7.2 (Документация) — можно делать параллельно
4. **Далее:** Этап 3 (Application, Infrastructure) — для полноты системы
5. **После:** Этап 4 (Публичный API) + Этап 5 (Serialization)
6. **Опционально:** Этап 0 (HTTP Status) + Этап 6 (Effect Adapters)
7. **В конце:** Этап 7.1 (Unit тесты) — покрыть всю функциональность

---

*Документ создан: 2025-12-17*
*Версия плана: 1.3*
*Последнее обновление: 2025-12-17*
*Добавлен раздел: Использование решений из существующей системы*
*Добавлен чек-лист реализации с перелинковкой на все шаги*
*Добавлен чек-лист реализации*
