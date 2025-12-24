/**
 * @file RateLimitError.ts - Ошибки превышения лимитов Yandex AI API
 *
 * Описывает ошибки при превышении rate limits Yandex Cloud AI:
 * - per-minute/hour/day limits
 * - burst limits
 * - quota exhaustion
 * - intelligent backoff strategies
 *
 * ❗ Содержит ML-семантику rate limiting для AI моделей.
 * Используется policies layer → retry strategies → observability.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/* ========================== CONSTANTS ========================== */

/** Вендор AI-платформы */
export const AI_VENDOR = 'yandex_cloud' as const;

/** Типы rate limit ограничений */
export type RateLimitKind =
  | 'per_minute'
  | 'per_hour'
  | 'per_day'
  | 'burst'
  | 'quota';

/** Стратегия восстановления для rate limit */
export type RateLimitRecoveryStrategy =
  | 'exponential_backoff'
  | 'fixed_delay'
  | 'immediate_retry'
  | 'fail_fast';

/** Единицы измерения rate limit */
export type RateLimitUnit = 'requests' | 'tokens' | 'bytes';

/* ========================== CONTEXT ========================== */

/** Контекст ошибки rate limit Yandex AI */
export interface RateLimitErrorContext {
  /** Тип доменного контекста */
  readonly type: 'yandex_ai_rate_limit';

  /** Вендор AI-платформы */
  readonly vendor: typeof AI_VENDOR;

  /** Тип rate limit ограничения */
  readonly limitKind: RateLimitKind;

  /** Рекомендуемая стратегия восстановления */
  readonly recoveryStrategy: RateLimitRecoveryStrategy;

  /** Единица измерения лимита */
  readonly unit: RateLimitUnit;

  /** Текущий usage в пределах окна */
  readonly currentUsage: number;

  /** Максимально допустимый лимит */
  readonly limit: number;

  /** Размер превышения (вычисляется автоматически) */
  readonly excess: number;

  /** Время окна rate limit (ms) */
  readonly windowMs: number;

  /** Время до сброса лимита (ms) */
  readonly resetTimeMs: number;

  /** Жесткое ограничение (quota) vs мягкое (rate limit) */
  readonly hardLimit: boolean;

  /** Endpoint или операция, которая вызвала лимит */
  readonly endpoint?: string;

  /** Тип модели AI (если применимо) */
  readonly modelType?: string;

  /** Рекомендуемая задержка перед retry (ms) */
  readonly recommendedDelayMs?: number;

  /** Количество предыдущих retry попыток */
  readonly retryCount?: number;

  /** Максимальное количество retry */
  readonly maxRetries?: number;
}

/* ========================== ERROR TYPE ========================== */

/** TaggedError для ошибок rate limit Yandex AI */
export type RateLimitError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.TECHNICAL;
    readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
    readonly severity: typeof ERROR_SEVERITY.MEDIUM;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details: RateLimitErrorContext;
    readonly timestamp: string;
  },
  'RateLimitError'
>;

/* ========================== FACTORY ========================== */

/** Базовый конструктор ошибки rate limit Yandex AI */
export function createRateLimitError(
  code: ErrorCode,
  message: string,
  details: Omit<RateLimitErrorContext, 'type' | 'vendor' | 'excess'>,
  timestamp?: string,
): RateLimitError {
  const excess = Math.max(0, details.currentUsage - details.limit);

  return {
    _tag: 'RateLimitError',
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: {
      type: 'yandex_ai_rate_limit',
      vendor: AI_VENDOR,
      excess,
      ...details,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as RateLimitError;
}

/* ========================== SPECIALIZED CREATORS ========================== */

/** Превышение per-minute лимита */
export function createPerMinuteLimitError(
  currentUsage: number,
  limit: number,
  endpoint?: string,
  modelType?: string,
): RateLimitError {
  const resetTimeMs = 60 * 1000; // 1 minute
  const recommendedDelayMs = Math.min(resetTimeMs, 30000); // Max 30 seconds

  return createRateLimitError(
    'INFRA_AI_RATE_LIMIT_PER_MINUTE' as ErrorCode,
    `Превышен лимит запросов в минуту: ${currentUsage}/${limit} (${
      currentUsage - limit
    } превышение)`,
    {
      limitKind: 'per_minute',
      recoveryStrategy: 'exponential_backoff',
      unit: 'requests',
      currentUsage,
      limit,
      windowMs: resetTimeMs,
      resetTimeMs,
      hardLimit: false,
      recommendedDelayMs,
      ...(endpoint !== undefined && { endpoint }),
      ...(modelType !== undefined && { modelType }),
    } as Omit<RateLimitErrorContext, 'type' | 'vendor' | 'excess'>,
  );
}

/** Превышение per-hour лимита */
export function createPerHourLimitError(
  currentUsage: number,
  limit: number,
  endpoint?: string,
  modelType?: string,
): RateLimitError {
  const resetTimeMs = 60 * 60 * 1000; // 1 hour
  const recommendedDelayMs = Math.min(resetTimeMs / 60, 300000); // Max 5 minutes

  return createRateLimitError(
    'INFRA_AI_RATE_LIMIT_PER_HOUR' as ErrorCode,
    `Превышен лимит запросов в час: ${currentUsage}/${limit} (${currentUsage - limit} превышение)`,
    {
      limitKind: 'per_hour',
      recoveryStrategy: 'fixed_delay',
      unit: 'requests',
      currentUsage,
      limit,
      windowMs: resetTimeMs,
      resetTimeMs,
      hardLimit: false,
      recommendedDelayMs,
      ...(endpoint !== undefined && { endpoint }),
      ...(modelType !== undefined && { modelType }),
    } as Omit<RateLimitErrorContext, 'type' | 'vendor' | 'excess'>,
  );
}

/** Превышение per-day лимита */
export function createPerDayLimitError(
  currentUsage: number,
  limit: number,
  endpoint?: string,
  modelType?: string,
): RateLimitError {
  const resetTimeMs = 24 * 60 * 60 * 1000; // 24 hours
  const recommendedDelayMs = Math.min(resetTimeMs / 24, 3600000); // Max 1 hour

  return createRateLimitError(
    'INFRA_AI_RATE_LIMIT_PER_DAY' as ErrorCode,
    `Превышен лимит запросов в сутки: ${currentUsage}/${limit} (${
      currentUsage - limit
    } превышение)`,
    {
      limitKind: 'per_day',
      recoveryStrategy: 'fail_fast',
      unit: 'requests',
      currentUsage,
      limit,
      windowMs: resetTimeMs,
      resetTimeMs,
      hardLimit: false,
      recommendedDelayMs,
      ...(endpoint !== undefined && { endpoint }),
      ...(modelType !== undefined && { modelType }),
    } as Omit<RateLimitErrorContext, 'type' | 'vendor' | 'excess'>,
  );
}

/** Превышение burst лимита */
export function createBurstLimitError(
  currentUsage: number,
  limit: number,
  windowMs: number,
  endpoint?: string,
  modelType?: string,
): RateLimitError {
  const recommendedDelayMs = Math.min(windowMs / 10, 10000); // Max 10 seconds

  return createRateLimitError(
    'INFRA_AI_RATE_LIMIT_BURST' as ErrorCode,
    `Превышен burst лимит: ${currentUsage}/${limit} за ${windowMs}ms (${
      currentUsage - limit
    } превышение)`,
    {
      limitKind: 'burst',
      recoveryStrategy: 'immediate_retry',
      unit: 'requests',
      currentUsage,
      limit,
      windowMs,
      resetTimeMs: windowMs,
      hardLimit: false,
      recommendedDelayMs,
      ...(endpoint !== undefined && { endpoint }),
      ...(modelType !== undefined && { modelType }),
    } as Omit<RateLimitErrorContext, 'type' | 'vendor' | 'excess'>,
  );
}

/** Исчерпание квоты токенов */
export function createQuotaExhaustionError(
  currentUsage: number,
  limit: number,
  modelType?: string,
  endpoint?: string,
): RateLimitError {
  return createRateLimitError(
    'INFRA_AI_QUOTA_EXHAUSTED' as ErrorCode,
    `Исчерпана квота токенов: ${currentUsage}/${limit} (${currentUsage - limit} превышение)`,
    {
      limitKind: 'quota',
      recoveryStrategy: 'fail_fast',
      unit: 'tokens',
      currentUsage,
      limit,
      windowMs: 24 * 60 * 60 * 1000, // Daily quota
      resetTimeMs: 24 * 60 * 60 * 1000,
      hardLimit: true,
      ...(modelType !== undefined && { modelType }),
      ...(endpoint !== undefined && { endpoint }),
    } as Omit<RateLimitErrorContext, 'type' | 'vendor' | 'excess'>,
  );
}

/* ========================== POLICY HELPERS ========================== */

/** Определяет стратегию восстановления для rate limit */
export function getRateLimitRecoveryStrategy(
  error: RateLimitError,
): RateLimitRecoveryStrategy {
  return error.details.recoveryStrategy;
}

/** Проверяет, допустим ли retry для rate limit ошибки */
export function isRateLimitRetriable(
  error: RateLimitError,
): boolean {
  return error.details.recoveryStrategy !== 'fail_fast';
}

/** Получает рекомендуемую задержку перед retry */
export function getRecommendedRetryDelay(
  error: RateLimitError,
): number {
  return error.details.recommendedDelayMs ?? 1000; // Default 1 second
}

/** Вычисляет процент использования лимита */
export function getRateLimitUsagePercentage(
  error: RateLimitError,
): number {
  const { currentUsage, limit } = error.details;
  return Math.round((currentUsage / limit) * 100);
}

/** Проверяет, является ли ошибка критической (более 90% использования) */
export function isRateLimitCritical(
  error: RateLimitError,
): boolean {
  return getRateLimitUsagePercentage(error) > 90;
}

/** Проверяет, является ли ограничение жестким (quota) */
export function isHardLimit(
  error: RateLimitError,
): boolean {
  return error.details.hardLimit;
}

/** Получает время до сброса лимита в читаемом формате */
export function getTimeUntilReset(
  error: RateLimitError,
): string {
  const resetTimeMs = error.details.resetTimeMs;
  if (resetTimeMs <= 0) return 'Немедленно';

  const seconds = Math.floor(resetTimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м`;
  } else if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  } else {
    return `${seconds}с`;
  }
}
