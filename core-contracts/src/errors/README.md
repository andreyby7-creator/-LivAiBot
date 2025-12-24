# Error Handling Architecture

Единая система обработки ошибок LivAiBot с type-safe TaggedError подходом.

## 🏗️ Архитектура

```
🧱 Base Layer ──► 🔗 Shared Layer ──► ⚙️ Service Layer
     │                │                    │
     ▼                ▼                    ▼
  Types           Domain / Infra       Service Errors
  Registry        Boundary Adapters    Custom Adapters
  Strategies      Policies            Resilience Strategies
  Observability
```

### 🧱 Base Layer

Foundation primitives для всех остальных слоёв. Независимые строительные блоки для type safety и унифицированного подхода.

### 🔗 Shared Layer

80% готовых решений для типовых операций. Enterprise компоненты с domain/infra errors, adapters и resilience policies.

### ⚙️ Service Layer

Service-specific ошибки и адаптеры с расширенной логикой. Расширяет Shared для уникальных требований каждого сервиса.

## 📚 Слои системы

### 🔧 Base Layer (`base/`)

**Foundation примитивы** для построения error handling.

- **BaseError**: Tagged Union для type safety
- **ErrorCode**: Унифицированная система кодов
- **ErrorBuilders**: Конструкторы типизированных ошибок
- **UnifiedErrorRegistry**: Layered error resolution
- **ErrorStrategies**: Effect-based resilience patterns
- **ErrorInstrumentation**: Observability интеграция

_Используется всеми слоями выше для фундамента._

### 🚀 Shared Layer (`shared/`)

**Enterprise компоненты** для 80% случаев error handling.

- **Domain Errors**: Validation, Auth, Permission с builders
- **Infrastructure Errors**: Database, Cache, Network mapping
- **Boundary Adapters**: HTTP/Database/Cache с Effect resilience
- **Resilience Policies**: Retry, Recovery, Circuit Breaker
- **Error Boundary**: Высокоуровневый error handling
- **Contracts**: Internal DTOs для межсервисного общения
- **Instrumentation**: Monitoring с Strategy pattern

_Готовые решения для быстрой разработки сервисов._

### 🎯 Service Layer (`services/`)

**Service-specific расширения** для уникальных требований.

- **AIService**: ML-specific errors и validation
- **AuthService**: Authentication domain расширения
- **Custom Adapters**: Service-specific boundary operations

_Расширяет Shared для конкретных нужд сервиса._

## 🚀 Быстрый старт

### 1. Импорт готовых компонентов

```typescript
import {
  createValidationError,
  HttpAdapter,
  withSharedErrorBoundary,
} from '@livai/core-contracts/errors/shared';
```

### 2. Создание типизированной ошибки

```typescript
const error = createValidationError({
  field: 'email',
  rule: 'format',
  value: 'invalid-email',
});
// → TaggedError с полными метаданными и type safety
```

### 3. Boundary operation с resilience

```typescript
const result = await HttpAdapter.post('/api/users')
  .withRetry({ maxAttempts: 3 })
  .withCircuitBreaker({ threshold: 5 })
  .execute();
// → Автоматическая обработка ошибок и повторных попыток
```

### 4. Error boundary для бизнес-логики

```typescript
const safeOperation = withSharedErrorBoundary(
  businessEffect,
  {
    normalize: (err) => mapToSharedError(err),
    strategy: (err) => err.retryable ? { _tag: 'Retry' } : { _tag: 'Stop' },
  },
);
```

## 🎯 Принципы

### Type Safety First

- **TaggedError**: Compile-time гарантии типов
- **Discriminated Unions**: Type-safe pattern matching
- **Effect Integration**: Functional error handling

### Layered Architecture

- **Base**: Независимые примитивы
- **Shared**: Повторно используемые компоненты
- **Service**: Специфичные расширения

### Resilience by Default

- **Retry**: Автоматические повторные попытки
- **Circuit Breaker**: Защита от cascading failures
- **Fallback**: Graceful degradation

## 📖 Документация

- **[Base Layer](base/)**: Foundation API reference
- **[Shared Layer](shared/)**: Enterprise components и patterns
- **[Migration Guide](../docs/MIGRATION.md)**: Переход с throw/catch
- **[Best Practices](../docs/BEST_PRACTICES.md)**: Рекомендации использования
- **[API Reference](../docs/API_REFERENCE.md)**: Полный справочник

## 🔗 Ключевые компоненты

| Компонент                 | Слой   | Назначение             |
| ------------------------- | ------ | ---------------------- |
| `BaseError`               | Base   | Type-safe Tagged Union |
| `createValidationError`   | Shared | Domain error builders  |
| `HttpAdapter`             | Shared | Boundary operations    |
| `RetryPolicy`             | Shared | Resilience patterns    |
| `withSharedErrorBoundary` | Shared | Error handling helpers |

## 🎉 Преимущества

- **80% use cases**: Готовые решения для типовых сценариев
- **Type Safety**: Compile-time гарантии корректности
- **Resilience**: Built-in fault tolerance
- **Observability**: Полная traceability ошибок
- **Maintainability**: Четкая архитектура и разделение ответственности
