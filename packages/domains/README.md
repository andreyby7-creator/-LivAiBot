# @livai/domains-classification

Реализация домена классификации — decision computing domain с labels, signals, strategies.

## Обзор

Пакет содержит реализацию домена классификации:

- **Labels**: Метки классификации (SAFE, SUSPICIOUS, DANGEROUS, UNKNOWN)
- **Signals**: Сигналы классификации и violations
- **Strategies**: Стратегии decision computing на базе core rule-engine
- **Providers**: Провайдеры данных, реализующие StagePlugin API
- **Policies**: Политики классификации и логика агрегации
- **Context Builders**: Pure функции для построения контекста

## Архитектура

Следует принципам Domain-Driven Design:

- ✅ Использует core primitives: построен на `@livai/core` (domain-kit, rule-engine, pipeline)
- ✅ Без side-effects: только чистая бизнес-логика
- ✅ Платформо-агностично: работает во всех слоях (API, UI, Workers)
- ✅ Строгая типизация: полное покрытие TypeScript
- ✅ Расширяемо: использует decision algebra (EvaluationLevel, Confidence, Label<T>)

## Использование

```typescript
import { ClassificationLabel } from '@livai/domains-classification';
import { Label } from '@livai/core/domain-kit';

const label: ClassificationLabel = 'SAFE';

const evaluation: Label<ClassificationLabel> = {
  label: 'SAFE',
  level: 0,
  confidence: 1.0,
};
```

## Разработка

```bash
pnpm install
pnpm test
pnpm type-check
pnpm lint
```

## Тестирование

- **Unit тесты** для всей доменной логики
- **Property-based testing** для edge cases
- **Высокие требования к покрытию**: 90%+ statements, branches, functions, lines

## Зависимости

- `@livai/core` — Core primitives (domain-kit, rule-engine, pipeline, aggregation)
