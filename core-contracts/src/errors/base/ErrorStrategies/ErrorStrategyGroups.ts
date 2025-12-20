/**
 * @file ErrorStrategyGroups.ts - Групповые стратегии по префиксам кодов ошибок
 */

import { LIVAI_ERROR_CODES } from '../ErrorCode.js';

import {
  FALLBACK_STRATEGY,
  IGNORE_STRATEGY,
  LOG_AND_RETURN_STRATEGY,
} from './ErrorStrategyBase.js';
import {
  withAlert,
  withCircuitBreaker,
  withFallback,
  withRetry,
} from './ErrorStrategyModifiers.js';
import { ALERT_THRESHOLDS, CIRCUIT_BREAKER, RETRY } from './ErrorStrategyTypes.js';

import type {
  ErrorCodeGroup,
  ErrorStrategy,
  LivAiErrorCode,
  StrategyModifier,
} from './ErrorStrategyTypes.js';

// ==================== ERROR CODE CONSTANTS ====================

const DOMAIN_AUTH_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  LIVAI_ERROR_CODES.AUTH_TOKEN_EXPIRED,
  LIVAI_ERROR_CODES.AUTH_TOKEN_INVALID,
];

const DOMAIN_USER_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.USER_NOT_FOUND,
  LIVAI_ERROR_CODES.USER_ALREADY_EXISTS,
];

const DOMAIN_SUBSCRIPTION_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
  LIVAI_ERROR_CODES.SUBSCRIPTION_EXPIRED,
];

const DOMAIN_BOT_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.BOT_NOT_FOUND,
  LIVAI_ERROR_CODES.BOT_ALREADY_EXISTS,
];

const DOMAIN_TOKEN_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.TOKEN_INVALID,
  LIVAI_ERROR_CODES.TOKEN_EXPIRED,
];

const DOMAIN_INTEGRATION_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.INTEGRATION_NOT_FOUND,
  LIVAI_ERROR_CODES.INTEGRATION_INVALID_CONFIG,
];

const INFRA_DB_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.DB_CONNECTION_FAILED,
  LIVAI_ERROR_CODES.DB_QUERY_FAILED,
  LIVAI_ERROR_CODES.DB_TRANSACTION_FAILED,
];

const INFRA_CACHE_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.CACHE_CONNECTION_FAILED,
  LIVAI_ERROR_CODES.CACHE_SET_FAILED,
];

const INFRA_NETWORK_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.NETWORK_TIMEOUT,
  LIVAI_ERROR_CODES.NETWORK_CONNECTION_REFUSED,
];

const INFRA_EXTERNAL_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.EXTERNAL_API_UNAVAILABLE,
  LIVAI_ERROR_CODES.EXTERNAL_API_TIMEOUT,
];

const SERVICE_AI_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.AI_MODEL_UNAVAILABLE,
  LIVAI_ERROR_CODES.AI_PROCESSING_FAILED,
  LIVAI_ERROR_CODES.AI_INVALID_INPUT,
];

const SERVICE_BILLING_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.BILLING_PAYMENT_FAILED,
  LIVAI_ERROR_CODES.BILLING_INVALID_AMOUNT,
];

const SERVICE_MOBILE_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.USER_NOT_FOUND,
  LIVAI_ERROR_CODES.USER_INVALID_DATA,
];

const SERVICE_TENANT_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.TENANT_NOT_FOUND,
  LIVAI_ERROR_CODES.TENANT_LIMIT_EXCEEDED,
];

const SERVICE_FEATURE_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.FEATURE_NOT_AVAILABLE,
  LIVAI_ERROR_CODES.FEATURE_DISABLED,
];

const ADMIN_USER_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.USER_NOT_FOUND,
  LIVAI_ERROR_CODES.USER_ACCESS_DENIED,
];

const ADMIN_FINANCE_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.FINANCE_TRANSACTION_FAILED,
  LIVAI_ERROR_CODES.FINANCE_INSUFFICIENT_FUNDS,
];

const ADMIN_AUDIT_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.AUDIT_LOG_FAILED,
  LIVAI_ERROR_CODES.AUDIT_ACCESS_DENIED,
];

const ADMIN_INTEGRATION_CODES: readonly LivAiErrorCode[] = [
  LIVAI_ERROR_CODES.INTEGRATION_NOT_FOUND,
  LIVAI_ERROR_CODES.INTEGRATION_INVALID_CONFIG,
];

// ==================== GROUP STRATEGY FACTORY ====================

/** Универсальная фабрика для создания групповых стратегий */
const createGroupStrategy = (
  prefix: string,
  description: string,
  codes: readonly LivAiErrorCode[],
  base: ErrorStrategy<unknown>,
  modifiers: readonly StrategyModifier<unknown>[],
): ErrorCodeGroup => ({
  prefix,
  description,
  codes,
  strategy: modifiers.reduce((s, m) => m(s), base),
});

// ==================== GROUP STRATEGIES ====================

/** Групповые стратегии по префиксам кодов ошибок */
export const GROUP_STRATEGIES: readonly ErrorCodeGroup[] = [
  // DOMAIN стратегии (6 групп)
  createGroupStrategy(
    'DOMAIN_AUTH',
    'Ошибки аутентификации пользователей',
    DOMAIN_AUTH_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.DEFAULT_MAX), withAlert(ALERT_THRESHOLDS.DEFAULT, 'medium')],
  ),
  createGroupStrategy(
    'DOMAIN_USER',
    'Ошибки управления пользователями',
    DOMAIN_USER_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.MEDIUM)],
  ),
  createGroupStrategy(
    'DOMAIN_SUBSCRIPTION',
    'Ошибки подписок и биллинга',
    DOMAIN_SUBSCRIPTION_CODES,
    FALLBACK_STRATEGY,
    [withRetry(1), withFallback(null)],
  ), // fallback: null
  createGroupStrategy(
    'DOMAIN_BOT',
    'Ошибки ботов и AI агентов',
    DOMAIN_BOT_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.DEFAULT_MAX)],
  ),
  createGroupStrategy(
    'DOMAIN_TOKEN',
    'Ошибки токенов и авторизации',
    DOMAIN_TOKEN_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.MEDIUM), withAlert(ALERT_THRESHOLDS.MEDIUM, 'medium')],
  ),
  createGroupStrategy(
    'DOMAIN_INTEGRATION',
    'Ошибки внешних интеграций',
    DOMAIN_INTEGRATION_CODES,
    FALLBACK_STRATEGY,
    [withRetry(RETRY.LOW), withFallback('integration_error')],
  ), // fallback: 'integration_error'

  // INFRA стратегии (4 группы)
  createGroupStrategy('INFRA_DB', 'Ошибки базы данных', INFRA_DB_CODES, LOG_AND_RETURN_STRATEGY, [
    withRetry(RETRY.HIGH),
    withCircuitBreaker(CIRCUIT_BREAKER.DEFAULT_THRESHOLD),
  ]),
  createGroupStrategy(
    'INFRA_CACHE',
    'Ошибки кеширования (Redis/Memcached)',
    INFRA_CACHE_CODES,
    FALLBACK_STRATEGY,
    [withRetry(RETRY.MEDIUM), withFallback(null)],
  ), // fallback: null
  createGroupStrategy(
    'INFRA_NETWORK',
    'Ошибки сети и HTTP запросов',
    INFRA_NETWORK_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.DEFAULT_MAX)],
  ),
  createGroupStrategy(
    'INFRA_EXTERNAL',
    'Ошибки внешних сервисов',
    INFRA_EXTERNAL_CODES,
    FALLBACK_STRATEGY,
    [withRetry(RETRY.LOW), withFallback('service_unavailable')],
  ), // fallback: 'service_unavailable'

  // SERVICE стратегии (5 групп)
  createGroupStrategy(
    'SERVICE_AI',
    'Ошибки AI обработки и генерации',
    SERVICE_AI_CODES,
    FALLBACK_STRATEGY,
    [withRetry(RETRY.MEDIUM), withFallback(null)],
  ), // fallback: null
  createGroupStrategy(
    'SERVICE_BILLING',
    'Ошибки биллинга и платежей',
    SERVICE_BILLING_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.DEFAULT_MAX), withAlert(CIRCUIT_BREAKER.DEFAULT_THRESHOLD, 'high')],
  ),
  createGroupStrategy(
    'SERVICE_MOBILE',
    'Ошибки мобильных клиентов',
    SERVICE_MOBILE_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.LOW)],
  ),
  createGroupStrategy(
    'SERVICE_TENANT',
    'Ошибки мульти-тенантности',
    SERVICE_TENANT_CODES,
    FALLBACK_STRATEGY,
    [withRetry(RETRY.MEDIUM), withFallback('tenant_error')],
  ), // fallback: 'tenant_error'
  createGroupStrategy(
    'SERVICE_FEATURE',
    'Ошибки фич-флагов и A/B тестирования',
    SERVICE_FEATURE_CODES,
    IGNORE_STRATEGY,
    [],
  ),

  // ADMIN стратегии (4 группы)
  createGroupStrategy(
    'ADMIN_USER',
    'Ошибки администрирования пользователей',
    ADMIN_USER_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withAlert(1, 'critical')],
  ),
  createGroupStrategy(
    'ADMIN_FINANCE',
    'Ошибки финансового администрирования',
    ADMIN_FINANCE_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.LOW), withAlert(ALERT_THRESHOLDS.DEFAULT, 'high')],
  ),
  createGroupStrategy(
    'ADMIN_AUDIT',
    'Ошибки системы аудита',
    ADMIN_AUDIT_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withAlert(ALERT_THRESHOLDS.MEDIUM, 'medium')],
  ),
  createGroupStrategy(
    'ADMIN_INTEGRATION',
    'Ошибки администрирования интеграций',
    ADMIN_INTEGRATION_CODES,
    LOG_AND_RETURN_STRATEGY,
    [withRetry(RETRY.MEDIUM), withAlert(ALERT_THRESHOLDS.LOW, 'low')],
  ),
] as const;
