/**
 * @file packages/domains/src/classification/providers/remote.provider.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Remote Provider (Pipeline Stage)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain provider для загрузки внешних сигналов классификации
 * - Адаптер remote-risk контракта в slot-based pipeline (`StagePlugin`)
 * - Изоляция remote transport/timeout/failure policy от domain-логики оценки
 * - Явная trust-boundary обработка: sanitize до и после пользовательского mapper
 *
 * Принципы:
 * - ✅ SRP: отдельно контракты, timeout-изоляция, маппинг сигналов и stage-фабрика
 * - ✅ Deterministic: стратегия merge/failure определяется policy-конфигом
 * - ✅ Domain-pure: возвращает только `ClassificationSignals`, без IO-побочных эффектов наружу
 * - ✅ Microservice-ready: transport внедряется через интерфейс `RemoteClassificationProvider`
 * - ✅ Extensible: кастомный `responseMapper` и `fallbackSignals` без изменения core-фабрики
 * - ✅ Explicit invariants: запрет неоднозначной конфигурации (`executionPolicy` vs `timeoutMs`)
 * - ✅ Strict typing: union policy + value objects, без stringly-typed API
 */

import { defineStage } from '@livai/core';
import type { StageContext, StageId, StagePlugin } from '@livai/core';

import type { ClassificationContext, ClassificationSignals } from '../signals/signals.js';
import type { DeviceInfo } from '../strategies/rules.js';

/* ============================================================================
 * 1. TYPES — REMOTE PROVIDER CONTRACT
 * ============================================================================
 */

/**
 * Политика обработки ошибок удаленного провайдера.
 * - `fail_open`: вернуть текущие сигналы, не усиливая риск
 * - `fail_closed`: применить fallback-сигналы (консервативное поведение)
 */
export type RemoteFailurePolicy = 'fail_open' | 'fail_closed';

/** Стратегия слияния локальных и удаленных сигналов. */
export type MergeStrategy = 'remote_wins' | 'local_wins' | 'max_risk';
export type AsnMergeStrategy = 'remote_wins' | 'local_wins' | 'first_non_undefined';

/**
 * Нормализованный ответ внешнего провайдера для classification domain.
 * Поля intentionally-optional: vendor может прислать неполный набор.
 */
export type RemoteProviderResponse = Readonly<{
  readonly isVpn?: boolean;
  readonly isTor?: boolean;
  readonly isProxy?: boolean;
  readonly asn?: string;
  readonly reputationScore?: number;
  readonly velocityScore?: number;
}>;

/**
 * Запрос в удаленный provider.
 * `signal` используется для cancellation в distributed/remote вызовах.
 */
export type RemoteProviderRequest = Readonly<{
  readonly device: DeviceInfo;
  readonly context: ClassificationContext;
  readonly signal?: AbortSignal;
}>;

/**
 * Контракт удаленного провайдера классификации.
 * Внедряется извне (HTTP/gRPC/message bus), что убирает скрытый coupling.
 */
export type RemoteClassificationProvider = (
  request: RemoteProviderRequest,
) => Promise<RemoteProviderResponse>;

/** Runtime-конфигурация удаленного provider stage. */
export type RemoteProviderStageConfig = Readonly<{
  /** Клиент внешнего провайдера (обязательный dependency). */
  readonly provider: RemoteClassificationProvider;
  /** Таймаут удаленного вызова, мс. */
  readonly timeoutMs?: number;
  /** Политика при ошибке/таймауте (задается явно, без скрытого default). */
  readonly failurePolicy: RemoteFailurePolicy;
  /** Стратегия слияния локальных и удаленных сигналов. */
  readonly mergeStrategy?: MergeStrategy;
  /** Стратегия слияния ASN в режиме `max_risk`. */
  readonly asnMergeStrategy?: AsnMergeStrategy;
  /** Политика асинхронного выполнения (timeout/cancellation/retry/circuit-breaker). */
  readonly executionPolicy?: AsyncExecutionPolicy;
  /**
   * Кастомный маппер vendor-ответа в domain signals.
   * По умолчанию используется identity-like нормализация.
   */
  readonly responseMapper?: (response: RemoteProviderResponse) => Partial<ClassificationSignals>;
  /**
   * Fallback-сигналы для `fail_closed`.
   * Для `fail_closed` должны быть заданы явно.
   */
  readonly fallbackSignals?: Partial<ClassificationSignals>;
}>;

/**
 * Политика выполнения async-эффекта.
 * Инжектируется извне для инфраструктурного контроля (timeout/retry/breaker).
 */
export type AsyncExecutionPolicy = Readonly<{
  /**
   * Важно: реализация policy отвечает за observability (метрики/трейсинг/log hooks).
   * Stage намеренно не логирует и не эмитит события, чтобы сохранить domain purity.
   * Также policy владеет retry/backoff/circuit-breaker стратегиями.
   */
  execute<T>(
    effect: (signal: AbortSignal) => Promise<T>,
    options?: Readonly<{ parentSignal?: AbortSignal; }>,
  ): Promise<T>;
}>;

/**
 * Минимальный slot-контракт для remote provider stage.
 * Расширяется конкретным pipeline slot map через generic `TSlotMap`.
 */
export type RemoteProviderSlotMap = Readonly<{
  readonly device: DeviceInfo;
  readonly context: ClassificationContext;
  readonly signals?: ClassificationSignals;
}>;

/* ============================================================================
 * 2. CONSTANTS — DEFAULTS & STAGE ID
 * ============================================================================
 */

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MERGE_STRATEGY: MergeStrategy = 'remote_wins';
const DEFAULT_ASN_MERGE_STRATEGY: AsnMergeStrategy = 'first_non_undefined';
const REMOTE_PROVIDER_STAGE_ID: StageId = 'classification_remote_provider' as StageId;
const MAX_ASN_LENGTH = 64;

/* ============================================================================
 * 3. INTERNAL — SANITIZATION & MERGE HELPERS
 * ============================================================================
 */

function mapRemoteResponseToSignals(
  response: RemoteProviderResponse,
): Partial<ClassificationSignals> {
  return {
    ...(response.isVpn !== undefined && { isVpn: response.isVpn }),
    ...(response.isTor !== undefined && { isTor: response.isTor }),
    ...(response.isProxy !== undefined && { isProxy: response.isProxy }),
    ...(response.asn !== undefined && { asn: response.asn }),
    ...(response.reputationScore !== undefined && { reputationScore: response.reputationScore }),
    ...(response.velocityScore !== undefined && { velocityScore: response.velocityScore }),
  };
}

function sanitizeAsn(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > MAX_ASN_LENGTH) {
    return undefined;
  }
  return /^[A-Za-z0-9._:-]+$/.test(normalized) ? normalized : undefined;
}

function sanitizeScore(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, value));
}

function sanitizeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function sanitizeRemoteResponse(
  response: RemoteProviderResponse,
): RemoteProviderResponse {
  const isVpn = sanitizeBoolean(response.isVpn);
  const isTor = sanitizeBoolean(response.isTor);
  const isProxy = sanitizeBoolean(response.isProxy);
  const asn = sanitizeAsn(response.asn);
  const reputationScore = sanitizeScore(response.reputationScore);
  const velocityScore = sanitizeScore(response.velocityScore);
  return Object.freeze({
    ...(isVpn !== undefined && { isVpn }),
    ...(isTor !== undefined && { isTor }),
    ...(isProxy !== undefined && { isProxy }),
    ...(asn !== undefined && { asn }),
    ...(reputationScore !== undefined && { reputationScore }),
    ...(velocityScore !== undefined && { velocityScore }),
  });
}

function sanitizeSignals(
  signals: Partial<ClassificationSignals>,
): Partial<ClassificationSignals> {
  const isVpn = sanitizeBoolean(signals.isVpn);
  const isTor = sanitizeBoolean(signals.isTor);
  const isProxy = sanitizeBoolean(signals.isProxy);
  const asn = sanitizeAsn(signals.asn);
  const reputationScore = sanitizeScore(signals.reputationScore);
  const velocityScore = sanitizeScore(signals.velocityScore);
  return Object.freeze({
    ...(isVpn !== undefined && { isVpn }),
    ...(isTor !== undefined && { isTor }),
    ...(isProxy !== undefined && { isProxy }),
    ...(asn !== undefined && { asn }),
    ...(reputationScore !== undefined && { reputationScore }),
    ...(velocityScore !== undefined && { velocityScore }),
  });
}

function combineRiskBoolean(
  localValue: boolean | undefined,
  remoteValue: boolean | undefined,
): boolean | undefined {
  if (localValue === undefined) {
    return remoteValue;
  }
  if (remoteValue === undefined) {
    return localValue;
  }
  return localValue || remoteValue;
}

function mergeByMaxRisk(
  baseSignals: ClassificationSignals | undefined,
  externalSignals: Partial<ClassificationSignals>,
  asnMergeStrategy: AsnMergeStrategy,
): ClassificationSignals {
  const localReputation = baseSignals?.reputationScore;
  const remoteReputation = externalSignals.reputationScore;
  const localVelocity = baseSignals?.velocityScore;
  const remoteVelocity = externalSignals.velocityScore;
  const mergedAsn = ((): string | undefined => {
    switch (asnMergeStrategy) {
      case 'remote_wins':
        return externalSignals.asn ?? baseSignals?.asn;
      case 'local_wins':
        return baseSignals?.asn ?? externalSignals.asn;
      case 'first_non_undefined':
        return baseSignals?.asn ?? externalSignals.asn;
      default: {
        const exhaustive: never = asnMergeStrategy;
        return exhaustive;
      }
    }
  })();

  return Object.freeze({
    ...(baseSignals ?? {}),
    isVpn: combineRiskBoolean(baseSignals?.isVpn, externalSignals.isVpn),
    isTor: combineRiskBoolean(baseSignals?.isTor, externalSignals.isTor),
    isProxy: combineRiskBoolean(baseSignals?.isProxy, externalSignals.isProxy),
    ...(mergedAsn !== undefined && { asn: mergedAsn }),
    ...(localReputation !== undefined || remoteReputation !== undefined
      ? {
        // Меньший reputationScore считается более рискованным.
        reputationScore: Math.min(localReputation ?? 100, remoteReputation ?? 100),
      }
      : {}),
    ...(localVelocity !== undefined || remoteVelocity !== undefined
      ? {
        // Больший velocityScore считается более рискованным.
        velocityScore: Math.max(localVelocity ?? 0, remoteVelocity ?? 0),
      }
      : {}),
  }) as ClassificationSignals;
}

function createTimeoutExecutionPolicy(timeoutMs: number): AsyncExecutionPolicy {
  return {
    async execute<T>(
      effect: (signal: AbortSignal) => Promise<T>,
      options?: Readonly<{ parentSignal?: AbortSignal; }>,
    ): Promise<T> {
      const controller = new AbortController();
      const parentSignal = options?.parentSignal;
      if (parentSignal?.aborted === true) {
        controller.abort(parentSignal.reason);
      }
      const onParentAbort = (): void => {
        controller.abort(parentSignal?.reason); // Мост между внешним и локальным cancellation.
      };
      parentSignal?.addEventListener('abort', onParentAbort, { once: true });
      const timer = setTimeout(() => {
        controller.abort(new Error(`Remote provider timeout after ${timeoutMs}ms`)); // Timeout отменяет remote call.
      }, timeoutMs);
      try {
        return await effect(controller.signal);
      } finally {
        clearTimeout(timer);
        parentSignal?.removeEventListener('abort', onParentAbort);
      }
    },
  };
}

function mergeSignals(
  baseSignals: ClassificationSignals | undefined,
  externalSignals: Partial<ClassificationSignals>,
  mergeStrategy: MergeStrategy,
  asnMergeStrategy: AsnMergeStrategy,
): ClassificationSignals {
  switch (mergeStrategy) {
    case 'remote_wins':
      return Object.freeze({
        ...(baseSignals ?? {}),
        ...externalSignals,
      }) as ClassificationSignals;
    case 'local_wins':
      return Object.freeze({
        ...externalSignals,
        ...(baseSignals ?? {}),
      }) as ClassificationSignals;
    case 'max_risk':
      return mergeByMaxRisk(baseSignals, externalSignals, asnMergeStrategy);
    default: {
      const exhaustive: never = mergeStrategy;
      return exhaustive;
    }
  }
}

function validateStageConfig(
  config: RemoteProviderStageConfig,
): string | null {
  if (config.executionPolicy !== undefined && config.timeoutMs !== undefined) {
    return 'Provide either executionPolicy or timeoutMs, not both';
  }
  if (config.failurePolicy === 'fail_closed' && config.fallbackSignals === undefined) {
    return 'fail_closed requires explicit fallbackSignals';
  }
  return null;
}

/* ============================================================================
 * 4. API — STAGE FACTORY
 * ============================================================================
 */

/**
 * Создает pipeline-stage для remote classification provider.
 *
 * Инварианты конфигурации:
 * - нельзя задавать одновременно `executionPolicy` и `timeoutMs`
 * - для `failurePolicy: 'fail_closed'` обязателен `fallbackSignals`
 *
 * Stage behavior:
 * - dependsOn: `device`, `context`
 * - provides: `signals`
 * - при успехе:
 *   1) remote response sanitize
 *   2) `responseMapper` (по умолчанию deterministic mapping)
 *   3) sanitize mapped signals
 *   4) merge через `mergeStrategy` + `asnMergeStrategy`
 * - при ошибке/таймауте: deterministic fallback через `failurePolicy`
 *
 * Важно:
 * - `mergeStrategy` применяется только к успешному remote-path
 * - fallback-path использует фиксированную policy merge
 */
export function createRemoteProviderStage<
  TSlotMap extends RemoteProviderSlotMap,
>(
  config: RemoteProviderStageConfig,
): StagePlugin<TSlotMap, readonly ['signals']> {
  const configError = validateStageConfig(config);
  if (configError !== null) {
    // eslint-disable-next-line fp/no-throw -- Fail-fast: некорректная конфигурация должна прерывать создание stage.
    throw new Error(configError);
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS; // Дефолт только для built-in policy; infra может переопределить через executionPolicy.
  const policy = config.failurePolicy; // Политика обязательна: нет скрытого security-default.
  const mergeStrategy = config.mergeStrategy ?? DEFAULT_MERGE_STRATEGY;
  const asnMergeStrategy = config.asnMergeStrategy ?? DEFAULT_ASN_MERGE_STRATEGY;
  const fallbackSignals = config.fallbackSignals;
  const responseMapper = config.responseMapper ?? mapRemoteResponseToSignals; // OCP: кастомный mapper без правки stage.
  const executionPolicy = config.executionPolicy ?? createTimeoutExecutionPolicy(timeoutMs);
  const resolveFailure = policy === 'fail_open'
    ? (existingSignals: ClassificationSignals | undefined): ClassificationSignals =>
      mergeSignals(existingSignals, {}, 'local_wins', asnMergeStrategy)
    : (existingSignals: ClassificationSignals | undefined): ClassificationSignals =>
      mergeSignals(
        existingSignals,
        fallbackSignals as Partial<ClassificationSignals>,
        'max_risk',
        asnMergeStrategy,
      );

  return defineStage<TSlotMap>()({
    id: REMOTE_PROVIDER_STAGE_ID,
    provides: ['signals'] as const,
    dependsOn: ['device', 'context'] as const,
    async run(ctx: StageContext<TSlotMap>) {
      const device = ctx.slots.device;
      const context = ctx.slots.context;
      const currentSignals = ctx.slots.signals;

      if (device === undefined || context === undefined) {
        return {
          ok: false,
          reason: {
            kind: 'MISSING_DEPENDENCY',
            slot: device === undefined ? 'device' : 'context',
          },
        };
      }

      try {
        const executionOptions = ctx.abortSignal !== undefined
          ? { parentSignal: ctx.abortSignal }
          : undefined;
        const response: RemoteProviderResponse = await executionPolicy.execute(
          (signal) =>
            config.provider({
              device,
              context,
              signal,
            }),
          executionOptions, // Observability/retry/circuit-breaker реализуются в executionPolicy, stage остается domain-pure.
        );
        // Trust-boundary hardening: sanitize response до mapper и после mapper.
        const sanitizedResponse = sanitizeRemoteResponse(response);
        const mappedSignals = sanitizeSignals(responseMapper(sanitizedResponse));
        return {
          ok: true,
          slots: {
            signals: mergeSignals(currentSignals, mappedSignals, mergeStrategy, asnMergeStrategy),
          } as Pick<TSlotMap, 'signals'>,
        };
      } catch { // Ошибки/timeout нормализуются в policy-driven fallback, без throw наружу.
        return {
          ok: true,
          slots: {
            signals: resolveFailure(currentSignals),
          } as Pick<TSlotMap, 'signals'>,
        };
      }
    },
  });
}
