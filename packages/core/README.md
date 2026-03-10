# @livai/core

**Фундаментальная бизнес-логика и доменные примитивы для платформы LivAI.**

---

## 📦 Модули

### 🛡️ Input Boundary

**Валидация и трансформация DTO**

- `generic-validation` — generic валидация с type guards
- `projection-engine` — трансформация domain → DTO (whitelist, sanitization)
- `context-enricher` — обогащение контекста метаданными

```typescript
import { transformDomainToDto, validateInput } from '@livai/core';

const dto = transformDomainToDto(domainObject, schema);
const validated = validateInput(input, schema);
```

### 🛡️ Data Safety

**Отслеживание заражения и контроль информационных потоков**

- `taint` — taint tracking для sensitive данных
- `taint-source` / `taint-sink` — границы ввода/вывода
- `taint-propagation` — отслеживание распространения
- `structural-clone` — безопасное клонирование с taint
- `trust-level` — уровни доверия данных
- `sanitization-mode` — режимы санитизации

```typescript
import { structuralClone, taintSink, taintSource } from '@livai/core';

const tainted = taintSource(data, 'user-input');
const safe = structuralClone(tainted);
taintSink(safe); // ✅ Безопасно
```

### 🧩 Domain Kit

**Decision Algebra & Probability/Uncertainty**

- `EvaluationLevel` — decision algebra с lattice ordering
- `Confidence` — probability/uncertainty для оценок
- `Label<T>` — domain-specific строковые метки с валидацией

```typescript
import { Confidence, EvaluationLevel, Label } from '@livai/core';

const level = EvaluationLevel.create('high');
const confidence = Confidence.create(0.95);
const label = Label.create('suspicious', 'security');
```

### 📊 Aggregation

**Generic агрегация значений с весами**

- `reducer` — generic reduction functions
- `weight` — операции с весами
- `scoring` — scoring operations
- Extensible algebra для custom aggregators

```typescript
import { reduce, score, weight } from '@livai/core';

const result = reduce(values, weights, reducer);
const weighted = weight(value, 0.8);
const scored = score(aggregated, policy);
```

### ⚙️ Rule Engine

**Generic операции с предикатами и правилами**

- `predicate` — generic predicate operations
- `rule` — generic rule operations
- `evaluator` — generic rule evaluation
- Extensible algebra для custom operations

```typescript
import { createPredicate, createRule, evaluateRule } from '@livai/core';

const predicate = createPredicate((x) => x > 10);
const rule = createRule(predicate, 'high-value');
const result = evaluateRule(rule, context);
```

### 🔄 Pipeline

**Dependency-driven execution engine**

- `engine` — dependency-driven execution
- `plugin-api` — compile-time provides/slots enforcement
- `plan` — автоматическое определение порядка выполнения
- `safety-guard` — валидация конфигурации
- `replay` — replay для отладки

```typescript
import { definePipeline, defineStage, executePipeline } from '@livai/core';

const stage = defineStage({
  id: 'process',
  provides: ['result'],
  dependsOn: ['input'],
  execute: (context) => ({ result: process(context.input) }),
});

const pipeline = definePipeline([stage]);
const result = await executePipeline(pipeline, { input: data });
```

### 🛡️ Resilience

**Reliability primitives**

- `circuit-breaker` — deterministic circuit breaker (pure state machine)
- `metrics` — метрики производительности
- `performance-limits` — лимиты производительности

```typescript
import { createCircuitBreaker } from '@livai/core';

const breaker = createCircuitBreaker({
  failureThreshold: 5,
  timeout: 60000,
});

const result = await breaker.execute(async () => {
  return await riskyOperation();
});
```

### 📋 Policies

**Бизнес-политики и правила доступа**

- `AuthPolicy` — политика аутентификации
- `BotPolicy` — политика ботов
- `ChatPolicy` — политика чатов
- `BillingPolicy` — политика биллинга
- `ComposedPolicy` — композиция политик

```typescript
import { AuthPolicy } from '@livai/core';

const policy = new AuthPolicy({
  accessTokenTtlMs: 15 * 60 * 1000,
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
});

const result = policy.evaluateToken(token, Date.now());
```

### 📊 Telemetry

**Система телеметрии и мониторинга**

- `TelemetryClient` — клиент для отправки телеметрических событий
- `TelemetryBatchCore` — batch ядро для накопления событий
- Sanitization утилиты для детекта PII и очистки metadata

```typescript
import { telemetry } from '@livai/core';
// или
import { TelemetryClient } from '@livai/core/telemetry';

const client = new TelemetryClient(config);
await client.emit('event', { data });
```

### 🚩 Feature Flags

**Детерминированный engine для управления feature flags**

- Core engine без React/env/console зависимостей
- Стратегии rollout/segmentation (percentage, users, tenants, attributes)
- React адаптер доступен через `@livai/core/feature-flags/react`

```typescript
import { evaluateFeature } from '@livai/core/feature-flags';
// или
import { featureFlags } from '@livai/core';

const result = evaluateFeature('feature-name', context, provider);
```

### 🚀 Performance

**Система мониторинга производительности**

- Трекинг метрик (Web Vitals, компоненты, API)
- Батчинг, sampling, threshold фильтрация
- React hooks доступны через `@livai/core/performance/react`

```typescript
import { performance } from '@livai/core';
// или
import { trackMetric } from '@livai/core/performance';

trackMetric('component-render', { duration: 100 });
```

### 🛡️ Access Control

**Система авторизации и контроля доступа**

- Core engine для проверки прав доступа (roles, permissions, resources)
- Guards, authorization checks, error handling
- React hooks для интеграции с UI

```typescript
import { accessControl } from '@livai/core';
// или
import { checkAccess, useCheckAccess } from '@livai/core/access-control';

const result = checkAccess(context, { resource, action });
```

### ⚡ Effect

**Утилиты для side-effects и обработки ошибок**

- Effect, Result<T, E>, timeout, retry, isolation
- Schema validation, error mapping
- Функциональная подсистема валидации

```typescript
import { effect } from '@livai/core';
// или
import { withRetry, withTimeout } from '@livai/core/effect';

const result = await withRetry(policy, async () => operation());
```

### 🔌 Transport

**Транспортные протоколы (SSE, WebSocket)**

- SSE и WebSocket runtime как детерминированные FSM
- Поддержка браузера и Node.js через адаптеры
- Переиспользуем в backend и других фронтах

```typescript
import { transport } from '@livai/core';
// или
import { createSSEClient } from '@livai/core/transport';

const client = createSSEClient(url, { onMessage: handleMessage });
```

---

## 🏗️ Архитектура

**Принципы:**

- ✅ **Без side-effects** — только чистая бизнес-логика
- ✅ **Платформо-агностично** — без зависимостей от инфраструктуры
- ✅ **Стабильные контракты** — используется во всех слоях (API, UI, Workers)
- ✅ **Строгая типизация** — полное покрытие TypeScript
- ✅ **Tree-shakeable** — только нужные компоненты попадают в bundle

**Зависимости:**

```
core → domains/src/classification → feature-auth
```

Подробнее: [`docs/architecture.md`](./docs/architecture.md)

---

## 📚 Документация

- [`docs/architecture.md`](./docs/architecture.md) — архитектура и зависимости
- [`docs/pipeline-runbook.md`](./docs/pipeline-runbook.md) — runbook для pipeline
- [`docs/pipeline-rollout-plan.md`](./docs/pipeline-rollout-plan.md) — план rollout

---

## 🚀 Разработка

```bash
pnpm install
pnpm test
pnpm type-check
pnpm lint
```

## ✅ Тестирование

- **Unit тесты** для всех модулей
- **Property-based testing** для edge cases
- **Высокие требования к покрытию**: 90%+ statements, branches, functions, lines
