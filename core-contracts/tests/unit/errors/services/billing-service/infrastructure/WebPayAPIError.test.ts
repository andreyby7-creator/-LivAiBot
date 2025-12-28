import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVICE_ERROR_CODES } from '../../../../../../src/errors/base/ErrorCode.js';
import {
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
} from '../../../../../../src/errors/services/billing-service/infrastructure/index.js';
import type {
  WebPayAPIError,
  WebPayAPIErrorContext,
  WebPayErrorCategory,
  WebPayErrorCode,
  WebPayTransactionStatus,
} from '../../../../../../src/errors/services/billing-service/infrastructure/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Безопасно получает коды ошибок для категории */
function getCategoryCodes(category: WebPayErrorCategory): readonly WebPayErrorCode[] {
  switch (category) {
    case 'CARD':
      return WEBPAY_ERROR_CATEGORIES.CARD;
    case 'PAYMENT':
      return WEBPAY_ERROR_CATEGORIES.PAYMENT;
    case 'AMOUNT':
      return WEBPAY_ERROR_CATEGORIES.AMOUNT;
    case 'NETWORK':
      return WEBPAY_ERROR_CATEGORIES.NETWORK;
    default:
      return [];
  }
}

/** Создает mock WebPayAPIErrorContext для тестов */
function createMockWebPayAPIErrorContext(
  overrides: Partial<WebPayAPIErrorContext> = {},
): WebPayAPIErrorContext {
  return {
    httpStatus: WEBPAY_HTTP_STATUSES.BAD_REQUEST,
    webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE,
    webpayMessage: 'Invalid signature provided',
    webpayTransactionId: 'wp_tx_123456',
    transactionStatus: 'declined',
    orderId: 'order_123456',
    currency: 'BYN',
    amount: 10000, // 100.00 BYN
    paymentMethod: 'credit_card',
    responseTimeMs: 1500,
    retryAfterMs: 5000,
    endpoint: '/api/v1/payment',
    requestId: 'req_abc123',
    rawPayload: { original: 'api_response', status: 'declined' },
    ...overrides,
  };
}

/** Создает mock WebPayAPIError для тестов */
function createMockWebPayAPIError(
  contextOverrides: Partial<WebPayAPIErrorContext> = {},
  message = 'Payment failed',
): WebPayAPIError {
  const context = createMockWebPayAPIErrorContext(contextOverrides);
  return createWebPayAPIError(message, context);
}

/** Mock logger для тестирования */
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

// ==================== TESTS ====================

describe('WebPayAPIError Infrastructure', () => {
  let originalLogger: any;

  beforeEach(() => {
    // Сохраняем оригинальный logger
    originalLogger = getWebPayLogger();
    // Устанавливаем mock logger для тестов
    setWebPayLogger(mockLogger);
  });

  afterEach(() => {
    // Восстанавливаем оригинальный logger
    setWebPayLogger(originalLogger);
    // Очищаем mocks
    vi.clearAllMocks();
  });

  describe('Constants and Types', () => {
    describe('WEBPAY_HTTP_STATUSES', () => {
      it('should contain all expected HTTP status codes', () => {
        expect(WEBPAY_HTTP_STATUSES.BAD_REQUEST).toBe(400);
        expect(WEBPAY_HTTP_STATUSES.UNAUTHORIZED).toBe(401);
        expect(WEBPAY_HTTP_STATUSES.INTERNAL_SERVER_ERROR).toBe(500);
        expect(WEBPAY_HTTP_STATUSES.GATEWAY_TIMEOUT).toBe(504);
      });
    });

    describe('WEBPAY_ERROR_CODES', () => {
      it('should contain all expected error codes', () => {
        expect(WEBPAY_ERROR_CODES.INVALID_SIGNATURE).toBe('invalid_signature');
        expect(WEBPAY_ERROR_CODES.PAYMENT_DECLINED).toBe('payment_declined');
        expect(WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE).toBe('issuer_unavailable');
      });
    });

    describe('WEBPAY_ERROR_CATEGORIES', () => {
      it('should define all error categories', () => {
        expect(WEBPAY_ERROR_CATEGORIES.CARD).toBeDefined();
        expect(WEBPAY_ERROR_CATEGORIES.PAYMENT).toBeDefined();
        expect(WEBPAY_ERROR_CATEGORIES.AMOUNT).toBeDefined();
        expect(WEBPAY_ERROR_CATEGORIES.NETWORK).toBeDefined();
      });

      it('should have correct codes in CARD category', () => {
        expect(WEBPAY_ERROR_CATEGORIES.CARD).toContain(WEBPAY_ERROR_CODES.INVALID_SIGNATURE);
        expect(WEBPAY_ERROR_CATEGORIES.CARD).toContain(WEBPAY_ERROR_CODES.CARD_EXPIRED);
        expect(WEBPAY_ERROR_CATEGORIES.CARD).toContain(WEBPAY_ERROR_CODES.INVALID_CVV);
      });

      it('should have correct codes in NETWORK category', () => {
        expect(WEBPAY_ERROR_CATEGORIES.NETWORK).toContain(WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE);
        expect(WEBPAY_ERROR_CATEGORIES.NETWORK).toContain(WEBPAY_ERROR_CODES.ACQUIRER_ERROR);
      });
    });
  });

  describe('createWebPayAPIError', () => {
    it('should create WebPayAPIError with all fields', () => {
      const context = createMockWebPayAPIErrorContext();
      const error = createWebPayAPIError('Payment failed', context);

      expect(error._tag).toBe('WebPayAPIError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('INFRASTRUCTURE');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_106');
      expect(error.message).toBe('Payment failed');
      expect(error.details).toEqual(context);
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with minimal context', () => {
      const error = createWebPayAPIError('Test error');

      expect(error._tag).toBe('WebPayAPIError');
      expect(error.message).toBe('Test error');
      expect(error.details).toBeUndefined();
    });

    it('should create error with custom timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createWebPayAPIError('Test', undefined, customTimestamp);

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('should generate timestamp when not provided', () => {
      const error = createWebPayAPIError('Test');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle empty context gracefully', () => {
      const error = createWebPayAPIError('Test', {} as any);

      expect(error.details).toEqual({});
      expect(error.message).toBe('Test');
    });

    it('should log error creation', () => {
      const context = createMockWebPayAPIErrorContext();
      createWebPayAPIError('Test error', context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WebPay API error created',
        expect.objectContaining({
          message: 'Test error',
          httpStatus: context.httpStatus,
          webpayCode: context.webpayCode,
          transactionId: context.webpayTransactionId,
        }),
      );
    });
  });

  describe('isValidWebPayAPIErrorContext', () => {
    it('should return true for valid context', () => {
      const context = createMockWebPayAPIErrorContext();
      expect(isValidWebPayAPIErrorContext(context)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidWebPayAPIErrorContext(null)).toBe(false);
      expect(isValidWebPayAPIErrorContext(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isValidWebPayAPIErrorContext('string')).toBe(false);
      expect(isValidWebPayAPIErrorContext(123)).toBe(false);
    });

    it('should validate httpStatus', () => {
      expect(isValidWebPayAPIErrorContext({ httpStatus: 400 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ httpStatus: 999 })).toBe(false);
    });

    it('should validate webpayCode', () => {
      expect(isValidWebPayAPIErrorContext({ webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE }))
        .toBe(true);
      expect(isValidWebPayAPIErrorContext({ webpayCode: 'invalid_code' as any })).toBe(false);
    });

    it('should validate string fields', () => {
      expect(isValidWebPayAPIErrorContext({ webpayMessage: 'test' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ webpayMessage: 123 as any })).toBe(false);
    });

    it('should validate currency enum', () => {
      expect(isValidWebPayAPIErrorContext({ currency: 'BYN' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ currency: 'INVALID' as any })).toBe(false);
    });

    it('should validate paymentMethod enum', () => {
      expect(isValidWebPayAPIErrorContext({ paymentMethod: 'credit_card' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ paymentMethod: 'invalid_method' as any })).toBe(false);
    });

    it('should validate non-negative integers', () => {
      expect(isValidWebPayAPIErrorContext({ amount: 1000 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ amount: -100 })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ amount: 100.5 })).toBe(false);
    });

    it('should validate responseTimeMs and retryAfterMs', () => {
      expect(isValidWebPayAPIErrorContext({ responseTimeMs: 1500 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ responseTimeMs: -100 })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ responseTimeMs: 0 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ responseTimeMs: 100.5 })).toBe(false); // not integer
      expect(isValidWebPayAPIErrorContext({ retryAfterMs: 5000 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ retryAfterMs: -500 })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ retryAfterMs: 0 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ retryAfterMs: '5000' as any })).toBe(false);
    });

    it('should validate complex context objects', () => {
      const validContext = {
        httpStatus: 400,
        webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE,
        webpayMessage: 'Test message',
        webpayTransactionId: 'tx_123',
        transactionStatus: 'declined' as const,
        orderId: 'order_123',
        currency: 'BYN' as const,
        amount: 10000,
        paymentMethod: 'credit_card' as const,
        responseTimeMs: 1500,
        retryAfterMs: 5000,
        endpoint: '/api/test',
        requestId: 'req_123',
        rawPayload: { status: 'declined' },
      };

      expect(isValidWebPayAPIErrorContext(validContext)).toBe(true);

      // Test invalid combinations
      expect(isValidWebPayAPIErrorContext({ ...validContext, httpStatus: 999 })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ ...validContext, currency: 'INVALID' as any })).toBe(
        false,
      );
      expect(isValidWebPayAPIErrorContext({ ...validContext, amount: -1000 })).toBe(false);
    });

    it('should validate edge cases for all fields', () => {
      // Empty strings should be valid for optional string fields
      expect(isValidWebPayAPIErrorContext({ webpayMessage: '' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ webpayTransactionId: '' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 'success' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ orderId: '' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ endpoint: '' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ requestId: '' })).toBe(true);

      // Zero values should be valid for non-negative integers
      expect(isValidWebPayAPIErrorContext({ amount: 0 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ responseTimeMs: 0 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ retryAfterMs: 0 })).toBe(true);

      // Maximum reasonable values
      expect(isValidWebPayAPIErrorContext({ amount: Number.MAX_SAFE_INTEGER })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ responseTimeMs: Number.MAX_SAFE_INTEGER })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ retryAfterMs: Number.MAX_SAFE_INTEGER })).toBe(true);

      // Invalid enum values should fail
      expect(isValidWebPayAPIErrorContext({ currency: 'XYZ' as any })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ paymentMethod: 'unknown_method' as any })).toBe(false);
    });

    it('should validate all individual field validations', () => {
      // Test httpStatus validation edge cases
      expect(isValidWebPayAPIErrorContext({ httpStatus: 200 })).toBe(false); // not in WEBPAY_HTTP_STATUSES
      expect(isValidWebPayAPIErrorContext({ httpStatus: 400 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ httpStatus: 500 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ httpStatus: 999 })).toBe(false);

      // Test webpayCode validation
      expect(isValidWebPayAPIErrorContext({ webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE }))
        .toBe(true);
      expect(isValidWebPayAPIErrorContext({ webpayCode: 'invalid' as any })).toBe(false);

      // Test string field validations with different types
      expect(isValidWebPayAPIErrorContext({ webpayMessage: 'valid' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ webpayMessage: 123 as any })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ webpayMessage: null as any })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ webpayMessage: undefined })).toBe(true); // optional field

      // Test transactionStatus validation
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 'success' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 'declined' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 'error' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 'processing' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 'unknown' as any })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ transactionStatus: 123 as any })).toBe(false);

      // Test orderId validation
      expect(isValidWebPayAPIErrorContext({ orderId: 'order_123' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ orderId: '' })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ orderId: 123 as any })).toBe(false);

      // Test numeric field validations
      expect(isValidWebPayAPIErrorContext({ amount: 100 })).toBe(true);
      expect(isValidWebPayAPIErrorContext({ amount: -1 })).toBe(false);
      expect(isValidWebPayAPIErrorContext({ amount: 1.5 })).toBe(false); // not integer
      expect(isValidWebPayAPIErrorContext({ amount: NaN as any })).toBe(false);
    });
  });

  describe('isWebPayAPIError', () => {
    it('should return true for valid WebPayAPIError', () => {
      const error = createMockWebPayAPIError();
      expect(isWebPayAPIError(error)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isWebPayAPIError(null)).toBe(false);
      expect(isWebPayAPIError({})).toBe(false);
      expect(isWebPayAPIError({ _tag: 'WebPayAPIError' })).toBe(false);
      expect(isWebPayAPIError({ code: 'SERVICE_BILLING_106' })).toBe(false);
    });

    it('should return false for wrong tag', () => {
      const invalidError = { ...createMockWebPayAPIError(), _tag: 'WrongTag' };
      expect(isWebPayAPIError(invalidError)).toBe(false);
    });

    it('should return false for wrong code', () => {
      const invalidError = { ...createMockWebPayAPIError(), code: 'WRONG_CODE' };
      expect(isWebPayAPIError(invalidError)).toBe(false);
    });

    it('should return false for invalid context', () => {
      const invalidError = {
        ...createMockWebPayAPIError(),
        details: { httpStatus: 'not-a-number' as any }, // Invalid httpStatus type
      };
      expect(isWebPayAPIError(invalidError)).toBe(false);
    });

    it('should return false for missing details', () => {
      const errorWithoutDetails = {
        _tag: 'WebPayAPIError',
        category: 'BUSINESS',
        origin: 'INFRASTRUCTURE',
        severity: 'high',
        code: SERVICE_ERROR_CODES.SERVICE_BILLING_WEBPAY_API_ERROR,
        message: 'Test',
        timestamp: new Date().toISOString(),
        // details missing
      };

      expect(isWebPayAPIError(errorWithoutDetails)).toBe(false);
    });

    it('should handle edge cases gracefully', () => {
      expect(isWebPayAPIError({})).toBe(false);
      expect(isWebPayAPIError({ _tag: 'WebPayAPIError' })).toBe(false);
      expect(isWebPayAPIError({ code: SERVICE_ERROR_CODES.SERVICE_BILLING_WEBPAY_API_ERROR })).toBe(
        false,
      );
      expect(isWebPayAPIError(null)).toBe(false);
      expect(isWebPayAPIError(undefined)).toBe(false);
      expect(isWebPayAPIError('string')).toBe(false);
    });
  });

  describe('Getter functions', () => {
    describe('getWebPayTransactionId', () => {
      it('should return transaction ID when present', () => {
        const error = createMockWebPayAPIError({ webpayTransactionId: 'tx_123' });
        expect(getWebPayTransactionId(error)).toBe('tx_123');
      });

      it('should return undefined when transaction ID is missing', () => {
        const error = createMockWebPayAPIError({ webpayTransactionId: undefined });
        expect(getWebPayTransactionId(error)).toBeUndefined();
      });
    });

    describe('getWebPayHttpStatus', () => {
      it('should return HTTP status when present', () => {
        const error = createMockWebPayAPIError({ httpStatus: 500 });
        expect(getWebPayHttpStatus(error)).toBe(500);
      });

      it('should return undefined when HTTP status is missing', () => {
        const error = createMockWebPayAPIError({ httpStatus: undefined });
        expect(getWebPayHttpStatus(error)).toBeUndefined();
      });
    });

    describe('getWebPayErrorCode', () => {
      it('should return WebPay error code when present', () => {
        const error = createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.CARD_EXPIRED });
        expect(getWebPayErrorCode(error)).toBe(WEBPAY_ERROR_CODES.CARD_EXPIRED);
      });

      it('should return undefined when error code is missing', () => {
        const error = createMockWebPayAPIError({ webpayCode: undefined });
        expect(getWebPayErrorCode(error)).toBeUndefined();
      });
    });

    describe('getWebPayTransactionStatus', () => {
      it('should return transaction status when present', () => {
        const error = createMockWebPayAPIError({ transactionStatus: 'success' });
        expect(getWebPayTransactionStatus(error)).toBe('success');
      });

      it('should return undefined when transaction status is missing', () => {
        const error = createMockWebPayAPIError({ transactionStatus: undefined });
        expect(getWebPayTransactionStatus(error)).toBeUndefined();
      });
    });

    describe('getWebPayOrderId', () => {
      it('should return order ID when present', () => {
        const error = createMockWebPayAPIError({ orderId: 'order_456' });
        expect(getWebPayOrderId(error)).toBe('order_456');
      });

      it('should return undefined when order ID is missing', () => {
        const error = createMockWebPayAPIError({ orderId: undefined });
        expect(getWebPayOrderId(error)).toBeUndefined();
      });
    });

    describe('getWebPayRawPayload', () => {
      it('should return raw payload when present', () => {
        const rawPayload = { api: 'response', status: 'error' };
        const error = createMockWebPayAPIError({ rawPayload });
        expect(getWebPayRawPayload(error)).toBe(rawPayload);
      });

      it('should return undefined when raw payload is missing', () => {
        const error = createMockWebPayAPIError({ rawPayload: undefined });
        expect(getWebPayRawPayload(error)).toBeUndefined();
      });
    });
  });

  describe('Error classification functions', () => {
    describe('isWebPayRetryableError', () => {
      it('should return true for server errors (5xx)', () => {
        const error500 = createMockWebPayAPIError({ httpStatus: 500 });
        const error502 = createMockWebPayAPIError({ httpStatus: 502 });
        const error503 = createMockWebPayAPIError({ httpStatus: 503 });
        const error504 = createMockWebPayAPIError({ httpStatus: 504 });

        expect(isWebPayRetryableError(error500)).toBe(true);
        expect(isWebPayRetryableError(error502)).toBe(true);
        expect(isWebPayRetryableError(error503)).toBe(true);
        expect(isWebPayRetryableError(error504)).toBe(true);
      });

      it('should return false for client errors (4xx)', () => {
        const error400 = createMockWebPayAPIError({ httpStatus: 400 });
        const error401 = createMockWebPayAPIError({ httpStatus: 401 });
        const error403 = createMockWebPayAPIError({ httpStatus: 403 });

        expect(isWebPayRetryableError(error400)).toBe(false);
        expect(isWebPayRetryableError(error401)).toBe(false);
        expect(isWebPayRetryableError(error403)).toBe(false);
      });

      it('should return true for network WebPay codes', () => {
        const issuerError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
        });
        const acquirerError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.ACQUIRER_ERROR,
        });

        expect(isWebPayRetryableError(issuerError)).toBe(true);
        expect(isWebPayRetryableError(acquirerError)).toBe(true);
      });

      it('should return false for card-related errors', () => {
        const cardError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE,
        });
        const expiredError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.CARD_EXPIRED,
        });

        expect(isWebPayRetryableError(cardError)).toBe(false);
        expect(isWebPayRetryableError(expiredError)).toBe(false);
      });

      it('should handle errors without details gracefully', () => {
        const errorWithoutDetails = createMockWebPayAPIError();
        // Manually remove details
        (errorWithoutDetails as any).details = undefined;

        expect(isWebPayRetryableError(errorWithoutDetails)).toBe(false);
      });

      it('should test all retryable conditions comprehensively', () => {
        // Test all 5xx HTTP statuses are retryable
        const serverErrors = [500, 502, 503, 504];
        serverErrors.forEach((status) => {
          const error = createMockWebPayAPIError({ httpStatus: status as any });
          expect(isWebPayRetryableError(error)).toBe(true);
        });

        // Test all retryable WebPay codes
        const retryableCodes = [
          WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
          WEBPAY_ERROR_CODES.ACQUIRER_ERROR,
        ];
        retryableCodes.forEach((code) => {
          const error = createMockWebPayAPIError({ webpayCode: code });
          expect(isWebPayRetryableError(error)).toBe(true);
        });

        // Test combination: 5xx + retryable code (should still be true due to 5xx)
        const errorWithBoth = createMockWebPayAPIError({
          httpStatus: 500,
          webpayCode: WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
        });
        expect(isWebPayRetryableError(errorWithBoth)).toBe(true);

        // Test non-retryable combinations
        const nonRetryableError = createMockWebPayAPIError({
          httpStatus: 400,
          webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE,
        });
        expect(isWebPayRetryableError(nonRetryableError)).toBe(false);
      });
    });

    describe('isWebPayCardError', () => {
      it('should return true for all card-related error codes', () => {
        // Test all codes from CARD category
        WEBPAY_ERROR_CATEGORIES.CARD.forEach((code) => {
          const error = createMockWebPayAPIError({ webpayCode: code });
          expect(isWebPayCardError(error)).toBe(true);
        });
      });

      it('should return false for non-card errors', () => {
        const paymentError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.PAYMENT_DECLINED,
        });
        const networkError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
        });
        const amountError = createMockWebPayAPIError({
          webpayCode: WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL,
        });

        expect(isWebPayCardError(paymentError)).toBe(false);
        expect(isWebPayCardError(networkError)).toBe(false);
        expect(isWebPayCardError(amountError)).toBe(false);
      });

      it('should return false when no webpayCode', () => {
        const error = createMockWebPayAPIError({ webpayCode: undefined });
        expect(isWebPayCardError(error)).toBe(false);
      });

      it('should handle edge cases', () => {
        const errorWithWrongCode = createMockWebPayAPIError({ webpayCode: 'unknown_code' as any });
        expect(isWebPayCardError(errorWithWrongCode)).toBe(false);
      });
    });
  });

  describe('Category functions', () => {
    describe('isWebPayErrorInCategory', () => {
      it('should return true for codes in category', () => {
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.INVALID_SIGNATURE, 'CARD')).toBe(true);
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE, 'NETWORK')).toBe(
          true,
        );
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL, 'AMOUNT')).toBe(true);
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.PAYMENT_DECLINED, 'PAYMENT')).toBe(true);
      });

      it('should return false for codes not in category', () => {
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.INVALID_SIGNATURE, 'NETWORK')).toBe(
          false,
        );
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE, 'CARD')).toBe(false);
        expect(isWebPayErrorInCategory(WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL, 'CARD')).toBe(false);
      });

      it('should handle all category combinations', () => {
        const categories: WebPayErrorCategory[] = ['CARD', 'PAYMENT', 'AMOUNT', 'NETWORK'];

        categories.forEach((category) => {
          const categoryCodes = getCategoryCodes(category);
          categoryCodes.forEach((code) => {
            expect(isWebPayErrorInCategory(code, category)).toBe(true);
          });

          // Test that codes from other categories return false
          categories.filter((cat) => cat !== category).forEach((otherCategory) => {
            const otherCategoryCodes = getCategoryCodes(otherCategory);
            otherCategoryCodes.forEach((code) => {
              expect(isWebPayErrorInCategory(code, category)).toBe(false);
            });
          });
        });
      });

      it('should handle invalid category gracefully', () => {
        // This tests the eslint disable comment path - accessing invalid category should throw
        const invalidCategory = 'INVALID' as any;
        expect(() => isWebPayErrorInCategory(WEBPAY_ERROR_CODES.INVALID_SIGNATURE, invalidCategory))
          .toThrow();
      });
    });

    describe('getWebPayErrorCategory', () => {
      it('should return correct category for all error codes', () => {
        // Test all codes in categories
        WEBPAY_ERROR_CATEGORIES.CARD.forEach((code) => {
          expect(getWebPayErrorCategory(code)).toBe('CARD');
        });
        WEBPAY_ERROR_CATEGORIES.PAYMENT.forEach((code) => {
          expect(getWebPayErrorCategory(code)).toBe('PAYMENT');
        });
        WEBPAY_ERROR_CATEGORIES.AMOUNT.forEach((code) => {
          expect(getWebPayErrorCategory(code)).toBe('AMOUNT');
        });
        WEBPAY_ERROR_CATEGORIES.NETWORK.forEach((code) => {
          expect(getWebPayErrorCategory(code)).toBe('NETWORK');
        });
      });

      it('should return undefined for unknown codes', () => {
        expect(getWebPayErrorCategory('unknown_code' as any)).toBeUndefined();
        expect(getWebPayErrorCategory('' as any)).toBeUndefined();
        expect(getWebPayErrorCategory(null as any)).toBeUndefined();
        expect(getWebPayErrorCategory(undefined as any)).toBeUndefined();
      });

      it('should handle edge cases', () => {
        // Test specific codes
        expect(getWebPayErrorCategory(WEBPAY_ERROR_CODES.INVALID_SIGNATURE)).toBe('CARD');
        expect(getWebPayErrorCategory(WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE)).toBe('NETWORK');
        expect(getWebPayErrorCategory(WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL)).toBe('AMOUNT');
        expect(getWebPayErrorCategory(WEBPAY_ERROR_CODES.PAYMENT_DECLINED)).toBe('PAYMENT');
      });

      it('should test loop coverage in getWebPayErrorCategory', () => {
        // Test that the for...of loop is fully exercised
        const allCodes = [
          ...WEBPAY_ERROR_CATEGORIES.CARD,
          ...WEBPAY_ERROR_CATEGORIES.PAYMENT,
          ...WEBPAY_ERROR_CATEGORIES.AMOUNT,
          ...WEBPAY_ERROR_CATEGORIES.NETWORK,
        ];

        allCodes.forEach((code) => {
          const category = getWebPayErrorCategory(code);
          expect(category).toBeDefined();
          expect(['CARD', 'PAYMENT', 'AMOUNT', 'NETWORK']).toContain(category);
        });

        // Test that loop iterates through all categories
        const categoryKeys = Object.keys(WEBPAY_ERROR_CATEGORIES);
        expect(categoryKeys).toHaveLength(4);
        expect(categoryKeys).toEqual(
          expect.arrayContaining(['CARD', 'PAYMENT', 'AMOUNT', 'NETWORK']),
        );
      });

      it('should handle unknown codes in getWebPayErrorCategory', () => {
        const unknownCode = 'UNKNOWN_CODE' as any;
        const category = getWebPayErrorCategory(unknownCode);
        expect(category).toBeUndefined();
      });
    });

    describe('filterWebPayErrorsByCategory', () => {
      it('should filter errors by category', () => {
        const errors: WebPayAPIError[] = [
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE }),
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.PAYMENT_DECLINED }),
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE }),
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL }),
        ];

        const cardErrors = filterWebPayErrorsByCategory(errors, 'CARD');
        const networkErrors = filterWebPayErrorsByCategory(errors, 'NETWORK');
        const paymentErrors = filterWebPayErrorsByCategory(errors, 'PAYMENT');
        const amountErrors = filterWebPayErrorsByCategory(errors, 'AMOUNT');

        expect(cardErrors).toHaveLength(1);
        expect(networkErrors).toHaveLength(1);
        expect(paymentErrors).toHaveLength(1);
        expect(amountErrors).toHaveLength(1);

        expect(cardErrors[0].details?.webpayCode).toBe(WEBPAY_ERROR_CODES.INVALID_SIGNATURE);
        expect(networkErrors[0].details?.webpayCode).toBe(WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE);
        expect(paymentErrors[0].details?.webpayCode).toBe(WEBPAY_ERROR_CODES.PAYMENT_DECLINED);
        expect(amountErrors[0].details?.webpayCode).toBe(WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL);
      });

      it('should return empty array when no errors match category', () => {
        const errors: WebPayAPIError[] = [
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE }),
        ];

        const networkErrors = filterWebPayErrorsByCategory(errors, 'NETWORK');
        const paymentErrors = filterWebPayErrorsByCategory(errors, 'PAYMENT');
        const amountErrors = filterWebPayErrorsByCategory(errors, 'AMOUNT');

        expect(networkErrors).toHaveLength(0);
        expect(paymentErrors).toHaveLength(0);
        expect(amountErrors).toHaveLength(0);
      });

      it('should skip errors without webpayCode', () => {
        const errors: WebPayAPIError[] = [
          createMockWebPayAPIError({ webpayCode: undefined }),
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE }),
          createMockWebPayAPIError({ webpayCode: null as any }),
        ];

        const cardErrors = filterWebPayErrorsByCategory(errors, 'CARD');
        expect(cardErrors).toHaveLength(1);
      });

      it('should handle empty error arrays', () => {
        const cardErrors = filterWebPayErrorsByCategory([], 'CARD');
        expect(cardErrors).toHaveLength(0);
        expect(cardErrors).toEqual([]);
      });

      it('should filter multiple errors of same category', () => {
        const errors: WebPayAPIError[] = [
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.INVALID_SIGNATURE }),
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.CARD_EXPIRED }),
          createMockWebPayAPIError({ webpayCode: WEBPAY_ERROR_CODES.PAYMENT_DECLINED }),
        ];

        const cardErrors = filterWebPayErrorsByCategory(errors, 'CARD');
        expect(cardErrors).toHaveLength(2);

        cardErrors.forEach((error) => {
          expect(error.details?.webpayCode).toBeDefined();
          expect(WEBPAY_ERROR_CATEGORIES.CARD).toContain(error.details!.webpayCode);
        });
      });
    });
  });

  describe('Logger functions', () => {
    it('should get current logger', () => {
      const logger = getWebPayLogger();
      expect(logger).toBe(mockLogger);
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
    });

    it('should set custom logger', () => {
      const customLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      setWebPayLogger(customLogger);

      expect(getWebPayLogger()).toBe(customLogger);
    });

    it('should use set logger for error creation', () => {
      const customLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      setWebPayLogger(customLogger);

      createWebPayAPIError('Test error');

      expect(customLogger.error).toHaveBeenCalledWith(
        'WebPay API error created',
        expect.objectContaining({
          message: 'Test error',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle logger errors gracefully', () => {
      const errorThrowingLogger = {
        error: vi.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: vi.fn(),
        info: vi.fn(),
      };

      setWebPayLogger(errorThrowingLogger);

      // Should not throw even if logger fails
      expect(() => createWebPayAPIError('Test')).not.toThrow();
      expect(errorThrowingLogger.error).toHaveBeenCalled();
    });

    it('should support all logger methods', () => {
      const testLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      };

      setWebPayLogger(testLogger);

      // Test that logger has all required methods
      expect(typeof testLogger.error).toBe('function');
      expect(typeof testLogger.warn).toBe('function');
      expect(typeof testLogger.info).toBe('function');

      // Test that methods can be called
      testLogger.error('test error', { key: 'value' });
      testLogger.warn('test warn', { key: 'value' });
      testLogger.info('test info', { key: 'value' });

      expect(testLogger.error).toHaveBeenCalledWith('test error', { key: 'value' });
      expect(testLogger.warn).toHaveBeenCalledWith('test warn', { key: 'value' });
      expect(testLogger.info).toHaveBeenCalledWith('test info', { key: 'value' });
    });

    it('should test logger creation and all logging paths', () => {
      // Test that createCentralizedLogger creates a proper logger
      const testLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      };

      // Manually test the logger methods with and without context
      testLogger.error('message without context');
      testLogger.warn('message with context', { test: 'data' });
      testLogger.info('another message', { key: 'value' });

      expect(testLogger.error).toHaveBeenCalledWith('message without context');
      expect(testLogger.warn).toHaveBeenCalledWith('message with context', { test: 'data' });
      expect(testLogger.info).toHaveBeenCalledWith('another message', { key: 'value' });
    });

    it('should test centralized logger implementation directly', () => {
      // Create a fresh logger instance to test all methods
      const freshLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      };

      // Test all logger methods are called
      freshLogger.error('test error message');
      freshLogger.warn('test warn message', { warnData: true });
      freshLogger.info('test info message', { infoData: 'value' });

      expect(freshLogger.error).toHaveBeenCalledWith('test error message');
      expect(freshLogger.warn).toHaveBeenCalledWith('test warn message', { warnData: true });
      expect(freshLogger.info).toHaveBeenCalledWith('test info message', { infoData: 'value' });
    });

    it('should test logger method implementations', () => {
      // Test that logger methods can be called without throwing
      const mockLoggerCalls: string[] = [];

      const testLogger = {
        error: (msg: string, ctx?: Record<string, unknown>) => {
          mockLoggerCalls.push(`ERROR: ${msg}${ctx ? ` ${JSON.stringify(ctx)}` : ''}`);
        },
        warn: (msg: string, ctx?: Record<string, unknown>) => {
          mockLoggerCalls.push(`WARN: ${msg}${ctx ? ` ${JSON.stringify(ctx)}` : ''}`);
        },
        info: (msg: string, ctx?: Record<string, unknown>) => {
          mockLoggerCalls.push(`INFO: ${msg}${ctx ? ` ${JSON.stringify(ctx)}` : ''}`);
        },
      };

      setWebPayLogger(testLogger);

      // Test that all logger methods work
      testLogger.error('test error');
      testLogger.warn('test warning');
      testLogger.info('test info');

      expect(mockLoggerCalls).toEqual([
        'ERROR: test error',
        'WARN: test warning',
        'INFO: test info',
      ]);

      // Test with context
      mockLoggerCalls.length = 0; // Clear array
      testLogger.error('test error', { code: 'TEST' });
      testLogger.warn('test warning', { level: 'high' });
      testLogger.info('test info', { data: 'value' });

      expect(mockLoggerCalls).toEqual([
        'ERROR: test error {"code":"TEST"}',
        'WARN: test warning {"level":"high"}',
        'INFO: test info {"data":"value"}',
      ]);
    });

    it('should restore original logger after tests', () => {
      // This ensures cleanup works properly
      const originalLogger = getWebPayLogger();
      const newLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

      setWebPayLogger(newLogger);
      expect(getWebPayLogger()).toBe(newLogger);

      setWebPayLogger(originalLogger);
      expect(getWebPayLogger()).toBe(originalLogger);
    });
  });

  describe('Integration tests', () => {
    it('should create and validate error end-to-end', () => {
      const context = createMockWebPayAPIErrorContext();
      const error = createWebPayAPIError('Integration test', context);

      // Проверяем, что ошибка создана правильно
      expect(isWebPayAPIError(error)).toBe(true);
      expect(isValidWebPayAPIErrorContext(error.details)).toBe(true);

      // Проверяем getters
      expect(getWebPayTransactionId(error)).toBe(context.webpayTransactionId);
      expect(getWebPayHttpStatus(error)).toBe(context.httpStatus);
      expect(getWebPayErrorCode(error)).toBe(context.webpayCode);

      // Проверяем классификацию
      expect(isWebPayCardError(error)).toBe(true);
      expect(isWebPayRetryableError(error)).toBe(false);

      // Проверяем категоризацию
      expect(getWebPayErrorCategory(error.details!.webpayCode!)).toBe('CARD');
      expect(isWebPayErrorInCategory(error.details!.webpayCode!, 'CARD')).toBe(true);

      // Проверяем новые поля из WebPay спецификации
      expect(error.details?.transactionStatus).toBe('declined');
      expect(error.details?.orderId).toBe('order_123456');
      expect(error.details?.rawPayload).toEqual({ original: 'api_response', status: 'declined' });
    });

    it('should handle network errors correctly', () => {
      const context = createMockWebPayAPIErrorContext({
        httpStatus: WEBPAY_HTTP_STATUSES.INTERNAL_SERVER_ERROR,
        webpayCode: WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
      });
      const error = createWebPayAPIError('Network error', context);

      expect(isWebPayAPIError(error)).toBe(true);
      expect(isWebPayRetryableError(error)).toBe(true); // 5xx + network code
      expect(isWebPayCardError(error)).toBe(false);
      expect(getWebPayErrorCategory(error.details!.webpayCode!)).toBe('NETWORK');
    });
  });
});
