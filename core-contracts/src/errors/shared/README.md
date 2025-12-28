# Shared Error Layer

Готовые enterprise-компоненты для 80% случаев error handling в LivAiBot.

## 🎯 Назначение

Shared слой предоставляет высокоуровневые компоненты для типовых сценариев обработки ошибок. Компоненты протестированы, production-ready и оптимизированы для повторного использования в сервисах.

## 🏗️ Core Types

### PaymentProviderId

Брендированный тип для идентификаторов платежных провайдеров (WebPay, BePaid, банки).

```typescript
import { isPaymentProviderId, PaymentProviderId } from '@livai/core-contracts/errors/shared';

// Type-safe payment provider IDs
const webpayId = 'webpay' as PaymentProviderId;
const bepaidId = 'bepaid' as PaymentProviderId;

// Runtime validation
if (isPaymentProviderId(providerId)) {
  // TypeScript знает что providerId: PaymentProviderId
}
```

## 🎨 Domain Errors

Типизированные ошибки бизнес-логики, независимые от инфраструктуры.

### ValidationError

Ошибки валидации входных данных.

```typescript
import { createValidationError } from '@livai/core-contracts/errors/shared';

const error = createValidationError({
  field: 'email',
  rule: 'format',
  value: 'invalid-email',
  message: 'Неверный формат email',
});
// → ValidationError с полными метаданными
```

### AuthError

Ошибки аутентификации и авторизации.

```typescript
import { createAuthError } from '@livai/core-contracts/errors/shared';

const error = createAuthError({
  reason: 'INVALID_TOKEN',
  deviceId: 'device-123',
  requiredPermissions: ['user.write'],
});
// → AuthError с context для debugging
```

### PermissionError

Ошибки контроля доступа.

```typescript
import { createPermissionError } from '@livai/core-contracts/errors/shared';

const error = createPermissionError({
  resource: 'user.profile',
  action: 'update',
  userPermissions: ['user.read'],
  requiredPermissions: ['user.write'],
});
// → PermissionError с анализом прав доступа
```

## 🔌 Infrastructure Errors

Отображение внешних инфраструктурных ошибок в унифицированный формат.

### DatabaseError

PostgreSQL, Redis и другие database ошибки.

```typescript
import { createDatabaseError } from '@livai/core-contracts/errors/shared';

const error = createDatabaseError({
  operation: 'SELECT',
  table: 'users',
  connectionId: 'pool-1',
  query: 'SELECT * FROM users WHERE id = $1',
  parameters: [123],
});
// → DatabaseError с полным контекстом запроса
```

### NetworkError

HTTP API и сетевые ошибки.

```typescript
import { createNetworkError } from '@livai/core-contracts/errors/shared';

const error = createNetworkError({
  url: 'https://api.external.com/users',
  method: 'GET',
  statusCode: 503,
  timeout: 5000,
  retryCount: 2,
});
// → NetworkError с HTTP деталями
```

### CacheError

Redis и другие cache системы.

```typescript
import { createCacheError } from '@livai/core-contracts/errors/shared';

const error = createCacheError({
  operation: 'GET',
  key: 'user:123',
  connectionId: 'redis-1',
  serializationError: false,
});
// → CacheError с ключом и операцией
```

## 🌐 Boundary Adapters

Effect-based адаптеры с встроенной resilience.

### HttpAdapter

REST API вызовы с retry, timeout, circuit breaker.

```typescript
import { HttpAdapter } from '@livai/core-contracts/errors/shared';

const result = await HttpAdapter.get('/api/users/123')
  .withRetry({ maxAttempts: 3, backoff: 'exponential' })
  .withCircuitBreaker({ threshold: 5, timeout: 60000 })
  .withTimeout(5000)
  .execute();
// → Автоматическая обработка ошибок и повторных попыток
```

### DatabaseAdapter

SQL операции с connection pooling и транзакциями.

```typescript
import { DatabaseAdapter } from '@livai/core-contracts/errors/shared';

const result = await DatabaseAdapter.execute('SELECT * FROM users WHERE id = $1', [123])
  .withRetry({ maxAttempts: 2 })
  .withTransaction('read-committed')
  .execute();
// → Автоматическое управление соединениями и транзакциями
```

### CacheAdapter

Redis операции с fallback на database.

```typescript
import { CacheAdapter } from '@livai/core-contracts/errors/shared';

const result = await CacheAdapter.get('user:123')
  .withFallback(() => DatabaseAdapter.getUser(123))
  .withRetry({ maxAttempts: 1 })
  .execute();
// → Cache-first стратегия с graceful degradation
```

## 🛡️ Resilience Policies

Pure functional политики для отказоустойчивости.

### RetryPolicy

Конфигурируемые повторные попытки.

```typescript
import { RetryPolicy, withRetryPolicy } from '@livai/core-contracts/errors/shared';

const policy = RetryPolicy.fixedDelay({
  attempts: 3,
  delay: 1000,
});

const safeEffect = withRetryPolicy(policy)(unreliableEffect);
```

### RecoveryPolicy

Graceful degradation с fallback значениями.

```typescript
import { RecoveryPolicy, withRecoveryPolicy } from '@livai/core-contracts/errors/shared';

const policy = RecoveryPolicy.fallback(() => defaultValue);

const resilientEffect = withRecoveryPolicy(policy)(effect);
```

### CircuitBreakerPolicy

Защита системы от cascading failures.

```typescript
import {
  CircuitBreakerPolicy,
  withCircuitBreakerPolicy,
} from '@livai/core-contracts/errors/shared';

const policy = CircuitBreakerPolicy.threshold({
  failureThreshold: 5,
  recoveryTimeout: 60000,
});

const protectedEffect = withCircuitBreakerPolicy(policy)(serviceEffect);
```

## 🔄 Error Boundary

Высокоуровневый error handling для 80% случаев.

```typescript
import { withSharedErrorBoundary } from '@livai/core-contracts/errors/shared';

const safeOperation = withSharedErrorBoundary(
  businessEffect,
  {
    normalize: (err) => mapToSharedError(err),
    strategy: (normalizedErr) =>
      normalizedErr.retryable
        ? { _tag: 'Retry', delay: 1000 }
        : { _tag: 'Stop' },
    serialize: (normalizedErr) => normalizedErr.message,
    retryPolicy: defaultRetryPolicy,
  },
);
```

## 📊 Instrumentation

Мониторинг и observability для shared операций.

```typescript
import { withSharedInstrumentation } from '@livai/core-contracts/errors/shared';

const monitored = withSharedInstrumentation(
  effect,
  {
    tracing: openTelemetryStrategy,
    metrics: prometheusStrategy,
    logging: structuredLogger,
  },
  {
    operation: 'user.create',
    tags: { service: 'auth', version: 'v2' },
  },
);
```

## 🏗️ Contracts

Внутренние форматы для межсервисного общения.

```typescript
import { createInternalErrorDTO } from '@livai/core-contracts/errors/shared';

// Для service-to-service communication
const dto = createInternalErrorDTO({
  code: 'VALIDATION_FAILED',
  message: 'Business rule violation',
  correlationId: 'corr-123',
  context: { operation: 'user.update', userId: 456 },
});
```

## 📖 Для кого

- **Service разработчики**: Готовые компоненты для быстрой разработки
- **DevOps инженеры**: Понимание resilience паттернов
- **QA инженеры**: Знание типовых error сценариев

## 🔗 Связанные компоненты

- **[Base Layer](../base/)**: Foundation примитивы
- **[Error System Overview](../README.md)**: Полная архитектура
- **[Usage Examples](../../docs/USAGE.md)**: Практические примеры
