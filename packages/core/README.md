# @livai/core

Бизнес-логика и политики домена для платформы LivAI.

## Обзор

Пакет содержит фундаментальную бизнес-логику и доменные политики:

- **Business Policies**: Правила и инварианты (AuthPolicy, BotPolicy, ChatPolicy, BillingPolicy)
- **Platform Primitives**: data-safety, domain-kit, rule-engine, pipeline, aggregation, resilience
- **Чистая бизнес-логика**: Без side-effects, платформо-агностично

## Архитектура

Следует принципам Domain-Driven Design:

- ✅ Без side-effects: только чистая бизнес-логика
- ✅ Без зависимостей от инфраструктуры: платформо-агностично
- ✅ Стабильные контракты: используется во всех слоях (API, UI, Workers)
- ✅ Строгая типизация: полное покрытие TypeScript

## Использование

```typescript
import { AuthPolicy } from '@livai/core';

const policy = new AuthPolicy({
  accessTokenTtlMs: 15 * 60 * 1000, // 15 минут
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 дней
});

const result = policy.evaluateToken(token, Date.now());
if (result.isDenied()) {
  // Обработка невалидного токена
}
```

## Разработка

```bash
pnpm install
pnpm test
pnpm type-check
pnpm lint
```

## Тестирование

- **Unit тесты** для всех политик
- **Property-based testing** для edge cases
- **Высокие требования к покрытию**: 90%+ statements, branches, functions, lines
