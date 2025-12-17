# 🏗️ Архитектурные границы Core Contracts v3.0

## 📋 Правила зависимостей и импортов

### 🎯 Domain Layer (ЧИСТЫЙ ДОМЕН)

**Domain - сердце бизнес-логики. Никаких side effects, внешних зависимостей.**

```
❌ domain НЕЛЬЗЯ импортировать:
   - io/* (Effect, внешние API, side effects)
   - context/* (runtime context, correlation)
   - targets/* (runtime-specific код)

✅ domain МОЖНО импортировать:
   - domain/* (другие domain модули)
   - fp/* (чистые функции для value objects, validation)
   - errors/base (BaseError для типизации)
   - domain/errors (собственные domain errors - DomainError, RuleViolationError)
```

**Обоснование:** Domain должен быть чистым, тестируемым без mocks, независимым от инфраструктуры.

**🔄 Domain Errors:** errors/domain логически принадлежит domain layer и не может импортировать ничего, кроме errors/base.

---

### 🔄 IO Layer (ГРАНИЦА ЭФФЕКТОВ) - Ports & Adapters

**IO - мост между чистым domain и внешним миром через Effect (Ports & Adapters pattern).**

```
❌ io НЕЛЬЗЯ импортировать:
   - domain/services (бизнес-логика, use cases)
   - domain/aggregates (domain entities с поведением)

✅ io МОЖНО импортировать:
   - domain/ports (интерфейсы репозиториев, шлюзов)
   - domain/model (value objects, DTOs для IO)
   - fp/* (чистые утилиты для composition)
   - errors/infrastructure (InfrastructureError, TimeoutError)
   - errors/base (BaseError для wrapping)
   - context/* (correlation context для tracing)
   - io/* (другие IO модули)
```

**Обоснование:** IO реализует domain ports (Adapters), но domain services не зависят от конкретных IO реализаций.

**📌 Ports & Adapters:**
- `domain/ports/` - интерфейсы (Repository, Gateway)
- `io/adapters/` - реализации интерфейсов

---

### 🧮 FP Layer (ЧИСТОЕ ФУНКЦИОНАЛЬНОЕ ПРОГРАММИРОВАНИЕ)

**FP - математические утилиты, без side effects.**

```
❌ fp НЕЛЬЗЯ импортировать:
   - io/* (side effects нарушают чистоту)
   - domain/services (бизнес-логика в утилитах)
   - domain/aggregates (entities с поведением)
   - context/* (runtime state в чистых функциях)

✅ fp МОЖНО импортировать:
   - domain/model (value objects для валидации)
   - fp/* (другие FP утилиты)
   - errors/base (только базовые типы ошибок)
```

**Обоснование:** FP слой должен быть полностью чистым, но может работать с domain value objects для валидации и утилит.

**🔧 Исключение:** fp может импортировать domain value objects для создания валидаторов (isEmail, nonEmptyString, etc.)

---

### 🚨 Errors Layer (ТИПИЗАЦИЯ ОШИБОК)

**Errors - ADT для type-safe error handling.**

```
❌ errors НЕЛЬЗЯ импортировать:
   - io/* (side effects в типах ошибок)
   - domain/* (errors не зависят от бизнес-логики)

✅ errors МОЖНО импортировать:
   - errors/* (составные типы и утилиты)
   - fp/* (error utilities, pattern matching)
```

**Обоснование:** Errors - фундаментальная типизация, не должна зависеть от бизнес-логики.

---

### 📊 Context Layer (ПРОПАГАЦИЯ КОНТЕКСТА)

**Context - correlation, tracing, tenant isolation.**

```
❌ context НЕЛЬЗЯ импортировать:
   - domain/* (контекст не знает о бизнес-логике)
   - io/* (side effects в контексте)
   - targets/* (runtime-specific в контексте)

✅ context МОЖНО импортировать:
   - fp/* (чистые утилиты)
   - errors/base (correlation errors)
   - context/* (внутренние утилиты)
```

**Обоснование:** Context - инфраструктурный примитив, не связанный с бизнес-логикой.

---

### 🎭 Targets Layer (RUNTIME-СПЕЦИФИЧНЫЕ АДАПТЕРЫ)

**Targets - адаптеры для разных runtime сред.**

```
❌ targets НЕЛЬЗЯ импортировать:
   - domain/* (runtime не знает о domain)

✅ targets МОЖНО импортировать:
   - io/* (адаптеры для runtime APIs)
   - fp/* (утилиты для composition)
   - errors/* (runtime-specific errors)
   - context/* (context propagation в runtime)
```

**Обоснование:** Targets - тонкий слой адаптации, делегирующий основную логику.

---

## 🔧 Правила кодирования

### 📦 Import/Export Rules

**ESM + TypeScript strict mode:**
- ✅ `import { Effect } from 'effect'` - только named imports
- ❌ `import Effect from 'effect'` - запрещены default imports
- ✅ `import { User } from './domain/User.ts'` - explicit extensions
- ✅ `export { User } from './User.ts'` - named exports only
- ❌ `export default User` - запрещены default exports

**Обоснование:** Explicit imports предотвращают bundle бloat и улучшают tree-shaking.

### 🚨 Error Handling Rules

**Строгая типизация ошибок:**
- ✅ Async функции: `Effect<A, Error, B>`
- ✅ Domain operations: `Either<A, DomainError>`
- ✅ Infrastructure: `Effect<A, InfrastructureError, B>`
- ❌ `try/catch` в domain layer
- ✅ Pattern matching для error types
- ✅ Exhaustive checking в switch statements

**Error Category Tagging:**
```typescript
type ErrorCategory =
  | "domain"
  | "infrastructure"
  | "security"
  | "rate-limit"
  | "timeout"

interface TaggedError {
  readonly _tag: string           // Discriminated union tag
  readonly category: ErrorCategory // Error category
  readonly retryable: boolean     // Can operation be retried?
}
```

**Обоснование:** Tagged errors обеспечивают type-safe error handling, observability и intelligent retry logic.

### 🧪 Testing Rules

**Многоуровневое тестирование:**
- ✅ Domain: pure functions + unit tests (100% coverage)
- ✅ IO: integration tests с controlled mocking
- ✅ Context: property-based testing
- ✅ E2E: через targets layer
- ✅ Contract: `domain/ports/*.contract.test.ts` (проверка интерфейсов)
- 📊 85%+ coverage для production code
- 📊 100% coverage для domain logic

**Contract Tests:**
- ✅ Проверяют соответствие IO adapters domain ports
- ✅ Валидируют targets не ломают контракты
- ✅ Обеспечивают multi-runtime compatibility

**Обоснование:** Contract tests гарантируют architectural integrity при эволюции кода.

---

## 📝 Соглашения по именованию

### 🏷️ TypeScript Naming

**Types & Interfaces:**
- ✅ `PascalCase` для типов: `User`, `Either`, `Effect`
- ✅ `Port` suffix для interfaces: `UserRepositoryPort` (вместо `IUserRepository`)
- ✅ `T` prefix для generic types: `TUser`

**Values & Functions:**
- ✅ `camelCase` для функций: `createUser`, `validateEmail`
- ✅ `PascalCase` для classes: `UserEntity`, `DomainService`

**Constants:**
- ✅ `SCREAMING_SNAKE_CASE`: `MAX_RETRY_ATTEMPTS`

### 📁 File/Folder Naming

**Folders:**
- ✅ `kebab-case` для папок: `domain-events`, `error-normalizers`
- ✅ `camelCase` для технических: `ioAdapters`, `fpUtils`

**Files:**
- ✅ `PascalCase` для типов: `DomainEvent.ts`, `User.ts`
- ✅ `camelCase` для реализации: `createUser.ts`, `validateEmail.ts`
- ✅ `kebab-case` для индексов: `index.ts`

---

## 🎭 Runtime-Specific Rules

### 🌐 Browser Target
```
✅ Доступно: DOM APIs, Web APIs, localStorage
❌ Запрещено: Node.js APIs, fs, process, Buffer
```

### 🟢 Node.js Target
```
✅ Доступно: fs, path, crypto, process, Buffer
❌ Запрещено: DOM APIs, window, document
```

### 🔄 Shared Target
```
✅ Доступно: Universal APIs (Date, Math, JSON, etc.)
❌ Запрещено: DOM APIs, Node.js APIs, runtime-specific
```

---

## ⚡ Performance Rules

### 📦 Bundle Optimization
- ✅ Tree-shakable exports
- ✅ Lazy loading для больших модулей
- ✅ Minimal bundle size в targets
- ❌ No unused dependencies

### 🧵 Concurrency Rules
- ✅ Effect для async operations
- ✅ Controlled parallelism в IO layer
- ✅ No race conditions в context propagation

---

## 🛡️ Code Quality Rules

### 🔍 Linting & Formatting
- ✅ ESLint с custom rules для архитектуры
- ✅ Prettier для consistent formatting
- ✅ TypeScript strict mode
- ✅ No any types

### 📚 Documentation
- ✅ TSDoc для public APIs
- ✅ README для каждого модуля
- ✅ Architecture decision records
- ✅ Migration guides

---

## 🚨 Нарушения границ

**Любое нарушение этих правил - blocking issue:**
1. ❌ Domain imports IO → **Critical Bug**
2. ❌ FP with side effects → **Critical Bug**
3. ❌ Context with business logic → **Major Bug**
4. ❌ Default exports → **Minor Issue**

**Code Review Checklist:**
- [ ] Dependencies follow boundaries
- [ ] Error types are correct
- [ ] Naming conventions followed
- [ ] Tests cover all paths
- [ ] Documentation updated

---

*Эти правила - фундамент архитектуры. Все код должен им подчиняться. Изменения только через ADR (Architecture Decision Record).* 🚀
