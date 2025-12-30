/**
 * @file monitoringPolicy.ts - Monitoring и observability политики для billing service
 *
 * Определяет правила для business impact оценки и monitoring приоритетов.
 * Вынос business logic из instrumentation для чистоты архитектуры.
 */

import { getBillingErrorMetadata } from '../BillingServiceErrorRegistry.js';

import type { BillingServiceError } from '../BillingServiceErrorTypes.js';

/**
 * Service-level error classification mapping
 *
 * ⚠️  SERVICE-LEVEL ABSTRACTION: Все ошибки абстрагированы от конкретных провайдеров (GENERIC).
 *     Это позволяет billing service быть provider-agnostic.
 *
 * TypeScript проверяет полноту mapping через satisfies.
 */
const ERROR_CLASSIFICATION_MAPPING = {
  PaymentFailedError: { provider: 'generic', errorClass: 'domain' },
  SubscriptionError: { provider: 'generic', errorClass: 'domain' },
  RefundError: { provider: 'generic', errorClass: 'domain' },
  InfrastructureUnknownError: { provider: 'generic', errorClass: 'infrastructure' },
} satisfies Record<
  BillingServiceError['_tag'],
  { provider: string; errorClass: 'domain' | 'infrastructure' | 'provider' | 'fraud'; }
>;

/** Оценивает бизнес-импакт ошибки для monitoring - extracted из instrumentation */
export const calculateBusinessImpact = (error: BillingServiceError): 'low' | 'medium' | 'high' => {
  const metadata = getBillingErrorMetadata(error);
  if (!metadata) return 'medium';

  // High impact: payment failures, refunds, subscription issues
  if (metadata.code.includes('PAYMENT_FAILED') || metadata.code.includes('REFUND')) {
    return 'high';
  }

  // Medium impact: subscription issues
  if (metadata.code.includes('SUBSCRIPTION')) {
    return 'medium';
  }

  return 'low';
};

/** Определяет приоритет мониторинга для ошибки - extracted из instrumentation */
export const calculateMonitoringPriority = (
  error: BillingServiceError,
): 'low' | 'medium' | 'high' => {
  const metadata = getBillingErrorMetadata(error);
  if (!metadata) return 'medium';

  // High priority: security/compliance issues, payment failures
  if (metadata.auditRequired || metadata.code.includes('PAYMENT_FAILED')) {
    return 'high';
  }

  // Medium priority: retryable errors, subscription issues
  if (metadata.retryable || metadata.code.includes('SUBSCRIPTION')) {
    return 'medium';
  }

  return 'low';
};

/** Получает metadata один раз и вычисляет derived attributes для метрик */
export const calculateMonitoringAttributes = (error: BillingServiceError): {
  errorTag: BillingServiceError['_tag'];
  errorClass: 'domain' | 'infrastructure' | 'provider' | 'fraud';
  severity: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: 'low' | 'medium' | 'high';
} => {
  const metadata = getBillingErrorMetadata(error);

  return {
    // Базовая классификация для метрик
    errorTag: error._tag,
    errorClass: detectErrorClass(error),

    // Расширенные атрибуты из registry для метрик
    severity: metadata?.severity ?? 'medium',

    // Бизнес-импакт оценка для alerting в метриках
    businessImpact: calculateBusinessImpact(error),
  };
};

/** Определяет класс ошибки - extracted из instrumentation */
const detectErrorClass = (
  error: BillingServiceError,
): 'domain' | 'infrastructure' | 'provider' | 'fraud' =>
  ERROR_CLASSIFICATION_MAPPING[error._tag].errorClass;
