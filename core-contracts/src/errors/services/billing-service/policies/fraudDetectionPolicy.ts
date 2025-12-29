/**
 * @file fraudDetectionPolicy.ts – Fraud Detection Policy Decision Engine
 *
 * Decision engine для обнаружения мошеннических паттернов в платежных операциях LivAiBot.
 * Оценивает риск мошенничества на основе паттернов retry, платежей и контекста.
 *
 * ⚠️ ВАЖНО: Эта политика ТОЛЬКО оценивает риск мошенничества и НЕ влияет напрямую на:
 * - Money flow (платежи/возвраты)
 * - Блокировку аккаунтов
 * - Отказ в обслуживании
 * Это decision-only engine для информирования других политик (refund, retry).
 *
 * Архитектурные принципы:
 * - Registry-driven: правила обнаружения через конфигурируемый registry
 * - Immutable rules: правила неизменяемы после создания (versioning для изменений)
 * - Deterministic scoring: одинаковый input → одинаковый score (тестируемость)
 * - Stateless: не хранит состояние, легко масштабируется
 * - Effect-based: композиция через Effect (v3)
 * - Observable: структурированное логирование с correlation ID
 * - Type-safe: discriminated unions с приоритетами правил
 * - Short-circuit evaluation: ранний выход при достижении high risk
 *
 * Границы ответственности:
 * ✅ Анализ паттернов retry и платежей (зависит от paymentRetryPolicy)
 * ✅ Расчет fraud score на основе правил
 * ✅ Принятие решений о подозрительности с приоритетами
 * ✅ Логирование подозрительной активности с correlation
 * ✅ Интеграция с refund policy для решений о возвратах
 *
 * ❌ Блокировка платежей или аккаунтов
 * ❌ Выполнение возвратов средств
 * ❌ Хранение fraud данных или истории
 * ❌ Непосредственное влияние на money flow
 */

import { Effect } from 'effect';

import type {
  FraudDetectionServiceRegistry,
  FraudRuleEngineError,
  FraudRuleProviderError,
} from './fraudDetectionInterfaces.js';
import type { FraudContext, FraudDecision, FraudPolicyConfig } from './fraudDetectionTypes.js';

// ==================== CONSTANTS ====================

/** Максимальный fraud score (100 = максимальный риск) */
export const MAX_FRAUD_SCORE = 100;

/** Порог низкого риска мошенничества */
export const LOW_RISK_THRESHOLD = 20;

/** Порог высокого риска мошенничества */
export const HIGH_RISK_THRESHOLD = 50;

/** Максимальное количество правил для оценки (performance limit) */
export const MAX_RULES_EVALUATION = 50;

/** Таймаут для geo/IP lookups (мс) */
export const GEO_LOOKUP_TIMEOUT_MS = 5000;

/** Rate limit для external API calls (запросов в минуту) */
export const EXTERNAL_API_RATE_LIMIT = 100;

/** Порог velocity attack (попыток в минуту) */
export const VELOCITY_ATTACK_THRESHOLD = 10;

/** Порог excessive retries */
export const EXCESSIVE_RETRY_THRESHOLD = 5;

/** Порог unusual amount deviation (200% = 2.0) */
export const UNUSUAL_AMOUNT_DEVIATION = 2.0;

/** Порог rapid attempts (попыток за период) */
export const RAPID_ATTEMPTS_THRESHOLD = 3;

/** Период для velocity attack (минуты) */
export const VELOCITY_ATTACK_PERIOD_MINUTES = 1;

/** Период для rapid attempts (минуты) */
export const RAPID_ATTEMPTS_PERIOD_MINUTES = 5;

/** Минимальное количество платежей для анализа истории */
export const MIN_PAYMENTS_FOR_HISTORY_ANALYSIS = 3;

/** Количество последних попыток для анализа payment method */
export const PAYMENT_METHOD_HISTORY_LENGTH = 10;

/** Константы времени для расчетов */
export const TIME_CONSTANTS = {
  SECONDS_PER_MINUTE: 60,
  MILLISECONDS_PER_SECOND: 1000,
  /** Миллисекунды в минуте: 60 секунд × 1000 мс */
  MILLISECONDS_PER_MINUTE: 60000,
} as const;

// ==================== RE-EXPORT TYPES ====================

// Re-export types from fraudDetectionTypes.ts for backward compatibility
export type {
  DeviceFingerprint,
  FraudContext,
  FraudDecision,
  FraudPolicyConfig,
  FraudReason,
  FraudRule,
  GeolocationData,
  PaymentAttempt,
  PaymentDetails,
  RulePriority,
  UserPaymentHistory,
} from './fraudDetectionTypes.js';

// Re-export constants
export { RULE_PRIORITIES } from './fraudDetectionTypes.js';

// ==================== DECISION ENGINE ====================

/**
 * Оценивает политику обнаружения мошенничества.
 * Microservice-based decision engine с dependency injection.
 *
 * @param context Контекст для оценки fraud
 * @param config Конфигурация fraud policy
 * @param services Реестр сервисов для dependency injection
 * @returns FraudDecision с детерминированным результатом
 */
export function evaluateFraudDetectionPolicy(
  context: FraudContext,
  config: FraudPolicyConfig,
  services: FraudDetectionServiceRegistry,
): Effect.Effect<FraudDecision, FraudRuleProviderError | FraudRuleEngineError, never> {
  return Effect.gen(function*(_) {
    const startTime = Date.now();

    // Логируем начало оценки
    yield* _(Effect.logDebug('Starting fraud detection evaluation', {
      event: 'fraud_evaluation_started',
      correlationId: context.correlationId,
      userId: context.userHistory.userId,
      paymentId: context.paymentDetails.id,
      configVersion: config.version,
    }));

    // Short-circuit если политика отключена
    if (!config.enabled) {
      yield* _(Effect.logDebug('Fraud detection disabled', {
        event: 'fraud_evaluation_disabled',
        correlationId: context.correlationId,
      }));

      return {
        _tag: 'Clean' as const,
        score: 0,
        evaluatedRules: 0,
      };
    }

    // Загружаем правила через FraudRuleProvider
    const activeRules = yield* _(services.ruleProvider.loadRules(config, config.version));

    // Оцениваем правила через FraudRuleEngine
    const decision = yield* _(
      services.ruleEngine.evaluateRules(context, activeRules, config, config.version),
    );

    // Логируем финальное решение
    const endTime = Date.now();
    const latency = endTime - startTime;

    yield* _(Effect.logDebug('Fraud evaluation completed', {
      event: 'fraud_evaluation_completed',
      correlationId: context.correlationId,
      decision: decision._tag,
      finalScore: decision.score,
      evaluatedRules: decision.evaluatedRules,
      totalRules: activeRules.length,
      latencyMs: latency,
      triggeredRules: 'triggeredRules' in decision ? decision.triggeredRules : [],
      userId: context.userHistory.userId,
      paymentId: context.paymentDetails.id,
    }));

    // Alert если превышены thresholds
    if (decision._tag === 'HighRisk' || decision._tag === 'Suspicious') {
      // ⚠️ Per-transaction метрики (не агрегированные!)
      // suspiciousRate/highRiskRate = 0 или 1 для одного платежа
      // Обычно эти метрики считаются на N транзакциях (например, 15% suspicious из 100)
      // Для single-payment decision engine это допустимо, но может вводить в заблуждение
      // TODO: Добавить агрегированные метрики по окну времени/пользователю для более точных alerts
      const suspiciousRate = decision._tag === 'Suspicious' ? 1 : 0;
      const highRiskRate = decision._tag === 'HighRisk' ? 1 : 0;

      if (
        suspiciousRate >= config.alerts.suspiciousRateThreshold / MAX_FRAUD_SCORE
        || highRiskRate >= config.alerts.highRiskRateThreshold / MAX_FRAUD_SCORE
      ) {
        yield* _(Effect.logWarning('Fraud alert threshold exceeded', {
          event: 'fraud_alert_threshold_exceeded',
          correlationId: context.correlationId,
          decision: decision._tag,
          score: decision.score,
          suspiciousRate,
          highRiskRate,
          alertThresholds: config.alerts,
        }));
      }
    }

    // Alert по latency
    // ⚠️ Production consideration: 100ms может быть слишком агрессивно при external calls
    // Рекомендации для production:
    // 1. Измерять p95 latency вместо fixed threshold
    // 2. Увеличить порог до 500-1000ms с учетом network/external API latency
    // 3. Использовать adaptive thresholds на основе historical data
    if (latency > config.alerts.evaluationLatencyThresholdMs) {
      yield* _(Effect.logWarning('Fraud evaluation latency alert', {
        event: 'fraud_evaluation_latency_alert',
        correlationId: context.correlationId,
        latencyMs: latency,
        thresholdMs: config.alerts.evaluationLatencyThresholdMs,
      }));
    }

    return decision;
  });
}

// ==================== DEFAULT CONFIGURATION ====================

/** Дефолтная конфигурация fraud detection policy (production-ready для LivAiBot) */
export const DEFAULT_FRAUD_POLICY_CONFIG: FraudPolicyConfig = {
  rules: {}, // Правила загружаются через FraudRuleProvider
  thresholds: {
    lowRisk: LOW_RISK_THRESHOLD,
    highRisk: HIGH_RISK_THRESHOLD,
  },
  maxScore: MAX_FRAUD_SCORE,
  enabled: true,
  version: '1.0.0',
  performance: {
    maxRulesEvaluation: MAX_RULES_EVALUATION,
    shortCircuitThreshold: HIGH_RISK_THRESHOLD,
  },
  externalApis: {
    geoLookupRateLimit: EXTERNAL_API_RATE_LIMIT,
    externalCallTimeoutMs: GEO_LOOKUP_TIMEOUT_MS,
  },
  alerts: {
    suspiciousRateThreshold: 10, // 10%
    highRiskRateThreshold: 5, // 5%
    evaluationLatencyThresholdMs: 100, // ⚠️ 100ms - может быть слишком агрессивно для production с external calls
  },
} as const;
