/**
 * @file SubscriptionLimitError.ts - Доменные ошибки превышения лимитов подписок LivAiBot
 *
 * Бизнес-ошибки превышения лимитов подписок, тарифов и квот.
 * Включает проверки usage caps, plan limits и subscription constraints.
 *
 * Возможности:
 * - Бизнес-ограничения подписок (план, использование, квоты, tier constraints)
 * - Enterprise трассировка (subscriptionId, planId, current/allowed usage)
 * - Руководство по апгрейду (tier рекомендации, даты сброса, предложения)
 * - PCI-safe (без чувствительных billing данных)
 * - Готово к аудиту (timestamps, структурированный контекст)
 *
 * Будущие улучшения:
 * - Динамическое управление квотами
 * - Мульти-тенант изоляция
 * - Мониторинг использования в реальном времени
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

// ==================== CONSTANTS ====================

/** Количество процентов в единице (для расчетов процентов) */
export const PERCENT_BASE = 100;

/** Допустимые причины превышения лимитов подписки */
export const VALID_SUBSCRIPTION_LIMIT_REASONS: readonly SubscriptionLimitReason[] = [
  'plan-limit-exceeded',
  'usage-cap-reached',
  'subscription-expired',
  'quota-exhausted',
  'tier-upgrade-required',
  'feature-locked',
] as const;

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

// ==================== SUBSCRIPTION LIMIT TYPES ====================

/** Причины превышения лимитов подписки */
export type SubscriptionLimitReason =
  | 'plan-limit-exceeded' // Превышен лимит тарифного плана
  | 'usage-cap-reached' // Достигнут предел использования
  | 'subscription-expired' // Подписка истекла
  | 'quota-exhausted' // Исчерпана квота
  | 'tier-upgrade-required' // Требуется повышение уровня
  | 'feature-locked'; // Функция заблокирована для текущего тарифа

/** Контекст ошибки превышения лимитов подписки */
export type SubscriptionLimitErrorContext = {
  readonly type: 'subscription_limit';
  readonly reason: SubscriptionLimitReason;
  readonly rule: string; // Бизнес-правило лимита
  readonly planId: string; // ID тарифного плана
  readonly subscriptionId?: string; // ID подписки
  readonly currentUsage?: number; // Текущее использование
  readonly allowedUsage?: number; // Разрешенное использование
  readonly usageUnit?: string; // Единица измерения (requests, tokens, etc.)
  readonly resetDate?: Date | string; // Дата сброса лимита
  readonly upgradeOptions?: readonly string[]; // Варианты апгрейда
  readonly suggestions?: readonly string[]; // Предложения по исправлению
};

/** TaggedError для ошибок превышения лимитов подписки */
export type SubscriptionLimitError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.DOMAIN;
  readonly severity: typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details: SubscriptionLimitErrorContext;
  readonly timestamp: string;
}, 'SubscriptionLimitError'>;

/** Создает SubscriptionLimitError */
export function createSubscriptionLimitError(
  reason: SubscriptionLimitReason,
  rule: string,
  message: string,
  planId: string,
  context?: Omit<SubscriptionLimitErrorContext, 'type' | 'reason' | 'rule' | 'planId'>,
  severity?: typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL,
  timestamp?: string,
): SubscriptionLimitError {
  return {
    _tag: 'SubscriptionLimitError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: severity ?? ERROR_SEVERITY.HIGH,
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_LIMIT_EXCEEDED,
    message,
    details: {
      type: 'subscription_limit',
      reason,
      rule,
      planId,
      ...context,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as SubscriptionLimitError;
}

// ==================== TYPE GUARDS & HELPERS ====================

/** Проверяет SubscriptionLimitErrorContext */
export function isValidSubscriptionLimitErrorContext(
  context: unknown,
): context is SubscriptionLimitErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Обязательные поля
  if (ctx['type'] !== 'subscription_limit') return false;
  if (typeof ctx['reason'] !== 'string') return false;
  if (typeof ctx['rule'] !== 'string') return false;
  if (typeof ctx['planId'] !== 'string') return false;

  // Проверяем что reason допустимый
  if (!VALID_SUBSCRIPTION_LIMIT_REASONS.includes(ctx['reason'] as SubscriptionLimitReason)) {
    return false;
  }

  // Опциональные поля
  if (ctx['subscriptionId'] !== undefined && typeof ctx['subscriptionId'] !== 'string') {
    return false;
  }
  if (
    ctx['currentUsage'] !== undefined
    && (typeof ctx['currentUsage'] !== 'number' || ctx['currentUsage'] < 0)
  ) return false;
  if (
    ctx['allowedUsage'] !== undefined
    && (typeof ctx['allowedUsage'] !== 'number' || ctx['allowedUsage'] <= 0)
  ) return false;
  if (ctx['usageUnit'] !== undefined && typeof ctx['usageUnit'] !== 'string') return false;
  if (
    ctx['resetDate'] !== undefined
    && typeof ctx['resetDate'] !== 'string'
    && !(ctx['resetDate'] instanceof Date)
  ) return false;

  if (ctx['upgradeOptions'] !== undefined) {
    if (!Array.isArray(ctx['upgradeOptions'])) return false;
    if (ctx['upgradeOptions'].length === 0) return false;
    if (
      !ctx['upgradeOptions'].every((opt: unknown) =>
        typeof opt === 'string' && opt.trim().length > 0
      )
    ) return false;
  }

  if (ctx['suggestions'] !== undefined) {
    if (!Array.isArray(ctx['suggestions'])) return false;
    if (ctx['suggestions'].length === 0) return false;
    if (!ctx['suggestions'].every((s: unknown) => typeof s === 'string' && s.trim().length > 0)) {
      return false;
    }
  }

  return true;
}

/** Проверяет является ли ошибка SubscriptionLimitError */
export function isSubscriptionLimitError(
  error: unknown,
): error is SubscriptionLimitError {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as { _tag: string; })._tag === 'SubscriptionLimitError'
  );
}

/** Получает причину превышения лимита */
export function getSubscriptionLimitReason(
  error: SubscriptionLimitError,
): SubscriptionLimitReason {
  return error.details.reason;
}

/** Получает ID тарифного плана */
export function getSubscriptionPlanId(
  error: SubscriptionLimitError,
): string {
  return error.details.planId;
}

/** Получает текущее использование */
export function getCurrentUsage(
  error: SubscriptionLimitError,
): number | undefined {
  return error.details.currentUsage;
}

/** Получает разрешенное использование */
export function getAllowedUsage(
  error: SubscriptionLimitError,
): number | undefined {
  return error.details.allowedUsage;
}

/** Вычисляет процент использования лимита */
export function getUsagePercentage(
  error: SubscriptionLimitError,
): number {
  const current = error.details.currentUsage ?? 0;
  const allowed = error.details.allowedUsage;

  if (allowed === undefined || allowed === 0) {
    return 0; // Нет лимита = 0% использования
  }

  return Math.round((current / allowed) * PERCENT_BASE);
}

/** Проверяет требуется ли апгрейд */
export function requiresUpgrade(
  error: SubscriptionLimitError,
): boolean {
  return error.details.reason === 'tier-upgrade-required';
}

/** Получает варианты апгрейда */
export function getUpgradeOptions(
  error: SubscriptionLimitError,
): readonly string[] | undefined {
  return error.details.upgradeOptions;
}
