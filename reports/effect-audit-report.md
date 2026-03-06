# План действий по рефакторингу `/packages/core/src/effect` (по зависимостям)

## 1️⃣ effect-utils.ts (базовый модуль) ✅ **РЕАЛИЗОВАНО**

**Зависимость:** базовый модуль (не зависит от других effect-модулей)

**Используется:**

- Внутри `effect`: `effect-timeout.ts`, `effect-isolation.ts`, `orchestrator.ts`, `schema-validated-effect.ts`, `error-mapping.ts`, `index.ts`
- Внешние пакеты: `packages/app` (Effect, EffectContext, EffectError, EffectLogger, EffectAbortController, TraceId, withLogging, withRetry, sleep), `packages/feature-auth` (Effect)

**Цель:** убрать дублирование, вынести утилиты, документировать типы.

### 🔴 Критичные задачи

- ✅ Удалить дублирующий `withTimeout` (строки 88–165) — удален, используется только из `effect-timeout.ts`
- ✅ Удалить `createTimeoutError()` (строки 92–98) — удален
- ✅ Удалить тип `TimeoutError` (строка 89) — удален, используется только из `effect-timeout.ts`

### 🟡 Важные задачи

- ✅ Добавить комментарии для `Result<T, E>` — добавлены JSDoc комментарии с описанием универсального результата операции и отличием от `ValidationResult<T>`
- ✅ Перенести `combineAbortSignals` из `effect-timeout.ts` как публичную утилиту — перенесен в `effect-utils.ts`
- ✅ Экспортировать `combineAbortSignals` через `index.ts` — экспортируется
- ✅ Добавить JSDoc к базовым типам: `Effect<T>`, `EffectContext` — добавлены комментарии для обоих типов
- ✅ Добавить комментарии о назначении типов результатов (`Result<T, E>` vs `ValidationResult<T>`) — добавлены в JSDoc для `Result<T, E>`

### 🟢 Желательные задачи

- ⏭️ Опционально вынести `validateTimeoutMs`, если она понадобится глобально — оставлено в `effect-timeout.ts` (domain-специфичная утилита)

### 📋 Проверки после рефакторинга

- ✅ Убедиться, что нет дублирующих функций и типов (`withTimeout`, `TimeoutError`, `createTimeoutError` удалены)
- ✅ Все базовые типы (`Effect<T>`, `EffectContext`, `Result<T, E>`) определены здесь и документированы через JSDoc
- ✅ `combineAbortSignals` вынесен сюда как публичная утилита и экспортируется через `index.ts`
- ✅ Добавлены комментарии о назначении типов результатов (`Result<T, E>` vs `ValidationResult<T>`)
- ✅ Проверена совместимость внешних пакетов (`packages/app`, `packages/feature-auth`) с типами `Effect` и `EffectContext` (type-check проходит успешно, типы импортируются из `@livai/core/effect`)
- ✅ Проверка, что сторонние модули не создают локальные копии `EffectContext` или `Result<T, E>` (локальных определений не найдено, все используют импорты из `@livai/core/effect`)
- ✅ Добавлен unit-тест для `combineAbortSignals` на объединение нескольких сигналов и корректное срабатывание abort (покрывает множественные сигналы, уже aborted сигналы, дубликаты, пустой массив, один сигнал)

---

## 2️⃣ effect-timeout.ts (таймауты и domain-специфические расширения) ✅ **РЕАЛИЗОВАНО**

**Зависимость:** использует `effect-utils.ts`

**Используется:**

- Внутри `effect`: `orchestrator.ts`, `index.ts`
- Внешние пакеты: `packages/feature-auth` (withTimeout) ⚠️ **КРИТИЧНО** - используется в login.ts, logout.ts, register.ts, refresh.ts, security-pipeline.ts

### 🔴 Критичные задачи

- ✅ Проверены импорты `TimeoutError` → используется только класс `TimeoutError` из `effect-timeout.ts` (внутренние/внешние импорты не найдены)
- ✅ `withTimeout` экспортируется из `effect-timeout.ts` и доступен через `index.ts` (нет дублирования в `effect-utils.ts`)
- ✅ `orchestrator.ts` использует `withTimeout` из `effect-timeout.ts`
- ✅ ⚠️ Проверены внешние использования `withTimeout` в `packages/feature-auth` (login.ts, logout.ts, register.ts, refresh.ts, security-pipeline.ts): импорт идёт из `@livai/core/effect`, после рефакторинга остаётся корректным

### 🟡 Важные задачи

- ✅ Обновлён импорт `combineAbortSignals` → используется из `effect-utils.ts`
- ✅ Добавлен комментарий к `TimeoutEffectContext` (см. `effect-timeout.ts`)
- ✅ Добавлен/уточнён JSDoc к `withTimeout` с описанием `AbortSignal`, `tag`, `timeoutMs`

### 🟢 Желательные задачи

- ✅ `validateTimeoutMs` оставлен локально в `effect-timeout.ts` как internal (используется только этим модулем; не экспортируется)

### 📋 Проверки после рефакторинга

- ✅ Все импорты `TimeoutError` ссылаются только на класс внутри этого файла
- ✅ `withTimeout` используется как единственная точка, экспортируется и доступен через `index.ts`
- ✅ `TimeoutEffectContext` документирован как domain-специфичное расширение `EffectContext`
- ✅ JSDoc для `withTimeout` с описанием `AbortSignal`, `tag`, `timeoutMs`
- ✅ Обновлены импорты `combineAbortSignals` → из `effect-utils.ts`
- ✅ Проверены все внешние использования `withTimeout` (`packages/feature-auth`) — импорт остаётся корректным
- ✅ Добавить тесты на `withTimeout` с `AbortSignal` и `tag` для телеметрии (реализовано: `packages/core/tests/effect/effect-timeout.test.ts`, покрытие `effect-timeout.ts` 100%)
- ✅ Проверена обработка edge-case (manual): `timeoutMs = 0` (валидируется/нормализуется), уже aborted signal (через `combineAbortSignals`), ошибка внутри эффекта (пробрасывается)

---

## 3️⃣ validation.ts (валидация) ✅ **РЕАЛИЗОВАНО**

**Зависимость:** использует `error-mapping.ts`

**Используется:**

- Внутри `effect`: `schema-validated-effect.ts`, `index.ts`
- Внешние пакеты: `packages/app` (ValidationError, formatFileSize, validateFileBasic, FormValidationResult, ValidationSchema, validateForm, pipeMany)

### 🟡 Важные задачи

- ✅ Добавлены комментарии для `ValidationResult<T>` (включая отличие от `Result<T, E>`) — см. `packages/core/src/effect/validation.ts`
- ✅ Добавлено пояснение, что `ValidationResult<T>` и `Result<T, E>` — разные типы для разных целей (валидация vs результат операции)

### 🟢 Желательные задачи

- ✅ Проверено/обеспечено: ошибки валидации совместимы с `error-mapping.ts` (ValidationError расширяет `TaggedError`, коды — `ServiceErrorCode`)
- ✅ Убедились, что нет локальных определений кодов ошибок (используются `ServiceErrorCode`/централизованные коды из `error-mapping.ts`)

### 📋 Проверки после рефакторинга

- ✅ `ValidationResult<T>` документирован и отличается от `Result<T, E>`
- ✅ Все ошибки маппятся через `error-mapping.ts`
- ✅ Нет локальных кодов ошибок
- ✅ Добавлены unit-тесты на `ValidationResult` для success и failure (см. `packages/core/tests/effect/validation.test.ts`, покрытие `validation.ts` 100% по строкам)
- ✅ Проверено, что внешние пакеты (`packages/app`) корректно используют `ValidationResult<T>` (публичный export через `@livai/core/effect` сохранён; type-check пакета core проходит)

---

## 4️⃣ error-mapping.ts (централизованные ошибки) ✅ **РЕАЛИЗОВАНО**

**Зависимость:** использует `effect-utils.ts`

**Используется:**

- Внутри `effect`: `validation.ts`, `schema-validated-effect.ts`, `effect-isolation.ts`, `index.ts`
- Внешние пакеты: `packages/app` (mapError, mapErrorBoundaryError, TaggedError, ServicePrefix, MappedError), `packages/feature-auth` (mapError, MapErrorConfig, MappedError, ServicePrefix, TaggedError)

### 🟢 Желательные задачи

- ✅ Проверить, что все domain-ошибки используют `ServiceErrorCode` (коды ошибок типизированы через `ServiceErrorCode`, TaggedError и errorMessages заданы как `Record<ServiceErrorCode, ...>`)
- ✅ Убедиться, что нет локальных кодов ошибок (во всех core-модулях используются `ServiceErrorCode`/TaggedError; локальных строковых кодов ошибок не найдено)
- ✅ Проверено использование `TimeoutError` и `IsolationError` (оба экспортируются через `@livai/core/effect`, используются в orchestrator/pipeline и маппятся либо в собственные pipeline‑ошибки, либо в TaggedError/ServiceErrorCode на границе error-mapping)

### 📋 Проверки после рефакторинга

- ✅ Все domain-ошибки используют `ServiceErrorCode`
- ✅ Нет локальных кодов ошибок
- ✅ `TimeoutError` и `IsolationError` корректно маппятся (через pipeline/errors и error-mapping: pipeline создаёт специализированные ошибки, которые в UI‑слое проходят через `mapError`/`mapErrorBoundaryError`)
- ✅ Проверено, что внешние пакеты (`packages/app`, `packages/feature-auth`) корректно используют `mapError` и `TaggedError` (импортируют только из `@livai/core/effect`, собственных TaggedError/кодовых типов не создают)
- ✅ Добавить unit-тест на `mapError` с разными типами ошибок (создан `packages/core/tests/effect/error-mapping.test.ts` с 17 тестами, покрывающими TaggedError, EffectError.kind, системные ошибки, error-boundary маппинг, createDomainError, chainMappers; достигнуто 100% coverage: statements/branches/functions/lines)

---

## 5️⃣ effect-isolation.ts (изоляция эффектов)

**Зависимость:** использует `effect-utils.ts`

**Используется:**

- Внутри `effect`: `orchestrator.ts`, `index.ts`
- Внешние пакеты: нет прямого использования (используется через orchestrator)

### 📋 Проверки после рефакторинга

- ☐ `runIsolated` корректно используется в `orchestrator.ts`
- ☐ Нет дублирования типов и ошибок
- ☐ Unit-тесты на try/catch и корректное возвращение ошибок
- ☐ Проверить, что side-effects изолированы и не влияют на глобальный state

---

## 6️⃣ orchestrator.ts (оркестрация)

**Зависимость:** использует `effect-timeout.ts`, `effect-isolation.ts`, `effect-utils.ts`

**Используется:**

- Внутри `effect`: `index.ts`
- Внешние пакеты: `packages/feature-auth` (orchestrate, step) ⚠️ **КРИТИЧНО** - используется в login.ts, refresh.ts, security-pipeline.ts

### 🔴 Критичные задачи

- Обновить импорты `withTimeout` → использовать только из `effect-timeout.ts`
- Передавать `AbortSignal` правильно в шаги
- Проверить, что `runIsolated` используется из `effect-isolation.ts`
- ⚠️ **КРИТИЧНО:** `packages/feature-auth` использует `orchestrate` и `step` - убедиться, что после рефакторинга всё работает корректно

### 📋 Проверки после рефакторинга

- ☐ Импорты `withTimeout` → только из `effect-timeout.ts`
- ☐ `runIsolated` → только из `effect-isolation.ts`
- ☐ Передача `AbortSignal` в шаги
- ☐ Проверить, что внешние пакеты (`packages/feature-auth`) корректно используют `orchestrate` и `step`
- ☐ Добавить unit-тест на последовательное выполнение шагов с таймаутами и сигналами abort
- ☐ Проверить, что оркестратор не дублирует логику таймаутов или ошибок

---

## 7️⃣ schema-validated-effect.ts (валидация схем)

**Зависимость:** использует `effect-utils.ts`, `error-mapping.ts`, `validation.ts`

**Используется:**

- Внутри `effect`: `index.ts`
- Внешние пакеты: `packages/feature-auth` (validatedEffect) ⚠️ **КРИТИЧНО** - используется в login.ts, register.ts, refresh.ts

### 🟢 Желательные задачи

- Очистить deprecated `createValidationError` (строки 86–92)
- Либо удалить, либо оставить с runtime предупреждением:
  ```typescript
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] createValidationError is deprecated, use createDomainError instead');
  }
  ```

### 📋 Проверки после рефакторинга

- ☐ Удалить deprecated `createValidationError` или оставить с runtime предупреждением
- ☐ Все ошибки маппятся через `error-mapping.ts`
- ☐ Внешние пакеты (`packages/feature-auth`) корректно используют `validatedEffect`
- ☐ Добавить unit-тесты на валидацию схем и правильное создание domain-ошибок

---

## 8️⃣ index.ts (экспорт)

**Зависимость:** агрегирует все модули (`effect-utils.ts`, `effect-timeout.ts`, `effect-isolation.ts`, `orchestrator.ts`, `schema-validated-effect.ts`, `validation.ts`, `error-mapping.ts`)

**Используется:** внешними пакетами (публичный API)

- `packages/app`: Effect, EffectContext, EffectError, EffectLogger, EffectAbortController, TraceId, withLogging, withRetry, sleep, mapError, mapErrorBoundaryError, ValidationError, formatFileSize, validateFileBasic, FormValidationResult, ValidationSchema, validateForm, TaggedError, ServicePrefix, MappedError, pipeMany
- `packages/feature-auth`: Effect, withTimeout, orchestrate, step, validatedEffect, mapError, MapErrorConfig, MappedError, ServicePrefix, TaggedError

### 🔴 Критичные задачи

- Удалить экспорт `withTimeout` из `effect-utils.ts`
- Экспортировать `withTimeout` только из `effect-timeout.ts`
- Экспортировать `TimeoutError` как класс из `effect-timeout.ts`
- Экспортировать `combineAbortSignals` из `effect-utils.ts`
- Обновить все остальные экспорты после рефакторинга

### 📋 Проверки после рефакторинга

- ☐ Экспортировать `withTimeout` только из `effect-timeout.ts`
- ☐ Экспортировать `TimeoutError` как класс из `effect-timeout.ts`
- ☐ Экспортировать `combineAbortSignals` из `effect-utils.ts`
- ☐ Удалить все старые или дублирующие экспорты
- ☐ Проверить совместимость всех внешних пакетов (`packages/app`, `packages/feature-auth`)
- ☐ Проверить tree-shaking → лишние функции не экспортируются
- ☐ Проверить, что импорт через `@livai/core/effect` остаётся корректным для всех внешних пакетов после изменений

---

## ✅ Итоговая последовательность работы

1. `effect-utils.ts` → убрать дубли, добавить комментарии, подготовить утилиты
2. `effect-timeout.ts` → использовать класс `TimeoutError`, вынести `combineAbortSignals`, добавить JSDoc
3. `validation.ts` → документировать `ValidationResult<T>`
4. `error-mapping.ts` → проверить типы ошибок и коды
5. `effect-isolation.ts` → проверить типы и `runIsolated`
6. `orchestrator.ts` → обновить импорты `withTimeout` и `runIsolated`
7. `schema-validated-effect.ts` → убрать deprecated `createValidationError`
8. `index.ts` → синхронизировать экспорты после всех изменений

---

## 📌 Общие рекомендации по архитектуре и зависимостям

### Единая точка истины для типов и ошибок

- ☐ Все базовые типы (`Effect<T>`, `EffectContext`, `Result<T, E>`) только в `effect-utils.ts`
- ☐ Все ошибки централизованы через `error-mapping.ts`

### Domain-модули расширяют, но не дублируют базовые типы

- ☐ `TimeoutEffectContext` и другие контексты только расширяют, не копируют типы

### Публичный API через index.ts

- ☐ Все модули доступны только через `index.ts`, без утечек внутренних реализаций

### Unit-тесты на все критичные модули и функции

- ☐ `withTimeout`, `combineAbortSignals`, `runIsolated`, `orchestrate`, `validatedEffect`, `mapError`

### Проверка внешних зависимостей после рефакторинга

- ☐ `packages/app` и `packages/feature-auth` → импорты и типы не сломались

### Документировать все публичные функции и типы через JSDoc

- ☐ Включая назначения, ограничения, domain-специфические расширения

### Обновление экспорта и импорта после перемещений

- ☐ Никаких "старых" дублирующих импортов не должно остаться
