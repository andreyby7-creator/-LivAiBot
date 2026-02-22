# План рефакторинга: миграция в core

**Дата создания:** 2026-02-XX\
**Цель:** Выделение платформенных компонентов из feature-auth в core (Universal Decision Computing Platform, не Risk Engine SDK)

**Критичные принципы:**

- Core = Universal Decision Computing Platform (не Risk Engine SDK, не Classification Framework)
- Core НЕ знает про auth-семантику (ALLOW/CHALLENGE/DENY)
- Core предоставляет decision algebra (EvaluationLevel, Confidence, Label<T>), НЕ конкретные enums!
- Pipeline = dependency-driven execution engine (provides/dependsOn), не middleware chain!
- Feature-auth маппит domain labels → auth actions
- **Rule-engine = pure predicate evaluator** (без aggregation semantics!)
- **Aggregation = отдельный модуль** (reducer, weight, scoring)
- **Context-builders = pure functions** (без IO/async/conditions) или plugins
- **Plugins = dependency-driven API** (StagePlugin с provides/dependsOn)
- **Classification-domain** = первая domain-implementation, объявляет свои labels
- **Data-safety = bidirectional boundary guard** (taint-source, taint-sink, taint-propagation)

---

## Этап 1: Создание структуры core ✅

### Шаг 1.1: Создать директории ✅

**Выполнено:**

- `packages/core/src/`: data-safety, domain-kit, input-boundary, pipeline, resilience, rule-engine, aggregation, policies
- `packages/core/tests/`: соответствующие тестовые директории
- `packages/domains/src/classification/`: signals, providers, strategies, policies, evaluation, aggregation, context

---

### Шаг 1.2: Перенос data-safety (Taint Isolation Engine) ✅

#### 1.2.0: Перенос sanitizer в data-safety (Bidirectional Boundary Guard) ✅

**Выполнено:**

- **Файл:** `packages/core/src/data-safety/` (модули: taint, taint-source, taint-sink, taint-propagation, structural-clone, trust-level, sanitization-mode)
- **Trust-levels:** Symbol-based (UNTRUSTED, PARTIAL, TRUSTED) — защита от арифметики и подделки через JSON
- **Bidirectional boundary:** input (taint-source) + output (taint-sink) + propagation (taint-propagation)
- **Pipeline slots:** `assertTrustedSlot`, `stripTaintSlot`, `propagateTaintSlot` — thin adapters для future pipeline
- **Тесты:** `packages/core/tests/data-safety/` (edge cases, slot-тесты)
- **Экспорт:** `packages/core/src/data-safety/index.ts`
- **Зависимости:** только `@livai/core-contracts`

---

### Шаг 1.3: Перенос input-boundary (DTO Guards Only) ✅

#### 1.3.1: Создание generic-validation.ts (DTO Guards Only) ✅

**Выполнено:**

- **Файл:** `packages/core/src/input-boundary/generic-validation.ts`
- **Type Guards (8):** `isString`, `isNumber`, `isBoolean`, `isNull`, `isUndefined`, `isNullOrUndefined`, `isArray`, `isObject`
- **JSON-Serializable:** `isJsonPrimitive`, `isJsonSerializable` (рекурсивная проверка, защита от циклических ссылок)
- **Structural Validation:** `hasProperty`, `hasProperties`, `getProperty`, `validateObjectShape` (path accumulation, accumulateErrors режим)
- **Rule Engine:** `ValidationRule<T, TMetadata>`, `ValidationRuleRegistry` (O(1) lookup), `registerRule`, composable predicates
- **Типы:** `JsonPrimitive`, `JsonValue`, `JsonArray`, `JsonObject` (strict union types)
- **Тесты:** `packages/core/tests/input-boundary/generic-validation.test.ts` (95 тестов, 98.48% строк, 100% функций)
- **Экспорт:** `packages/core/src/input-boundary/index.ts`
- **Зависимости:** нет внешних зависимостей

---

#### 1.3.2: Создание projection-engine.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/input-boundary/projection-engine.ts`
- **Архитектура:** selection → enrichment slots → merge (conflict detection) → safe-keys validation → freeze
- **Трансформации (3):** `transformDomainToDto`, `transformDomainsToDtos`, `transformDomainToPartialDto` (generic, deterministic, order-independent)
- **Типы (6):** `TransformationOutcome<TDto>`, `TransformationFailureReason`, `DtoFieldMapper<TDomain>`, `DtoSchema<TDomain>`, `ProjectionSlot<TDomain>`, `TransformationContext<TMetadata>`
- **Security:** `FORBIDDEN_KEYS` (prototype pollution protection), `isForbiddenKey`, `isValidFieldName`, `assertSafeObject`
- **JSON-Serializable:** `assertJsonSerializable` (runtime checks, защита от функций, символов, циклических ссылок)
- **Pipeline Stages:** `selectFields`, `collectContributions`, `applyContribution`, `mergeContributions`
- **Принципы:** SRP, deterministic, domain-pure, immutable, order-independent, conflict detection, fail-fast
- **Тесты:** `packages/core/tests/input-boundary/projection-engine.test.ts` (42 теста, 96.55% строк)
- **Экспорт:** `packages/core/src/input-boundary/index.ts` (раздел "PROJECTION ENGINE")
- **Зависимости:** только `generic-validation.ts` (JsonValue, isJsonSerializable)

---

#### 1.3.3: Создание context-enricher.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/input-boundary/context-enricher.ts`
- **Архитектура:** dependency-driven execution (signal-based DAG) → conflict detection → collect all errors (non-fail-fast)
- **Основные функции (2):** `enrichContext`, `registerEnricher` (immutable)
- **Типы (5):** `ContextEnricher<TContext>`, `EnricherRegistry<TContext>`, `EnrichmentResult`, `EnrichmentError`, `EnrichmentObserver`
- **Dependency Resolution:** signal-based topological sort (Kahn's algorithm), `buildSignalDependencyGraph`, `detectCycles`, `topologicalSort`
- **Conflict Detection:** `isStableEqual` (stable JSON serialization), `stableKeySort`, `applyEnricherSignals`
- **Precondition Enforcement:** `checkDependencies` (missing dependency detection)
- **Observer Hooks:** `onSkippedEnricher`, `onConflictingSignals`, `onCircularDependency`, `onEnricherError`, `onMissingDependency`
- **Принципы:** SRP, deterministic, domain-pure, immutable, signal-based dependency, conflict detection, non-fail-fast
- **Тесты:** `packages/core/tests/input-boundary/context-enricher.test.ts` (65 тестов, 92.61% statements, 78.84% branches, 100% functions)
- **Экспорт:** `packages/core/src/input-boundary/index.ts` (раздел "CONTEXT ENRICHER")
- **Зависимости:** только `generic-validation.ts` (isJsonSerializable)

---

### Шаг 1.4: Создание domain-kit (Decision Algebra) ✅

**КРИТИЧНО:** Domain-kit = decision algebra, НЕ конкретные enums!\
Core не знает про SAFE/SUSPICIOUS/DANGEROUS - это domain объявляет свои labels.

#### 1.4.1: Создание evaluation-level.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/domain-kit/evaluation-level.ts`
- **Архитектура:** библиотека из 4 модулей: EvaluationLevel (value object), EvaluationScale (scale factory), EvaluationAlgebra (algebra contract), EvaluationAggregation (aggregation policies)
- **Основные модули (5):** `evaluationLevel` (create, deserialize, value, isNormalized), `evaluationScale` (create с runtime fingerprint через FNV-1a hash), `evaluationAlgebra` (standardOrder, standardLatticeOrder), `evaluationAlgebraDev` (verify для проверки algebra laws), `evaluationAggregation` (worstCase, bestCase, step)
- **Типы (11):** `EvaluationLevel<TDomain>` (branded type), `NormalizedEvaluationLevel<TDomain>`, `EvaluationScale<TDomain>` (opaque brand), `EvaluationLevelOutcome<TLevel>`, `EvaluationLevelFailureReason`, `Ordering`, `EvaluationScaleOutcome<TDomain>`, `LatticeVerificationResult`, `AggregationMode`, `EvaluationOrder<TDomain>`, `LatticeOrder<TDomain>`
- **Принципы:** SRP, deterministic (scale-enforced), domain-pure, microservice-ready (scale fingerprint), scalable (parametric algebra), strict typing (phantom generic + opaque scale), extensible, immutable, algebra-first, runtime-safe, partial order ready
- **Тесты:** `packages/core/tests/domain-kit/evaluation-level.test.ts` (80 тестов, 89.79% statements, 82.44% branches, 95% functions)
- **Экспорт:** `packages/core/src/domain-kit/index.ts` (разделы: "ТИПЫ", "EVALUATION LEVEL", "EVALUATION SCALE", "EVALUATION ALGEBRA", "EVALUATION ALGEBRA DEV", "EVALUATION AGGREGATION")
- **Зависимости:** нет внешних зависимостей

---

#### 1.4.2: Создание confidence.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/domain-kit/confidence.ts`
- **Архитектура:** библиотека из 3 модулей: Confidence (value object), ConfidenceOperations (runtime operations), ConfidenceCombiners (combiner factory)
- **Основные модули (3):** `confidence` (create, deserialize, value, isValidDomain), `confidenceOperations` (safeCombine, combine, average с Kahan summation, weightedAverage), `confidenceCombiners` (average, maximum, minimum, product, sum, chain)
- **Типы (6):** `Confidence<TDomain>` (branded type), `ConfidenceOutcome<TConfidence>`, `ConfidenceFailureReason`, `ConfidenceCombiner<TDomain>`, `ConfidenceCombineResult<TDomain>`, `ConfidenceAggregationMode`
- **Internal Helpers:** `validateConfidence`, `kahanSum`
- **Принципы:** SRP, deterministic (Kahan summation), domain-pure, microservice-ready, scalable (extensible через ConfidenceCombiner), strict typing, extensible, immutable, security (runtime validation NaN/Infinity)
- **Тесты:** `packages/core/tests/domain-kit/confidence.test.ts` (74 теста, 99.11% statements, 98.5% branches, 100% functions)
- **Экспорт:** `packages/core/src/domain-kit/index.ts` (разделы: "CONFIDENCE — PROBABILITY/UNCERTAINTY TYPES", "CONFIDENCE — VALUE OBJECT MODULE", "CONFIDENCE OPERATIONS", "CONFIDENCE COMBINERS")
- **Зависимости:** нет внешних зависимостей

---

#### 1.4.3: Создание label.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/domain-kit/label.ts`
- **Архитектура:** библиотека из 2 модулей: Label (value object), LabelValidators (validator factory)
- **Основные модули (2):** `label` (create с trim, deserialize, value, isLabel, assertValid), `labelValidators` (whitelist с двухуровневым кешированием, pattern, custom)
- **Типы (4):** `Label<TLabel>` (branded type), `LabelOutcome<TLabel>`, `LabelFailureReason`, `LabelValidator<TLabel>`
- **Internal Helpers:** `createBrandedLabel`, `validateLabel`, `createCacheKey`, `validatorCacheWeak`, `validatorCacheMap`
- **Принципы:** SRP, deterministic, domain-pure, microservice-ready, scalable (extensible validation, кеширование), strict typing (branded type + phantom generic), extensible, immutable, security (runtime validation, ESLint no-restricted-syntax)
- **Тесты:** `packages/core/tests/domain-kit/label.test.ts` (48 тестов, 100% покрытие)
- **Экспорт:** `packages/core/src/domain-kit/index.ts` (разделы: "LABEL — DOMAIN-SPECIFIC STRING LABELS TYPES", "LABEL — VALUE OBJECT MODULE", "LABEL VALIDATORS")
- **Зависимости:** нет внешних зависимостей

---

#### 1.4.4: Проверка структуры и импортов (Generic Validation) ✅

**Выполнено:**

- **Структура:** `packages/core/src/domain-kit/` содержит только generic модули, нет упоминаний `risk`, `classification`, `auth`
- **Импорты:** нет импортов из `feature-auth/`, нет зависимостей от domain labels
- **TypeScript:** компилируется без ошибок
- **Проверки:**
  - ✅ Нет циклических зависимостей
  - ✅ Нет зависимостей от feature-auth
  - ✅ Нет domain-специфичных типов в core
  - ✅ Все файлы созданы
  - ✅ Тесты созданы и проходят (48 тестов для label, 100% покрытие)
  - ✅ Domain объявляет свои labels (не core)
- **Результаты проверок:**
  - ✅ `pnpm run build` - успешно
  - ✅ `pnpm run type-check` - успешно
  - ✅ `pnpm run tsc:check` - успешно
  - ✅ `pnpm run lint:canary` - успешно
  - ✅ `npx vitest run` - успешно (223 тестовых файла, 9671 тестов)
  - ✅ `pnpm run check:deprecated` - успешно
  - ✅ `pnpm run check:circular-deps` - успешно
  - ✅ `npx dprint fmt` - успешно

---

### Шаг 1.5: Создание aggregation (Aggregation Semantics) ✅

#### 1.5.1: Создание reducer.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/aggregation/reducer.ts`
- **Архитектура:** библиотека из 3 модулей: WeightedValue (тип), Reducer (generic функции), ReducerAlgebra (extensible contract)
- **Основные модули (2):** `reducer` (sum, average, weightedAverage, min, max, weightedAverageFromWeightedValues, weightedAverageFromIterable), `reducerAlgebra` (aggregate)
- **Типы (6):** `WeightedValue<T>`, `ReduceResult<T>`, `ReduceFailureReason`, `WeightValidationConfig`, `AggregatorState<TState>`, `NumericAggregator<TValue, TResult, TState>`
- **Reducer API:** Kahan summation для точности, streaming-friendly Iterable API, early termination
- **Internal Helpers:** `isValidWeight`, `isValidNumber`, `validateWeightSum`, `validateWeightedValue`
- **Принципы:** SRP, deterministic, domain-pure, microservice-ready (IEEE-754), scalable (extensible через ReducerAlgebra, Iterable streaming), strict typing, extensible, immutable, security (runtime validation NaN/Infinity, IEEE-754 MIN_NORMAL)
- **Тесты:** `packages/core/tests/aggregation/reducer.test.ts` (78 тестов, 98.44% statements, 90.47% branches, 100% functions)
- **Экспорт:** `packages/core/src/aggregation/index.ts`
- **Зависимости:** нет внешних зависимостей

---

#### 1.5.2: Создание weight.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/aggregation/weight.ts`
- **Архитектура:** библиотека из 2 модулей: Weight (generic функции), WeightAlgebra (extensible contract)
- **Основные модули (2):** `weight` (sum, sumFromIterable, normalize, normalizeFromIterable, scale, combine, validate, isNormalized), `weightAlgebra` (operate)
- **Типы (5):** `WeightResult<T>`, `WeightFailureReason`, `WeightValidationConfig`, `NormalizationConfig`, `WeightOperation<TResult, TState, TContext>`
- **Weight API:** Kahan summation, streaming-friendly, DoS защита через maxSize, real early termination через loop
- **Internal Helpers:** `isValidWeight`, `isValidNumber`, `validateWeightSum`, `validateWeights`, `sumFromArrayAssumeValid`, `scaleWeightsUnsafe`
- **Принципы:** SRP, deterministic, domain-pure, microservice-ready (IEEE-754), scalable (extensible через WeightAlgebra, Iterable streaming, DoS защита), strict typing, extensible, immutable, security (runtime validation, IEEE-754 MIN_NORMAL, DoS защита)
- **Тесты:** `packages/core/tests/aggregation/weight.test.ts` (79 тестов, 98.01% statements, 97.41% branches, 100% functions)
- **Экспорт:** `packages/core/src/aggregation/index.ts`
- **Зависимости:** нет внешних зависимостей

---

#### 1.5.3: Создание scoring.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/aggregation/scoring.ts`
- **Архитектура:** библиотека из 2 модулей: Scoring (generic функции), ScoreAlgebra (extensible contract)
- **Основные модули (2):** `scoring` (weightedScore, weightedScoreFromWeightedValues, weightedScoreFromIterable, normalizeScore, clampScore), `scoreAlgebra` (operate)
- **Типы (4):** `ScoreResult<T, E>`, `ScoreFailureReason`, `ScoringConfig`, `ScoreOperation<TResult, TState, TContext, E>`
- **Scoring API:** adaptive summation (Neumaier для mixed-sign, Kahan для single-sign), streaming-friendly, pre-check overflow guard, post-step/post-finalize numeric guards
- **Internal Helpers:** `isFiniteNumber`, `isSubnormal`, `kahanAdd`, `neumaierAdd`, `chooseSummationAlgorithm`, `accumulateWeightedFromArrays`, `accumulateWeighted`, `computeWeightedScore`, `validateRange`, `isValidScore`, `isValidWeight`, `validateWeightSum`, `validateScores`, `validateWeights`, `normalizeValue`, `validateOperateInputs`, `guardNumericProduct`, `guardState`, `processOperateStep`
- **Принципы:** SRP, deterministic, domain-pure, microservice-ready (IEEE-754, adaptive summation), scalable (extensible через ScoreAlgebra, Iterable streaming), strict typing (generic по E), extensible, immutable, security (runtime validation, overflow guards, numeric guards)
- **Тесты:** `packages/core/tests/aggregation/scoring.test.ts` (72 теста, 94.41% statements, 90.9% branches, 100% functions)
- **Экспорт:** `packages/core/src/aggregation/index.ts`
- **Зависимости:** нет внешних зависимостей (использует reducer и weight из aggregation для композиции)

---

#### 1.5.4: Проверка структуры и импортов (Aggregation) ✅

**Выполнено:**

- **Структура:** `packages/core/src/aggregation/` содержит только generic модули, нет упоминаний `risk`, `classification`, `auth`
- **Импорты:** нет импортов из `feature-auth/`, нет зависимостей от domain labels, использует только reducer и weight из aggregation
- **TypeScript:** компилируется без ошибок
- **Проверки:**
  - ✅ Нет циклических зависимостей
  - ✅ Нет зависимостей от feature-auth
  - ✅ Нет domain-специфичных типов
  - ✅ Все файлы созданы
  - ✅ Тесты созданы и проходят (reducer: 78, weight: 79, scoring: 72, покрытие 94-98%)
  - ✅ Только generic math, без domain-специфичной логики
  - ✅ НЕ зависит от domain-kit/label.ts
- **Результаты проверок:**
  - ✅ `pnpm run build` - успешно
  - ✅ `pnpm run type-check` - успешно
  - ✅ `pnpm run tsc:check` - успешно
  - ✅ `pnpm run lint:canary` - успешно
  - ✅ `npx vitest run` - успешно (226 тестовых файлов, 9899 тестов)
  - ✅ `pnpm run check:deprecated` - успешно
  - ✅ `pnpm run check:circular-deps` - успешно
  - ✅ `npx dprint fmt` - успешно

---

### Шаг 1.6: Создание rule-engine (Pure Predicate Evaluator) ✅

**КРИТИЧНО:** Rule-engine = pure predicate evaluator, НЕ знает про aggregation!\
Rule-engine = policy-agnostic evaluator, работает только с предикатами и правилами.

#### 1.6.1: Создание predicate.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/rule-engine/predicate.ts`
- **Архитектура:** библиотека из 2 модулей: Predicate (primitives), PredicateAlgebra (extensible contract)
- **Основные модули (2):** `predicate` (and, or, not, validate, evaluate, evaluateAll, evaluateAllIterable), `predicateAlgebra` (operate, operateLazy)
- **Типы (7):** `Predicate<TFact>`, `PredicateResult<T, E>`, `PredicateErrorMetadata`, `PredicateFailureReason`, `PredicateHooks<TResult, TState, TFact, TContext>`, `PredicateConfig<TResult, TState, TFact, TContext>`, `PredicateOperation<TResult, TState, TContext, TFact, E>`
- **Internal Helpers:** `validatePredicate`, `validatePredicates`, `validateTimestamp`, `validateFeatureFlags`, `validateMetadata`, `validateErrorMetadataObject`, `validateErrorMetadataForDebug`, `createErrorMetadata`, `createErrorMetadataLazy`, `buildEvaluationErrorReason`, `evaluateSinglePredicate`, `evaluatePredicatesIterable`, `composePredicatesIterative`, `operateArray`, `operateIterable`, `processOperateStep`, `executeFinalize`
- **Принципы:** SRP, deterministic (loop-based early termination), domain-pure (НЕ зависит от domain labels, aggregation, classification), scalable (Iterable streaming O(1) memory, extensible через PredicateOperation), strict typing (generic по TFact, TResult, TState, TContext, E), extensible, immutable, security (runtime validation, maxCompositionSize для DoS)
- **Тесты:** `packages/core/tests/rule-engine/predicate.test.ts` (63 теста, полное покрытие)
- **Экспорт:** `packages/core/src/rule-engine/index.ts`
- **Зависимости:** нет внешних зависимостей

---

#### 1.6.2: Создание rule.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/rule-engine/rule.ts`
- **Архитектура:** библиотека из 2 модулей: Rule (generic функции), RuleAlgebra (extensible contract)
- **Основные модули (2):** `rule` (create, validate, validateWithPredicate, validateAll, sortByPriority, filterByPriority, prepare, extensions), `ruleAlgebra` (operate, operateLazy)
- **Типы (7):** `Rule<TPredicate, TResult>`, `RuleResult<T, E>`, `RuleFailureReason`, `RuleConfig<TResult, TState, TPredicate, TFact, TContext>`, `StepResult<TState>`, `RuleOperation<TResult, TState, TContext, TPredicate, TFact, E>`, `ProcessStepResult<TState, E>`
- **Internal Helpers:** `validatePriority`, `validateRule`, `validateRules`, `filterRulesByPriority`, `isStepResult`, `processRuleOperateStep`, `handleRuleFinalizeError`, `executeRuleFinalize`, `operateRuleArray`, `operateRuleIterable`, `operateLazyArray`, `operateLazyIterable`
- **Принципы:** SRP, deterministic, domain-pure (НЕ зависит от domain labels, aggregation, classification), scalable (Iterable streaming O(1) memory, true streaming через yield*), strict typing, extensible (short-circuit через StepResult без throw), immutable, security (runtime validation, maxCompositionSize)
- **Тесты:** `packages/core/tests/rule-engine/rule.test.ts` (87 тестов, 99.43% statements, 98.79% branches, 100% functions)
- **Экспорт:** `packages/core/src/rule-engine/index.ts`
- **Зависимости:** `rule-engine/predicate.ts` (Predicate, PredicateResult, predicate.validate)

---

#### 1.6.3: Создание evaluator.ts ✅

**Выполнено:**

- **Файл:** `packages/core/src/rule-engine/evaluator.ts`
- **Архитектура:** библиотека из 2 модулей: Evaluator (generic функции), EvaluatorAlgebra (extensible contract)
- **Основные модули (2):** `evaluator` (evaluate для first-match, evaluateAll для all-match, evaluateIterable для streaming), `evaluatorAlgebra` (operate, operateLazy)
- **Типы (5):** `EvaluationMode`, `EvaluationResult<T, E>`, `EvaluationFailureReason`, `EvaluationConfig<TResult, TPredicate, TFact>`, `EvaluatorOperation<TResult, TState, TContext, TPredicate, TFact, TRuleResult, E>`
- **Internal Helpers:** `validateRuleStreaming`, `filterRuleByPriority`, `convertRuleResultToEvaluationResult`, `processFirstMatchResult`, `processAllMatchResult`, `handleEvaluationError`, `isStructuredError`, `evaluateFirstMatchStreaming`, `evaluateAllMatchStreaming`, `createFirstMatchOperation`, `createAllMatchOperation`, `operateEvaluatorRules`, `processEvaluatorStep`
- **Принципы:** SRP, deterministic (loop-based early termination, streaming O(1) memory), domain-pure (НЕ зависит от domain labels, aggregation, classification), scalable (Iterable streaming, автоматический выбор между streaming и материализацией), strict typing, extensible, immutable, security (runtime validation, maxCompositionSize, валидация на лету)
- **Тесты:** `packages/core/tests/rule-engine/evaluator.test.ts` (43 теста, 93.29% statements, 86.66% branches, 100% functions)
- **Экспорт:** `packages/core/src/rule-engine/index.ts`
- **Зависимости:** `rule-engine/predicate.ts` (Predicate), `rule-engine/rule.ts` (Rule, RuleResult, RuleFailureReason, RuleOperation, StepResult, isStepResult, rule, ruleAlgebra)

---

#### 1.6.4: Проверка rule-engine (Generic Validation) ✅

**Выполнено:**

- **Структура:** `packages/core/src/rule-engine/` содержит только generic модули, нет упоминаний `risk`, `classification`, `auth`
- **Импорты:** нет импортов из `feature-auth/`, нет зависимостей от domain labels, aggregation, classification, использует только внутренние зависимости (predicate → rule → evaluator)
- **TypeScript:** компилируется без ошибок
- **Проверки:**
  - ✅ Нет циклических зависимостей
  - ✅ Нет зависимостей от feature-auth
  - ✅ Нет зависимостей от domain labels, aggregation, classification
  - ✅ Все файлы созданы
  - ✅ Тесты созданы и проходят (predicate: 63, rule: 87, evaluator: 43, покрытие 93-99%)
  - ✅ Только generic operations, без domain-специфичной логики
  - ✅ Policy-agnostic
- **Результаты проверок:**
  - ✅ `pnpm run build` - успешно
  - ✅ `pnpm run type-check` - успешно
  - ✅ `pnpm run tsc:check` - успешно
  - ✅ `pnpm run lint:canary` - успешно
  - ✅ `npx vitest run` - успешно (229 тестовых файлов, 10092 тестов)
  - ✅ `pnpm run check:deprecated` - успешно
  - ✅ `pnpm run check:circular-deps` - успешно
  - ✅ `npx dprint fmt` - успешно

---

### Шаг 1.7: Создание domains/src/classification (Domain Implementation) ✅

#### 1.7.1: Создание структуры classification-domain ✅

**Выполнено:**

- **Директория:** `packages/domains/src/classification/`
- **Поддиректории (7):** signals, providers, strategies, policies, evaluation, aggregation, context
- **Экспорты:** `packages/domains/src/index.ts` содержит TODO для будущих экспортов

---

#### 1.7.2: Создание labels.ts ✅

**Выполнено:**

- **Файл:** `packages/domains/src/classification/labels.ts`
- **Архитектура:** библиотека из 3 модулей: ClassificationLabel (union type, single source of truth), classificationLabel (value object), classificationLabelUtils (pure helpers), classificationPolicy (declarative policy map)
- **Основные модули (3):** `classificationLabel` (create, deserialize, value, isLabel, assertValid), `classificationLabelUtils` (getAllowedValues, isSafe/isSuspicious/isDangerous/isUnknown, hasValue), `classificationPolicy` (requiresReview, isCritical)
- **Типы (4):** `ClassificationLabelValue` (union type из CLASSIFICATION_LABELS), `ClassificationLabel` (branded type через Label<T>), `ClassificationLabelOutcome`, `CLASSIFICATION_LABELS` (константа-массив)
- **Internal Helpers:** `getValue`, `getPolicy` (exhaustive lookup)
- **Принципы:** SRP, deterministic, domain-pure, scalable (declarative policy map O(1) lookup, гибридный подход), strict typing (union types из массива, branded type), extensible, immutable, security (runtime validation, whitelist validator, trim)
- **Тесты:** `packages/domains/tests/classification/labels.test.ts` (67 тестов, 100% покрытие)
- **Экспорт:** `packages/domains/src/classification/index.ts`, `packages/domains/src/index.ts`
- **Зависимости:** `@livai/core` (Label, LabelOutcome, LabelValidator, label, labelValidators)
- **ESLint:** правило `ai-security/data-leakage` отключено для `packages/domains/**/*.{ts,tsx}`

---

#### 1.7.3: Перенос signals.ts ✅

**Выполнено:**

- **Файл:** `packages/domains/src/classification/signals/signals.ts`
- **Архитектура:** библиотека из 2 модулей: ClassificationSignals (internal/external разделение), ClassificationContext (валидация всех полей)
- **Основные модули (2):** `classificationSignals` (createInternal, createExternal, extractInternalSignals, create), `classificationContext` (create)
- **Типы (6):** `ClassificationGeo`, `InternalClassificationSignals`, `ExternalClassificationSignals`, `ClassificationSignals`, `ClassificationContext`, `BuildClassificationContext`
- **Internal Helpers:** `isValidCoordinate`, `isValidScore`, `isValidGeoStringFields`, `isValidGeoCoordinates`, `isValidGeo`, `isValidBooleanFields`, `isValidScoreFields`, `isValidInternalSignals`, `validateStringField`, `validateContextStringFields`, `validateContextGeo`, `validateContextSignals`, `hasComplexFieldsValidationErrors`, `validateContextComplexFields`
- **Принципы:** SRP, deterministic, domain-pure, scalable (whitelist keys), strict typing (branded types через generic типы из core), extensible, immutable (shallow copy), security (runtime validation, whitelist keys, Object.getPrototypeOf проверка)
- **Тесты:** `packages/domains/tests/classification/signals/signals.test.ts` (61 тест, 100% покрытие)
- **Экспорт:** `packages/domains/src/classification/signals/index.ts`, `packages/domains/src/classification/index.ts`, `packages/domains/src/index.ts`
- **Зависимости:** `@livai/core` (Confidence, EvaluationLevel, EvaluationScale), `domains/src/classification/labels.ts` (ClassificationLabel)

---

#### 1.7.4: Перенос violations.ts ✅

**Выполнено:**

- **Файл:** `packages/domains/src/classification/signals/violations.ts`
- **Архитектура:** библиотека из 2 модулей: SemanticViolation (discriminated union для type safety), semanticViolationValidator (composable validators)
- **Основные модули (1):** `semanticViolationValidator` (validate)
- **Типы (11):** `SemanticViolationSeverity`, `SemanticViolationAffects`, `SemanticViolationImpact`, `SemanticViolationCode` (выводится из SemanticViolation['code']), `ScoreViolationReason`, `CoordinateViolationReason`, `IncompleteCoordinatesReason`, `ScoreViolationMeta`, `CoordinatesViolationMeta`, `IncompleteCoordinatesViolationMeta`, `SemanticViolation` (discriminated union)
- **Internal Helpers:** `when` (условное значение), `isValidLatitude`, `isValidLongitude`, `createScoreViolation`, `createCoordinatesViolation`, `createIncompleteCoordinatesViolation`, `validateReputationScore`, `validateVelocityScore`, `validateCoordinates`
- **Принципы:** SRP, deterministic, domain-pure, scalable (union types для расширения без if/else-монолита), strict typing (discriminated union, single source of truth через SemanticViolation['code']), extensible (легко добавлять новые violation codes), immutable (фильтрация undefined вместо мутации массива), security (runtime validation)
- **Тесты:** `packages/domains/tests/classification/signals/violations.test.ts` (45 тестов, 100% покрытие: statements, branch, functions, lines)
- **Экспорт:** `packages/domains/src/classification/signals/index.ts`, `packages/domains/src/classification/index.ts`, `packages/domains/src/index.ts`
- **Зависимости:** `domains/src/classification/constants.ts` (GEO_VALIDATION, SCORE_VALIDATION), `domains/src/classification/signals/signals.ts` (ClassificationGeo, InternalClassificationSignals)

---

#### 1.7.5: Перенос evaluation-result.ts ✅

**Выполнено:**

- **Файл:** `packages/domains/src/classification/evaluation/result.ts`
- **Архитектура:** библиотека из 1 модуля: ClassificationEvaluationResult (результат оценки классификации)
- **Основные модули (0):** только типы (нет runtime модулей)
- **Типы (1):** `ClassificationEvaluationResult` (результат оценки с evaluationLevel, confidence, label, scale, usedSignals, context)
- **Internal Helpers:** нет (только типы)
- **Принципы:** SRP, deterministic, domain-pure, scalable (легко расширяется новыми полями), strict typing (branded types через generic типы из core, строгая типизация usedSignals через keyof ClassificationSignals), extensible (опциональные поля для расширения), immutable (все поля readonly), security (runtime validation через branded types)
- **Тесты:** `packages/domains/tests/classification/evaluation/result.test.ts` (34 теста, покрытие типов 100%)
- **Экспорт:** `packages/domains/src/classification/evaluation/index.ts`, `packages/domains/src/classification/index.ts`, `packages/domains/src/index.ts`
- **Зависимости:** `@livai/core` (EvaluationLevel, Confidence, EvaluationScale), `domains/src/classification/labels.ts` (ClassificationLabel), `domains/src/classification/signals/signals.ts` (ClassificationContext, ClassificationSignals для keyof типизации usedSignals)

---

#### 1.7.5.1: Реализация assessment logic в evaluation/ ✅

**Выполнено:**

- **Файл:** `packages/domains/src/classification/evaluation/assessment.ts`
- **Архитектура:** библиотека из 1 модуля: Assessment logic для финальной сборки результата оценки классификации
- **Основные модули (2):** `buildAssessmentContextWithPlugins`, `assembleAssessmentResultFromContext`
- **Типы (3):** `AssessmentContext` (контекст для assessment logic), `AssessmentContextBuilderPlugin` (плагин для расширения контекста), `BuildAssessmentContextOptions` (опции для сборки контекста)
- **Internal Helpers (3):** `buildAssessmentContext`, `applyAssessmentPlugins`, `assembleAssessmentResult`
- **Принципы:** Pure domain (детерминированная функция), No side-effects (изолирован от effects layer), SRP (только assessment logic, не содержит validation/rule evaluation), Domain-focused (classification-специфичная логика), Immutable (все функции возвращают frozen объекты)
- **Тесты:** `packages/domains/tests/classification/evaluation/assessment.test.ts` (28 тестов, 100% покрытие: statements, branch, functions, lines)
- **Экспорт:** `packages/domains/src/classification/evaluation/index.ts`, `packages/domains/src/classification/index.ts`, `packages/domains/src/index.ts`
- **Зависимости:** `domains/src/classification/evaluation/result.ts` (ClassificationEvaluationResult), `domains/src/classification/signals/signals.js` (ClassificationContext), `domains/src/classification/strategies/rules.js` (DeviceInfo)

---

#### 1.7.6: Перенос strategies ✅

**Выполнено:**

**1. deterministic.strategy.ts:**

- **Файл:** `packages/domains/src/classification/strategies/deterministic.strategy.ts`
- **Архитектура:** orchestration layer для оценки классификации через локальные правила, использует generic rule-engine из @livai/core
- **Основные модули (1):** `evaluateClassificationRules` (orchestration: validation → rule context building → rule evaluation → result assembly)
- **Типы (2):** `ContextBuilderPlugin` (плагин для расширения контекста), `EvaluateClassificationRulesOptions` (опции для оценки правил)
- **Internal Helpers (10):** `buildRuleContext`, `applyRulePlugins`, `calculateEvaluationLevelFromRiskScore`, `calculateConfidence`, `assembleClassificationResult`, `calculateEntropy`, `freezeContext`, `shallowCloneContext`, `validateRuleEvaluationOptions`, `normalizeRiskScore`
- **Принципы:** Pure domain engine (детерминированная функция), No side-effects (изолирован от effects layer), Testable (легко тестируется без моков), Domain-focused (только orchestration логика), SRP (валидация, контекст-билдеры и rule evaluation разделены), Immutable (Readonly/reduce для защиты от мутаций), Scalable (мемоизация genericRules, единый проход через evaluator.evaluateAll)
- **Тесты:** `packages/domains/tests/classification/strategies/deterministic.strategy.test.ts` (83 теста, 86.36% statements, 80.76% branches, 86.95% functions, 87.15% lines)
- **Экспорт:** `packages/domains/src/classification/strategies/index.ts`, `packages/domains/src/classification/index.ts`
- **Зависимости:** `@livai/core` (Confidence, EvaluationLevel, Rule, evaluator, confidence, evaluationLevel), `domains/src/classification/labels.ts` (classificationLabel), `domains/src/classification/strategies/rules.ts` (ClassificationRule, DeviceInfo, RuleEvaluationContext, allRules), `domains/src/classification/strategies/validation.ts` (validateClassificationSemantics), `domains/src/classification/strategies/config.ts` (ClassificationRulesConfig, getClassificationRulesConfig), `domains/src/classification/evaluation/assessment.ts` (assembleAssessmentResultFromContext, buildAssessmentContextWithPlugins)
- **Technical Debt:** Strategy layer содержит evaluation logic (calculateEvaluationLevelFromRiskScore, calculateConfidence, assembleClassificationResult), которая должна быть в evaluation layer. После реализации policies/ эта логика будет перенесена в evaluation/assessment.ts.

---

**2. assessment.ts:**

- **Файл:** `packages/domains/src/classification/strategies/assessment.ts`
- **Архитектура:** composition layer для orchestration оценки классификации, объединяет scoring, rule engine и decision policy
- **Основные модули (1):** `assessClassification` (pipeline: scoring → rule evaluation → assessment context → assemble result)
- **Типы (3):** `ContextBuilderPlugin` (плагин для расширения контекста, расширяет DeterministicContextBuilderPlugin), `ClassificationPolicy` (политика для classification assessment с `weights?: Readonly<RiskWeights>` и `decision?: unknown`, типы `RiskWeights` определены в `aggregation/scoring.ts` в рамках подготовки к разделу 1.7.7), `AssessmentResult` (результат assessment с возможными ошибками валидации)
- **Internal Helpers (4):** `buildScoringContext`, `applyScoringContextPlugins`, `shallowCloneContext`, `freezeContext`
- **Принципы:** Composition (объединяет подсистемы: scoring, rules, decision), Pure domain (детерминированная функция), No side-effects (изолирован от effects layer), SRP (только orchestration, не содержит validation/error handling/context building), Domain-focused (classification-специфичная логика), Immutable (контексты клонируются и замораживаются)
- **Тесты:** `packages/domains/tests/classification/strategies/assessment.test.ts` (41 тест, 92.85% statements, 100% branches, 75% functions, 92.85% lines)
- **Экспорт:** `packages/domains/src/classification/strategies/index.ts`, `packages/domains/src/classification/index.ts`
- **Зависимости:** `@livai/core` (нет прямых зависимостей), `domains/src/classification/strategies/deterministic.strategy.ts` (evaluateClassificationRules, ContextBuilderPlugin), `domains/src/classification/strategies/rules.ts` (DeviceInfo), `domains/src/classification/strategies/config.ts` (ClassificationRulesConfig, getClassificationRulesConfig), `domains/src/classification/aggregation/scoring.ts` (RiskWeights: `{ readonly device: number; readonly geo: number; readonly network: number; readonly velocity: number; }`, определены до реализации `calculateRiskScore` для улучшения типобезопасности, ScoringContext, calculateRiskScore, defaultRiskWeights), `domains/src/classification/evaluation/assessment.ts` (assembleAssessmentResultFromContext, buildAssessmentContextWithPlugins)

---

**3. rules.ts:**

- **Файл:** `packages/domains/src/classification/strategies/rules.ts`
- **Архитектура:** data-driven rule engine с declarative rule definitions для classification assessment
- **Основные модули (8):** `allRules` (массив всех правил), `evaluateRules` (оценка правил), `getRuleDefinition` (получение определения правила), `getRulesWithDecisionImpact` (получение правил с impact на решение), `getMaxPriority` (максимальный приоритет), `sortRulesByPriority` (сортировка по приоритету), `evaluateRuleActions` (оценка действий правил), `clearEnabledRulesCache` (очистка кеша)
- **Типы (12):** `DeviceInfo` (информация об устройстве), `ClassificationRule` (правило классификации), `RuleSignals` (сигналы правила), `RuleContextMetadata` (метаданные контекста), `RuleEvaluationContext` (контекст оценки), `RuleAction` (действие правила), `ClassificationRuleConfig` (конфигурация правила), `RuleMetadata` (метаданные правила), `RuleIdentifier` (идентификатор правила), `RuleDefinition` (определение правила), `ExtendedRuleDefinition` (расширенное определение), `VersionedRuleDefinition` (версионированное определение)
- **Internal Helpers (20+):** правила для device (UNKNOWN_DEVICE, IOT_DEVICE, MISSING_OS, MISSING_BROWSER), network (LOW_REPUTATION, CRITICAL_REPUTATION, HIGH_VELOCITY), geo (HIGH_RISK_COUNTRY, INCOMPLETE_COORDINATES), composite (HIGH_RISK_SCORE, MULTIPLE_VIOLATIONS), helper функции для создания правил и оценки
- **Принципы:** Declarative rules (правила как данные), OCP (открыт для расширения, закрыт для модификации), Single source of truth (каждое правило определено один раз), Testable (правила легко тестировать изолированно), Domain-pure (classification-специфичная логика), Scalable (O(1) lookup через Map, short-circuit для критических правил), Lazy evaluation (для >1000 правил поддерживается lazy evaluation non-critical rules), Precomputing (кэширование enabledRulesPerUser для массовых вызовов)
- **Тесты:** `packages/domains/tests/classification/strategies/rules.test.ts` (покрытие тестами реализовано)
- **Экспорт:** `packages/domains/src/classification/strategies/index.ts`, `packages/domains/src/classification/index.ts`
- **Зависимости:** `domains/src/classification/constants.ts` (SCORE_VALIDATION), `domains/src/classification/strategies/config.ts` (ClassificationRulesConfig, RuleThresholds, getClassificationRulesConfig, isClassificationRuleEnabled, registerConfigChangeCallback), `domains/src/classification/signals/signals.ts` (ClassificationGeo)

---

**4. validation.ts:**

- **Файл:** `packages/domains/src/classification/strategies/validation.ts`
- **Архитектура:** classification-специфичная валидация signals для strategies, использует semanticViolationValidator из signals/violations.ts
- **Основные модули (1):** `validateClassificationSemantics` (валидация семантики classification signals)
- **Типы (1):** `ClassificationSemanticValidator` (контракт для валидатора семантики)
- **Internal Helpers:** нет (использует composable validators из violations.ts)
- **Принципы:** Pure (детерминированная функция без side-effects), Domain-focused (только бизнес-логика, не security), Composable (использует composable validators из violations.ts), Policy-ready (violations пригодны для policy-engine без парсинга), Explainable (возвращает violations с impact для explainability)
- **Тесты:** `packages/domains/tests/classification/strategies/validation.test.ts` (покрытие тестами реализовано)
- **Экспорт:** `packages/domains/src/classification/strategies/index.ts`, `packages/domains/src/classification/index.ts`
- **Зависимости:** `domains/src/classification/signals/signals.ts` (InternalClassificationSignals), `domains/src/classification/signals/violations.ts` (semanticViolationValidator, SemanticViolation)

---

**5. config.ts:**

- **Файл:** `packages/domains/src/classification/strategies/config.ts`
- **Архитектура:** динамическая конфигурация для classification rules с поддержкой обновления без перекомпиляции
- **Основные модули (7):** `getClassificationRulesConfig` (получение конфигурации), `updateClassificationRulesConfig` (обновление конфигурации), `registerConfigChangeCallback` (регистрация callback для изменений), `unregisterConfigChangeCallback` (отмена регистрации), `registerClearEnabledRulesCacheCallback` (регистрация callback для очистки кеша), `resetClassificationRulesConfig` (сброс конфигурации), `isClassificationRuleEnabled` (проверка включения правила)
- **Типы (5):** `BaseRuleThresholds` (базовые пороги), `RuleThresholds` (пороги с динамическими через Record), `RuleConfigVersion` (версия конфигурации), `RuleFeatureFlag` (feature flag для правила), `ClassificationRulesConfig` (конфигурация правил), `ConfigChangeCallback` (callback для изменений)
- **Internal Helpers:** `hashUtils` (FNV-1a hash для rollout), `callbackManager` (управление callbacks), константы (DEFAULT_RULE_THRESHOLDS, DEFAULT_HIGH_RISK_COUNTRIES, DEFAULT_CRITICAL_RULE_PRIORITY_THRESHOLD, DEFAULT_CLASSIFICATION_RULES_CONFIG)
- **Принципы:** Dynamic (конфигурация может обновляться runtime), Extensible (RuleThresholds поддерживает динамические пороги через Record<string, number>), Versioned (типы для версионирования правил готовы), Feature flags (постепенное включение правил с FNV-1a hash для rollout), Immutable (конфигурация защищена от мутаций через Object.freeze и Readonly), Type-safe (строгая типизация всех параметров), SRP (hash и callback management вынесены в отдельные внутренние модули), Scalable (Map для O(1) lookup feature flags, lazy init для ускорения старта), Security (валидация ruleId, FNV-1a hash для rollout, защита от рекурсии в callbacks)
- **Тесты:** `packages/domains/tests/classification/strategies/config.test.ts` (покрытие тестами реализовано)
- **Экспорт:** `packages/domains/src/classification/strategies/index.ts`, `packages/domains/src/classification/index.ts`
- **Зависимости:** нет внешних зависимостей (только внутренние типы)

---

#### 1.7.7: Перенос scoring в aggregation ✅

**Выполнено:**

**scoring.ts:**

- **Файл:** `packages/domains/src/classification/aggregation/scoring.ts`
- **Архитектура:** aggregation layer для расчета risk score на основе факторов классификации, использует generic aggregation semantics из @livai/core. Интегрирован с `assessment.ts` (использует `calculateRiskScore` для построения scoringContext из deviceInfo и context, weights из `policy.weights ?? defaultRiskWeights`, передает config в scoringContext для оптимизации) и `deterministic.strategy.ts` (принимает riskScore через `options.riskScore`, использует в buildRuleContext, calculateEvaluationLevelFromRiskScore, calculateConfidence, assembleClassificationResult)
- **Основные модули (3):** `calculateRiskScore` (рассчитывает risk score с RiskWeights, использует registry-style архитектуру), `calculateRiskScoreWithCustomFactors` (рассчитывает risk score с кастомными факторами для extensibility), `validateRiskWeights` (валидирует risk weights: сумма должна быть близка к 1.0, каждый вес в диапазоне 0.0-1.0)
- **Типы (3):** `ScoringContext` (контекст для scoring: device, geo, ip, signals, опционально config для оптимизации, используется в assessment.ts для построения из deviceInfo и context), `RiskFactor` (фактор риска с name, weight, compute для registry-style архитектуры), `RiskWeights` (конфигурация весов: device, geo, network, velocity, сумма = 1.0, используется в assessment.ts через `policy.weights ?? defaultRiskWeights`, типы определены в разделе 1.7.6 ДО реализации calculateRiskScore для улучшения типобезопасности)
- **Константы (1):** `defaultRiskWeights` (дефолтные веса: device=0.3, geo=0.25, network=0.25, velocity=0.2, сумма=1.0, immutable через Object.freeze, используется в assessment.ts как fallback для `policy.weights ?? defaultRiskWeights`)
- **Internal Helpers (12):** `validateAndNormalizeScore` (валидация и нормализация score 0-100, защита от NaN/Infinity/отрицательных значений), `isValidIpv4` (валидация IPv4 через ipaddr.js), `isValidIpv6` (валидация IPv6 через ipaddr.js, поддержка всех edge-cases: compressed/mixed, zones, IPv4-mapped), `isValidIp` (валидация IP адреса IPv4 или IPv6), `calculateDeviceRisk` (расчет риска устройства 0-100), `calculateGeoRisk` (расчет географического риска 0-100), `calculateNetworkRisk` (расчет сетевого риска 0-100 с валидацией IP и reputationScore), `calculateVelocityRisk` (расчет velocity риска 0-100), `validateFactorsRegistry` (валидация registry факторов: сумма весов, диапазон весов, уникальность имен), `createFactorsCacheKey` (создание ключа кеша из весов факторов), `calculateRiskScoreWithFactors` (расчет risk score используя registry факторов с кешированием normalizedFactors), `normalizedFactorsCacheModule` (кеш для normalizedFactors для оптимизации множественных вызовов)
- **Принципы:** Aggregation semantics (scoring = aggregation, НЕ в strategies), Pure domain (детерминированная функция, одинаковый вход → одинаковый выход, без randomness, IO, глобального состояния), No side-effects (изолирован от effects layer), SRP (только scoring, не содержит decision logic или rule evaluation), Domain-focused (classification-специфичные веса и факторы), Normalized weights (веса суммируются в 1.0 для корректного weighted scoring), Immutable (все веса и константы защищены от мутаций через Object.freeze и Readonly), Security (валидация всех входных данных для защиты от poisoning: IP-валидаторы через battle-tested ipaddr.js, валидация чисел reputationScore/velocityScore для защиты от NaN/Infinity/отрицательных значений), Extensible (registry-style архитектура для динамического добавления факторов без изменения core types), Scalable (кеширование normalizedFactors для оптимизации множественных вызовов, опциональный config в ScoringContext для избежания повторных вызовов getClassificationRulesConfig), Integration-ready (интегрирован с assessment.ts через calculateRiskScore и buildScoringContext, с deterministic.strategy.ts через options.riskScore)
- **Тесты:** `packages/domains/tests/classification/aggregation/scoring.test.ts` (119 тестов, 93.33% statements, 95.4% branches, 89.47% functions, 92.7% lines)
- **Экспорт:** `packages/domains/src/classification/aggregation/index.ts`, `packages/domains/src/classification/index.ts`. Используется в `assessment.ts` (calculateRiskScore, defaultRiskWeights, ScoringContext, RiskWeights) и `deterministic.strategy.ts` (riskScore передается через options.riskScore)
- **Зависимости:** `ipaddr.js` (battle-tested библиотека для валидации IP адресов), `domains/src/classification/constants.ts` (SCORE_VALIDATION), `domains/src/classification/signals/signals.ts` (ClassificationContext, ClassificationGeo, ClassificationSignals), `domains/src/classification/strategies/config.ts` (getClassificationRulesConfig), `domains/src/classification/strategies/rules.ts` (DeviceInfo)

---

#### 1.7.7.1: Проверка разделения ответственности (Strategies vs Aggregation) ✅

**КРИТИЧНО:** После переноса strategies и scoring проверить разделение responsibility!

**Выполнено:**

- **Структура:** `packages/domains/src/classification/strategies/` содержит только strategy-специфичную логику, `packages/domains/src/classification/aggregation/` содержит только scoring логику
- **Импорты:**
  - В `strategies/` нет прямого использования `@livai/core/aggregation/scoring.ts` (используется только через `domains/src/classification/aggregation/scoring.ts` в `assessment.ts` как composition layer)
  - В `aggregation/` нет импортов из `@livai/core/rule-engine/evaluator.ts`
  - `strategies/assessment.ts` использует `calculateRiskScore` из `aggregation/scoring.ts` (правильно: composition layer объединяет scoring и rules)
  - `strategies/deterministic.strategy.ts` использует только `@livai/core/rule-engine/evaluator.ts` для вычислений
- **TypeScript:** компилируется без ошибок
- **Проверки:**
  - ✅ Scoring только в `domains/src/classification/aggregation/` (calculateRiskScore, calculateRiskScoreWithCustomFactors, validateRiskWeights)
  - ✅ Strategy только в `domains/src/classification/strategies/` (evaluateClassificationRules, assessClassification)
  - ✅ Нет пересечений между strategies и aggregation (чистое разделение ответственности)
  - ✅ Aggregation использует только `domains/src/classification/` и `ipaddr.js`, не использует `@livai/core/rule-engine/`
  - ✅ Strategies используют `@livai/core/rule-engine/evaluator.ts` для вычислений, `assessment.ts` использует `aggregation/scoring.ts` как composition layer (правильно)
  - ✅ Aggregation не содержит rule evaluation логики
  - ✅ Aggregation не содержит strategy-специфичной логики
  - ✅ Strategies не содержат функций scoring (только использование через composition layer)
- **Результаты проверок:**
  - ✅ `pnpm run build` - успешно
  - ✅ `pnpm run type-check` - успешно
  - ✅ `pnpm run tsc:check` - успешно
  - ✅ `pnpm run lint:canary` - успешно
  - ✅ `npx vitest run` - успешно (241 тестовых файлов, 10848 тестов)
  - ✅ `pnpm run check:deprecated` - успешно
  - ✅ `pnpm run check:circular-deps` - успешно

---

#### 1.7.8: Перенос context-builders (Pure Functions) ✅

**Выполнено:**

**context-builders.ts:**

- **Файл:** `packages/domains/src/classification/context/context-builders.ts`
- **Архитектура:** Pure functions для построения контекстов разных слоёв classification domain, используют slot-based API для интеграции в declarative pipeline. Изолированы от основной логики для соблюдения SRP. Интегрированы с `deterministic.strategy.ts` (использует `buildRuleContext` для построения ruleContext из deviceInfo, context и riskScore), `evaluation/assessment.ts` (использует `buildAssessmentContext` и `buildAssessmentContextWithPlugins` для построения assessmentContext из deviceInfo, context, riskScore и ruleEvaluationResult), `strategies/assessment.ts` (использует `buildScoringContext` для построения scoringContext из deviceInfo, context и config)
- **Основные модули (3):** `buildScoringContext` (строит контекст для scoring из device, context и config, возвращает ScoringContext с device, geo, ip, signals и config), `buildRuleContext` (строит контекст для rule evaluation из device, context и riskScore, возвращает RuleEvaluationContext с device, geo, previousGeo, signals и metadata, валидирует riskScore для защиты от poisoning), `buildAssessmentContext` (строит контекст для assessment из device, context, riskScore и ruleEvaluationResult, возвращает AssessmentContext с device, classificationContext, riskScore и ruleEvaluationResult, применяет freeze для защиты от plugin mutations)
- **Типы (1):** `ClassificationSlotMap` (slot map для classification pipeline: определяет все слоты данных device, context, signals, config, riskScore, scoringContext, ruleContext, ruleEvaluationResult, assessmentContext, используется для slot-based архитектуры и автоматической композиции стадий через pipeline)
- **Internal Helpers (3):** `freezeContext` (замораживает контекст для защиты от мутаций через Object.freeze), `buildRuleSignals` (строит RuleSignals из ClassificationSignals, возвращает пустой объект вместо undefined для pipeline удобства, фильтрует только нужные поля isVpn, isTor, isProxy, reputationScore, velocityScore), `validateRiskScore` (валидирует и нормализует risk score: undefined → 0, NaN/Infinity → 0, ограничивает диапазоном 0-100 через SCORE_VALIDATION константы, защита от poisoning)
- **Принципы:** Pure domain (детерминированные функции без side-effects, IO, async, conditions, одинаковый вход → одинаковый выход), Slot-based API (функции принимают и возвращают Pick<ClassificationSlotMap, ...> для pipeline integration, уменьшение coupling), SRP (каждый builder отвечает за свой тип контекста, изолирован от основной логики), Reusable (используются в strategies, evaluation, aggregation layers), Immutable (все функции возвращают frozen объекты с защитой вложенных структур через Object.freeze, shallow copy для O(1) по памяти), Scalable (O(1) по памяти: shallow copy вместо deep copy), Pipeline-ready (готовы к автоматической композиции стадий через slot-based архитектуру), Security (валидация riskScore для защиты от poisoning, freeze вложенных объектов первого уровня для защиты от plugin mutations, валидация previousSessionId для определения isNewDevice)
- **Тесты:** `packages/domains/tests/classification/context/context-builders.test.ts` (513 строк, 100% statements, 100% branches, 100% functions, 100% lines)
- **Экспорт:** `packages/domains/src/classification/context/index.ts`, `packages/domains/src/classification/index.ts`. Используется в `deterministic.strategy.ts` (buildRuleContext), `evaluation/assessment.ts` (buildAssessmentContext, buildAssessmentContextWithPlugins), `strategies/assessment.ts` (buildScoringContext)
- **Зависимости:** `domains/src/classification/aggregation/scoring.ts` (ScoringContext), `domains/src/classification/constants.ts` (SCORE_VALIDATION), `domains/src/classification/evaluation/assessment.ts` (AssessmentContext), `domains/src/classification/evaluation/result.ts` (ClassificationEvaluationResult), `domains/src/classification/signals/signals.ts` (ClassificationContext, ClassificationSignals), `domains/src/classification/strategies/config.ts` (ClassificationRulesConfig), `domains/src/classification/strategies/rules.ts` (DeviceInfo, RuleContextMetadata, RuleEvaluationContext, RuleSignals)

---

#### 1.7.9: Создание README для domains ✅

**Выполнено:**

**README.md:**

- **Файл:** `packages/domains/src/classification/README.md`
- **Структура:**
  - Архитектура: описание flow и слоев (signals → validation → context-builders → strategies → aggregation → evaluation → result)
  - Интеграция с @livai/core: примеры использования rule-engine, aggregation, core types, pipeline plugins
  - Примеры использования: полный flow и context builders
  - Зависимости: диаграмма модулей и их связей
  - Принципы: pure domain, slot-based API, SRP, immutable, security
- **Формат:** лаконичный, структурированный, с примерами кода для каждого компонента

---

### Шаг 1.8: Создание pipeline (Universal Orchestration Runtime) ✅

#### 1.8.1: Создание plugin-api.ts (Dependency-Driven) ✅

**Выполнено:**

- **Файл:** `packages/core/src/pipeline/plugin-api.ts`
- **Архитектура:** generic dependency-driven execution engine API (не middleware chain). Pipeline автоматически определяет порядок выполнения на основе provides/dependsOn. Dependency resolution, fan-out/fan-in, lazy stages, cancellation, partial recompute
- **Основные модули (4):** `validatePlugin` (проверка структуры и типов plugin), `validatePipelineConfig` (валидация конфигурации pipeline), `defineStage` (factory helper с tuple type inference), `defineFallback` (factory helper для fallback стадий)
- **Типы (10):** `StageContext`, `StageMetadata`, `StagePlugin`, `StageResult`, `StageFailureReason`, `StageError`, `FallbackStage`, `PipelineConfig`, `PipelineResult`, `PipelineFailureReason`
- **Internal Helpers (3):** `validateOptionalNumber` (валидация опциональных числовых полей), `validateOptionalBoolean` (валидация опциональных boolean полей), `validateFallbackStage` (валидация fallback стадии)
- **Принципы:** SRP, Deterministic, Domain-pure, Microservice-ready, Scalable, Strict typing (union-типы, generic по TSlotMap, tuple type для provides), Extensible, Immutable, Security (compile-time provides/slots enforcement, runtime validation, AbortSignal для cancellation, fallback isolation)
- **Тесты:** `packages/core/tests/pipeline/plugin-api.test.ts` (61 тест, 100% покрытие statements/functions/lines, 95.31% branch coverage)
- **Экспорт:** `packages/core/src/pipeline/index.ts`, `packages/core/src/index.ts`
- **Зависимости:** Нет внешних зависимостей (только TypeScript типы)

---

#### 1.8.2: Перенос pipeline engine ✅

**Выполнено:**

**1. errors.ts:**

- **Файл:** `packages/core/src/pipeline/errors.ts`
- **Архитектура:** type-safe слой нормализации и классификации ошибок pipeline (execution/isolation/timeout/cancelled/dependency).
- **Основные модули:** классы ошибок (`TimeoutError`, `IsolationError`, `CancelledError`), фабрики (`createExecutionError`, `createIsolationError`, `createTimeoutError`, `createCancelledError`, `createDependencyError`, `createPipelineError`), классификация/нормализация (`classifyError`, `normalizePipelineError`), конвертеры (`pipelineErrorToStageFailureReason`, `pipelineErrorToStageError`, `stageFailureReasonToPipelineError`).
- **Типы:** `PipelineError`, `PipelineStageError`, `BrandedStageError`, `PipelineErrorMetadata`.
- **Принципы:** deterministic mapping, strict unions, predictable error surface, runtime validation metadata.
- **Тесты:** `packages/core/tests/pipeline/errors.test.ts` — 118 тестов, coverage: 100/100/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** `./plugin-api.js` (типы `PipelineFailureReason`, `StageError`, `StageFailureReason`).

---

**2. feature-flags.ts:**

- **Файл:** `packages/core/src/pipeline/feature-flags.ts`
- **Архитектура:** pure feature-flag rollout (tenant/bucket/traffic) с композицией резолверов и приоритетов.
- **Основные модули:** `createUserBucketResolver`, `createTenantResolver`, `createTrafficPercentageResolver`, `createCombinedResolver`, `resolvePipelineMode`, `resolveFeatureFlag`, `isShadowMode`, `isActiveMode`, `getPipelineVersion`.
- **Типы:** `PipelineVersion`, `PipelineMode`, `FeatureFlagSource`, `ResolverPriority`, `RolloutConfig`, `FeatureFlagResolver`, `FeatureFlagResult`.
- **Принципы:** deterministic resolution, domain-pure configuration, composable resolvers, no hidden side-effects.
- **Тесты:** `packages/core/tests/pipeline/feature-flags.test.ts` — 56 тестов, coverage: 100/89.62/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** внешние импорты отсутствуют (pure module).

---

**3. runtime-overrides.ts:**

- **Файл:** `packages/core/src/pipeline/runtime-overrides.ts`
- **Архитектура:** runtime override layer для безопасного изменения pipeline-конфига с приоритетами (custom/runtime/environment).
- **Основные модули:** `createDefaultEnvProvider`, `createEnvProviderFromObject`, `readRuntimeOverridesFromEnv`, `createCustomOverrideProvider`, `createDefaultOverrideMapper`, `applyRuntimeOverrides`, `hasActiveOverrides`, `getActiveOverrideKeys`, `validateRuntimeOverrides`.
- **Типы:** `OverrideKey`, `OverrideSource`, `OverridePriority`, `RuntimeOverride`, `RuntimeOverrides`, `OverrideResult`, `OverrideEvent`, `OverrideProvider`, `OverrideApplier`.
- **Принципы:** deterministic apply order, explicit priority map, observable override events, strict runtime validation.
- **Тесты:** `packages/core/tests/pipeline/runtime-overrides.test.ts` — 68 тестов, coverage: 100/94.66/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** внешние импорты отсутствуют (pure module).

---

**4. safety-guard.ts:**

- **Файл:** `packages/core/src/pipeline/safety-guard.ts`
- **Архитектура:** metrics-driven guardrail движок для rollback-решений на основе приоритетных правил.
- **Основные модули:** `createMinMeasurementsRule`, `createThresholdRule`, `createCombinedRule`, `evaluateSafetyGuard`, `createRollbackConfig`, `updateSafetyGuardState` + сортировка приоритетов (`compareRulePriorities`, `sortRuleResultsByPriority`).
- **Типы:** `SafetyRule`, `SafetyRuleResult`, `SafetyGuardConfig`, `SafetyGuardResult`, `SafetyGuardState`, `RulePriority`, `RollbackEvent`.
- **Принципы:** deterministic rule order, composable policies, state-safe window reset, strong typing of metrics.
- **Тесты:** `packages/core/tests/pipeline/safety-guard.test.ts` — 48 тестов, coverage: 100/100/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** внешние импорты отсутствуют (pure module).

---

**5. replay.ts:**

- **Файл:** `packages/core/src/pipeline/replay.ts`
- **Архитектура:** replay capture toolkit с фильтрами, санитизацией контекста и управляемой генерацией event id.
- **Основные модули:** `defaultEventIdGenerator`, `deterministicEventIdGenerator`, `formatTimestamp`, `shouldCaptureEvent`, `applyFilters`, `createCombinedFilter`, `createFieldRemovalSanitizer`, `createTransformSanitizer`, `createCombinedSanitizer`, `createReplayEvent`.
- **Типы:** `ReplayEvent`, `ReplayEventFilter`, `ContextSanitizer`, `ReplayEventSaver`, `MetadataFactory`, `CaptureResult`, `ReplayCaptureConfig`.
- **Принципы:** privacy-first capture, deterministic ids/timestamps, composable sanitizers/filters, bounded capture policies.
- **Тесты:** `packages/core/tests/pipeline/replay.test.ts` — 54 теста, coverage: 100/100/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** внешние импорты отсутствуют (pure module).

---

**6. adapter.ts:**

- **Файл:** `packages/core/src/pipeline/adapter.ts`
- **Архитектура:** runtime adapter для cancellation/timeout orchestration вокруг async effects.
- **Основные модули:** `createAbortPromise`, `createTimeoutPromise`, `createRuntimeAdapter`, `withTimeout`, `adaptEffectLibrary` + guards `isAborted`, `isCancellationError`, `isAdapterTimeoutError`.
- **Типы:** `PipelineEffect`, `RuntimeAdapter`, `RuntimeAdapterFactory`, `AdapterConfig`, `AdapterResult`, `CancellablePromise`, `AdapterEvent`.
- **Принципы:** explicit lifecycle events, reliable cleanup, typed error channels, composable runtime integration.
- **Тесты:** `packages/core/tests/pipeline/adapter.test.ts` — 52 теста, coverage: 100/97.14/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** внешние импорты отсутствуют (используются глобальные `AbortSignal`, `setTimeout`, `clearTimeout`).

---

**7. plan.ts:**

- **Файл:** `packages/core/src/pipeline/plan.ts`
- **Архитектура:** immutable compiler execution-plan (DAG) с validate + topological sort + materialization.
- **Основные модули:** `createExecutionPlan`, `createExecutionPlanSafe`, `createExecutionPlanOrThrow`.
- **Типы:** `ExecutionPlan`, `ExecutionPlanError`.
- **Internal helpers (ключевые):** нормализация плагинов, проверка duplicate providers/unknown slots/cycle, dependency indexes, deterministic hash/version, stable sorting helpers.
- **Принципы:** deterministic compilation, O(V+E) graph operations, branded ids (`StageId`/`SlotId`), strict validation, immutable plan structure.
- **Тесты:** `packages/core/tests/pipeline/plan.test.ts` — 42 теста, coverage: 95.62/82.16/100/95.73.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** `./plugin-api.js` (`validatePlugin`, типы pipeline).

---

**8. engine.ts:**

- **Файл:** `packages/core/src/pipeline/engine.ts`
- **Архитектура:** execution orchestrator поверх compiled plan: sequential + parallel (fan-out/fan-in), guard checks, deterministic merge.
- **Основные модули:** `createPipelineEngine`, `executePipeline`.
- **Типы:** `ExecutionState`, `StageExecutionResult`.
- **Internal helpers (ключевые):** `executeSequentially`, `executeWithParallelSupport`, `executeStageBatch`, `executeLevel`, `executeBatch`, `mergeResults`, `guardChecks`, `handleStageError`, `normalizeExecutionError`.
- **Принципы:** SRP helpers, deterministic behavior, timeout/cancellation control, throttling (`maxParallelStages`), safe error normalization.
- **Тесты:** `packages/core/tests/pipeline/engine.test.ts` — 38 тестов, coverage: 100/97.11/100/100.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** `./plan.js` (`createExecutionPlan`, `ExecutionPlan`), `./plugin-api.js` (`validatePipelineConfig` + types).

---

**9. facade.ts:**

- **Файл:** `packages/core/src/pipeline/facade.ts`
- **Архитектура:** policy-driven facade над compile/execute командным API (ALLOW/REWRITE/REJECT) с audit hook.
- **Основные модули:** `createPipelineFacade`, `createAllowAllRule`, `createAllowedCommandsRule`.
- **Типы:** `PipelineFacadeCommand`, `PipelineFacadeRule`, `FacadeRuleDecision`, `PipelineFacadeResult`, `PipelineFacadeFailure`, `FacadeAuditEvent`, `PipelineFacadeOptions`.
- **Internal helpers (ключевые):** `resolveCommandWithRules`, `dispatchHandler`, `assertNever`, преобразование ошибок compile/execute в facade failure unions.
- **Принципы:** deterministic rule pipeline, strict command/result unions, extensible handlers, side-effect control через explicit audit hook.
- **Тесты:** `packages/core/tests/pipeline/facade.test.ts` — 25 тестов, coverage: 96.29/96.77/94.73/96.22.
- **Экспорт:** через `packages/core/src/pipeline/index.ts`.
- **Зависимости:** `./engine.js` (`executePipeline`), `./plan.js` (`createExecutionPlanSafe`, типы plan), `./plugin-api.js` (pipeline types).

---

#### 1.8.3: Перенос providers в domains/src/classification ✅

**Выполнено:**

- **Файлы:**
  - `packages/domains/src/classification/providers/remote.provider.ts`
  - `packages/domains/src/classification/providers/index.ts`
  - `packages/domains/src/classification/index.ts` (подключен экспорт providers)
- **Архитектура:** domain-level provider stage для slot graph (`StagePlugin<TSlotMap>`) с explicit execution policy, deterministic merge и trust-boundary sanitization.
- **Основной API:** `createRemoteProviderStage`.
- **Типы:** `RemoteProviderStageConfig`, `RemoteProviderSlotMap`, `RemoteProviderRequest`, `RemoteProviderResponse`, `RemoteClassificationProvider`, `RemoteFailurePolicy`, `MergeStrategy`, `AsnMergeStrategy`, `AsyncExecutionPolicy`.
- **Ключевые внутренние модули:**
  - sanitize layer: `sanitizeRemoteResponse`, `sanitizeSignals`, `sanitizeAsn`, `sanitizeScore`, `sanitizeBoolean`;
  - merge layer: `mergeSignals`, `mergeByMaxRisk`, `combineRiskBoolean`;
  - execution layer: `createTimeoutExecutionPolicy`;
  - config invariants: `validateStageConfig` (fail-fast на factory уровне).
- **Принципы:** SRP, deterministic fallback/merge, domain-pure stage, microservice-ready transport injection, strict typing, explicit config invariants, отсутствие скрытого coupling.
- **Тесты:** `packages/domains/tests/classification/providers/remote.provider.test.ts` — 61 тест, coverage для `remote.provider.ts`: 95.95/87.3/100/95.95 (непокрытые только defensive `never` ветки).
- **Зависимости:** `@livai/core` (`defineStage`, типы pipeline), `domains/src/classification/signals/signals.ts`, `domains/src/classification/strategies/rules.ts`.

---

#### 1.8.4: Перенос policies в domains/src/classification ✅

**Выполнено:**

- **Файлы:**
  - `packages/domains/src/classification/policies/base.policy.ts`
  - `packages/domains/src/classification/policies/aggregation.strategy.ts`
  - `packages/domains/src/classification/policies/aggregation.policy.ts`
  - `packages/domains/src/classification/policies/index.ts`
  - `packages/domains/src/classification/index.ts` (подключен экспорт policies)
  - Интеграция policy-логики в:
    - `packages/domains/src/classification/strategies/assessment.ts`
    - `packages/domains/src/classification/evaluation/assessment.ts`
    - `packages/domains/src/classification/strategies/deterministic.strategy.ts`
- **Архитектура:** разделение policy/strategy/evaluation по SRP:
  - `policies/*` — decision + aggregation policy contracts и deterministic правила;
  - `strategies/deterministic.strategy.ts` — validation/ruleContext/rule-evaluation + `RuleEvaluationSnapshot`;
  - `evaluation/assessment.ts` — финальная сборка результата (`evaluationLevel`, `confidence`, `label`, `scale`) из snapshot + decision policy.
- **Основной API:**
  - policies: `determineRiskLevel`, `determineLabel`, `aggregateRiskSources`, `applyAggregationPolicy`;
  - strategy: `evaluateClassificationRules`, `evaluateClassificationRulesSnapshot`;
  - evaluation: `buildAssessmentContextWithPlugins`, `assembleAssessmentResultFromContext`.
- **Типы:**
  - `DecisionPolicy`, `RiskThresholds`, `RiskLevel`, `DecisionSignals`;
  - `AggregationPolicy`, `AggregationPolicyStrategy`, `AggregatedRisk`, `AggregationSource*`;
  - `RuleEvaluationSnapshot` (минимальный промежуточный контракт: `riskScore`, `triggeredRules`, `violations`).
- **Принципы:** strict typing, deterministic behavior, fail-safe defaults, domain purity (без IO), явные trust-boundary контракты, расширяемость через policy unions и plugins без изменения core API.
- **Тесты:**
  - `packages/domains/tests/classification/policies/base.policy.test.ts`
  - `packages/domains/tests/classification/policies/aggregation.strategy.test.ts`
  - `packages/domains/tests/classification/policies/aggregation.policy.test.ts`
  - `packages/domains/tests/classification/evaluation/assessment.test.ts`
  - `packages/domains/tests/classification/strategies/deterministic.strategy.test.ts`
  - `packages/domains/tests/classification/strategies/assessment.test.ts`
  - `packages/domains/tests/classification/context/context-builders.test.ts`
- **Итог по интеграции TODO блока:** все пункты (determineRiskLevel/determineLabel, типизация `DecisionPolicy`, интеграция в `assessment.ts`, `evaluation/assessment.ts`, `deterministic.strategy.ts`) реализованы.
- **Зависимости:** `@livai/core` (domain-kit / evaluator / branded primitives), `domains/src/classification/signals/signals.ts`, `domains/src/classification/strategies/rules.ts`.

---

### Шаг 1.9: Перенос resilience (Reliability Primitives)

#### 1.9.1: Перенос circuit-breaker.ts

**Исходный файл:**

- `packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.circuit-breaker.ts`

**Целевой файл:**

- `packages/core/src/resilience/circuit-breaker.ts`

**Действия:**

1. Перенести файл
2. Убрать зависимости от security-pipeline
3. Сделать generic circuit breaker
4. Обновить путь в комментариях
5. Обновить экспорт в `packages/core/src/resilience/index.ts`

**Тесты:**

- Создать `packages/core/tests/resilience/circuit-breaker.test.ts`
- Адаптировать логику тестов (убрать security-pipeline зависимости)
- Generic тесты для circuit breaker

**Зависимости:**

- Нет внешних зависимостей (или минимальные)

---

#### 1.9.2: Перенос metrics.ts

**Исходный файл:**

- `packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.metrics.ts`

**Целевой файл:**

- `packages/core/src/resilience/metrics.ts`

**Действия:**

1. Перенести файл
2. Убрать зависимости от security-pipeline
3. Сделать generic metrics
4. Обновить путь в комментариях
5. Обновить экспорт в `packages/core/src/resilience/index.ts`

**Тесты:**

- Создать `packages/core/tests/resilience/metrics.test.ts`
- Адаптировать логику тестов (убрать security-pipeline зависимости)
- Generic тесты для metrics

**Зависимости:**

- Нет внешних зависимостей (или минимальные)

---

#### 1.9.3: Перенос performance-limits.ts

**Исходный файл:**

- `packages/feature-auth/src/lib/security-pipeline/risk-sources/performance-limits.ts`

**Целевой файл:**

- `packages/core/src/resilience/performance-limits.ts`

**Действия:**

1. Перенести файл
2. Убрать зависимости от security-pipeline
3. Сделать generic performance limits
4. Обновить путь в комментариях
5. Обновить экспорт в `packages/core/src/resilience/index.ts`

**Тесты:**

- Создать `packages/core/tests/resilience/performance-limits.test.ts`
- Адаптировать логику тестов (убрать security-pipeline зависимости)
- Generic тесты для performance limits

**Зависимости:**

- `resilience/metrics.ts`

**Чеклист после переноса resilience:**

- [ ] Все файлы перенесены (circuit-breaker, metrics, performance-limits)
- [ ] Тесты перенесены и обновлены
- [ ] TypeScript компилируется без ошибок
- [ ] Нет зависимостей от security-pipeline
- [ ] Generic версии созданы

---

### Шаг 1.10: Перенос документации

#### 1.10.1: Создание generic документации в core

**Исходные файлы:**

- `packages/feature-auth/docs/auth-risk-runbook.md`
- `packages/feature-auth/docs/rollout-plan.md`

**Целевые файлы:**

- `packages/core/docs/pipeline-runbook.md`
- `packages/core/docs/pipeline-rollout-plan.md`

**Действия:**

1. Создать `packages/core/docs/` директорию
2. Создать `pipeline-runbook.md`:
   - Взять за основу `auth-risk-runbook.md`
   - Убрать auth-специфичные ссылки (`FORCE_RISK_V1`, `DISABLE_REMOTE_PROVIDER`)
   - Обновить пути: `security-pipeline.*` → `pipeline.*`
   - Сделать generic примеры использования
3. Создать `pipeline-rollout-plan.md`:
   - Взять за основу `rollout-plan.md`
   - Убрать auth-специфичные конфигурации
   - Обновить пути на core компоненты
   - Сделать generic план rollout

**Тесты:**

- Нет (документация)

**Зависимости:**

- Нет

---

#### 1.10.2: Обновление auth документации

**Файлы для обновления:**

- `packages/feature-auth/docs/auth-risk-runbook.md`
- `packages/feature-auth/docs/rollout-plan.md`

**Действия:**

1. Обновить `auth-risk-runbook.md`:
   - Добавить ссылки на `@livai/core/docs/pipeline-runbook.md`
   - Обновить пути: `security-pipeline.*` → `@livai/core/pipeline/*`
   - Оставить auth-специфичные конфигурации (`FORCE_RISK_V1`, etc.)
   - Добавить раздел "Использование в auth service"
2. Обновить `rollout-plan.md`:
   - Добавить ссылки на `@livai/core/docs/pipeline-rollout-plan.md`
   - Обновить пути на core компоненты
   - Оставить auth-специфичные конфигурации
   - Добавить раздел "Auth-specific configuration"

**Тесты:**

- Нет (документация)

**Зависимости:**

- `core/docs/pipeline-runbook.md`
- `core/docs/pipeline-rollout-plan.md`

**Чеклист после переноса документации:**

- [ ] Generic документация создана в core/docs/
- [ ] Auth документация обновлена в feature-auth/docs/
- [ ] Ссылки на core документацию добавлены
- [ ] Auth-специфичные конфигурации сохранены

---

## Этап 2: Обновление feature-auth

### Шаг 2.1: Удаление перенесенных файлов

**Файлы для удаления:**

1. `packages/feature-auth/src/lib/sanitizer.ts` ✅
2. `packages/feature-auth/src/domain/LocalRulesEngine.ts` ✅
3. `packages/feature-auth/src/domain/RiskValidation.ts` ✅
4. `packages/feature-auth/src/domain/ContextBuilders.ts` ✅ (переносится в domains/src/classification/context)
5. `packages/feature-auth/src/domain/PluginAppliers.ts` ✅ (НЕ переносится - заменяется на plugin-api.ts)
6. `packages/feature-auth/src/lib/security-pipeline/` (вся директория) ✅
7. `packages/feature-auth/src/effects/login/risk-rules.ts` ✅
8. `packages/feature-auth/src/effects/login/risk-scoring.ts` ✅
9. `packages/feature-auth/src/effects/login/risk-decision.ts` ✅
10. `packages/feature-auth/src/types/risk.ts` ✅

**Тесты для удаления:**

1. `packages/feature-auth/tests/unit/domain/LocalRulesEngine.test.ts` ✅
2. `packages/feature-auth/tests/unit/domain/RiskValidation.test.ts` ✅
3. `packages/feature-auth/tests/unit/domain/ContextBuilders.test.ts` ✅ (переносится в domains/tests/classification/context)
4. `packages/feature-auth/tests/unit/domain/PluginAppliers.test.ts` ✅ (НЕ переносится - заменяется на plugin-api тесты)
5. `packages/feature-auth/tests/unit/effects/login/risk-rules.test.ts` ✅
6. `packages/feature-auth/tests/unit/effects/login/risk-scoring.test.ts` ✅
7. `packages/feature-auth/tests/unit/effects/login/risk-decision.test.ts` ✅ (НЕ переносится - auth-семантика)
8. `packages/feature-auth/tests/unit/types/risk.test.ts` ✅
9. `packages/feature-auth/tests/unit/lib/security-pipeline/` (вся директория) ✅

---

### Шаг 2.2: Обновление оставшихся файлов

#### 2.2.1: Переименование risk-assessment.adapter.ts

**Исходный файл:**

- `packages/feature-auth/src/effects/login/risk-assessment.adapter.ts`

**Целевой файл:**

- `packages/feature-auth/src/effects/login/login-risk-assessment.adapter.ts`

**Действия:**

1. Переименовать файл
2. Обновить импорты на `@livai/core/input-boundary/projection-engine`
3. Использовать generic адаптер из core
4. Оставить auth-специфичную логику (LoginRiskAssessment DTO)
5. Обновить путь в комментариях

**Тесты:**

- Переименовать `packages/feature-auth/tests/unit/effects/login/risk-assessment.adapter.test.ts` → `login-risk-assessment.adapter.test.ts`
- Обновить импорты на core
- Обновить тесты для использования generic адаптера

---

#### 2.2.2: Обновление validation.ts

**Файл:**

- `packages/feature-auth/src/effects/login/validation.ts`

**Действия:**

1. Оставить файл без изменений (auth-специфичные type guards)
2. Обновить комментарии, если нужно

**Тесты:**

- Оставить `packages/feature-auth/tests/unit/effects/login/validation.test.ts` без изменений

---

#### 2.2.3: Переименование metadata-builders.ts

**Исходный файл:**

- `packages/feature-auth/src/effects/login/metadata-builders.ts`

**Целевой файл:**

- `packages/feature-auth/src/effects/login/login-metadata.enricher.ts`

**Действия:**

1. Переименовать файл
2. Реализовать интерфейс `ContextEnricher` из `@livai/core/input-boundary/context-enricher`
3. Обновить импорты на core типы
4. Обновить путь в комментариях

**Тесты:**

- Переименовать `packages/feature-auth/tests/unit/effects/login/metadata-builders.test.ts` → `login-metadata.enricher.test.ts`
- Обновить импорты на core
- Обновить тесты для проверки реализации интерфейса

---

#### 2.2.4: Создание classification-mapper.ts

**Целевой файл:**

- `packages/feature-auth/src/effects/login/classification-mapper.ts`

**Действия:**

1. Создать новый файл
2. Реализовать функцию `mapClassificationToAuthAction(label: ClassificationLabel): 'login' | 'mfa' | 'block'`
3. Импортировать `ClassificationLabel` из `@livai/domains/classification/labels`
4. Добавить документацию
5. **КРИТИЧНО:** Маппинг domain labels → auth actions (не Decision!)

**Тесты:**

- Создать `packages/feature-auth/tests/unit/effects/login/classification-mapper.test.ts`
- Тесты для всех вариантов ClassificationLabel → auth actions

---

#### 2.2.5: Обновление risk-assessment.ts

**Файл:**

- `packages/feature-auth/src/effects/login/risk-assessment.ts`

**Действия:**

1. Обновить импорты на `@livai/domains/classification/strategies/assessment`
2. Обновить импорты на `@livai/domains/classification/`
3. Использовать core компоненты вместо локальных
4. Обновить путь в комментариях

**Тесты:**

- Обновить `packages/feature-auth/tests/unit/effects/login/risk-assessment.test.ts`
- Обновить импорты на core
- Обновить моки для core компонентов

---

#### 2.2.6: Создание auth-risk.ts

**Целевой файл:**

- `packages/feature-auth/src/types/auth-risk.ts`

**Действия:**

1. Создать новый файл
2. Определить auth-специфичные расширения типов из core
3. Re-export типы из core с расширениями
4. Добавить auth-специфичные типы (если нужны)

**Тесты:**

- Создать `packages/feature-auth/tests/unit/types/auth-risk.test.ts`
- Тесты для auth-специфичных расширений

---

#### 2.2.7: Обновление security-pipeline.ts

**Файл:**

- `packages/feature-auth/src/lib/security-pipeline.ts`

**Действия:**

1. Обновить импорты на `@livai/core/pipeline`
2. Использовать core компоненты
3. Оставить auth-специфичную обертку (если нужна)
4. Обновить путь в комментариях

**Тесты:**

- Обновить тесты (если есть)
- Обновить импорты на core

---

#### 2.2.8: Обновление auth.ts

**Файл:**

- `packages/feature-auth/src/types/auth.ts`

**Действия:**

1. Обновить импорты на `@livai/core/domain-kit/evaluation-level` или `@livai/core/aggregation/scoring` (если используется)
2. Убрать локальные определения RiskLevel (использовать из core)
3. Обновить другие импорты при необходимости

**Тесты:**

- Обновить `packages/feature-auth/tests/unit/types/auth.test.ts`
- Обновить импорты на core

---

## Этап 3: Обновление зависимостей и экспортов

### Шаг 3.1: Обновление core/package.json

**Файл:**

- `packages/core/package.json`

**Действия:**

1. Добавить экспорты:

```json
{
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js",
      "default": "./dist/esm/index.js"
    },
    "./input-boundary": {
      "types": "./dist/esm/input-boundary/index.d.ts",
      "import": "./dist/esm/input-boundary/index.js",
      "default": "./dist/esm/input-boundary/index.js"
    },
    "./data-safety": {
      "types": "./dist/esm/data-safety/index.d.ts",
      "import": "./dist/esm/data-safety/index.js",
      "default": "./dist/esm/data-safety/index.js"
    },
    "./domain-kit": {
      "types": "./dist/esm/domain-kit/index.d.ts",
      "import": "./dist/esm/domain-kit/index.js",
      "default": "./dist/esm/domain-kit/index.js"
    },
    "./aggregation": {
      "types": "./dist/esm/aggregation/index.d.ts",
      "import": "./dist/esm/aggregation/index.js",
      "default": "./dist/esm/aggregation/index.js"
    },
    "./rule-engine": {
      "types": "./dist/esm/rule-engine/index.d.ts",
      "import": "./dist/esm/rule-engine/index.js",
      "default": "./dist/esm/rule-engine/index.js"
    },
    "./pipeline": {
      "types": "./dist/esm/pipeline/index.d.ts",
      "import": "./dist/esm/pipeline/index.js",
      "default": "./dist/esm/pipeline/index.js"
    },
    "./resilience": {
      "types": "./dist/esm/resilience/index.d.ts",
      "import": "./dist/esm/resilience/index.js",
      "default": "./dist/esm/resilience/index.js"
    }
  }
}
```

---

### Шаг 3.2: Создание index.ts файлов

**Файлы для создания:**

1. `packages/core/src/input-boundary/index.ts`
2. `packages/core/src/data-safety/index.ts`
3. `packages/core/src/domain-kit/index.ts`
4. `packages/core/src/aggregation/index.ts`
5. `packages/core/src/rule-engine/index.ts`
6. `packages/core/src/pipeline/index.ts`
7. `packages/core/src/resilience/index.ts`
8. `packages/domains/src/classification/index.ts`

**Действия для каждого:**

1. Создать файл
2. Добавить экспорты всех публичных API
3. Добавить документацию

---

### Шаг 3.3: Обновление core/src/index.ts

**Файл:**

- `packages/core/src/index.ts`

**Действия:**

1. Добавить экспорты из всех новых модулей:

```typescript
// Input Boundary (DTO Guards Only)
export * from './input-boundary/index.js';

// Data Safety (Taint Isolation Engine)
export * from './data-safety/index.js';

// Domain Kit (Decision Algebra)
export * from './domain-kit/index.js';

// Aggregation (Aggregation Semantics)
export * from './aggregation/index.js';

// Rule Engine (Pure Predicate Evaluator)
export * from './rule-engine/index.js';

// Pipeline (Universal Orchestration Runtime)
export * from './pipeline/index.js';

// Resilience (Reliability Primitives)
export * from './resilience/index.js';
```

---

### Шаг 3.4: Обновление feature-auth/package.json

**Файл:**

- `packages/feature-auth/package.json`

**Действия:**

1. Добавить зависимость на `@livai/core` (если еще нет)
2. Добавить зависимость на `@livai/domains/classification` (если еще нет)
3. Обновить версию зависимостей при необходимости

**Чеклист после обновления зависимостей:**

- [ ] package.json обновлены (core, feature-auth)
- [ ] Экспорты настроены в core/package.json
- [ ] index.ts файлы созданы
- [ ] TypeScript компилируется без ошибок
- [ ] Нет циклических зависимостей

---

## Этап 4: Тестирование

### Шаг 4.0: Интеграционный smoke-test (до полной миграции)

**КРИТИЧНО:** Сделать быстрый интеграционный smoke-test на feature-auth с core перед полной миграцией всех тестов!

**Действия:**

1. Создать минимальный smoke-test:
   - Файл: `packages/feature-auth/tests/integration/smoke-core.test.ts`
   - Тест: базовое использование core компонентов из feature-auth
   - Тест: проверка импортов из `@livai/core/`
   - Тест: проверка импортов из `@livai/domains/classification/`
2. Проверить базовые сценарии:
   - Создание context через domain-kit
   - Выполнение простого rule через rule-engine
   - Использование aggregation для scoring
   - Выполнение pipeline с одним plugin
3. Запустить smoke-test:
   ```bash
   cd packages/feature-auth && pnpm test tests/integration/smoke-core.test.ts
   ```
4. Если smoke-test проходит → продолжить полную миграцию
5. Если smoke-test не проходит → исправить проблемы до полной миграции

**Чеклист:**

- [ ] Smoke-test создан
- [ ] Базовые импорты работают
- [ ] Минимальный сценарий выполняется
- [ ] Нет критичных ошибок интеграции

**Зависимости:**

- Этапы 1.1-1.9 должны быть завершены
- Этап 2 (обновление feature-auth) должен быть частично выполнен

---

### Шаг 4.1: Тестирование core

**Действия:**

1. Запустить `pnpm test` в `packages/core`
2. Проверить, что все тесты проходят
3. Проверить coverage
4. Исправить ошибки импортов
5. Исправить ошибки типов

---

### Шаг 4.2: Тестирование feature-auth

**Действия:**

1. Запустить `pnpm test` в `packages/feature-auth`
2. Проверить, что все тесты проходят
3. Проверить coverage
4. Исправить ошибки импортов
5. Исправить ошибки типов

---

### Шаг 4.3: Интеграционное тестирование

**Действия:**

1. Запустить интеграционные тесты
2. Проверить работу feature-auth с core компонентами
3. **Добавить integration тест для domains/src/classification:**
   - Файл: `packages/domains/tests/classification/integration/end-to-end.test.ts`
   - Тест: end-to-end flow через pipeline, strategies и aggregation
   - Проверить полный цикл: signals → strategies → aggregation → evaluation-result
4. Исправить ошибки интеграции

---

## Этап 5: Обновление README и архитектурной документации

**Примечание:** Операционная документация (runbook, rollout plan) уже перенесена на Этапе 1.8.

### Шаг 5.1: Обновление core/README.md

**Действия:**

1. Обновить описание пакета
2. Добавить описание новых модулей:
   - input-boundary (DTO guards only)
   - data-safety (bidirectional boundary guard)
   - domain-kit (decision algebra: EvaluationLevel, Confidence, Label<T>)
   - aggregation (aggregation semantics: reducer, weight, scoring)
   - rule-engine (pure predicate evaluator)
   - pipeline (dependency-driven execution engine)
   - resilience (reliability primitives)
3. Добавить примеры использования
4. Добавить ссылки на документацию в `core/docs/`
5. Обновить архитектурную документацию

---

### Шаг 5.2: Обновление feature-auth/README.md

**Действия:**

1. Обновить описание зависимостей от core
2. Обновить примеры использования
3. Указать, что некоторые компоненты перенесены в core
4. Добавить ссылки на core документацию

---

### Шаг 5.3: Обновление архитектурной документации

**Действия:**

1. Обновить `docs/phase2-UI.md` (если нужно)
2. Создать/обновить документацию по архитектуре core
3. **Добавить диаграмму зависимостей:**
   ```
   core → domains/src/classification → feature-auth
   ```
   - Визуализировать зависимости между модулями
   - Показать, какие компоненты core использует каждый domain
   - Показать, какие компоненты использует feature-auth
4. **Добавить визуализацию DAG (slot graph) для pipeline:**
   - Показать пример графа зависимостей между plugins
   - Показать fan-out и fan-in сценарии
   - Показать порядок выполнения stages

**Чеклист после обновления документации:**

- [ ] README core обновлен
- [ ] README feature-auth обновлен
- [ ] Архитектурная документация обновлена
- [ ] Диаграммы зависимостей добавлены
- [ ] Примеры использования обновлены

---

## Чеклист завершения

- [ ] Все файлы перенесены в core
- [ ] Все тесты перенесены и обновлены
- [ ] Все импорты обновлены
- [ ] Все переименования выполнены
- [ ] Все экспорты настроены
- [ ] Generic документация создана в core/docs/
- [ ] Auth документация обновлена в feature-auth/docs/
- [ ] Тесты core проходят
- [ ] Тесты feature-auth проходят
- [ ] Интеграционные тесты проходят
- [ ] README обновлены
- [ ] package.json обновлены
- [ ] Нет циклических зависимостей
- [ ] Нет неиспользуемых импортов
- [ ] Линтер проходит без ошибок
- [ ] TypeScript компилируется без ошибок

---

## Порядок выполнения (рекомендуемый)

1. **Этап 1.1**: Создать структуру core и domains
2. **Этап 1.2**: Перенести sanitizer в data-safety (bidirectional boundary guard)
3. **Этап 1.3**: Создать input-boundary (DTO guards only)
4. **Этап 1.4**: Создать domain-kit (decision algebra: EvaluationLevel, Confidence, Label<T>)
5. **Этап 1.5**: Создать aggregation (aggregation semantics: reducer, weight, scoring) - НЕ зависит от domain labels
   - **ВАЖНО:** Aggregation должен быть ДО rule-engine, так как не зависит от него
6. **Этап 1.6**: Создать rule-engine (pure predicate evaluator)
   - **ВАЖНО:** Rule-engine должен быть ДО domains/src/classification, так как strategies используют rule-engine
7. **Этап 1.7**: Создать domains/src/classification (domain implementation с labels)
   - **ВАЖНО:** Зависит от rule-engine (шаг 1.6) и aggregation (шаг 1.5)
8. **Этап 1.8**: Создать pipeline (dependency-driven execution engine)
   - **ВАЖНО:** Зависит от rule-engine (для plugin API)
9. **Этап 1.9**: Перенести resilience
10. **Этап 1.10**: Перенести документацию (generic в core, обновить auth)
11. **Этап 3**: Обновить экспорты и зависимости
12. **Этап 2**: Обновить feature-auth (classification-mapper вместо decision-mapper)
    - **ВАЖНО:** Зависит от core и @livai/domains-classification
13. **Этап 4**: Тестирование
14. **Этап 5**: Обновление README и архитектурной документации

---

## Критичные моменты

1. **Не создавать циклические зависимости**: core не должен зависеть от feature-auth
2. **Generic типы**: Все типы в core должны быть generic, без auth-специфичных зависимостей
3. **КРИТИЧНО - Decision НЕ в core**: Core предоставляет decision algebra (EvaluationLevel, Confidence, Label<T>). Domain объявляет свои labels. Decision (ALLOW/CHALLENGE/DENY) = auth-семантика, остается в feature-auth
4. **Pipeline = universal runtime**: Pipeline работает с slot graph (не domain state). Classification-специфичная логика в domains/src/classification/
5. **Rule-engine = policy-agnostic**: Rule-engine не знает про classification. Classification-специфичная стратегия в domains/src/classification/strategies
6. **Context-builders = pure functions**: Без IO/async/conditions. Если требуют IO/async → автоматически переделать в StagePlugin
7. **Aggregation НЕ зависит от domain labels**: Generic reducers и weights работают только с generic math, не знают про SAFE/SUSPICIOUS/etc
8. **Plugins = dependency-driven API**: Plugin API в pipeline (StagePlugin с provides/dependsOn), implementations в domains
9. **Data-safety = bidirectional boundary**: taint-source, taint-sink, taint-propagation (не только input-side)
10. **Classification-domain**: Первая domain-implementation, объявляет свои labels, не в core
11. **Тесты первыми**: При переносе файлов сразу переносить и обновлять тесты
12. **Постепенная миграция**: Выполнять по этапам, проверяя после каждого этапа
13. **Сохранение функциональности**: После миграции функциональность должна остаться той же

---

## Итоговая структура

```
core/                              ← Universal Decision Computing Platform
 ├─ input-boundary/                ← DTO guards only
 │    ├─ projection-engine.ts
 │    ├─ generic-validation.ts
 │    └─ context-enricher.ts
 │
 ├─ data-safety/                   ← bidirectional boundary guard
 │    ├─ taint.ts
 │    ├─ taint-source.ts            ← external → trusted
 │    ├─ taint-sink.ts              ← trusted → plugins
 │    ├─ taint-propagation.ts       ← plugins → policies
 │    ├─ structural-clone.ts
 │    ├─ trust-level.ts
 │    └─ sanitization-mode.ts
 │
 ├─ domain-kit/                    ← decision algebra (не конкретные enums!)
 │    ├─ evaluation-level.ts        ← number (0..N)
 │    ├─ confidence.ts              ← number (0..1)
 │    └─ label.ts                   ← Label<T extends string>
 │
 ├─ aggregation/                   ← aggregation semantics (не в rule-engine!)
 │    ├─ reducer.ts
 │    ├─ weight.ts
 │    └─ scoring.ts
 │
 ├─ rule-engine/                   ← pure predicate evaluator
 │    ├─ predicate.ts
 │    ├─ rule.ts
 │    └─ evaluator.ts
 │
 ├─ pipeline/                      ← dependency-driven execution engine
 │    ├─ plugin-api.ts             ← StagePlugin с provides/dependsOn (не chain!)
 │    ├─ engine.ts                 ← управляет порядком, fan-out, fan-in, cancellation
 │    ├─ facade.ts
 │    ├─ adapter.ts
 │    ├─ errors.ts
 │    ├─ feature-flags.ts
 │    ├─ runtime-overrides.ts
 │    ├─ safety-guard.ts
 │    └─ replay.ts
 │
 └─ resilience/                    ← reliability primitives
      ├─ circuit-breaker.ts
      ├─ metrics.ts
      └─ performance-limits.ts

domains/                           ← domain implementations
 └─ classification/                 ← первая domain-implementation
      ├─ labels.ts                  ← объявляет SAFE/SUSPICIOUS/DANGEROUS/UNKNOWN
      ├─ signals/
      │    ├─ signals.ts
      │    └─ violations.ts
      ├─ providers/
      │    └─ remote.provider.ts   ← реализует StagePlugin с provides/dependsOn
      ├─ strategies/
      │    ├─ deterministic.strategy.ts
      │    ├─ rules.ts
      │    ├─ assessment.ts
      │    └─ validation.ts
      ├─ aggregation/               ← использует core/aggregation
      │    └─ scoring.ts
      ├─ policies/
      │    ├─ base.policy.ts
      │    └─ aggregation.policy.ts
      ├─ evaluation/
      │    └─ result.ts
      └─ context/
           └─ context-builders.ts   ← pure functions (без IO/async/conditions)

features/
 └─ feature-auth/
      └─ maps classification → auth actions (login/mfa/block)
```

**Ключевые принципы:**

- ✅ Core = Universal Decision Computing Platform (не Risk Engine SDK, не Classification Framework)
- ✅ Domain-kit = decision algebra (EvaluationLevel, Confidence, Label<T>), НЕ конкретные enums
- ✅ Classification labels объявляются в domains/src/classification/labels.ts
- ✅ Pipeline = dependency-driven execution (provides/dependsOn), не middleware chain
- ✅ Rule-engine = pure predicate evaluator (без aggregation!)
- ✅ Aggregation = отдельный модуль (reducer, weight, scoring)
- ✅ Data-safety = bidirectional boundary guard (taint-source, taint-sink, propagation)
- ✅ Context-builders = pure functions (без IO/async/conditions) или plugins
- ✅ Plugins = dependency-driven API (StagePlugin с provides/dependsOn)

---

## Архитектурная схема

```
┌─────────────────────────────────────────────────────────────┐
│                    CORE (Platform Layer)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ input-boundary│  │  data-safety  │  │  domain-kit   │     │
│  │ (DTO guards)  │  │ (taint track) │  │ (algebra)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  aggregation  │  │ rule-engine   │  │   pipeline    │     │
│  │  (generic)    │  │ (predicates)  │  │ (orchestr.)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐                                          │
│  │  resilience   │                                          │
│  │ (circuit-br.) │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│              DOMAINS (Domain Implementations)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  domains/src/classification/                           │   │
│  │    ├─ labels.ts (SAFE/SUSPICIOUS/DANGEROUS/UNKNOWN) │   │
│  │    ├─ signals/ (ClassificationSignals)                │   │
│  │    ├─ strategies/ (uses core/rule-engine)            │   │
│  │    ├─ aggregation/ (uses core/aggregation)           │   │
│  │    ├─ providers/ (implements StagePlugin)           │   │
│  │    └─ context/ (pure functions)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│              FEATURES (Feature-Specific Logic)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  feature-auth/                                        │   │
│  │    └─ maps ClassificationLabel → auth actions        │   │
│  │        (login/mfa/block)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Принцип зависимостей:**

- Core НЕ зависит от domains или features
- Domains зависят только от core
- Features зависят от core и domains
