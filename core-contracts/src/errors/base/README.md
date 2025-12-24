# Base Error Layer

Foundation компоненты для type-safe обработки ошибок в LivAiBot.

## 🎯 Назначение

Base слой предоставляет фундаментальные примитивы для построения надежной системы обработки ошибок. Все компоненты выше (Shared и Service слои) используют Base как основу для type safety и унифицированного подхода.

## 🏗️ Core Types

### BaseError

Tagged Union для type-safe ошибок с полной metadata поддержкой.

```typescript
interface BaseError {
  readonly _tag: 'BaseError';
  readonly code: ErrorCode;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly timestamp: number;
  readonly metadata: ErrorMetadata;
}
```

### ErrorCode

Унифицированная система кодов с namespace для предотвращения конфликтов.

```typescript
// Примеры кодов
VALIDATION_FAILED = 'VALIDATION_FAILED';
AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID';
DATABASE_CONNECTION_LOST = 'DATABASE_CONNECTION_LOST';
```

### ErrorMetadata

Структурированные метаданные для observability и debugging.

```typescript
interface ErrorMetadata {
  readonly context: Record<string, unknown>;
  readonly correlationId?: string;
  readonly userId?: string;
  readonly operation?: string;
}
```

## 🔧 Builders & Validators

### ErrorBuilders

Конструкторы типизированных ошибок с автоматической metadata генерацией.

```typescript
import { createBaseError } from '@livai/core-contracts/errors/base';

const error = createBaseError({
  code: 'VALIDATION_FAILED',
  message: 'Email format invalid',
  category: 'CLIENT',
  metadata: {
    field: 'email',
    value: 'invalid@',
    rule: 'email_format',
  },
});
```

### ErrorValidators

Runtime валидация ошибок и их структуры.

```typescript
import { isValidErrorMetadata, validateErrorCode } from '@livai/core-contracts/errors/base';

// Проверка существования кода
const isValid = validateErrorCode('VALIDATION_FAILED'); // true

// Валидация метаданных
const hasValidMeta = isValidErrorMetadata(error.metadata); // true
```

### ErrorTransformers

Преобразование цепочек ошибок и нормализация внешних ошибок.

```typescript
import { transformErrorChain } from '@livai/core-contracts/errors/base';

// Преобразование unknown error в BaseError
const baseError = transformErrorChain(unknownError, {
  preserveStack: true,
  addCorrelationId: true,
});
```

## 📋 Registry

### UnifiedErrorRegistry

Layered resolution с fallback: Service → Shared → Base.

```typescript
import { registerErrorLayer, resolveErrorMeta } from '@livai/core-contracts/errors/base';

// Разрешение метаданных с fallback
const meta = resolveErrorMeta('VALIDATION_FAILED');
// → { category: 'CLIENT', severity: 'LOW', retryable: false }

// Регистрация нового слоя
registerErrorLayer('service', serviceErrorDefinitions);
```

## 🎛️ Strategies & Observability

### ErrorStrategies

Effect-based стратегии обработки ошибок.

```typescript
import {
  createCircuitBreakerStrategy,
  createRetryStrategy,
} from '@livai/core-contracts/errors/base';

const retryStrategy = createRetryStrategy({
  maxAttempts: 3,
  backoff: 'exponential',
  baseDelay: 100,
});

const breakerStrategy = createCircuitBreakerStrategy({
  threshold: 5,
  timeout: 60000,
});
```

### ErrorInstrumentation

Интеграция с системами мониторинга.

```typescript
import { withErrorMetrics, withErrorTracing } from '@livai/core-contracts/errors/base';

const monitoredEffect = withErrorMetrics(
  withErrorTracing(businessEffect, 'user.create'),
  { service: 'auth', operation: 'registration' },
);
```

## 📖 Для кого

- **Разработчики Shared/Service слоев**: Используют Base как строительные блоки
- **Архитекторы**: Понимают фундамент системы
- **Maintainers**: Модифицируют базовые типы и правила

## 🔗 Связанные компоненты

- **[Shared Layer](../shared/)**: Готовые решения на базе Base
- **[Error System Overview](../README.md)**: Архитектурное описание
- **[Migration Guide](../../docs/MIGRATION.md)**: Переход на новую систему
