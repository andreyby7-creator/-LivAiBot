/**
 * @file packages/core/src/data-safety/taint-sink.ts
 * ============================================================================
 * 🛡️ CORE — Taint Sink (Output Boundary)
 * ============================================================================
 *
 * Formal information-flow security sink: проверка trusted данных перед отправкой в плагины.
 * Trusted → Plugins через assertTrusted (Trusted<T> wrapper), результаты помечаются как PLUGIN source.
 *
 * ⚠️ ВАЖНО:
 * - Formal IFC: trusted = invariants_passed AND policies_allow (не OR!)
 * - Runtime brand: Trusted<T> защищен от подделки через type assertion
 * - TOCTOU-safe: фиксированный snapshot правил для time-of-check semantics
 * - Trusted<T> wrapper: сохраняет provenance (end-to-end taint tracking)
 * - Sinks не могут upgrade trust: clampPluginTrust ограничивает максимальный уровень
 * - Fail-closed: non-tainted = UNTRUSTED, нет positive proof = UNTRUSTED
 */

import type { Tainted, TaintSource } from './taint.js';
import { addTaint, getTaintMetadata, isTainted, stripTaint, taintSources } from './taint.js';
import type { TrustLevel, TrustLevelRegistry } from './trust-level.js';
import { dominates, meetTrust, trustLevels } from './trust-level.js';

/* ============================================================================
 * 🧩 ТИПЫ
 * ============================================================================
 */

/** Тип sink для policy engine (union type для строгой типизации) */
export type SinkType = 'plugin' | 'db' | 'llm' | 'network' | 'file' | 'cache';

/** Immutable decision snapshot для TOCTOU-безопасности (atomic policy evaluation) */
export type TrustedCheckSnapshot = Readonly<{
  /** Timestamp момента принятия решения (фиксируется один раз) */
  readonly now: number;
  /** Capabilities на момент принятия решения (immutable snapshot) */
  readonly capabilities: readonly string[];
}>;

/** Контекст проверки trusted состояния для policy engine */
export type TrustedCheckContext = Readonly<{
  /** Требуемый уровень доверия */
  readonly requiredTrustLevel: TrustLevel;
  /** Registry уровней доверия */
  readonly trustLevelRegistry: TrustLevelRegistry;
  /** Тип sink (для policy engine) */
  readonly sink: SinkType;
  /** Опциональная операция (для fine-grained policies) */
  readonly operation?: string;
  /** Опциональные capabilities (для advanced policies) */
  readonly capabilities?: readonly string[];
}>;

/** Результат проверки trusted состояния (union type, без value для защиты от подмены) */
export type TrustedCheckResult =
  | Readonly<{ type: 'TRUSTED'; }>
  | Readonly<{ type: 'UNTRUSTED'; reason: TrustedCheckFailureReason; }>;

/** Причина отказа в trusted проверке (union type) */
export type TrustedCheckFailureReason =
  | Readonly<{ kind: 'TAINTED'; source: TaintSource; trustLevel: TrustLevel; }>
  | Readonly<{ kind: 'INSUFFICIENT_TRUST'; current: TrustLevel; required: TrustLevel; }>
  | Readonly<{ kind: 'NO_METADATA'; }>
  | Readonly<{ kind: 'POLICY_DENY'; }>;

/**
 * Правило проверки trusted состояния (pure функция, extensible без изменения core)
 * Принимает snapshot для TOCTOU-безопасности (atomic policy evaluation)
 */
export type TrustedCheckRule = Readonly<{
  /** Имя правила (для отладки и логирования) */
  readonly name: string;
  /** Проверяет trusted состояние данных с учетом context и snapshot */
  readonly check: (
    value: unknown,
    context: TrustedCheckContext,
    snapshot: TrustedCheckSnapshot,
  ) => TrustedCheckResult;
}>;

/**
 * Registry правил проверки: invariants (обязательные) + policies (расширяемые)
 * Invariants всегда выполняются первыми и не могут быть обойдены
 */
export type TrustedCheckRuleRegistry = Readonly<{
  /** Обязательные invariant правила (metadata проверка и т.д.) */
  readonly invariants: readonly TrustedCheckRule[];
  /** Расширяемые policy правила (plugin-specific policies) */
  readonly policies: readonly TrustedCheckRule[];
  /** Map для O(1) lookup правил по имени */
  readonly ruleMap: ReadonlyMap<string, TrustedCheckRule>;
}>;

/* ============================================================================
 * ❌ СТРУКТУРИРОВАННЫЕ ОШИБКИ (Domain Layer)
 * ============================================================================
 */

/** Ошибка непроверенных данных (domain error, без stack trace) */
export type UntrustedValueError = Readonly<{
  readonly name: 'UntrustedValueError';
  readonly message: string;
  readonly reason: TrustedCheckFailureReason;
  readonly requiredTrustLevel: TrustLevel;
}>;

/** Создает структурированную ошибку непроверенных данных (domain-pure) */
export function createUntrustedValueError(
  reason: TrustedCheckFailureReason,
  requiredTrustLevel: TrustLevel,
): UntrustedValueError {
  return Object.freeze({
    name: 'UntrustedValueError' as const,
    message: 'Value is not trusted',
    reason,
    requiredTrustLevel,
  });
}

/** Type guard для проверки UntrustedValueError */
export function isUntrustedValueError(
  error: unknown,
): error is UntrustedValueError {
  return (
    typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'UntrustedValueError'
    && 'reason' in error
    && 'requiredTrustLevel' in error
  );
}

/* ============================================================================
 * 🔧 UTILITY FUNCTIONS
 * ============================================================================
 */

/** Извлекает причину отказа из TrustedCheckResult (security panic при unreachable) @internal */
function extractFailureReason(result: TrustedCheckResult): TrustedCheckFailureReason {
  if (result.type !== 'UNTRUSTED') {
    // Security invariant violated: эта функция вызывается только для UNTRUSTED результатов
    // eslint-disable-next-line fp/no-throw
    throw new Error('Security invariant violated: extractFailureReason called for TRUSTED result');
  }
  return result.reason;
}

/** Ограничивает trust level для plugin output (non-amplification: output ≤ input) @internal */
function clampPluginTrust(
  requested: TrustLevel,
  inputTrustLevel: TrustLevel,
  registry: TrustLevelRegistry,
): TrustLevel {
  // Plugin output не может быть выше input trust (non-amplification)
  // Используем meet для fail-closed: meet(requested, inputTrustLevel)
  return meetTrust(requested, inputTrustLevel, registry);
}

/* ============================================================================
 * 🎯 DEFAULT RULES (Core Rules)
 * ============================================================================
 */

/** Базовое правило проверки trusted (fail-closed: non-tainted = UNTRUSTED) */
const defaultTrustedCheckRule: TrustedCheckRule = Object.freeze({
  name: 'default-trusted-check',
  check: (
    value: unknown,
    context: TrustedCheckContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _snapshot: TrustedCheckSnapshot,
  ): TrustedCheckResult => {
    // Fail-closed: non-tainted = UNTRUSTED (защита от забытого markAsExternal)
    if (!isTainted(value)) {
      return Object.freeze({
        type: 'UNTRUSTED',
        reason: Object.freeze({ kind: 'NO_METADATA' }),
      });
    }

    // eslint-disable-next-line ai-security/model-poisoning
    const metadata = getTaintMetadata(value);
    if (metadata === undefined) {
      return Object.freeze({
        type: 'UNTRUSTED',
        reason: Object.freeze({ kind: 'NO_METADATA' }),
      });
    }

    // Проверяем trustLevel через lattice dominates
    const isTrusted = dominates(
      metadata.trustLevel,
      context.requiredTrustLevel,
      context.trustLevelRegistry,
    );

    if (!isTrusted) {
      return Object.freeze({
        type: 'UNTRUSTED',
        reason: Object.freeze({
          kind: 'INSUFFICIENT_TRUST',
          current: metadata.trustLevel,
          required: context.requiredTrustLevel,
        }),
      });
    }

    return Object.freeze({ type: 'TRUSTED' });
  },
});

/** Дефолтный registry (thread-safe, immutable, defaultTrustedCheckRule - mandatory invariant) */
export const defaultTrustedCheckRuleRegistry: TrustedCheckRuleRegistry = Object.freeze({
  invariants: Object.freeze([defaultTrustedCheckRule]),
  policies: Object.freeze([]),
  ruleMap: Object.freeze(
    new Map<string, TrustedCheckRule>([
      [defaultTrustedCheckRule.name, defaultTrustedCheckRule],
    ]),
  ) as ReadonlyMap<string, TrustedCheckRule>,
});

/* ============================================================================
 * 🎯 OUTPUT BOUNDARY OPERATIONS
 * ============================================================================
 */

/** Применяет правила с short-circuit (fail-fast для time-of-check semantics) @internal */
function applyRules(
  rules: readonly TrustedCheckRule[],
  value: unknown,
  context: TrustedCheckContext,
  snapshot: TrustedCheckSnapshot,
): { allowed: boolean; firstFailure?: TrustedCheckResult; } {
  // Формальная IFC семантика: отсутствие правил = allow, не deny
  if (rules.length === 0) {
    return { allowed: true };
  }

  // Рекурсивная функция с фиксированным snapshot для TOCTOU-безопасности
  const applyRulesRecursive = (
    index: number,
    atLeastOneTrusted: boolean,
  ): { allowed: boolean; firstFailure?: TrustedCheckResult; } => {
    if (index >= rules.length) {
      return { allowed: atLeastOneTrusted };
    }

    const rule = rules[index];
    if (rule === undefined) {
      return applyRulesRecursive(index + 1, atLeastOneTrusted);
    }

    // Все правила получают один и тот же snapshot (atomic decision)
    const result = rule.check(value, context, snapshot);
    if (result.type === 'UNTRUSTED') {
      return { allowed: false, firstFailure: result };
    }

    // После проверки UNTRUSTED result.type всегда 'TRUSTED'
    return applyRulesRecursive(index + 1, true);
  };

  return applyRulesRecursive(0, false);
}

/**
 * Проверяет trusted состояние через rule-engine (formal IFC: invariants AND policies)
 *
 * @param value - Данные для проверки
 * @param context - Контекст проверки
 * @param ruleRegistry - Registry правил проверки
 * @returns Результат проверки
 */
export function checkTrusted(
  value: unknown,
  context: TrustedCheckContext,
  ruleRegistry: TrustedCheckRuleRegistry = defaultTrustedCheckRuleRegistry,
): TrustedCheckResult {
  // Materialize decision snapshot once (TOCTOU-safe, atomic policy evaluation)
  const snapshot: TrustedCheckSnapshot = Object.freeze({
    now: Date.now(),
    capabilities: context.capabilities ?? Object.freeze([]),
  });

  // Применяем invariants, затем policies (fail-fast)
  const invariantsResult = applyRules(ruleRegistry.invariants, value, context, snapshot);
  if (invariantsResult.firstFailure !== undefined) {
    return invariantsResult.firstFailure;
  }

  const policiesResult = applyRules(ruleRegistry.policies, value, context, snapshot);
  if (policiesResult.firstFailure !== undefined) {
    return policiesResult.firstFailure;
  }

  // Formal IFC: trusted = invariants_passed AND policies_allow
  // Invariants = safety preconditions (must pass)
  // Policies = authorization constraints (may restrict, отсутствие = allow)
  const isTrusted = invariantsResult.allowed && policiesResult.allowed;

  if (!isTrusted) {
    // Монотонность: policy deny должен возвращать POLICY_DENY, не маскироваться под NO_METADATA
    // Это обеспечивает: equal inputs → equal security decision (non-interference)
    return Object.freeze({
      type: 'UNTRUSTED',
      reason: Object.freeze({ kind: 'POLICY_DENY' }),
    });
  }

  return Object.freeze({ type: 'TRUSTED' });
}

/** Runtime brand для Trusted<T> (unforgeable capability, runtime защита от подделки) */
export const TrustedBrand: unique symbol = Symbol('Trusted');

/**
 * Registry trusted объектов для проверки по identity (защита от Proxy/spoofing)
 * WeakSet обеспечивает проверку по identity, не по presence (object-capability model)
 */
const trustedObjects = new WeakSet<object>();

/**
 * Trusted wrapper для передачи данных в плагины (unforgeable capability)
 * Защита от covert channel: плагин получает только value, не provenance metadata
 * IFC правило: sinks may depend on data, not classification
 */
export type Trusted<T> = Readonly<{
  readonly value: T;
  readonly [TrustedBrand]: true;
}>;

/**
 * Runtime проверка Trusted<T> (object-capability: проверка по identity через WeakSet)
 * Защита от Proxy/spoofing: проверка по identity, не по presence
 */
export function isTrusted(value: unknown): value is Trusted<unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && trustedObjects.has(value)
  );
}

/**
 * Создает Trusted<T> wrapper (unforgeable capability, только внутри модуля)
 * Регистрирует объект в WeakSet для проверки по identity (защита от Proxy/spoofing)
 * @internal
 */
function createTrusted<T>(value: T): Trusted<T> {
  const obj = Object.freeze({
    value,
    [TrustedBrand]: true as const,
  });
  trustedObjects.add(obj);
  return obj;
}

/**
 * Результат assertTrusted с сохранением trustLevel для clampPluginTrust
 * TrustLevel нужен только в boundary, не передается в плагин
 *
 * @internal
 */
type TrustedWithLevel<T> = Readonly<{
  readonly trusted: Trusted<T>;
  readonly trustLevel: TrustLevel;
}>;

/**
 * Проверяет trusted состояние и возвращает Trusted wrapper (fail-hard)
 * TrustLevel сохраняется только в boundary, не передается в плагин (защита от covert channel)
 *
 * @param value - Tainted данные для проверки
 * @param context - Контекст проверки
 * @param ruleRegistry - Registry правил проверки
 * @returns Trusted wrapper и trustLevel (для boundary, не для плагина)
 * @throws {UntrustedValueError} Если данные не trusted
 */
function assertTrustedWithLevel<T>(
  value: T | Tainted<T>,
  context: TrustedCheckContext,
  ruleRegistry: TrustedCheckRuleRegistry = defaultTrustedCheckRuleRegistry,
): TrustedWithLevel<T> {
  const checkResult = checkTrusted(value, context, ruleRegistry);
  if (checkResult.type === 'UNTRUSTED') {
    const reason = extractFailureReason(checkResult);
    const error = createUntrustedValueError(reason, context.requiredTrustLevel);
    // eslint-disable-next-line fp/no-throw
    throw error;
  }

  // TRUSTED → metadata обязан существовать (security invariant, без fallback)
  if (!isTainted(value)) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Security invariant violated: TRUSTED result but value is not tainted');
  }

  // eslint-disable-next-line ai-security/model-poisoning
  const metadata = getTaintMetadata(value);
  if (metadata === undefined) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Security invariant violated: TRUSTED result but metadata is missing');
  }

  // Плагин получает только value, не provenance metadata (IFC: sinks may depend on data, not classification)
  return Object.freeze({
    trusted: createTrusted(stripTaint(value)),
    trustLevel: metadata.trustLevel,
  });
}

/**
 * Проверяет trusted состояние и возвращает Trusted wrapper (fail-hard)
 * Публичный API: плагин получает только value, не trustLevel
 *
 * @param value - Tainted данные для проверки
 * @param context - Контекст проверки
 * @param ruleRegistry - Registry правил проверки
 * @returns Trusted wrapper (только value, без metadata)
 * @throws {UntrustedValueError} Если данные не trusted
 */
export function assertTrusted<T>(
  value: T | Tainted<T>,
  context: TrustedCheckContext,
  ruleRegistry: TrustedCheckRuleRegistry = defaultTrustedCheckRuleRegistry,
): Trusted<T> {
  return assertTrustedWithLevel(value, context, ruleRegistry).trusted;
}

/**
 * Помечает результаты плагинов как tainted с source=PLUGIN
 *
 * @param value - Результат выполнения плагина
 * @param trustLevel - Уровень доверия к результату (по умолчанию UNTRUSTED)
 * @param timestamp - Опциональный timestamp
 * @returns Tainted данные с source=PLUGIN
 */
export function markAsPluginOutput<T>(
  value: T,
  trustLevel: TrustLevel = trustLevels.UNTRUSTED as TrustLevel,
  timestamp?: number,
): Tainted<T> {
  return addTaint(value, taintSources.PLUGIN as TaintSource, trustLevel, timestamp);
}

/**
 * Комбинированная операция: проверка trusted, выполнение плагина, пометка результата
 * Sinks не могут upgrade trust (clampPluginTrust ограничивает максимальный уровень)
 *
 * @param value - Tainted данные для проверки
 * @param plugin - Функция плагина (получает Trusted<T> wrapper)
 * @param context - Контекст проверки
 * @param resultTrustLevel - Уровень доверия для результата (по умолчанию UNTRUSTED)
 * @param ruleRegistry - Registry правил проверки
 * @returns Tainted результат плагина с source=PLUGIN
 * @throws {UntrustedValueError} Если данные не trusted
 */
export async function executePluginWithBoundary<T, U>(
  value: T | Tainted<T>,
  plugin: (trusted: Trusted<T>) => U | Promise<U>,
  context: TrustedCheckContext,
  resultTrustLevel: TrustLevel = trustLevels.UNTRUSTED as TrustLevel,
  ruleRegistry: TrustedCheckRuleRegistry = defaultTrustedCheckRuleRegistry,
): Promise<Tainted<U>> {
  // Получаем Trusted wrapper и trustLevel (trustLevel только для boundary, не для плагина)
  const { trusted, trustLevel } = assertTrustedWithLevel(value, context, ruleRegistry);
  const pluginResult = await Promise.resolve(plugin(trusted));
  const clampedTrust = clampPluginTrust(
    resultTrustLevel,
    trustLevel,
    context.trustLevelRegistry,
  );
  return markAsPluginOutput(pluginResult, clampedTrust);
}

/* ============================================================================
 * 🏗️ OUTPUT BOUNDARY INTERFACE (Extensibility)
 * ============================================================================
 */

/** Generic OutputBoundary интерфейс для различных плагинов */
export interface OutputBoundary<TInput, TOutput> {
  /** Проверяет trusted и возвращает Trusted wrapper (сохраняет provenance) */
  assertTrusted(
    value: TInput | Tainted<TInput>,
    context: TrustedCheckContext,
  ): Trusted<TInput>;
  /** Помечает результат плагина как tainted с source=PLUGIN */
  markAsPluginOutput(value: TOutput, trustLevel?: TrustLevel): Tainted<TOutput>;
  /** Комбинированная операция: проверка, выполнение, пометка */
  execute(
    value: TInput | Tainted<TInput>,
    plugin: (trusted: Trusted<TInput>) => TOutput | Promise<TOutput>,
    context: TrustedCheckContext,
    resultTrustLevel?: TrustLevel,
  ): Promise<Tainted<TOutput>>;
}

/** Создает OutputBoundary для плагинов (базовая реализация) */
export function createPluginOutputBoundary<TInput, TOutput>(): OutputBoundary<TInput, TOutput> {
  return Object.freeze({
    assertTrusted: (value: TInput | Tainted<TInput>, context: TrustedCheckContext) =>
      assertTrusted(value, context),
    markAsPluginOutput: (value: TOutput, trustLevel?: TrustLevel) =>
      markAsPluginOutput(value, trustLevel),
    execute: async (
      value: TInput | Tainted<TInput>,
      plugin: (trusted: Trusted<TInput>) => TOutput | Promise<TOutput>,
      context: TrustedCheckContext,
      resultTrustLevel?: TrustLevel,
    ) => executePluginWithBoundary(value, plugin, context, resultTrustLevel),
  });
}
