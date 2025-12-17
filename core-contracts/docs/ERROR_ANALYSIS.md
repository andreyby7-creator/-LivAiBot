# 🔍 Комплексный анализ Error Kernel - Core Contracts

## 📊 Текущее состояние (Current State)

### ✅ Что есть (What Exists):

1. **BaseError.ts** - FP-совместимый тип ошибки
   - Immutable структура через `ReadonlyDeep`
   - Factory функции `createError`, `wrapUnknownError`
   - Type guard `isBaseError`
   - Pattern matching через `matchError`

2. **ErrorCode.ts** - Стабильные коды ошибок
   - ABI-стабильные константы
   - Type guard `isErrorCodeValid`
   - Layer-specific коды (DOMAIN_, APPLICATION_, INFRA_, SECURITY_, VALIDATION_)

3. **ErrorConstants.ts** - Константы
   - `ERROR_SEVERITY` (low, medium, high, critical)
   - `ERROR_CATEGORY` (validation, authorization, business, infrastructure, unknown)
   - `ERROR_ORIGIN` (domain, application, infrastructure, security)
   - Type guards для каждой константы

4. **ErrorMetadata.ts** - Метаданные ошибок
   - correlationId, context, localizedMessage, cause
   - severity, category, tenantId, retryable, origin, extra
   - Factory `createErrorMetadata`

5. **ErrorUtils.ts** - Утилиты
   - Type guards по слоям (isDomainError, isApplicationError, etc.)
   - Metadata helpers (hasCorrelationId, hasTenantId, isRetryable, hasCause)
   - Cause chain utilities (getCauseChain, getRootCause, getNthCause)
   - Filtering (filterErrorsBySeverity, filterErrorsByCategory, findErrorByCode)
   - Transformation (toSerializableError, sanitizeError)
   - Comparison (areErrorsEqual, hasSameCode, hasSameCodeAndMessage)
   - Context utilities (mergeErrorContexts, extractContextValue)
   - Validation (isValidErrorMetadata, validateErrorStructure)

---

## 🔎 Анализ пробелов (Gap Analysis)

### 🟡 1. Специализированная сериализация (Specialized Serialization)

**Текущее состояние:**
- ✅ Есть `toSerializableError` - общая сериализация для логов/мониторинга
- ❌ НЕТ специализированных форматов для разных use cases

**Что может не хватать:**

#### a) HTTP Response сериализация
```typescript
// Нужна функция для HTTP ответов (без stack trace, sanitized context)
toHttpResponse(error: BaseError): HttpErrorResponse
```
- **Зачем:** HTTP API должны возвращать безопасные ответы без stack traces
- **Место:** Может быть в `ErrorUtils.ts` или отдельный `ErrorSerialization.ts`
- **Приоритет:** 🟡 Средний (можно делать через `toSerializableError` + sanitize)

#### b) Log Format сериализация
```typescript
// Нужна функция для логов (со stack trace, полный context)
toLogFormat(error: BaseError, options?: { includeStack?: boolean }): LogErrorFormat
```
- **Зачем:** Логи нуждаются в полной информации включая stack traces
- **Место:** `ErrorUtils.ts` или `ErrorSerialization.ts`
- **Приоритет:** 🟡 Средний (можно расширить `toSerializableError`)

#### c) Telemetry Format сериализация
```typescript
// Нужна функция для телеметрии (с env, service, version, host, region)
toTelemetryFormat(
  error: BaseError, 
  options?: { env?, service?, version?, host?, region? }
): TelemetryErrorFormat
```
- **Зачем:** Мониторинг системы нуждается в контексте окружения
- **Место:** `ErrorUtils.ts` или `ErrorSerialization.ts`
- **Приоритет:** 🟢 Низкий (можно добавить позже, когда появится телеметрия)

**Рекомендация:** 
- Создать `ErrorSerialization.ts` с функциями `toHttpResponse`, `toLogFormat`, `toTelemetryFormat`
- ИЛИ расширить `ErrorUtils.ts` этими функциями (если не перегружает файл)

---

### 🟢 2. HTTP Status Code Mapping

**Текущее состояние:**
- ❌ НЕТ маппинга ErrorCode → HTTP status codes
- 📝 В README.md упоминается, что это должно быть в targets layer

**Что может не хватать:**

```typescript
// Маппинг ErrorCode → HTTP status code
mapErrorCodeToHttpStatus(code: ErrorCode): number
mapErrorToHttpStatus(error: BaseError): number
```

**Аргументы ЗА:**
- ✅ Базовый маппер может быть частью Error Kernel (не зависит от HTTP библиотеки)
- ✅ Помогает соблюдать консистентность маппинга
- ✅ Может быть переопределен в targets layer

**Аргументы ПРОТИВ:**
- ❌ Error Kernel не должен знать про transport layer
- ❌ Согласно архитектуре, маппинг должен быть в targets/
- ❌ Может создать coupling с HTTP

**Рекомендация:**
- 🟡 **Условно:** Создать `ErrorStatusMapper.ts` только если:
  - Нужна консистентность маппинга на уровне core-contracts
  - Множество микросервисов используют разные HTTP библиотеки
  - Требуется единый source of truth для маппинга
- ⚠️ **НО:** Лучше оставить это в targets layer, как указано в архитектуре

---

### 🟡 3. Severity-based Business Logic Helpers

**Текущее состояние:**
- ✅ Есть `getErrorSeverity` - получает severity с fallback
- ❌ НЕТ бизнес-логики на основе severity

**Что может не хватать:**

```typescript
// Требует ли ошибка алерта?
requiresAlert(error: BaseError): boolean
// Блокирует ли ошибка deployment?
shouldBlockDeployment(error: BaseError): boolean
// Приоритет ошибки для сортировки/очередей
getErrorPriority(error: BaseError): number
```

**Рекомендация:**
- ✅ Добавить в `ErrorUtils.ts`:
  - `requiresAlert` - true для HIGH и CRITICAL
  - `shouldBlockDeployment` - true для CRITICAL
  - `getErrorPriority` - числовой приоритет для сортировки (CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1)
- **Приоритет:** 🟡 Средний (полезно для мониторинга и CI/CD)

---

### 🟢 4. Retryable Error Logic

**Текущее состояние:**
- ✅ Есть `isRetryable` - проверяет флаг retryable
- ❌ НЕТ логики определения retryable на основе кода/severity

**Что может не хватать:**

```typescript
// Определяет, можно ли повторить на основе кода ошибки
isErrorCodeRetryable(code: ErrorCode): boolean
// Комбинированная проверка (флаг + код)
shouldRetry(error: BaseError): boolean
```

**Аргументы:**
- ✅ Некоторые коды ошибок всегда retryable (INFRA_TIMEOUT, INFRA_NETWORK_ERROR)
- ✅ Некоторые никогда не retryable (DOMAIN_RULE_VIOLATION, SECURITY_UNAUTHORIZED)
- ⚠️ Но это может быть domain-специфично

**Рекомендация:**
- 🟢 **Низкий приоритет:** Можно добавить helper в `ErrorUtils.ts` если нужна стандартная логика
- ⚠️ **НО:** Retry логика часто специфична для конкретных use cases, лучше оставить в application layer

---

### 🟢 5. Metadata Helpers Extension

**Текущее состояние:**
- ✅ Базовые helpers есть (hasCorrelationId, hasTenantId)
- ❌ НЕТ helpers для извлечения метаданных (getCategory, getTags, hasTag)

**Что может не хватать:**

```typescript
// Извлечение метаданных
getCategory(error: BaseError): ErrorCategory | undefined
getTags(error: BaseError): string[] | undefined  // если добавим tags в ErrorMetadata
hasTag(error: BaseError, tag: string): boolean
getRecoverySuggestions(error: BaseError): string[] | undefined
```

**Рекомендация:**
- 🟡 **Средний приоритет:** Добавить если метаданные будут расширены (tags, recovery suggestions)
- ⚠️ **НО:** Сейчас в ErrorMetadata нет tags/recovery suggestions, поэтому не актуально

---

### 🔴 6. AppError.ts (НЕ нужен!)

**Аргументы ПРОТИВ:**
- ❌ Противоречит FP подходу проекта (использует классы)
- ❌ Дублирует функциональность BaseError
- ❌ BaseError уже покрывает все нужды через функции

**Рекомендация:**
- ❌ **НЕ создавать** AppError.ts - это было бы шагом назад от FP к OOP

---

## 📋 Итоговые рекомендации (Final Recommendations)

### ✅ Высокий приоритет (High Priority):

1. **Severity-based helpers** → Добавить в `ErrorUtils.ts`:
   - `requiresAlert(error: BaseError): boolean`
   - `shouldBlockDeployment(error: BaseError): boolean`
   - `getErrorPriority(error: BaseError): number`

### 🟡 Средний приоритет (Medium Priority):

2. **Специализированная сериализация** → Создать `ErrorSerialization.ts`:
   - `toHttpResponse(error: BaseError): HttpErrorResponse` (без stack, sanitized)
   - `toLogFormat(error: BaseError, options?): LogErrorFormat` (со stack)
   - `toTelemetryFormat(error: BaseError, options?): TelemetryErrorFormat` (с env info)

### 🟢 Низкий приоритет (Low Priority / Future):

3. **HTTP Status Mapping** → Рассмотреть `ErrorStatusMapper.ts` ТОЛЬКО если:
   - Нужна консистентность на уровне core-contracts
   - Множество микросервисов используют разные HTTP библиотеки
   - ⚠️ Иначе оставить в targets layer

4. **Retryable logic** → Добавить helpers в `ErrorUtils.ts` если нужна стандартная логика

---

## 🎯 Принципы решения (Decision Principles)

1. **FP First:** Все функции, никаких классов
2. **Minimal Core:** Error Kernel должен быть минимальным, transport-specific логика в targets/
3. **Extensibility:** Легко расширять без breaking changes
4. **Type Safety:** Полная типизация на всех уровнях
5. **No Overhead:** Добавлять только то, что реально используется

---

## 📝 Заключение (Conclusion)

**Текущее состояние хорошее** - есть все базовые компоненты. 

**Что реально стоит добавить:**
- ✅ Severity-based helpers (requiresAlert, shouldBlockDeployment, getErrorPriority)
- 🟡 Специализированная сериализация (toHttpResponse, toLogFormat)

**Что НЕ нужно:**
- ❌ AppError.ts (классы)
- ❌ ErrorSeverity.ts (уже есть в ErrorConstants.ts)
- ❌ RetryableError.ts (достаточно функций в ErrorUtils.ts)
- ❌ ErrorStatusMapper.ts (лучше в targets/, если только не критично нужна консистентность)
