# @livai/feature-auth

**Бизнес-логика и доменные модели аутентификации для платформы LivAI.**

---

## 📦 Зависимости

**Core компоненты:**

- `@livai/core` — фундаментальные примитивы (pipeline, rule-engine, aggregation)
- `@livai/domains` — domain logic для classification и risk assessment
- `@livai/app` — инфраструктура (orchestrator, effect-timeout, store-utils)

**Миграция:**

Некоторые компоненты перенесены в `@livai/core` и `@livai/domains`:

- ✅ Risk assessment logic → `@livai/domains/classification`
- ✅ Context builders → `@livai/domains/classification/context`
- ✅ Rule engine → `@livai/core/rule-engine`
- ✅ Pipeline → `@livai/core/pipeline`
- ✅ Aggregation → `@livai/core/aggregation`
- ✅ Data safety → `@livai/core/data-safety`

**Использование:**

```typescript
import { executeSecurityPipeline } from '@livai/feature-auth';
import { assessClassification } from '@livai/domains';
import { orchestrate } from '@livai/app/lib/orchestrator';

// Security pipeline использует core компоненты
const result = await executeSecurityPipeline({
  context: { operation: 'login', userId: 'user-123', ip: '192.168.1.1' },
  mandatoryAuditLogger: auditLogger,
});
```

---

## 🏗️ Архитектура

**Слои:**

1. **Domain** — чистые DTO и типы (`domain/*.ts`)
2. **Effects** — бизнес-логика через Effect (`effects/*.ts`)
3. **Store** — состояние через Zustand (`stores/auth.ts`)
4. **Lib** — фасады и адаптеры (`lib/*.ts`)
5. **Hooks** — React интеграция (`hooks/useAuth.ts`)

**Зависимости:**

```
feature-auth
  ├─ @livai/core (pipeline, rule-engine, aggregation)
  ├─ @livai/domains (classification, risk assessment)
  └─ @livai/app (orchestrator, effects, store-utils)
```

Подробнее: [`@livai/core/docs/architecture.md`](../core/docs/architecture.md)

---

## 📚 Документация

- [`@livai/core/docs/architecture.md`](../core/docs/architecture.md) — архитектура core
- [`@livai/domains/README.md`](../domains/README.md) — domain logic

---

## 🚀 Разработка

```bash
pnpm install
pnpm test
pnpm type-check
pnpm lint
```

## ✅ Тестирование

- **Unit тесты** для всех компонентов
- **Integration тесты** для схем и интеграции с core
- **Высокие требования к покрытию**: 90%+ statements, branches, functions, lines
