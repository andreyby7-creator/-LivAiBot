/**
 * @file BillingServiceErrorRegistry.ts - Реестр SERVICE_BILLING_* кодов с метаданными
 *
 * Регистрирует billing service ошибки с расширенными метаданными:
 * - Поведенческие характеристики (refundable, retryable, visibility)
 * - Комплаенс требования (PCI, GDPR, audit)
 * - Бизнес-контекст (payment methods, subscriptions)
 * - Multi-region/multi-tenant tracking (regionId, tenantId)
 *
 * Используется совместно с Effect-based error handling и observability.
 */

import { SERVICE_ERROR_CODES } from '../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { BillingServiceError } from './BillingServiceErrorTypes.js';
import type { SupportedPaymentMethod } from './domain/index.js';
import type { ErrorCode } from '../../base/ErrorCode.js';
import type { ExtendedErrorCodeMetadata } from '../../base/ErrorCodeMeta.js';

// ==================== COMMON CONSTANTS ====================

/** Базовый URL документации ошибок */
export const BILLING_DOCS_BASE_URL = 'https://docs.livaibot.ai/errors/';

/** Общие фразы remediation */
export const BILLING_REMEDIATION_COMMON = {
  /** Обращение в поддержку */
  CONTACT_SUPPORT: 'обратитесь в поддержку',
  /** Проверка данных платежа */
  CHECK_PAYMENT_DATA: 'Проверьте данные платежа',
  /** Повтор попытки */
  RETRY_ATTEMPT: 'повторите попытку',
  /** Проверка условий возврата */
  CHECK_REFUND_TERMS: 'Проверьте условия возврата',
  /** Проверка статуса подписки */
  CHECK_SUBSCRIPTION_STATUS: 'Проверьте статус подписки',
} as const;

/** Дефолтные значения для multi-region/multi-tenant tracking */
export const BILLING_DEFAULTS = {
  /** Дефолтный регион для сервисов где регион не определен */
  REGION: 'global',
  /** Дефолтный tenant для сервисов где tenant не определен */
  TENANT: 'system',
} as const;

// ==================== BILLING-SPECIFIC METADATA TYPES ====================

/** Поведенческие метаданные billing операций */
export type BillingBehaviorMetadata = {
  /** Возможен ли возврат средств */
  readonly refundable: boolean;
  /** Требуется ли активная подписка */
  readonly subscriptionRequired: boolean;
  /** Видимость ошибки для пользователей */
  readonly visibility: 'public' | 'internal';
  /** Возможен ли повтор операции (retry) */
  readonly retryable: boolean;
  /** Стратегия повторов для retryable ошибок */
  readonly retryPolicy?: 'immediate' | 'delayed' | 'manual';
  /** Версия retry метаданных для future-proofing и совместимости */
  readonly retryMetadataVersion: 'v1';
};
/** Метаданные комплаенса и безопасности */
export type BillingComplianceMetadata = {
  /** Содержит ли чувствительную информацию о суммах */
  readonly amountSensitive: boolean;
  /** Риск мошенничества */
  readonly fraudRisk: 'low' | 'medium' | 'high';
  /** Требуется ли аудит операции */
  readonly auditRequired: boolean;
  /** Уровень требований комплаенса */
  readonly complianceLevel: 'pci' | 'gdpr' | 'standard';
};
/** Полные метаданные для billing service ошибок */
export type BillingMetadata =
  & BillingBehaviorMetadata
  & BillingComplianceMetadata
  & {
    /**
     * Метод оплаты (если специфичен для ошибки)
     *
     * Уровневый хинт сервиса для категоризации операций.
     * НЕ ДОЛЖЕН зависеть от конкретных SDK или провайдеров.
     * Использует только доменные типы (SupportedPaymentMethod).
     */
    readonly paymentMethod?: SupportedPaymentMethod;
    /**
     * Регион операции для отслеживания в multi-region системах
     *
     * Указывает географический регион где произошла ошибка.
     * Полезно для мониторинга и локализации проблем.
     * По умолчанию: 'global' для сервисов где регион не определен.
     */
    readonly regionId: string;
    /**
     * Tenant/organization для отслеживания в multi-tenant системах
     *
     * Указывает tenant/organization в multi-tenant системе.
     * Важно для изоляции данных и tenant-specific логики.
     * По умолчанию: 'system' для сервисов где tenant не определен.
     */
    readonly tenantId: string;
  };
/** Расширенные метаданные для billing service ошибок */
export type BillingServiceErrorMetadata = ExtendedErrorCodeMetadata & BillingMetadata;

// ==================== BILLING SERVICE ERROR REGISTRY ====================

/** SERVICE_BILLING_* коды с billing-specific метаданными */
export const BILLING_SERVICE_ERROR_REGISTRY = {
  // Payment Failed (SERVICE_BILLING_100)
  [SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED]: {
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
    description: 'Обработка платежа завершилась неудачей',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.SERVICE,
    httpStatus: 422, // Unprocessable Entity - семантическая ошибка валидации платежа
    internalCode: 'PAYMENT_FAILED',
    loggable: true,
    remediation:
      `${BILLING_REMEDIATION_COMMON.CHECK_PAYMENT_DATA} и ${BILLING_REMEDIATION_COMMON.RETRY_ATTEMPT}`,
    docsUrl: `${BILLING_DOCS_BASE_URL}payment-failed`,
    // Behavior metadata
    refundable: false,
    subscriptionRequired: false,
    visibility: 'public',
    retryable: true, // Сбои платежей могут быть временными
    retryPolicy: 'delayed', // Сбои платежей должны повторяться с задержкой
    retryMetadataVersion: 'v1',
    // Compliance metadata
    amountSensitive: true,
    fraudRisk: 'medium',
    auditRequired: true,
    complianceLevel: 'pci',
    // Multi-region/multi-tenant tracking
    regionId: BILLING_DEFAULTS.REGION,
    tenantId: BILLING_DEFAULTS.TENANT,
  } satisfies BillingServiceErrorMetadata,

  // Subscription Error (SERVICE_BILLING_101)
  [SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR]: {
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
    description: 'Ошибка управления подпиской',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.SERVICE,
    httpStatus: 403,
    internalCode: 'SUBSCRIPTION_ERROR',
    loggable: true,
    remediation:
      `${BILLING_REMEDIATION_COMMON.CHECK_SUBSCRIPTION_STATUS} или ${BILLING_REMEDIATION_COMMON.CONTACT_SUPPORT}`,
    docsUrl: `${BILLING_DOCS_BASE_URL}subscription-error`,
    // Behavior metadata
    refundable: false,
    subscriptionRequired: true,
    visibility: 'public',
    retryable: true, // Операции с подписками могут быть повторены
    retryPolicy: 'manual', // Ошибки подписок требуют ручной проверки
    retryMetadataVersion: 'v1',
    // Compliance metadata
    amountSensitive: false,
    fraudRisk: 'low',
    auditRequired: false,
    complianceLevel: 'standard',
    // Multi-region/multi-tenant tracking
    regionId: BILLING_DEFAULTS.REGION,
    tenantId: BILLING_DEFAULTS.TENANT,
  } satisfies BillingServiceErrorMetadata,

  // Refund Error (SERVICE_BILLING_102)
  [SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR]: {
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR,
    description: 'Ошибка обработки возврата средств',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.SERVICE,
    httpStatus: 400,
    internalCode: 'REFUND_ERROR',
    loggable: true,
    remediation:
      `${BILLING_REMEDIATION_COMMON.CHECK_REFUND_TERMS} или ${BILLING_REMEDIATION_COMMON.CONTACT_SUPPORT}`,
    docsUrl: `${BILLING_DOCS_BASE_URL}refund-error`,
    // Behavior metadata
    refundable: true,
    subscriptionRequired: false,
    visibility: 'public',
    retryable: false, // Возвраты не должны повторяться для избежания дубликатов
    retryMetadataVersion: 'v1',
    // Compliance metadata
    amountSensitive: true,
    fraudRisk: 'medium',
    auditRequired: true,
    complianceLevel: 'pci',
    // Multi-region/multi-tenant tracking
    regionId: BILLING_DEFAULTS.REGION,
    tenantId: BILLING_DEFAULTS.TENANT,
  } satisfies BillingServiceErrorMetadata,

  // Generic API Error (SERVICE_BILLING_109)
  [SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR]: {
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR,
    description: 'Неспецифицированная ошибка API платежного сервиса',
    severity: 'high',
    category: 'TECHNICAL',
    origin: ERROR_ORIGIN.SERVICE,
    httpStatus: 500,
    internalCode: 'GENERIC_API_ERROR',
    loggable: true,
    remediation: BILLING_REMEDIATION_COMMON.CONTACT_SUPPORT,
    docsUrl: `${BILLING_DOCS_BASE_URL}generic-api-error`,
    // Behavior metadata
    refundable: false,
    subscriptionRequired: false,
    visibility: 'public',
    retryable: true, // Общие API ошибки могут быть повторены
    retryPolicy: 'delayed',
    retryMetadataVersion: 'v1',
    // Compliance metadata
    amountSensitive: false,
    fraudRisk: 'low',
    auditRequired: true,
    complianceLevel: 'standard',
    // Multi-region/multi-tenant tracking
    regionId: BILLING_DEFAULTS.REGION,
    tenantId: BILLING_DEFAULTS.TENANT,
  } satisfies BillingServiceErrorMetadata,
} as const;

// ==================== COMPILE-TIME EXHAUSTIVENESS GUARD ====================

/** Compile-time guard для обеспечения полноты registry */
const exhaustivenessCheck: Record<BillingServiceError['code'], BillingServiceErrorMetadata> =
  BILLING_SERVICE_ERROR_REGISTRY;
// Type assertion для compile-time проверки полноты
void exhaustivenessCheck;

// ==================== LOOKUP FUNCTION ====================

/**
 * Получает метаданные для billing service ошибки
 * @param input BillingServiceError или ErrorCode
 * @returns метаданные ошибки или undefined если код не найден
 */
export function getBillingErrorMetadata(
  input: BillingServiceError | ErrorCode,
): BillingServiceErrorMetadata | undefined {
  const code = typeof input === 'string' ? input : input.code;
  // Безопасный lookup - проверяем наличие кода в registry
  if (code in BILLING_SERVICE_ERROR_REGISTRY) {
    return BILLING_SERVICE_ERROR_REGISTRY[code as keyof typeof BILLING_SERVICE_ERROR_REGISTRY];
  }
  return undefined;
}
