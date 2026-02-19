# Classification Domain

Pure domain logic для классификации устройств и сессий. Использует generic компоненты из `@livai/core`.

## Архитектура

```
signals → validation → context-builders → strategies → aggregation → evaluation → result
```

### Слои

- **signals/** — domain-specific signals и context (ClassificationSignals, ClassificationContext)
- **strategies/** — rule evaluation через `@livai/core/rule-engine` (deterministic.strategy, rules, validation)
- **aggregation/** — risk scoring через `@livai/core/aggregation` (scoring.ts)
- **evaluation/** — assessment logic и финальная сборка результата (assessment.ts, result.ts)
- **context/** — pure functions для построения контекстов (context-builders.ts)
- **labels/** — classification labels и policy (labels.ts)

## Интеграция с @livai/core

- **strategies/** → `@livai/core/rule-engine` (evaluator, Rule)
- **aggregation/** → `@livai/core/aggregation` (aggregation semantics)
- **evaluation/** → `@livai/core` (EvaluationLevel, Confidence, EvaluationScale)
- **providers/** → `@livai/core/pipeline` (StagePlugin)

## Зависимости

```
@livai/core
├── rule-engine (strategies/)
├── aggregation (aggregation/)
├── domain-kit (evaluation/, signals/)
└── pipeline (providers/)

domains/classification
├── signals → strategies
├── strategies → aggregation
├── aggregation → evaluation
└── context → все слои
```

## Использование

### Context Builders в Pipeline

Все builders — pure functions, pipeline-ready, возвращают frozen объекты первого уровня. Используют slot-based API (`Pick<ClassificationSlotMap, ...>`) для упрощения композиции плагинов и минимизации coupling.

```typescript
// scoringContext → используется для расчета riskScore (aggregation/scoring.ts)
const scoring = buildScoringContext({ device, context, config });
// riskScore рассчитывается через calculateRiskScore(scoring.scoringContext, weights)
const riskScore = calculateRiskScore(scoring.scoringContext, defaultRiskWeights);

// ruleContext → metadata.riskScore из валидированного riskScore
const rule = buildRuleContext({ device, context, riskScore });

// ruleEvaluationResult получается из strategies/deterministic.strategy.ts
// через evaluateClassificationRules(device, context, { riskScore, ... })
const ruleEvaluationResult = evaluateClassificationRules(device, context, { riskScore });

// assessmentContext → собирает все результаты
const assessment = buildAssessmentContext({
  device,
  context,
  riskScore: rule.ruleContext.metadata.riskScore,
  ruleEvaluationResult, // ClassificationEvaluationResult
});
```

**Типы:** `ClassificationSignals`, `ClassificationContext` → `signals/`, `context-builders.ts`

## Принципы

- **Pure domain** — детерминированные функции, без side-effects, pipeline-ready
- **Slot-based API** — контексты через `Pick<ClassificationSlotMap, ...>` упрощают композицию плагинов и минимизируют coupling
- **SRP** — каждый слой отвечает за свою область
- **Immutable** — все вложенные объекты первого уровня заморожены для защиты от mutations downstream
- **Security** — валидация входных данных, защита от poisoning
