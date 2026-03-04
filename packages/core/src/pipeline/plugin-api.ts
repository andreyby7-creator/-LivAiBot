/**
 * @file packages/core/src/pipeline/plugin-api.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Plugin API)
 * ============================================================================
 * Архитектурная роль:
 * - Generic dependency-driven execution engine API для композиции стадий pipeline
 * - Автоматическое определение порядка выполнения на основе provides/dependsOn
 * - Причина изменения: dependency-driven execution, не middleware chain
 * Принципы:
 * - ✅ SRP: разделение на TYPES, INTERNAL (validation helpers), FACTORY HELPERS, API
 * - ✅ Deterministic: pure functions, immutable execution plan (executionIndex, executionPlanVersion)
 * - ✅ Domain-pure: generic по TSlotMap (определяется domain), tuple type для provides (compile-time enforcement)
 * - ✅ Extensible: factory helpers (defineStage, defineFallback) для улучшенного type inference
 * - ✅ Strict typing: union-типы для StageFailureReason, generic по TSlotMap и TProvides, tuple type для provides
 * - ✅ Microservice-ready: stateless, без скрытого coupling, AbortSignal для cancellation
 * - ✅ Scalable: поддержка fan-out/fan-in, lazy evaluation, partial recompute через конфигурацию
 * - ✅ Reliability: compile-time provides/slots enforcement, runtime validation (duplicate providers, unknown slots)
 * - ✅ Isolation: каждый plugin работает только со своими declared provides, fallback isolation (side-effect only)
 * - ✅ Recovery: onError hook может вернуть StageResult для восстановления выполнения
 * ⚠️ ВАЖНО:
 * - ❌ НЕ middleware chain (порядок определяется зависимостями, не порядком регистрации)
 * - ❌ НЕ включает domain-специфичные значения (TSlotMap определяется domain layer)
 * - ⚠️ Execution engine (топологическая сортировка, DAG validation) в pipeline-engine.ts
 * - ⚠️ Scalability (reverse dependency index, memoization) относится к engine, не к API
 */

/* ============================================================================
 * 1. TYPES — PLUGIN API MODEL (Pure Type Definitions)
 * ============================================================================
 */

export type StageId = string & { readonly __brand: 'StageId'; };
export type SlotId = string & { readonly __brand: 'SlotId'; };

/**
 * Контекст выполнения стадии pipeline
 * @template TSlotMap - Тип slot map для pipeline (определяется domain)
 * @note Архитектурный компромисс: slots — Partial<TSlotMap>.
 *       Движок времени выполнения гарантирует наличие слотов dependsOn, но гарантия
 *       времени компиляции не реализована (потребовало бы StageContext<TSlotMap, TDependsOn>).
 * @public
 */
export type StageContext<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  /** Текущие слоты данных (readonly, не мутируется) */
  readonly slots: Readonly<Partial<TSlotMap>>;
  /** Метаинформация о выполнении стадии */
  readonly metadata: StageMetadata;
  /** AbortSignal для enforceable cancellation (опционально) */
  readonly abortSignal?: AbortSignal;
}>;

/**
 * Метаинформация о выполнении стадии
 * @public
 */
export type StageMetadata = Readonly<{
  /** Идентификатор стадии (для логирования и отладки) */
  readonly stageId: string;
  /** Индекс выполнения стадии в текущем execution plan (0-based) */
  readonly executionIndex: number;
  /** Версия execution plan (для валидации при partial recompute) */
  readonly executionPlanVersion: string;
  /** Время начала выполнения (timestamp в миллисекундах) */
  readonly startTime: number;
  /** Флаг отмены выполнения */
  readonly cancelled: boolean;
}>;

/**
 * Интерфейс стадии pipeline (плагин, управляемый зависимостями)
 * @template TSlotMap - Тип slot map для pipeline (определяется domain)
 * @template TProvides - Слоты, которые предоставляет эта стадия (tuple для принудительного контроля времени компиляции)
 * @note Pipeline автоматически определяет порядок выполнения на основе provides/dependsOn
 * @public
 */
export interface StagePlugin<
  TSlotMap extends Readonly<Record<string, unknown>>,
  TProvides extends readonly (keyof TSlotMap)[] = readonly (keyof TSlotMap)[],
> {
  /** Явный идентификатор стадии (опционально). Если не задан, planner использует структурный hash fallback. */
  readonly id?: StageId;

  /** Слоты, которые предоставляет эта стадия (execution engine валидирует отсутствие дубликатов) */
  readonly provides: TProvides;

  /** Слоты, от которых зависит эта стадия (опционально, runtime engine гарантирует наличие) */
  readonly dependsOn?: readonly (keyof TSlotMap)[];

  /**
   * Выполнение стадии pipeline (pure function, детерминированная, без side-effects)
   * @note Должен возвращать только слоты, объявленные в provides (compile-time enforced)
   */
  run(
    ctx: StageContext<TSlotMap>, // Контекст выполнения стадии
  ): Promise<StageResult<TSlotMap, TProvides>>; // Результат выполнения (effect-based, может быть ошибка)

  /**
   * Обработчик ошибок (опционально)
   * @note Возврат StageResult восстанавливает выполнение, void — пробрасывает ошибку
   */
  onError?: (
    error: StageError, // Ошибка выполнения стадии
    ctx: StageContext<TSlotMap>, // Контекст выполнения стадии
  ) => StageResult<TSlotMap, TProvides> | void; // StageResult для recovery или void для логирования
}

/**
 * Результат выполнения стадии (алгебраический контракт на основе эффектов)
 * @template TSlotMap - Тип slot map для pipeline
 * @template TProvides - Слоты, которые предоставляет стадия (tuple для принудительного контроля времени компиляции)
 * @note Строгая типизация: slots должны соответствовать объявленным provides
 * @public
 */
export type StageResult<
  TSlotMap extends Readonly<Record<string, unknown>>,
  TProvides extends readonly (keyof TSlotMap)[] = readonly (keyof TSlotMap)[],
> =
  | Readonly<{ ok: true; slots: Readonly<Pick<TSlotMap, TProvides[number]>>; }>
  | Readonly<{ ok: false; reason: StageFailureReason; }>;

/**
 * Причина ошибки выполнения стадии
 * @note Union-тип для строгой типизации (без строковых литералов в domain)
 * @public
 */
export type StageFailureReason =
  | Readonly<{ kind: 'MISSING_DEPENDENCY'; slot: string; }>
  | Readonly<{ kind: 'INVALID_SLOT'; slot: string; value: unknown; }>
  | Readonly<{ kind: 'SLOT_MISMATCH'; declared: readonly string[]; returned: readonly string[]; }>
  | Readonly<{ kind: 'EXECUTION_ERROR'; error: Error; }>
  | Readonly<{ kind: 'ISOLATION_ERROR'; error: Error; }>
  | Readonly<{ kind: 'CANCELLED'; }>
  | Readonly<{ kind: 'TIMEOUT'; timeoutMs: number; }>
  | Readonly<{ kind: 'CIRCULAR_DEPENDENCY'; path: readonly string[]; }>
  | Readonly<{ kind: 'INVALID_PLUGIN'; reason: string; }>;

/**
 * Ошибка выполнения стадии
 * @note Обертка над StageFailureReason для удобства обработки
 * @public
 */
export type StageError = Readonly<{
  /** Причина ошибки */
  readonly reason: StageFailureReason;
  /** Идентификатор стадии, в которой произошла ошибка */
  readonly stageId: string;
  /** Время ошибки (timestamp в миллисекундах) */
  readonly timestamp: number;
}>;

/**
 * Fallback стадия для глобальных ошибок (только побочные эффекты, не предоставляет слоты)
 * @template TSlotMap - Тип slot map для pipeline
 * @public
 */
export type FallbackStage<TSlotMap extends Readonly<Record<string, unknown>>> =
  & StagePlugin<
    TSlotMap,
    readonly never[]
  >
  & Readonly<{
    /** Маркер fallback стадии для engine enforcement */
    readonly isFallback: true;
  }>;

/**
 * Конфигурация pipeline
 * @template TSlotMap - Тип slot map для pipeline
 * @note Generic по TSlotMap для типобезопасности
 * @public
 */
export type PipelineConfig<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  /** Инъекция источника времени для детерминированного тестирования (по умолчанию Date.now) */
  readonly now?: () => number;
  /** Максимальное время выполнения pipeline (в миллисекундах) */
  readonly maxExecutionTimeMs?: number;
  /** Максимальное количество стадий (защита от DoS) */
  readonly maxStages?: number;
  /** Максимальное количество зависимостей (защита от DoS) */
  readonly maxDependencies?: number;
  /** Максимальная глубина графа зависимостей */
  readonly maxDepth?: number;
  /** Максимальное количество исходящих рёбер для стадии */
  readonly maxFanOut?: number;
  /** Максимальное количество входящих рёбер для стадии */
  readonly maxFanIn?: number;
  /** Разрешить параллельное выполнение независимых стадий (fan-out) */
  readonly allowParallelExecution?: boolean;
  /** Разрешить lazy evaluation (стадии выполняются только при необходимости) */
  readonly allowLazyEvaluation?: boolean;
  /** Разрешить partial recompute (пересчет только зависимых стадий) */
  readonly allowPartialRecompute?: boolean;
  /** Fallback стадия для глобальных ошибок (опционально, side-effect only) */
  readonly fallbackStage?: FallbackStage<TSlotMap>;
  /** AbortSignal для enforceable cancellation (опционально) */
  readonly abortSignal?: AbortSignal;
  /** Строгая валидация слотов: проверять, что стадия возвращает только declared provides (runtime validation) */
  readonly strictSlotCheck?: boolean;
  /** Максимальное количество параллельных стадий в одном уровне (throttling для больших уровней) */
  readonly maxParallelStages?: number;
  /** @internal Type marker для типобезопасности */
  readonly _typeMarker?: Readonly<{
    readonly slotMap?: TSlotMap;
  }>;
}>;

/**
 * Результат выполнения pipeline (на основе эффектов)
 * @template TSlotMap - Тип slot map для pipeline
 * @public
 */
export type PipelineResult<TSlotMap extends Readonly<Record<string, unknown>>> =
  | Readonly<{ ok: true; slots: Readonly<Partial<TSlotMap>>; executionOrder: readonly string[]; }>
  | Readonly<{ ok: false; reason: PipelineFailureReason; }>;

/**
 * Причина ошибки выполнения pipeline
 * @note Union-тип для строгой типизации
 * @public
 */
export type PipelineFailureReason =
  | Readonly<{ kind: 'NO_PLUGINS'; }>
  | Readonly<{ kind: 'DUPLICATE_PROVIDERS'; slot: string; stageIds: readonly string[]; }>
  | Readonly<{ kind: 'UNKNOWN_SLOT'; slot: string; stageId: string; }>
  | Readonly<{ kind: 'CIRCULAR_DEPENDENCY'; path: readonly string[]; }>
  | Readonly<{ kind: 'MISSING_REQUIRED_SLOT'; slot: string; }>
  | Readonly<{ kind: 'EXECUTION_TIMEOUT'; timeoutMs: number; }>
  | Readonly<{ kind: 'STAGE_FAILED'; stageId: string; reason: StageFailureReason; }>
  | Readonly<{ kind: 'INVALID_CONFIG'; reason: string; }>
  | Readonly<{ kind: 'INVALID_EXECUTION_PLAN'; reason: string; }>;

/* ============================================================================
 * 2. PLAN BUILDING TYPES — SIMPLIFIED TYPES FOR EXECUTION PLAN BUILDING
 * ============================================================================
 */

/** Контракт стадии pipeline для построения плана выполнения (упрощенный, без методов выполнения). */
export type PlanStagePlugin<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly provides: readonly (keyof TSlotMap)[];
  readonly dependsOn?: readonly (keyof TSlotMap)[];
}>;

/** Опциональная fallback стадия для построения плана выполнения. */
export type PlanFallbackStage<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly provides: readonly (keyof TSlotMap)[];
}>;

/** Конфигурация конструктора pipeline для построения плана выполнения. */
export type PlanPipelineConfig<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly maxStages?: number;
  readonly maxDependencies?: number;
  readonly fallbackStage?: PlanFallbackStage<TSlotMap>;
}>;

/** Внутренний помощник для валидации массива слотов: непустой (по умолчанию), непустые имена, уникальные записи. */
function isValidSlotArray(slots: unknown, allowEmpty = false): slots is readonly unknown[] {
  if (!Array.isArray(slots)) {
    return false;
  }

  if (!allowEmpty && slots.length === 0) {
    return false;
  }

  const normalizedSlots = slots.map((slot) => String(slot));
  if (normalizedSlots.some((slot) => slot.length === 0)) {
    return false;
  }

  return new Set(normalizedSlots).size === normalizedSlots.length;
}

/** Структурная валидация времени выполнения для ввода плагина плана. */
export function validatePlanPlugin<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: unknown,
): plugin is PlanStagePlugin<TSlotMap> {
  if (typeof plugin !== 'object' || plugin === null) {
    return false;
  }

  const candidate = plugin as { provides?: unknown; dependsOn?: unknown; };
  if (!isValidSlotArray(candidate.provides)) {
    return false;
  }

  if (candidate.dependsOn !== undefined && !isValidSlotArray(candidate.dependsOn, true)) {
    return false;
  }

  return true;
}

/* ============================================================================
 * 3. INTERNAL — VALIDATION HELPERS
 * ============================================================================
 */

/**
 * Валидация плагина (проверка структуры и типов)
 * @note НЕ предназначен для fallback стадий (provides: []). Fallback валидируется отдельно.
 * @internal
 */
export function validatePlugin<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: unknown, // Plugin для валидации
): plugin is StagePlugin<TSlotMap> { // Type guard для StagePlugin
  if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) {
    return false;
  }

  const obj = plugin as Record<string, unknown>;

  if (
    !('provides' in obj)
    || !('run' in obj)
    || !Array.isArray(obj['provides'])
    || obj['provides'].length === 0
    || typeof obj['run'] !== 'function'
  ) {
    return false;
  }

  // Fallback стадии (provides: []) не проходят эту проверку — это ожидаемо
  if (
    ('dependsOn' in obj && obj['dependsOn'] !== undefined && !Array.isArray(obj['dependsOn']))
    || ('onError' in obj && obj['onError'] !== undefined && typeof obj['onError'] !== 'function')
  ) {
    return false;
  }

  return true;
}

/**
 * Валидация опционального числового поля (положительное число)
 * @internal
 */
function validateOptionalNumber(
  obj: Record<string, unknown>, // Объект для валидации
  key: string, // Ключ поля для валидации
): boolean { // true если поле валидно или отсутствует
  const value = obj[key];
  return value === undefined || (typeof value === 'number' && value > 0);
}

/**
 * Валидация опционального boolean поля
 * @internal
 */
function validateOptionalBoolean(
  obj: Record<string, unknown>, // Объект для валидации
  key: string, // Ключ поля для валидации
): boolean { // true если поле валидно или отсутствует
  const value = obj[key];
  return value === undefined || typeof value === 'boolean';
}

/**
 * Валидация опционального function поля
 * @internal
 */
function validateOptionalFunction(
  obj: Record<string, unknown>, // Объект для валидации
  key: string, // Ключ поля для валидации
): boolean { // true если поле валидно или отсутствует
  const value = obj[key];
  return value === undefined || typeof value === 'function';
}

/**
 * Валидация fallback стадии
 * @internal
 */
function validateFallbackStage(
  fallback: unknown, // Fallback стадия для валидации
): boolean { // true если fallback стадия валидна
  if (typeof fallback !== 'object' || fallback === null || Array.isArray(fallback)) {
    return false;
  }
  const fb = fallback as Record<string, unknown>;
  // Fallback должен иметь структуру plugin, но с provides: [] (validatePlugin не пропустит это)
  // Поэтому проверяем структуру напрямую
  return (
    'provides' in fb
    && 'run' in fb
    && Array.isArray(fb['provides'])
    && fb['provides'].length === 0
    && typeof fb['run'] === 'function'
    && fb['isFallback'] === true
    && ('dependsOn' in fb
      ? (fb['dependsOn'] === undefined || Array.isArray(fb['dependsOn']))
      : true)
    && ('onError' in fb
      ? (fb['onError'] === undefined || typeof fb['onError'] === 'function')
      : true)
  );
}

/**
 * Валидация конфигурации pipeline
 * @internal
 */
export function validatePipelineConfig<TSlotMap extends Readonly<Record<string, unknown>>>(
  config: unknown, // Конфигурация pipeline для валидации
): config is PipelineConfig<TSlotMap> { // Type guard для PipelineConfig
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return false;
  }

  const obj = config as Record<string, unknown>;

  // Валидация опциональных полей
  if (
    !validateOptionalFunction(obj, 'now') // clock injection for deterministic tests
    || !validateOptionalNumber(obj, 'maxExecutionTimeMs') // положительное число (мс)
    || !validateOptionalNumber(obj, 'maxStages') // положительное число (DoS protection)
    || !validateOptionalNumber(obj, 'maxDependencies') // положительное число (DoS protection)
    || !validateOptionalNumber(obj, 'maxDepth') // положительное число (ограничение глубины DAG)
    || !validateOptionalNumber(obj, 'maxFanOut') // положительное число (ограничение fan-out)
    || !validateOptionalNumber(obj, 'maxFanIn') // положительное число (ограничение fan-in)
    || !validateOptionalNumber(obj, 'maxParallelStages') // положительное число (throttling для больших уровней)
    || !validateOptionalBoolean(obj, 'allowParallelExecution') // fan-out/fan-in
    || !validateOptionalBoolean(obj, 'allowLazyEvaluation') // lazy stages
    || !validateOptionalBoolean(obj, 'allowPartialRecompute') // incremental recompute
    || !validateOptionalBoolean(obj, 'strictSlotCheck') // строгая валидация слотов (runtime validation)
  ) {
    return false;
  }

  // Валидация abortSignal (опционально, но если есть — должен быть экземпляром AbortSignal)
  if (
    'abortSignal' in obj
    && obj['abortSignal'] !== undefined
    && !(obj['abortSignal'] instanceof AbortSignal)
  ) {
    return false;
  }

  // Валидация fallbackStage
  if (
    'fallbackStage' in obj
    && obj['fallbackStage'] !== undefined
    && !validateFallbackStage(obj['fallbackStage'])
  ) {
    return false;
  }

  return true;
}

/* ============================================================================
 * 3. FACTORY HELPERS — УЛУЧШЕННЫЙ TYPE INFERENCE
 * ============================================================================
 */

/**
 * Factory helper для создания стадии с улучшенным выводом типов
 * @template TSlotMap - Тип slot map для pipeline
 * @template const TProvides - Слоты, которые предоставляет стадия (const tuple)
 * @note Гарантирует tuple type для provides (не массив) через const assertion
 * @public
 */
export function defineStage<
  TSlotMap extends Readonly<Record<string, unknown>>,
>() {
  return function<const TProvides extends readonly (keyof TSlotMap)[]>(
    plugin: StagePlugin<TSlotMap, TProvides>, // Plugin для создания стадии
  ): StagePlugin<TSlotMap, TProvides> { // StagePlugin с улучшенным type inference
    return plugin;
  };
}

/**
 * Factory helper для создания fallback стадии (только побочные эффекты, не предоставляет слоты)
 * @template TSlotMap - Тип slot map для pipeline
 * @public
 */
export function defineFallback<
  TSlotMap extends Readonly<Record<string, unknown>>,
>() {
  return function(
    plugin: Omit<StagePlugin<TSlotMap, readonly never[]>, 'isFallback'>, // Plugin без isFallback маркера
  ): FallbackStage<TSlotMap> { // Fallback стадия с isFallback маркером
    return {
      ...plugin,
      isFallback: true as const,
    };
  };
}

/* ============================================================================
 * 4. EXAMPLES — ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
 * ============================================================================
 */

/**
 * @example Пример использования для domain-пайплайна
 * ```typescript
 * type RiskPipelineSlotMap = {
 *   readonly device: DeviceInfo;
 *   readonly requestContext: RequestContext;
 *   readonly rulesConfig: RulesConfig;
 *   readonly riskScore?: number;
 *   readonly scoringContext?: ScoringContext;
 *   readonly ruleContext?: RuleEvaluationContext;
 *   readonly ruleEvaluationResult?: RuleEvaluationResult;
 * };
 * const scoringPlugin = defineStage<RiskPipelineSlotMap>()({
 *   provides: ['scoringContext', 'riskScore'], // автоматически as const
 *   dependsOn: ['device', 'requestContext', 'rulesConfig'],
 *   async run(ctx) {
 *     if (ctx.abortSignal?.aborted) return { ok: false, reason: { kind: 'CANCELLED' } };
 *     const { device, requestContext, rulesConfig } = ctx.slots;
 *     const scoringContext = buildScoringContext({ device, requestContext, rulesConfig });
 *     const riskScore = calculateRiskScore(scoringContext.scoringContext);
 *     return { ok: true, slots: { scoringContext: scoringContext.scoringContext, riskScore } };
 *   },
 *   onError(error, ctx) {
 *     // Recovery: может вернуть StageResult для восстановления
 *     console.error(`Scoring failed: ${error.reason.kind}`, ctx.metadata.stageId);
 *   }
 * });
 * const rulePlugin = defineStage<RiskPipelineSlotMap>()({
 *   provides: ['ruleContext', 'ruleEvaluationResult'],
 *   dependsOn: ['device', 'requestContext', 'riskScore'],
 *   async run(ctx) {
 *     if (ctx.abortSignal?.aborted) return { ok: false, reason: { kind: 'CANCELLED' } };
 *     const { device, requestContext, riskScore } = ctx.slots;
 *     const ruleContext = buildRuleContext({ device, requestContext, riskScore });
 *     const result = evaluateRules(ruleContext.ruleContext);
 *     return { ok: true, slots: { ruleContext: ruleContext.ruleContext, ruleEvaluationResult: result } };
 *   }
 * });
 * const fallback = defineFallback<RiskPipelineSlotMap>()({
 *   provides: [] as const,
 *   async run(ctx) {
 *     console.error('Pipeline failed', ctx.metadata.stageId);
 *     return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
 *   }
 * });
 * ```
 */
