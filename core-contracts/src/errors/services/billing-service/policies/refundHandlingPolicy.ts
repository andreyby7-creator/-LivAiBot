/**
 * @file refundHandlingPolicy.ts – Refund Handling Policy Decision Engine
 *
 * Decision engine для оценки возможности возврата средств (refund) на основе
 * результатов fraud detection и retry/payment context.
 *
 * ⚠️ ВАЖНО: Эта политика **только оценивает вероятность и допустимость возврата**.
 * - Не выполняет реальных возвратов
 * - Не влияет на money flow напрямую
 *
 * Архитектурные принципы:
 * - Decision-only: информирует downstream сервисы
 * - Effect-based: композиция через Effect
 * - Immutable rules: правила неизменяемы
 * - Observable: структурированное логирование
 * - Multi-tenant ready: через service registry
 * - Type-safe: discriminated unions для решений
 * - Short-circuit: при high-risk fraud возврат блокируется
 */

import { Effect } from 'effect';

import type { FraudDetectionServiceRegistry } from './fraudDetectionInterfaces.js';
import type { FraudDecision, PaymentDetails } from './fraudDetectionTypes.js';

// ==================== TYPES ====================

/** Решение по возврату платежа */
export type RefundDecision =
  | { readonly _tag: 'Approve'; readonly reason: string; readonly score: number; }
  | {
    readonly _tag: 'Conditional';
    readonly reason: string;
    readonly score: number;
    readonly conditions: readonly string[];
  }
  | { readonly _tag: 'Deny'; readonly reason: string; readonly score: number; };

/** Контекст для оценки возврата */
export type RefundContext = {
  /** Детали платежа */
  readonly payment: PaymentDetails;
  /** Решение fraud detection */
  readonly fraudDecision: FraudDecision;
  /** Feature flags для A/B testing и gradual rollout */
  readonly flags?: Record<string, boolean>;
  /** Correlation ID для tracing */
  readonly correlationId: string;
};

// ==================== CONSTANTS ====================

/** Максимальный score для refund decision */
export const MAX_REFUND_SCORE = 100;

/** Порог для автоматического approve */
export const APPROVE_THRESHOLD = 30;

/** Порог для conditional review */
export const CONDITIONAL_THRESHOLD = 60;

/** Порог, выше которого refund полностью блокируется */
export const DENY_THRESHOLD = 80;

// ==================== REFUND POLICY CONFIG ====================

/** Конфигурация политики возврата */
export type RefundPolicyConfig = {
  /** Включена ли политика */
  readonly enabled: boolean;
  /** Версия политики */
  readonly version: string;
  /** Пороги score для принятия решения */
  readonly thresholds: {
    approve: number;
    conditional: number;
    deny: number;
  };
  /** Scores для разных типов fraud decision */
  readonly scores: {
    clean: number;
    suspicious: number;
    highRisk: number;
  };
  /** Максимальный score */
  readonly maxScore: number;
  /** Alert thresholds */
  readonly alerts: {
    evaluationLatencyThresholdMs: number;
  };
};

// ==================== DEFAULT CONFIG ====================

export const DEFAULT_REFUND_POLICY_CONFIG: RefundPolicyConfig = {
  enabled: true,
  version: '1.0.0',
  thresholds: {
    approve: APPROVE_THRESHOLD,
    conditional: CONDITIONAL_THRESHOLD,
    deny: DENY_THRESHOLD,
  },
  scores: {
    clean: 10,
    suspicious: 50,
    highRisk: 90,
  },
  maxScore: MAX_REFUND_SCORE,
  alerts: {
    evaluationLatencyThresholdMs: 100, // ⚠️ 100ms - может быть слишком агрессивно для production
  },
};

// ==================== DECISION ENGINE ====================

/**
 * Оценивает возможность возврата средств.
 *
 * @param context Контекст платежа и fraud decision
 * @param config Конфигурация refund policy
 * @param services Сервисы для dependency injection
 * @returns RefundDecision с детерминированным результатом
 */
export function evaluateRefundPolicy(
  context: RefundContext,
  config: RefundPolicyConfig,
  services: FraudDetectionServiceRegistry,
): Effect.Effect<RefundDecision, never, never> {
  return Effect.gen(function*(_) {
    // Services reserved for future use (multi-tenant, health checks, etc.)
    void services;

    const startTime = Date.now();

    yield* _(Effect.logDebug('Starting refund evaluation', {
      event: 'refund_evaluation_started',
      correlationId: context.correlationId,
      paymentId: context.payment.id,
      fraudDecision: context.fraudDecision._tag,
      configVersion: config.version,
    }));

    if (!config.enabled) {
      yield* _(Effect.logDebug('Refund policy disabled', {
        event: 'refund_evaluation_disabled',
        correlationId: context.correlationId,
        paymentId: context.payment.id,
      }));

      return { _tag: 'Approve', reason: 'Policy disabled', score: 0 };
    }

    // Основная логика оценки
    let decision: RefundDecision;
    let score = 0;
    let conditions: readonly string[] = [];

    switch (context.fraudDecision._tag) {
      case 'Clean':
        score = config.scores.clean;
        decision = { _tag: 'Approve', reason: 'Payment clean', score };
        break;

      case 'Suspicious':
        score = config.scores.suspicious;
        conditions = ['Suspicious fraud score'] as const;
        decision = { _tag: 'Conditional', reason: 'Payment flagged suspicious', score, conditions };
        break;

      case 'HighRisk':
        score = config.scores.highRisk;
        conditions = ['High-risk fraud detected'] as const;
        decision = { _tag: 'Deny', reason: 'High risk payment', score };
        break;
    }

    // Учет feature flags для экспериментов
    if (context.flags?.['forceConditional'] === true && decision._tag === 'Approve') {
      conditions = ['Forced conditional via feature flag'] as const;
      decision = { _tag: 'Conditional', reason: 'Forced conditional', score, conditions };
    }

    // Применяем thresholds конфигурации
    if (score <= config.thresholds.approve) {
      decision = { _tag: 'Approve', reason: decision.reason, score };
    } else if (score <= config.thresholds.conditional) {
      decision = { _tag: 'Conditional', reason: decision.reason, score, conditions };
    } else {
      decision = { _tag: 'Deny', reason: decision.reason, score };
    }

    // Логируем финальное решение
    const endTime = Date.now();
    const latency = endTime - startTime;

    yield* _(Effect.logDebug('Refund evaluation completed', {
      event: 'refund_evaluation_completed',
      correlationId: context.correlationId,
      paymentId: context.payment.id,
      decision: decision._tag,
      score: decision.score,
      conditions: 'conditions' in decision ? decision.conditions : [],
      latencyMs: latency,
    }));

    // Alert по latency
    if (latency > config.alerts.evaluationLatencyThresholdMs) {
      yield* _(Effect.logWarning('Refund evaluation latency alert', {
        event: 'refund_evaluation_latency_alert',
        correlationId: context.correlationId,
        paymentId: context.payment.id,
        latencyMs: latency,
        thresholdMs: config.alerts.evaluationLatencyThresholdMs,
      }));
    }

    return decision;
  });
}
