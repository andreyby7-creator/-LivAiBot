# 🏗️ Архитектура @livai/core

**Обзор архитектуры core пакета и зависимостей между модулями.**

---

## 📐 Общие принципы

- ✅ **Без side-effects** — только чистая бизнес-логика
- ✅ **Платформо-агностично** — без зависимостей от инфраструктуры
- ✅ **Стабильные контракты** — используется во всех слоях
- ✅ **Строгая типизация** — полное покрытие TypeScript
- ✅ **Tree-shakeable** — только нужные компоненты в bundle

---

## 🔗 Граф зависимостей

```
┌─────────────────────────────────────────────────────────┐
│                    @livai/core                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Policies   │  │ Domain Kit   │  │ Rule Engine  │  │
│  │              │  │              │  │              │  │
│  │ AuthPolicy   │  │ Evaluation   │  │ Predicate    │  │
│  │ BotPolicy    │  │ Confidence   │  │ Rule         │  │
│  │ ChatPolicy   │  │ Label<T>     │  │ Evaluator    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Aggregation  │  │   Pipeline   │  │ Data Safety  │  │
│  │              │  │              │  │              │  │
│  │ Reducer      │  │ Engine       │  │ Taint        │  │
│  │ Weight       │  │ Plugin API   │  │ Propagation  │  │
│  │ Scoring      │  │ Plan         │  │ Sanitization │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Input Boundary│  │ Resilience   │  │              │  │
│  │              │  │              │  │              │  │
│  │ Validation   │  │ Circuit      │  │              │  │
│  │ Projection    │  │ Breaker     │  │              │  │
│  │ Enricher      │  │ Metrics     │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  @livai/domains                         │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Classification Domain                    │  │
│  │                                                  │  │
│  │  Strategies → Aggregation → Evaluation          │  │
│  │       │            │              │              │  │
│  │       └────────────┼──────────────┘              │  │
│  │                    │                             │  │
│  │              Assessment Result                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              @livai/feature-auth                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Security Pipeline                       │  │
│  │                                                  │  │
│  │  Device Fingerprint → Risk Assessment          │  │
│  │       │                    │                     │  │
│  │       └────────────────────┘                     │  │
│  │                    │                             │  │
│  │         Security Pipeline Result                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Pipeline: Dependency-Driven Execution

**Пример графа зависимостей (slot graph):**

```
Stage A (provides: ['input'])
    │
    ├─► Stage B (dependsOn: ['input'], provides: ['processed'])
    │       │
    │       └─► Stage D (dependsOn: ['processed'], provides: ['result'])
    │
    └─► Stage C (dependsOn: ['input'], provides: ['metadata'])
            │
            └─► Stage D (dependsOn: ['metadata'])
```

**Порядок выполнения:**

1. Stage A (нет зависимостей)
2. Stage B, C (параллельно, зависят от A)
3. Stage D (зависит от B и C)

**Fan-out / Fan-in сценарии:**

- **Fan-out:** Stage A → Stage B, C, D (параллельно)
- **Fan-in:** Stage B, C, D → Stage E (ожидает все)

---

## 🧩 Модули и их роли

### 🛡️ Input Boundary

**Валидация и трансформация DTO**

- Изоляция domain от transport layer
- Whitelist-based sanitization
- Generic validation с type guards

### 🛡️ Data Safety

**Отслеживание заражения**

- Taint tracking для sensitive данных
- Information Flow Control (IFC)
- Structural clone с сохранением taint

### 🧩 Domain Kit

**Decision Algebra**

- EvaluationLevel — lattice ordering для решений
- Confidence — probability/uncertainty
- Label<T> — domain-specific метки

### 📊 Aggregation

**Generic агрегация**

- Reducer — generic reduction
- Weight — операции с весами
- Scoring — scoring operations

### ⚙️ Rule Engine

**Generic предикаты и правила**

- Predicate — generic предикаты
- Rule — generic правила
- Evaluator — evaluation engine

### 🔄 Pipeline

**Dependency-driven execution**

- Автоматическое определение порядка
- Compile-time provides/slots enforcement
- Safety guards для валидации

### 🛡️ Resilience

**Reliability primitives**

- Circuit breaker (pure state machine)
- Performance limits
- Metrics collection

### 📋 Policies

**Бизнес-политики**

- AuthPolicy, BotPolicy, ChatPolicy
- ComposedPolicy для композиции
- Rule-engine архитектура

### 📊 Telemetry

**Система телеметрии и мониторинга**

- TelemetryClient — клиент для отправки телеметрических событий
- TelemetryBatchCore — batch ядро для накопления событий
- Sanitization утилиты для детекта PII и очистки metadata
- Runtime-зависимый клиент с queue и throttle

### 🚩 Feature Flags

**Детерминированный engine для управления feature flags**

- Core engine без React/env/console зависимостей
- Стратегии rollout/segmentation (percentage, users, tenants, attributes)
- Evaluation API + provider pattern (single/bulk)
- React адаптер доступен через `@livai/core/feature-flags/react`

### 🚀 Performance

**Система мониторинга производительности**

- Трекинг метрик (Web Vitals, компоненты, API)
- Батчинг, sampling, threshold фильтрация
- DI для logger
- React hooks доступны через `@livai/core/performance/react`

### 🛡️ Access Control

**Система авторизации и контроля доступа**

- Core engine для проверки прав доступа (roles, permissions, resources)
- Guards, authorization checks, error handling
- Route permissions для декларативных политик доступа
- React hooks для интеграции с UI

### ⚡ Effect

**Утилиты для side-effects и обработки ошибок**

- Effect, Result<T, E>, timeout, retry, isolation
- Schema validation, error mapping
- Orchestration для композиции асинхронных операций
- Функциональная подсистема валидации

### 🔌 Transport

**Транспортные протоколы (SSE, WebSocket)**

- SSE и WebSocket runtime как детерминированные FSM
- Поддержка браузера и Node.js через адаптеры
- Переиспользуем в backend и других фронтах

---

## 📚 Использование в feature-auth

**Пример интеграции:**

```typescript
// feature-auth использует core компоненты
import { orchestrate } from '@livai/app/lib/orchestrator';
import { assessClassification } from '@livai/domains';
import { transformDomainToDto } from '@livai/core';

// Security pipeline композирует:
// 1. Device fingerprint (feature-auth)
// 2. Risk assessment (domains + core)
// 3. DTO projection (core)
```

**Зависимости feature-auth:**

- `@livai/core/pipeline` — orchestration
- `@livai/core/rule-engine` — правила
- `@livai/core/aggregation` — агрегация
- `@livai/core/data-safety` — sanitization
- `@livai/domains/classification` — risk assessment

---

## 🔍 Детали реализации

**См. также:**

- [`pipeline-runbook.md`](./pipeline-runbook.md) — runbook для pipeline
- [`pipeline-rollout-plan.md`](./pipeline-rollout-plan.md) — план rollout
