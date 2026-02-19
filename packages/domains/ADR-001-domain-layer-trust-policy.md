# ADR-001: Domain Layer Trust Policy

**Status:** Accepted\
**Date:** 2024\
**Context:** Domain layer должен работать только с валидированными данными для предотвращения security vulnerabilities (model poisoning, data leakage).

## Decision

Domain layer (`packages/domains`) работает только с **валидированными данными** и является **trusted zone**.

## Rules

### 1. Валидация входных данных

Все входные данные должны проходить через **factory methods** перед использованием в domain layer:

- `classificationContext.create()` — создание и валидация context
- `classificationSignals.create()` — создание и валидация signals
- `classificationLabel.create()` — создание и валидация labels

**Правило:** Если factory method возвращает `null`, данные невалидны и не должны использоваться.

### 2. Pure Functions

Любые функции в domain layer должны быть **pure functions**:

- ✅ Нет side-effects
- ✅ Нет `async/await` в production коде
- ✅ Нет IO операций:
  - ❌ DB queries
  - ❌ Queue payload
  - ❌ HTTP клиенты (`fetch`, `axios`)
  - ❌ Файловая система (`fs`, `path`)
  - ❌ Environment variables (`process.env`)

### 3. Trust Boundary

**Запрещено:**

- ❌ Прямой импорт из `adapters`, `infra`, `api` пакетов
- ❌ Circular imports между domain модулями
- ❌ Backdoor функции типа `createUnsafe()`, `createRaw()`, `fromRaw()`
- ❌ Экспорт raw типов, которые могут быть созданы без factory

**Разрешено:**

- ✅ Экспорт типов (`export type`) для TypeScript
- ✅ Импорт из `@livai/core` (trusted core domain kit)
- ✅ Импорт между модулями внутри `packages/domains`

### 4. Factory Methods Contract

Все factory methods должны:

- ✅ Возвращать `null` при невалидных данных (не fallback значения)
- ✅ Не делать silent coercion
- ✅ Не использовать `as SomeType` без предварительной валидации
- ✅ Не использовать `unknown as T` без проверок
- ✅ Валидировать все поля перед созданием объекта

### 5. Prototype Pollution Protection

**Запрещено:**

- ❌ `Object.assign({}, raw)` без валидации
- ❌ Spread raw объектов (`{ ...raw }`) без schema validation

**Разрешено:**

- ✅ Spread после валидации через factory methods
- ✅ Shallow copy валидированных объектов

### 6. ESLint Rules

ESLint правила `ai-security/model-poisoning` и `ai-security/data-leakage` **выключены** для `packages/domains/**/*.{ts,tsx}` намеренно, так как:

- Domain layer работает только с уже валидированными данными
- Валидация выполняется на границе (adapter/application layer)
- Все входные данные проходят через factory methods с валидацией

## Architecture Flow

```
External input (HTTP/DB/Queue)
   ↓
Adapter/Application layer
   ↓ (Zod schema validation)
Factory methods (classificationContext.create(), etc.)
   ↓ (returns null if invalid)
packages/domains (trusted zone)
   ↓
Pure domain logic
```

## Enforcement

1. **Code Review:** Все новые файлы в `packages/domains` должны соблюдать этот контракт
2. **Tests:** Интеграционные тесты проверяют, что factory methods фильтруют некорректные данные
3. **ESLint:** Правила отключены, но архитектурный контракт должен соблюдаться
4. **Documentation:** Этот ADR документирует контракт для future developers

## Consequences

### Positive

- ✅ Domain layer защищён от невалидированных данных
- ✅ Чёткое разделение ответственности (validation vs domain logic)
- ✅ Легче тестировать (pure functions)
- ✅ Меньше security vulnerabilities

### Negative

- ⚠️ Требуется дисциплина при добавлении нового кода
- ⚠️ Все данные должны проходить через factory methods (дополнительный слой)

## References

- ESLint override: `config/eslint/modes/canary.config.mjs` и `dev.config.mjs`
- Factory methods: `packages/domains/src/classification/signals/signals.ts`
- Context builders: `packages/domains/src/classification/context/context-builders.ts`
