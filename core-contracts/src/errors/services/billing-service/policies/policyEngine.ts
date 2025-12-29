/**
 * @file policyEngine.ts – Unified Decision Engine
 *
 * Интегрированный decision engine для LivAiBot:
 * - Fraud Detection
 * - Refund Handling
 *
 * Все политики decision-only, stateless, Effect-based, multi-tenant ready.
 */

import { Effect } from 'effect';

import {
  DEFAULT_FRAUD_POLICY_CONFIG,
  evaluateFraudDetectionPolicy,
} from './fraudDetectionPolicy.js';
import { defaultFraudDetectionServices } from './fraudDetectionProviders.js';
import { DEFAULT_REFUND_POLICY_CONFIG, evaluateRefundPolicy } from './refundHandlingPolicy.js';

import type { FraudDetectionServiceRegistry } from './fraudDetectionInterfaces.js';
import type {
  FraudContext,
  FraudDecision,
  FraudPolicyConfig,
  PaymentDetails,
} from './fraudDetectionTypes.js';
import type { RefundContext, RefundDecision, RefundPolicyConfig } from './refundHandlingPolicy.js';

// ==================== TYPES ====================

export type PolicyEngineContext = {
  payment: PaymentDetails;
  fraudContext: FraudContext;
  flags?: Record<string, boolean>;
  correlationId: string;
};

export type PolicyEngineConfig = {
  fraudPolicy: FraudPolicyConfig;
  refundPolicy: RefundPolicyConfig;
};

// ==================== DEFAULT CONFIG ====================

export const DEFAULT_POLICY_ENGINE_CONFIG: PolicyEngineConfig = {
  fraudPolicy: DEFAULT_FRAUD_POLICY_CONFIG,
  refundPolicy: DEFAULT_REFUND_POLICY_CONFIG,
};

// ==================== POLICY ENGINE ====================

/**
 * Интегрированная оценка политики:
 * 1️⃣ Fraud Detection
 * 2️⃣ Refund Handling
 *
 * @param context Контекст платежа и fraud
 * @param config Конфигурация всех политик
 * @param services Сервисы для dependency injection
 */
export function evaluatePolicies(
  context: PolicyEngineContext,
  config: PolicyEngineConfig = DEFAULT_POLICY_ENGINE_CONFIG,
  services: FraudDetectionServiceRegistry = defaultFraudDetectionServices,
): Effect.Effect<{ fraud: FraudDecision; refund: RefundDecision; }, unknown, never> {
  return Effect.gen(function*(_) {
    const startTime = Date.now();

    // ==================== FRAUD DETECTION ====================
    const fraudDecision = yield* _(
      evaluateFraudDetectionPolicy(context.fraudContext, config.fraudPolicy, services),
    );

    // ==================== REFUND HANDLING ====================
    const refundContext: RefundContext = {
      payment: context.payment,
      fraudDecision,
      flags: context.flags ?? {},
      correlationId: context.correlationId,
    };

    const refundDecision = yield* _(
      evaluateRefundPolicy(refundContext, config.refundPolicy, services),
    );

    const endTime = Date.now();
    const latency = endTime - startTime;

    // ==================== LOGGING ====================
    yield* _(Effect.logDebug('Policy engine completed', {
      event: 'policy_engine_completed',
      correlationId: context.correlationId,
      paymentId: context.payment.id,
      fraudDecision: fraudDecision._tag,
      refundDecision: refundDecision._tag,
      latencyMs: latency,
    }));

    return { fraud: fraudDecision, refund: refundDecision };
  });
}
