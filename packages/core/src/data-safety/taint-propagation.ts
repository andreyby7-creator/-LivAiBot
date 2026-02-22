/**
 * @file packages/core/src/data-safety/taint-propagation.ts
 * ============================================================================
 * 🛡️ CORE — Data Safety (Taint Propagation)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Отслеживание распространения taint через плагины и применение политик
 * - Plugins → Policies через rule-engine для контроля распространения taint
 * - Причина изменения: data safety, taint isolation, formal IFC (Information Flow Control)
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, HELPERS, API (decision engine отделен от data transformation)
 * - ✅ Deterministic: одинаковые входы → одинаковые решения (monotonic), TOCTOU-safe через snapshot
 * - ✅ Domain-pure: generic по типам значений, без привязки к domain-специфичным типам
 * - ✅ Extensible: PropagationRule для расширения политик без изменения core логики
 * - ✅ Strict typing: union types для PropagationOperation, PropagationDecision, PropagationFailureReason
 * - ✅ Microservice-ready: stateless, immutable registry, thread-safe после build()
 * - ✅ Security: Formal IFC (propagation = invariants_passed AND policies_allow), non-amplification, fail-closed
 * - ✅ Effect-based: core возвращает Outcome для composability, boundary может бросать исключения
 *
 * ⚠️ ВАЖНО:
 * - Formal IFC: propagation = invariants_passed AND policies_allow (не OR!)
 * - TOCTOU-safe: фиксированный snapshot правил для time-of-check semantics
 * - Non-amplification: объединенный taint не может быть выше исходных уровней
 * - Policy downgrade: policy может переписать mergedTaint вниз по lattice
 * - Fail-closed: отсутствие политик = allow, но invariants обязательны
 */

import type { Tainted, TaintMetadata } from './taint.js';
import { addTaint, mergeTaintMetadata } from './taint.js';
import type { TrustLevelRegistry } from './trust-level.js';
import { dominates } from './trust-level.js';

/* ============================================================================
 * 1. TYPES — PROPAGATION MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Тип операции распространения (union type для строгой типизации) */
export type PropagationOperation = 'combine' | 'transform' | 'filter' | 'aggregate' | 'merge';

/** Immutable decision snapshot для TOCTOU-безопасности (atomic policy evaluation) */
export type PropagationSnapshot = Readonly<{
  /** Timestamp момента принятия решения (фиксируется один раз, приходит снаружи) */
  readonly now: number;
  /** Capabilities на момент принятия решения (immutable snapshot, runtime state) */
  readonly capabilities: readonly string[];
}>;

/** Контекст распространения taint для policy engine (статический, без runtime state) */
export type PropagationContext = Readonly<{
  /** Registry уровней доверия */
  readonly trustLevelRegistry: TrustLevelRegistry;
  /** Тип операции распространения */
  readonly operation: PropagationOperation;
  /** Опциональный тип целевого значения (capability-tag для policies) */
  readonly targetType?: string;
}>;

/** Решение о распространении (policy может переписать mergedTaint вниз по lattice) */
export type PropagationDecision =
  | Readonly<{ type: 'ALLOW'; override?: TaintMetadata; }>
  | Readonly<{ type: 'DENY'; reason: PropagationFailureReason; }>;

/** Причина отказа в распространении (union type) */
export type PropagationFailureReason =
  | Readonly<{ kind: 'INSUFFICIENT_TRUST'; sources: readonly TaintMetadata[]; }>
  | Readonly<{ kind: 'INCOMPATIBLE_SOURCES'; sources: readonly TaintMetadata[]; }>
  | Readonly<{ kind: 'POLICY_DENY'; }>;

/**
 * Результат распространения (effect-based, для composability)
 * Core возвращает Outcome, boundary может бросать исключения
 */
export type PropagationOutcome<T> =
  | Readonly<{ ok: true; value: T | Tainted<T>; }>
  | Readonly<{ ok: false; reason: PropagationFailureReason; }>;

/**
 * Правило политики распространения (pure predicate, extensible без изменения core)
 * Принимает предвычисленный mergedTaint для оптимизации (O(1) вместо O(sources))
 * Принимает snapshot для TOCTOU-безопасности (atomic policy evaluation)
 * Может переписать mergedTaint вниз по lattice через override
 */
export type PropagationRule = Readonly<{
  /** Имя правила (для отладки и логирования) */
  readonly name: string;
  /** Проверяет разрешение распространения (pure predicate, может вернуть override) */
  readonly check: (
    sources: readonly TaintMetadata[],
    mergedTaint: TaintMetadata,
    context: PropagationContext,
    snapshot: PropagationSnapshot,
  ) => PropagationDecision;
}>;

/**
 * Registry правил распространения: invariants (обязательные) + policies (расширяемые)
 * Invariants всегда выполняются первыми и не могут быть обойдены
 */
export type PropagationRuleRegistry = Readonly<{
  /** Обязательные invariant правила (non-amplification и т.д.) */
  readonly invariants: readonly PropagationRule[];
  /** Расширяемые policy правила (plugin-specific policies) */
  readonly policies: readonly PropagationRule[];
  /** Map для O(1) lookup правил по имени (для динамического enable/disable) */
  readonly ruleMap: ReadonlyMap<string, PropagationRule>;
}>;

/** Clock интерфейс для детерминистического времени (dependency injection) */
export type Clock = Readonly<{
  /** Возвращает текущее время (может быть мокнуто для тестов/replay) */
  readonly now: () => number;
}>;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT REGISTRY
 * ============================================================================
 */

/* ============================================================================
 * 3. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Извлекает причину отказа из PropagationDecision
 * @note Security panic при unreachable (вызывается только для DENY результатов)
 * @internal
 */
function extractFailureReason(
  decision: PropagationDecision, // PropagationDecision для извлечения причины
): PropagationFailureReason { // Причина отказа
  if (decision.type !== 'DENY') {
    // Security invariant violated: эта функция вызывается только для DENY результатов
    // eslint-disable-next-line fp/no-throw
    throw new Error('Security invariant violated: extractFailureReason called for ALLOW result');
  }
  return decision.reason;
}

/**
 * Валидирует override taint (должен быть ≤ mergedTaint по lattice)
 * @note Policy может только downgrade trust, не upgrade
 * @internal
 */
function validateOverride(
  override: TaintMetadata, // Override taint metadata
  mergedTaint: TaintMetadata, // Merged taint metadata
  registry: TrustLevelRegistry, // Registry уровней доверия
): boolean { // true если override ≤ mergedTaint
  // Override должен быть ≤ mergedTaint (policy может только downgrade)
  // Используем dominates: override ≤ mergedTaint ⇔ dominates(mergedTaint, override)
  return dominates(mergedTaint.trustLevel, override.trustLevel, registry);
}

/**
 * Объединяет taint metadata от нескольких источников (non-amplification)
 * @note Предвычисляется один раз для оптимизации (O(sources) вместо O(rules × sources)).
 *       Timestamp = max(all sources) для корректного distributed tracing
 * @public
 */
export function computeMergedTaint(
  sources: readonly TaintMetadata[], // Массив taint metadata от источников
  registry: TrustLevelRegistry, // Registry уровней доверия
): TaintMetadata { // Объединенный taint metadata
  if (sources.length === 0) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Cannot merge taint from empty sources array');
  }

  const firstSource = sources[0];
  if (firstSource === undefined) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('First taint source is undefined');
  }

  // Используем reduce для аккумуляции merged taint и max timestamp
  const result = sources.slice(1).reduce(
    (acc, source) => {
      const merged = mergeTaintMetadata(acc.merged, source, registry);
      const maxTimestamp = source.timestamp !== undefined && source.timestamp > acc.maxTimestamp
        ? source.timestamp
        : acc.maxTimestamp;
      return { merged, maxTimestamp };
    },
    {
      merged: firstSource,
      maxTimestamp: firstSource.timestamp ?? 0,
    },
  );

  // Возвращаем merged taint с max timestamp
  if (result.maxTimestamp > 0) {
    return Object.freeze({
      ...result.merged,
      timestamp: result.maxTimestamp,
    });
  }
  return result.merged;
}

/* ============================================================================
 * 4. API — PROPAGATION OPERATIONS
 * ============================================================================
 */

/** Базовое правило проверки распространения (non-amplification: output ≤ input) */
const defaultPropagationRule: PropagationRule = Object.freeze({
  name: 'default-propagation-check',
  check: (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _sources: readonly TaintMetadata[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mergedTaint: TaintMetadata,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: PropagationContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _snapshot: PropagationSnapshot,
  ): PropagationDecision => {
    // Проверка sources.length === 0 уже гарантируется выше (в propagateTaintFromSources)
    // Правило просто разрешает, если mergedTaint предвычислен корректно
    // Non-amplification гарантируется через computeMergedTaint (использует meet)
    return Object.freeze({ type: 'ALLOW' });
  },
});

/** Дефолтный registry (thread-safe, immutable, defaultPropagationRule - mandatory invariant) */
export const defaultPropagationRuleRegistry: PropagationRuleRegistry = Object.freeze({
  invariants: Object.freeze([defaultPropagationRule]),
  policies: Object.freeze([]),
  ruleMap: Object.freeze(
    new Map<string, PropagationRule>([
      [defaultPropagationRule.name, defaultPropagationRule],
    ]),
  ) as ReadonlyMap<string, PropagationRule>,
});

/* ============================================================================
 * 🎯 PROPAGATION OPERATIONS
 * ============================================================================
 */

/** Применяет правила с short-circuit (fail-fast для time-of-check semantics) @internal */
function applyRules(
  rules: readonly PropagationRule[],
  sources: readonly TaintMetadata[],
  mergedTaint: TaintMetadata,
  context: PropagationContext,
  snapshot: PropagationSnapshot,
): { allowed: boolean; firstFailure?: PropagationDecision; override?: TaintMetadata; } {
  // Формальная IFC семантика: отсутствие правил = allow, не deny
  if (rules.length === 0) {
    return { allowed: true };
  }

  // Рекурсивная функция с фиксированным snapshot для TOCTOU-безопасности
  // Фиксируем массив правил один раз (atomic decision)
  const applyRulesRecursive = (
    index: number,
    atLeastOneAllowed: boolean,
    overrideSoFar: TaintMetadata | undefined,
  ): { allowed: boolean; firstFailure?: PropagationDecision; override?: TaintMetadata; } => {
    if (index >= rules.length) {
      return {
        allowed: atLeastOneAllowed,
        ...(overrideSoFar !== undefined ? { override: overrideSoFar } : {}),
      };
    }

    const rule = rules[index];
    if (rule === undefined) {
      return applyRulesRecursive(index + 1, atLeastOneAllowed, overrideSoFar);
    }

    // Все правила получают один и тот же snapshot и предвычисленный mergedTaint (atomic decision)
    const decision = rule.check(sources, mergedTaint, context, snapshot);
    if (decision.type === 'DENY') {
      return { allowed: false, firstFailure: decision };
    }

    // После проверки DENY decision.type всегда 'ALLOW'
    const newAtLeastOneAllowed = true;

    // Собираем override от правил (первый override имеет приоритет)
    const newOverride = decision.override !== undefined && overrideSoFar === undefined
      ? ((): TaintMetadata => {
        // Валидируем override (должен быть ≤ mergedTaint)
        // decision.override уже проверен на undefined выше
        const overrideValue = decision.override;
        if (validateOverride(overrideValue, mergedTaint, context.trustLevelRegistry)) {
          return overrideValue;
        }
        // Security invariant: override не может быть выше mergedTaint
        // eslint-disable-next-line fp/no-throw
        throw new Error(
          'Security invariant violated: policy override trustLevel is higher than mergedTaint',
        );
      })()
      : overrideSoFar;

    return applyRulesRecursive(index + 1, newAtLeastOneAllowed, newOverride);
  };

  return applyRulesRecursive(0, false, undefined);
}

/**
 * Проверяет разрешение распространения через rule-engine (formal IFC: invariants AND policies)
 * @note Только decision engine: возвращает ALLOW/DENY с опциональным override
 * @public
 */
export function checkPropagation(
  sources: readonly TaintMetadata[], // Массив taint metadata от источников
  mergedTaint: TaintMetadata, // Предвычисленный объединенный taint (для оптимизации)
  context: PropagationContext, // Контекст распространения (статический, без runtime state)
  snapshot: PropagationSnapshot, // Snapshot времени и capabilities (runtime state, приходит снаружи)
  ruleRegistry: PropagationRuleRegistry = defaultPropagationRuleRegistry, // Registry правил распространения
): PropagationDecision { // Решение о разрешении распространения (ALLOW/DENY с опциональным override)
  // Применяем invariants, затем policies (fail-fast)
  const invariantsResult = applyRules(
    ruleRegistry.invariants,
    sources,
    mergedTaint,
    context,
    snapshot,
  );
  if (invariantsResult.firstFailure !== undefined) {
    return invariantsResult.firstFailure;
  }

  const policiesResult = applyRules(
    ruleRegistry.policies,
    sources,
    mergedTaint,
    context,
    snapshot,
  );
  if (policiesResult.firstFailure !== undefined) {
    return policiesResult.firstFailure;
  }

  // Formal IFC: allowed = invariants_passed AND policies_allow
  // Invariants = safety preconditions (must pass)
  // Policies = authorization constraints (may restrict, отсутствие = allow)
  const isAllowed = invariantsResult.allowed && policiesResult.allowed;

  if (!isAllowed) {
    // Монотонность: policy deny должен возвращать POLICY_DENY, не маскироваться
    // Это обеспечивает: equal inputs → equal security decision (non-interference)
    return Object.freeze({
      type: 'DENY',
      reason: Object.freeze({ kind: 'POLICY_DENY' }),
    });
  }

  // Используем override от invariants или policies (первый имеет приоритет)
  const finalOverride = invariantsResult.override ?? policiesResult.override;

  return Object.freeze({
    type: 'ALLOW',
    ...(finalOverride !== undefined ? { override: finalOverride } : {}),
  });
}

/**
 * Распространяет taint от нескольких источников к целевому значению (effect-based)
 * @template T - Тип целевого значения
 * @note Orchestration: вызывает checkPropagation (decision) и computeMergedTaint (transformation).
 *       SRP: не знает про isTainted, принимает TaintMetadata[] напрямую.
 *       Core возвращает Outcome для composability, boundary может бросать исключения
 * @public
 */
export function propagateTaintFromSources<T>(
  sources: readonly TaintMetadata[], // Массив taint metadata от источников (уже извлечены выше)
  target: T, // Целевое значение для пометки taint
  context: PropagationContext, // Контекст распространения (статический)
  snapshot: PropagationSnapshot, // Snapshot времени и capabilities (runtime state, приходит снаружи)
  ruleRegistry: PropagationRuleRegistry = defaultPropagationRuleRegistry, // Registry правил распространения
): PropagationOutcome<T> { // Outcome с tainted целевым значением или untainted target, или ошибка
  // Security correctness: untainted input -> untainted output (не создаем taint из ничего)
  if (sources.length === 0) {
    return Object.freeze({ ok: true, value: target });
  }

  // Предвычисляем mergedTaint один раз (оптимизация: O(sources) вместо O(rules × sources))
  const mergedTaint = computeMergedTaint(sources, context.trustLevelRegistry);

  // Проверяем разрешение распространения через rule-engine (decision с опциональным override)
  const decision = checkPropagation(sources, mergedTaint, context, snapshot, ruleRegistry);

  if (decision.type === 'DENY') {
    const reason = extractFailureReason(decision);
    return Object.freeze({ ok: false, reason });
  }

  // Используем override от policy, если есть, иначе mergedTaint
  const finalTaint = decision.override ?? mergedTaint;

  // Применяем финальный taint к целевому значению (data transformation)
  const taintedValue = addTaint(
    target,
    finalTaint.source,
    finalTaint.trustLevel,
    finalTaint.timestamp,
  );

  return Object.freeze({ ok: true, value: taintedValue });
}

/**
 * Распространяет taint от одного источника к целевому значению (effect-based)
 * @template T - Тип целевого значения
 * @note Упрощенный API для случая одного источника
 * @public
 */
export function propagateTaintFromSource<T>(
  source: TaintMetadata, // Taint metadata от источника (уже извлечен выше)
  target: T, // Целевое значение для пометки taint
  context: PropagationContext, // Контекст распространения (статический)
  snapshot: PropagationSnapshot, // Snapshot времени и capabilities (runtime state, приходит снаружи)
  ruleRegistry: PropagationRuleRegistry = defaultPropagationRuleRegistry, // Registry правил распространения
): PropagationOutcome<T> { // Outcome с tainted целевым значением или untainted target, или ошибка
  return propagateTaintFromSources(
    Object.freeze([source]),
    target,
    context,
    snapshot,
    ruleRegistry,
  );
}

/* ============================================================================
 * 5. PROPAGATION INTERFACE — EXTENSIBILITY
 * ============================================================================
 */

/**
 * Generic PropagationBoundary интерфейс для различных операций распространения
 * @public
 */
export interface PropagationBoundary {
  /** Проверяет разрешение распространения через rule-engine (только decision) */
  checkPropagation(
    sources: readonly TaintMetadata[],
    mergedTaint: TaintMetadata,
    context: PropagationContext,
    snapshot: PropagationSnapshot,
  ): PropagationDecision;
  /** Распространяет taint от нескольких источников к целевому значению (effect-based) */
  propagateFromSources<T>(
    sources: readonly TaintMetadata[],
    target: T,
    context: PropagationContext,
    snapshot: PropagationSnapshot,
  ): PropagationOutcome<T>;
  /** Распространяет taint от одного источника к целевому значению (effect-based) */
  propagateFromSource<T>(
    source: TaintMetadata,
    target: T,
    context: PropagationContext,
    snapshot: PropagationSnapshot,
  ): PropagationOutcome<T>;
  /** Распространяет taint с выбрасыванием исключения (для boundary layer) */
  propagateFromSourcesOrThrow<T>(
    sources: readonly TaintMetadata[],
    target: T,
    context: PropagationContext,
    snapshot: PropagationSnapshot,
  ): T | Tainted<T>;
  /** Распространяет taint от одного источника с выбрасыванием исключения (для boundary layer) */
  propagateFromSourceOrThrow<T>(
    source: TaintMetadata,
    target: T,
    context: PropagationContext,
    snapshot: PropagationSnapshot,
  ): T | Tainted<T>;
}

/**
 * Создает PropagationBoundary для операций распространения (базовая реализация)
 * @public
 */
export function createPropagationBoundary(
  ruleRegistry: PropagationRuleRegistry = defaultPropagationRuleRegistry, // Registry правил распространения
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _clock: Clock = { now: () => Date.now() }, // Clock для детерминистического времени (dependency injection)
): PropagationBoundary { // PropagationBoundary для операций распространения
  return Object.freeze({
    checkPropagation: (
      sources: readonly TaintMetadata[],
      mergedTaint: TaintMetadata,
      context: PropagationContext,
      snapshot: PropagationSnapshot,
    ) => checkPropagation(sources, mergedTaint, context, snapshot, ruleRegistry),
    propagateFromSources: <T>(
      sources: readonly TaintMetadata[],
      target: T,
      context: PropagationContext,
      snapshot: PropagationSnapshot,
    ) => propagateTaintFromSources(sources, target, context, snapshot, ruleRegistry),
    propagateFromSource: <T>(
      source: TaintMetadata,
      target: T,
      context: PropagationContext,
      snapshot: PropagationSnapshot,
    ) => propagateTaintFromSource(source, target, context, snapshot, ruleRegistry),
    propagateFromSourcesOrThrow: <T>(
      sources: readonly TaintMetadata[],
      target: T,
      context: PropagationContext,
      snapshot: PropagationSnapshot,
    ) => {
      const outcome = propagateTaintFromSources(sources, target, context, snapshot, ruleRegistry);
      if (!outcome.ok) {
        // eslint-disable-next-line fp/no-throw
        throw new Error(`Taint propagation denied: ${outcome.reason.kind}`);
      }
      return outcome.value;
    },
    propagateFromSourceOrThrow: <T>(
      source: TaintMetadata,
      target: T,
      context: PropagationContext,
      snapshot: PropagationSnapshot,
    ) => {
      const outcome = propagateTaintFromSource(source, target, context, snapshot, ruleRegistry);
      if (!outcome.ok) {
        // eslint-disable-next-line fp/no-throw
        throw new Error(`Taint propagation denied: ${outcome.reason.kind}`);
      }
      return outcome.value;
    },
  });
}
