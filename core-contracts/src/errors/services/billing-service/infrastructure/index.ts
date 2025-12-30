/**
 * @file index.ts - Экспорт инфраструктурных ошибок billing service
 *
 * Ошибки взаимодействия с платежными провайдерами (WebPay, BePaid) и системные
 * ошибки инфраструктуры платежей. Включает API ошибки, недоступность шлюзов
 * и универсальные fallback ошибки.
 */

// ==================== WEBPAY API ERRORS ====================

export type {
  WebPayAPIError,
  WebPayAPIErrorContext,
  WebPayErrorCategory,
  WebPayErrorCode,
  WebPayHttpStatus,
  WebPayTransactionStatus,
} from './WebPayAPIError.js';

export {
  createWebPayAPIError,
  filterWebPayErrorsByCategory,
  getWebPayErrorCategory,
  getWebPayErrorCode,
  getWebPayHttpStatus,
  getWebPayLogger,
  getWebPayOrderId,
  getWebPayRawPayload,
  getWebPayTransactionId,
  getWebPayTransactionStatus,
  isValidWebPayAPIErrorContext,
  isWebPayAPIError,
  isWebPayCardError,
  isWebPayErrorInCategory,
  isWebPayRetryableError,
  setWebPayLogger,
  WEBPAY_ERROR_CATEGORIES,
  WEBPAY_ERROR_CODES,
  WEBPAY_HTTP_STATUSES,
} from './WebPayAPIError.js';

// ==================== BEPAID API ERRORS ====================

export type {
  BePaidAPIError,
  BePaidAPIErrorContext,
  BePaidErrorCategory,
  BePaidErrorCode,
  BePaidHttpStatus,
} from './BePaidAPIError.js';

export {
  BEPAID_ERROR_CATEGORIES,
  BEPAID_ERROR_CODES,
  BEPAID_HTTP_STATUSES,
  createBePaidAPIError,
  filterBePaidErrorsByCategory,
  getBePaidErrorCategory,
  getBePaidErrorCode,
  getBePaidHttpStatus,
  getBePaidLogger,
  getBePaidTransactionId,
  isBePaidAPIError,
  isBePaidCardError,
  isBePaidErrorInCategory,
  isBePaidRetryableError,
  isValidBePaidAPIErrorContext,
  setBePaidLogger,
} from './BePaidAPIError.js';

// ==================== SYSTEM INFRASTRUCTURE ERRORS ====================

export type {
  GatewayUnavailableReason,
  PaymentGatewayUnavailableError,
  PaymentGatewayUnavailableErrorContext,
} from './PaymentGatewayUnavailableError.js';

export type { GenericAPIError, GenericAPIErrorContext } from './GenericAPIError.js';

export {
  createPaymentGatewayUnavailableError,
  getEstimatedRecoveryTimeMin,
  getRetryAfterMs,
  getSourceErrorTag,
  getSuggestedAlternatives,
  getUnavailableProvider,
  getUnavailableReason,
  hasSuggestedAlternatives,
  isGatewayUnavailableRetryable,
  isPaymentGatewayUnavailableError,
  isValidPaymentGatewayUnavailableErrorContext,
  shouldConsiderAlternatives,
} from './PaymentGatewayUnavailableError.js';

export {
  createGenericAPIError,
  createGenericAPIErrorFromResponse,
  getGenericAPIErrorCorrelationId,
  getGenericAPIErrorHttpStatus,
  getGenericAPIErrorMessage,
  getGenericAPIErrorProvider,
  getGenericAPIErrorRawResponse,
  isGenericAPIError,
  isValidGenericAPIErrorContext,
} from './GenericAPIError.js';
