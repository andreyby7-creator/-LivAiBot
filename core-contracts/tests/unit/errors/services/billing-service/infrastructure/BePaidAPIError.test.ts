import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVICE_ERROR_CODES } from '../../../../../../src/errors/base/ErrorCode.js';
import {
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
} from '../../../../../../src/errors/services/billing-service/infrastructure/index.js';
import type {
  BePaidAPIError,
  BePaidAPIErrorContext,
  BePaidErrorCategory,
  BePaidErrorCode,
} from '../../../../../../src/errors/services/billing-service/infrastructure/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Безопасно получает коды ошибок для категории */
function getCategoryCodes(category: BePaidErrorCategory): readonly BePaidErrorCode[] {
  switch (category) {
    case 'SYSTEM':
      return BEPAID_ERROR_CATEGORIES.SYSTEM;
    case 'CARD_PROCESSING':
      return BEPAID_ERROR_CATEGORIES.CARD_PROCESSING;
    case 'APM':
      return BEPAID_ERROR_CATEGORIES.APM;
    case 'VALIDATION':
      return BEPAID_ERROR_CATEGORIES.VALIDATION;
    case 'APM_VALIDATION':
      return BEPAID_ERROR_CATEGORIES.APM_VALIDATION;
    case 'THREEDS':
      return BEPAID_ERROR_CATEGORIES.THREEDS;
    case 'ROUTING':
      return BEPAID_ERROR_CATEGORIES.ROUTING;
    case 'SUBSCRIPTION':
      return BEPAID_ERROR_CATEGORIES.SUBSCRIPTION;
    case 'SECURITY':
      return BEPAID_ERROR_CATEGORIES.SECURITY;
    default:
      return [];
  }
}

/** Создает mock BePaidAPIErrorContext для тестов */
function createMockBePaidAPIErrorContext(
  overrides: Partial<BePaidAPIErrorContext> = {},
): BePaidAPIErrorContext {
  return {
    httpStatus: BEPAID_HTTP_STATUSES.BAD_REQUEST,
    bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR,
    bepaidMessage: 'Authorization error occurred',
    bepaidErrors: {
      system: ['System error occurred'],
      validation: ['Invalid payment data'],
    },
    bepaidTransactionId: 'bp_tx_123456',
    trackingId: 'track_789',
    transactionState: 'failed',
    currency: 'BYN',
    amount: 10000, // 100.00 BYN
    paymentMethod: 'credit_card',
    responseTimeMs: 1500,
    retryAfterMs: 5000,
    endpoint: '/api/v1/payment',
    requestId: 'req_abc123',
    gatewayId: 'gw_123',
    shopId: 'shop_456',
    orderId: 'order_789',
    threeDsStatus: 'failed',
    providerCode: 'original_error_code',
    rawResponse: { original: 'api_response' },
    ...overrides,
  };
}

/** Создает mock BePaidAPIError для тестов */
function createMockBePaidAPIError(
  contextOverrides: Partial<BePaidAPIErrorContext> = {},
  message = 'Payment failed',
): BePaidAPIError {
  const context = createMockBePaidAPIErrorContext(contextOverrides);
  return createBePaidAPIError(message, context);
}

/** Mock logger для тестирования */
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

// ==================== TESTS ====================

describe('BePaidAPIError Infrastructure', () => {
  let originalLogger: any;

  beforeEach(() => {
    // Сохраняем оригинальный logger
    originalLogger = getBePaidLogger();
    // Устанавливаем mock logger для тестов
    setBePaidLogger(mockLogger);
  });

  afterEach(() => {
    // Восстанавливаем оригинальный logger
    setBePaidLogger(originalLogger);
    // Очищаем mocks
    vi.clearAllMocks();
  });

  describe('Constants and Types', () => {
    describe('BEPAID_HTTP_STATUSES', () => {
      it('should contain all expected HTTP status codes', () => {
        expect(BEPAID_HTTP_STATUSES.BAD_REQUEST).toBe(400);
        expect(BEPAID_HTTP_STATUSES.UNAUTHORIZED).toBe(401);
        expect(BEPAID_HTTP_STATUSES.INTERNAL_SERVER_ERROR).toBe(500);
        expect(BEPAID_HTTP_STATUSES.GATEWAY_TIMEOUT).toBe(504);
      });
    });

    describe('BEPAID_ERROR_CODES', () => {
      it('should contain all expected BePaid error codes', () => {
        expect(BEPAID_ERROR_CODES.SUCCESS).toBe('S.0000');
        expect(BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR).toBe('F.0102');
        expect(BEPAID_ERROR_CODES.VALIDATION_GATEWAY_NOT_FOUND).toBe('E.1003');
        expect(BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED).toBe('F.4001');
        expect(BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR).toBe('F.2001');
      });

      it('should have correct error code prefixes', () => {
        // Success codes
        expect(BEPAID_ERROR_CODES.SUCCESS.startsWith('S.')).toBe(true);

        // Processing errors
        expect(BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR.startsWith('F.01')).toBe(true);

        // Validation errors
        expect(BEPAID_ERROR_CODES.VALIDATION_GATEWAY_NOT_FOUND.startsWith('E.1')).toBe(true);

        // 3DS errors
        expect(BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED.startsWith('F.4')).toBe(true);

        // Routing errors
        expect(BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR.startsWith('F.2')).toBe(true);
      });
    });

    describe('BEPAID_ERROR_CATEGORIES', () => {
      it('should define all BePaid error categories', () => {
        expect(BEPAID_ERROR_CATEGORIES.SYSTEM).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.CARD_PROCESSING).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.APM).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.VALIDATION).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.THREEDS).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.ROUTING).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.SUBSCRIPTION).toBeDefined();
        expect(BEPAID_ERROR_CATEGORIES.SECURITY).toBeDefined();
      });

      it('should have correct codes in CARD_PROCESSING category', () => {
        expect(BEPAID_ERROR_CATEGORIES.CARD_PROCESSING).toContain(
          BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR,
        );
        expect(BEPAID_ERROR_CATEGORIES.CARD_PROCESSING).toContain(
          BEPAID_ERROR_CODES.PROCESSING_CARD_DECLINE,
        );
        expect(BEPAID_ERROR_CATEGORIES.CARD_PROCESSING).toContain(
          BEPAID_ERROR_CODES.PROCESSING_INVALID_CVV,
        );
      });

      it('should have correct codes in THREEDS category', () => {
        expect(BEPAID_ERROR_CATEGORIES.THREEDS).toContain(BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED);
        expect(BEPAID_ERROR_CATEGORIES.THREEDS).toContain(BEPAID_ERROR_CODES.THREEDS_NOT_ENROLLED);
        expect(BEPAID_ERROR_CATEGORIES.THREEDS).toContain(BEPAID_ERROR_CODES.THREEDS_TIMEOUT);
      });

      it('should have correct codes in SECURITY category', () => {
        expect(BEPAID_ERROR_CATEGORIES.SECURITY).toContain(BEPAID_ERROR_CODES.RISK_DECLINE);
        expect(BEPAID_ERROR_CATEGORIES.SECURITY).toContain(BEPAID_ERROR_CODES.FRAUD_DETECTED);
        expect(BEPAID_ERROR_CATEGORIES.SECURITY).toContain(BEPAID_ERROR_CODES.SECURITY_VIOLATION);
      });
    });
  });

  describe('createBePaidAPIError', () => {
    it('should create BePaidAPIError with all fields', () => {
      const context = createMockBePaidAPIErrorContext();
      const error = createBePaidAPIError('Payment failed', context);

      expect(error._tag).toBe('BePaidAPIError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('INFRASTRUCTURE');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_107');
      expect(error.message).toBe('Payment failed');
      expect(error.details).toEqual(context);
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with minimal context', () => {
      const error = createBePaidAPIError('Test error');

      expect(error._tag).toBe('BePaidAPIError');
      expect(error.message).toBe('Test error');
      expect(error.details).toBeUndefined();
      expect(error.code).toBe('SERVICE_BILLING_107');
    });

    it('should create error with custom timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createBePaidAPIError('Test', undefined, customTimestamp);

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('should log error creation with BePaid context', () => {
      const context = createMockBePaidAPIErrorContext();
      createBePaidAPIError('Test error', context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'BePaid API error created',
        expect.objectContaining({
          message: 'Test error',
          httpStatus: context.httpStatus,
          bepaidCode: context.bepaidCode,
          transactionId: context.bepaidTransactionId,
        }),
      );
    });

    it('should handle rawResponse in context', () => {
      const rawResponse = { original: 'api_response', nested: { data: true } };
      const error = createBePaidAPIError('Test', { rawResponse });

      expect(error.details?.rawResponse).toEqual(rawResponse);
    });

    it('should handle logger errors gracefully', () => {
      const errorThrowingLogger = {
        error: vi.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: vi.fn(),
        info: vi.fn(),
      };

      setBePaidLogger(errorThrowingLogger);

      // Should not throw despite logger error
      expect(() => createBePaidAPIError('Test')).not.toThrow();
      expect(errorThrowingLogger.error).toHaveBeenCalled();
    });
  });

  describe('isValidBePaidAPIErrorContext', () => {
    it('should return true for valid context', () => {
      const context = createMockBePaidAPIErrorContext();
      expect(isValidBePaidAPIErrorContext(context)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidBePaidAPIErrorContext(null)).toBe(false);
      expect(isValidBePaidAPIErrorContext(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isValidBePaidAPIErrorContext('string')).toBe(false);
      expect(isValidBePaidAPIErrorContext(123)).toBe(false);
    });

    it('should validate httpStatus', () => {
      expect(isValidBePaidAPIErrorContext({ httpStatus: 400 })).toBe(true);
      expect(isValidBePaidAPIErrorContext({ httpStatus: 999 })).toBe(false);
    });

    it('should validate bepaidCode', () => {
      expect(isValidBePaidAPIErrorContext({ bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR }))
        .toBe(true);
      expect(isValidBePaidAPIErrorContext({ bepaidCode: 'invalid' as any })).toBe(false);
    });

    it('should validate bepaidErrors structure', () => {
      expect(isValidBePaidAPIErrorContext({
        bepaidErrors: { system: ['error1'], validation: ['error2'] },
      })).toBe(true);

      expect(isValidBePaidAPIErrorContext({
        bepaidErrors: { system: 'not array' as any },
      })).toBe(false);

      expect(isValidBePaidAPIErrorContext({
        bepaidErrors: { system: [123 as any] },
      })).toBe(false);
    });

    it('should validate BePaid-specific fields', () => {
      expect(isValidBePaidAPIErrorContext({
        gatewayId: 'gw_123',
        shopId: 'shop_456',
        orderId: 'order_789',
        trackingId: 'track_123',
        transactionState: 'failed',
        threeDsStatus: 'success',
        providerCode: 'orig_code',
      })).toBe(true);

      expect(isValidBePaidAPIErrorContext({
        gatewayId: 123 as any, // should be string
      })).toBe(false);
    });

    it('should validate complex context objects', () => {
      const validContext = createMockBePaidAPIErrorContext();

      expect(isValidBePaidAPIErrorContext(validContext)).toBe(true);

      // Test invalid combinations - cover all validation branches
      expect(isValidBePaidAPIErrorContext({ ...validContext, httpStatus: 999 })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, bepaidCode: 'invalid_code' as any }))
        .toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, bepaidMessage: 123 as any })).toBe(
        false,
      );
      expect(isValidBePaidAPIErrorContext({
        ...validContext,
        bepaidErrors: 'not_object' as any,
      })).toBe(false);
      expect(isValidBePaidAPIErrorContext({
        ...validContext,
        bepaidErrors: null as any,
      })).toBe(false);
      expect(isValidBePaidAPIErrorContext({
        ...validContext,
        bepaidErrors: { system: 'not_array' as any },
      })).toBe(false);
      expect(isValidBePaidAPIErrorContext({
        ...validContext,
        bepaidErrors: { system: [123 as any] },
      })).toBe(false);
      expect(isValidBePaidAPIErrorContext({
        ...validContext,
        bepaidErrors: { system: ['valid'], validation: [456 as any] },
      })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, bepaidTransactionId: 123 as any }))
        .toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, trackingId: 123 as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, transactionState: 123 as any })).toBe(
        false,
      );
      expect(isValidBePaidAPIErrorContext({ ...validContext, currency: 'XYZ' as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, amount: -1 })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, amount: 1.5 })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, paymentMethod: 'invalid' as any }))
        .toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, responseTimeMs: -1 })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, retryAfterMs: -1 })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, endpoint: 123 as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, requestId: 123 as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, gatewayId: 123 as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, shopId: 123 as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, orderId: 123 as any })).toBe(false);
      expect(isValidBePaidAPIErrorContext({ ...validContext, threeDsStatus: 123 as any })).toBe(
        false,
      );
      expect(isValidBePaidAPIErrorContext({ ...validContext, providerCode: 123 as any })).toBe(
        false,
      );
    });
  });

  describe('isBePaidAPIError', () => {
    it('should return true for valid BePaidAPIError', () => {
      const error = createMockBePaidAPIError();
      expect(isBePaidAPIError(error)).toBe(true);
    });

    it('should return false for invalid objects', () => {
      expect(isBePaidAPIError(null)).toBe(false);
      expect(isBePaidAPIError({})).toBe(false);
      expect(isBePaidAPIError({ _tag: 'BePaidAPIError' })).toBe(false);
      expect(isBePaidAPIError({ code: 'SERVICE_BILLING_107' })).toBe(false);
    });

    it('should return false for wrong tag', () => {
      const invalidError = { ...createMockBePaidAPIError(), _tag: 'WrongTag' };
      expect(isBePaidAPIError(invalidError)).toBe(false);
    });

    it('should return false for wrong code', () => {
      const invalidError = { ...createMockBePaidAPIError(), code: 'WRONG_CODE' };
      expect(isBePaidAPIError(invalidError)).toBe(false);
    });

    it('should return false for invalid context', () => {
      const invalidError = {
        ...createMockBePaidAPIError(),
        details: { httpStatus: 'not-a-number' as any },
      };
      expect(isBePaidAPIError(invalidError)).toBe(false);
    });

    it('should validate BePaid-specific context fields', () => {
      const errorWithBepaidErrors = createMockBePaidAPIError({
        bepaidErrors: { system: ['error'] },
      });
      expect(isBePaidAPIError(errorWithBepaidErrors)).toBe(true);

      const errorWithInvalidBepaidErrors = {
        ...createMockBePaidAPIError(),
        details: { bepaidErrors: { system: [123 as any] } },
      };
      expect(isBePaidAPIError(errorWithInvalidBepaidErrors)).toBe(false);
    });
  });

  describe('Getter functions', () => {
    describe('getBePaidTransactionId', () => {
      it('should return transaction ID when present', () => {
        const error = createMockBePaidAPIError({ bepaidTransactionId: 'tx_123' });
        expect(getBePaidTransactionId(error)).toBe('tx_123');
      });

      it('should return undefined when transaction ID is missing', () => {
        const error = createMockBePaidAPIError({ bepaidTransactionId: undefined });
        expect(getBePaidTransactionId(error)).toBeUndefined();
      });
    });

    describe('getBePaidHttpStatus', () => {
      it('should return HTTP status when present', () => {
        const error = createMockBePaidAPIError({ httpStatus: 500 });
        expect(getBePaidHttpStatus(error)).toBe(500);
      });

      it('should return undefined when HTTP status is missing', () => {
        const error = createMockBePaidAPIError({ httpStatus: undefined });
        expect(getBePaidHttpStatus(error)).toBeUndefined();
      });
    });

    describe('getBePaidErrorCode', () => {
      it('should return BePaid error code when present', () => {
        const error = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED,
        });
        expect(getBePaidErrorCode(error)).toBe(BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED);
      });

      it('should return undefined when error code is missing', () => {
        const error = createMockBePaidAPIError({ bepaidCode: undefined });
        expect(getBePaidErrorCode(error)).toBeUndefined();
      });
    });
  });

  describe('Error classification functions', () => {
    describe('isBePaidRetryableError', () => {
      it('should return true for server errors (5xx)', () => {
        const error500 = createMockBePaidAPIError({ httpStatus: 500 });
        const error502 = createMockBePaidAPIError({ httpStatus: 502 });
        const error503 = createMockBePaidAPIError({ httpStatus: 503 });
        const error504 = createMockBePaidAPIError({ httpStatus: 504 });

        expect(isBePaidRetryableError(error500)).toBe(true);
        expect(isBePaidRetryableError(error502)).toBe(true);
        expect(isBePaidRetryableError(error503)).toBe(true);
        expect(isBePaidRetryableError(error504)).toBe(true);
      });

      it('should return false for client errors (4xx)', () => {
        const error400 = createMockBePaidAPIError({ httpStatus: 400 });
        const error401 = createMockBePaidAPIError({ httpStatus: 401 });
        const error403 = createMockBePaidAPIError({ httpStatus: 403 });

        expect(isBePaidRetryableError(error400)).toBe(false);
        expect(isBePaidRetryableError(error401)).toBe(false);
        expect(isBePaidRetryableError(error403)).toBe(false);
      });

      it('should return true for routing BePaid codes', () => {
        const routingError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR,
        });
        const routingError2 = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.ROUTING_GATEWAY_UNAVAILABLE,
        });

        expect(isBePaidRetryableError(routingError)).toBe(true);
        expect(isBePaidRetryableError(routingError2)).toBe(true);
      });

      it('should return true for system errors', () => {
        const systemError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.SYSTEM_ERROR,
        });
        expect(isBePaidRetryableError(systemError)).toBe(true);
      });

      it('should return false for card-related errors', () => {
        const cardError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR,
        });
        const validationError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.VALIDATION_GATEWAY_NOT_FOUND,
        });

        expect(isBePaidRetryableError(cardError)).toBe(false);
        expect(isBePaidRetryableError(validationError)).toBe(false);
      });

      it('should test all retryable conditions comprehensively', () => {
        // Test combination: 5xx + routing code (should still be true due to 5xx)
        const errorWithBoth = createMockBePaidAPIError({
          httpStatus: BEPAID_HTTP_STATUSES.INTERNAL_SERVER_ERROR,
          bepaidCode: BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR,
        });
        expect(isBePaidRetryableError(errorWithBoth)).toBe(true);

        // Test combination: non-retryable http + retryable code (should be true due to code)
        const errorWithRetryableCode = createMockBePaidAPIError({
          httpStatus: BEPAID_HTTP_STATUSES.BAD_REQUEST, // not retryable
          bepaidCode: BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR, // retryable
        });
        expect(isBePaidRetryableError(errorWithRetryableCode)).toBe(true);

        // Test combination: retryable http + non-retryable code (should be true due to http)
        const errorWithRetryableHttp = createMockBePaidAPIError({
          httpStatus: BEPAID_HTTP_STATUSES.INTERNAL_SERVER_ERROR, // retryable
          bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR, // not retryable
        });
        expect(isBePaidRetryableError(errorWithRetryableHttp)).toBe(true);

        // Test error without details (should be false)
        const errorWithoutDetails = {
          ...createMockBePaidAPIError(),
          details: undefined,
        };
        expect(isBePaidRetryableError(errorWithoutDetails)).toBe(false);
      });
    });

    describe('isBePaidCardError', () => {
      it('should return true for all card processing error codes', () => {
        BEPAID_ERROR_CATEGORIES.CARD_PROCESSING.forEach((code) => {
          const error = createMockBePaidAPIError({ bepaidCode: code });
          expect(isBePaidCardError(error)).toBe(true);
        });
      });

      it('should return false for non-card errors', () => {
        const routingError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR,
        });
        const validationError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.VALIDATION_GATEWAY_NOT_FOUND,
        });
        const threedsError = createMockBePaidAPIError({
          bepaidCode: BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED,
        });

        expect(isBePaidCardError(routingError)).toBe(false);
        expect(isBePaidCardError(validationError)).toBe(false);
        expect(isBePaidCardError(threedsError)).toBe(false);
      });

      it('should return false when no bepaidCode', () => {
        const error = createMockBePaidAPIError({ bepaidCode: undefined });
        expect(isBePaidCardError(error)).toBe(false);
      });

      it('should handle edge cases', () => {
        const errorWithWrongCode = createMockBePaidAPIError({ bepaidCode: 'UNKNOWN_CODE' as any });
        expect(isBePaidCardError(errorWithWrongCode)).toBe(false);
      });
    });
  });

  describe('Category functions', () => {
    describe('isBePaidErrorInCategory', () => {
      it('should return true for codes in category', () => {
        expect(isBePaidErrorInCategory(BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR, 'CARD_PROCESSING'))
          .toBe(true);
        expect(isBePaidErrorInCategory(BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR, 'ROUTING'))
          .toBe(true);
        expect(isBePaidErrorInCategory(BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED, 'THREEDS')).toBe(
          true,
        );
        expect(isBePaidErrorInCategory(BEPAID_ERROR_CODES.RISK_DECLINE, 'SECURITY')).toBe(true);
      });

      it('should return false for codes not in category', () => {
        expect(isBePaidErrorInCategory(BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR, 'ROUTING')).toBe(
          false,
        );
        expect(
          isBePaidErrorInCategory(BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR, 'CARD_PROCESSING'),
        ).toBe(false);
      });

      it('should handle all category combinations', () => {
        const categories: BePaidErrorCategory[] = [
          'SYSTEM',
          'CARD_PROCESSING',
          'APM',
          'VALIDATION',
          'APM_VALIDATION',
          'THREEDS',
          'ROUTING',
          'SUBSCRIPTION',
          'SECURITY',
        ];

        categories.forEach((category) => {
          const categoryCodes = getCategoryCodes(category);
          categoryCodes.forEach((code) => {
            expect(isBePaidErrorInCategory(code, category)).toBe(true);
          });

          // Test that codes from other categories return false
          categories.filter((cat) => cat !== category).forEach((otherCategory) => {
            const otherCategoryCodes = getCategoryCodes(otherCategory);
            otherCategoryCodes.forEach((code) => {
              expect(isBePaidErrorInCategory(code, category)).toBe(false);
            });
          });
        });
      });
    });

    describe('getBePaidErrorCategory', () => {
      it('should return correct category for all BePaid error codes', () => {
        // Test all codes in categories
        BEPAID_ERROR_CATEGORIES.CARD_PROCESSING.forEach((code) => {
          expect(getBePaidErrorCategory(code)).toBe('CARD_PROCESSING');
        });
        BEPAID_ERROR_CATEGORIES.ROUTING.forEach((code) => {
          expect(getBePaidErrorCategory(code)).toBe('ROUTING');
        });
        BEPAID_ERROR_CATEGORIES.THREEDS.forEach((code) => {
          expect(getBePaidErrorCategory(code)).toBe('THREEDS');
        });
        BEPAID_ERROR_CATEGORIES.SECURITY.forEach((code) => {
          expect(getBePaidErrorCategory(code)).toBe('SECURITY');
        });
        BEPAID_ERROR_CATEGORIES.VALIDATION.forEach((code) => {
          expect(getBePaidErrorCategory(code)).toBe('VALIDATION');
        });
      });

      it('should return undefined for unknown codes', () => {
        expect(getBePaidErrorCategory('unknown_code' as any)).toBeUndefined();
        expect(getBePaidErrorCategory('' as any)).toBeUndefined();
        expect(getBePaidErrorCategory(null as any)).toBeUndefined();
        expect(getBePaidErrorCategory(undefined as any)).toBeUndefined();
      });

      it('should cover all loop branches in getBePaidErrorCategory', () => {
        // Test each category to ensure loop covers all paths
        const allCodes = [
          ...BEPAID_ERROR_CATEGORIES.SYSTEM,
          ...BEPAID_ERROR_CATEGORIES.CARD_PROCESSING,
          ...BEPAID_ERROR_CATEGORIES.APM,
          ...BEPAID_ERROR_CATEGORIES.VALIDATION,
          ...BEPAID_ERROR_CATEGORIES.APM_VALIDATION,
          ...BEPAID_ERROR_CATEGORIES.THREEDS,
          ...BEPAID_ERROR_CATEGORIES.ROUTING,
          ...BEPAID_ERROR_CATEGORIES.SUBSCRIPTION,
          ...BEPAID_ERROR_CATEGORIES.SECURITY,
        ];

        allCodes.forEach((code) => {
          const category = getBePaidErrorCategory(code);
          expect(category).toBeDefined();
          expect([
            'SYSTEM',
            'CARD_PROCESSING',
            'APM',
            'VALIDATION',
            'APM_VALIDATION',
            'THREEDS',
            'ROUTING',
            'SUBSCRIPTION',
            'SECURITY',
          ]).toContain(category);
        });
      });

      it('should test loop coverage in getBePaidErrorCategory', () => {
        const allCodes = [
          ...BEPAID_ERROR_CATEGORIES.SYSTEM,
          ...BEPAID_ERROR_CATEGORIES.CARD_PROCESSING,
          ...BEPAID_ERROR_CATEGORIES.APM,
          ...BEPAID_ERROR_CATEGORIES.VALIDATION,
          ...BEPAID_ERROR_CATEGORIES.APM_VALIDATION,
          ...BEPAID_ERROR_CATEGORIES.THREEDS,
          ...BEPAID_ERROR_CATEGORIES.ROUTING,
          ...BEPAID_ERROR_CATEGORIES.SUBSCRIPTION,
          ...BEPAID_ERROR_CATEGORIES.SECURITY,
        ];

        allCodes.forEach((code) => {
          const category = getBePaidErrorCategory(code);
          expect(category).toBeDefined();
          expect([
            'SYSTEM',
            'CARD_PROCESSING',
            'APM',
            'VALIDATION',
            'APM_VALIDATION',
            'THREEDS',
            'ROUTING',
            'SUBSCRIPTION',
            'SECURITY',
          ]).toContain(category);
        });
      });
    });

    describe('filterBePaidErrorsByCategory', () => {
      it('should filter errors by category', () => {
        const errors: BePaidAPIError[] = [
          createMockBePaidAPIError({ bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR }),
          createMockBePaidAPIError({ bepaidCode: BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR }),
          createMockBePaidAPIError({ bepaidCode: BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED }),
          createMockBePaidAPIError({ bepaidCode: BEPAID_ERROR_CODES.RISK_DECLINE }),
        ];

        const cardErrors = filterBePaidErrorsByCategory(errors, 'CARD_PROCESSING');
        const routingErrors = filterBePaidErrorsByCategory(errors, 'ROUTING');
        const threedsErrors = filterBePaidErrorsByCategory(errors, 'THREEDS');
        const securityErrors = filterBePaidErrorsByCategory(errors, 'SECURITY');

        expect(cardErrors).toHaveLength(1);
        expect(routingErrors).toHaveLength(1);
        expect(threedsErrors).toHaveLength(1);
        expect(securityErrors).toHaveLength(1);

        expect(cardErrors[0].details?.bepaidCode).toBe(BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR);
        expect(routingErrors[0].details?.bepaidCode).toBe(
          BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR,
        );
        expect(threedsErrors[0].details?.bepaidCode).toBe(BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED);
        expect(securityErrors[0].details?.bepaidCode).toBe(BEPAID_ERROR_CODES.RISK_DECLINE);
      });

      it('should return empty array when no errors match category', () => {
        const errors: BePaidAPIError[] = [
          createMockBePaidAPIError({ bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR }),
        ];

        const routingErrors = filterBePaidErrorsByCategory(errors, 'ROUTING');
        const threedsErrors = filterBePaidErrorsByCategory(errors, 'THREEDS');

        expect(routingErrors).toHaveLength(0);
        expect(threedsErrors).toHaveLength(0);
      });

      it('should skip errors without bepaidCode', () => {
        const errors: BePaidAPIError[] = [
          createMockBePaidAPIError({ bepaidCode: undefined }),
          createMockBePaidAPIError({ bepaidCode: BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR }),
          createMockBePaidAPIError({ bepaidCode: null as any }),
        ];

        const cardErrors = filterBePaidErrorsByCategory(errors, 'CARD_PROCESSING');
        expect(cardErrors).toHaveLength(1);
      });

      it('should handle empty error arrays', () => {
        const cardErrors = filterBePaidErrorsByCategory([], 'CARD_PROCESSING');
        expect(cardErrors).toHaveLength(0);
        expect(cardErrors).toEqual([]);
      });
    });
  });

  describe('Logger functions', () => {
    it('should get current logger', () => {
      const logger = getBePaidLogger();
      expect(logger).toBe(mockLogger);
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
    });

    it('should set custom logger', () => {
      const customLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      setBePaidLogger(customLogger);

      expect(getBePaidLogger()).toBe(customLogger);
    });

    it('should use set logger for error creation', () => {
      const customLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      setBePaidLogger(customLogger);

      createBePaidAPIError('Test error');

      expect(customLogger.error).toHaveBeenCalledWith(
        'BePaid API error created',
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

      setBePaidLogger(errorThrowingLogger);

      expect(() => createBePaidAPIError('Test')).not.toThrow();
      expect(errorThrowingLogger.error).toHaveBeenCalled();
    });

    it('should test centralized logger implementation directly', () => {
      const testLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      };

      const testLogger2 = {
        error: (msg: string, ctx?: Record<string, unknown>) => {
          testLogger.error(`ERROR: ${msg}${ctx ? ` ${JSON.stringify(ctx)}` : ''}`);
        },
        warn: (msg: string, ctx?: Record<string, unknown>) => {
          testLogger.warn(`WARN: ${msg}${ctx ? ` ${JSON.stringify(ctx)}` : ''}`);
        },
        info: (msg: string, ctx?: Record<string, unknown>) => {
          testLogger.info(`INFO: ${msg}${ctx ? ` ${JSON.stringify(ctx)}` : ''}`);
        },
      };

      setBePaidLogger(testLogger2);

      testLogger2.error('test error');
      testLogger2.warn('test warning', { warnData: true });
      testLogger2.info('test info', { infoData: 'value' });

      expect(testLogger.error).toHaveBeenCalledWith('ERROR: test error');
      expect(testLogger.warn).toHaveBeenCalledWith('WARN: test warning {"warnData":true}');
      expect(testLogger.info).toHaveBeenCalledWith('INFO: test info {"infoData":"value"}');
    });

    it('should restore original logger after tests', () => {
      const originalLogger = getBePaidLogger();
      const newLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

      setBePaidLogger(newLogger);
      expect(getBePaidLogger()).toBe(newLogger);

      setBePaidLogger(originalLogger);
      expect(getBePaidLogger()).toBe(originalLogger);
    });
  });

  describe('Integration tests', () => {
    it('should create and validate error end-to-end with BePaid specifics', () => {
      const context = createMockBePaidAPIErrorContext({
        bepaidErrors: { system: ['API Error'], validation: ['Invalid data'] },
        rawResponse: { original: 'response', status: 400 },
        gatewayId: 'gw_test',
        shopId: 'shop_test',
        threeDsStatus: 'failed',
      });
      const error = createBePaidAPIError('BePaid integration test', context);

      // Проверяем, что ошибка создана правильно
      expect(isBePaidAPIError(error)).toBe(true);
      expect(isValidBePaidAPIErrorContext(error.details)).toBe(true);

      // Проверяем BePaid-специфичные поля
      expect(getBePaidTransactionId(error)).toBe(context.bepaidTransactionId);
      expect(getBePaidHttpStatus(error)).toBe(context.httpStatus);
      expect(getBePaidErrorCode(error)).toBe(context.bepaidCode);

      // Проверяем классификацию
      expect(isBePaidCardError(error)).toBe(true);
      expect(isBePaidRetryableError(error)).toBe(false);

      // Проверяем категоризацию
      expect(getBePaidErrorCategory(error.details!.bepaidCode!)).toBe('CARD_PROCESSING');
      expect(isBePaidErrorInCategory(error.details!.bepaidCode!, 'CARD_PROCESSING')).toBe(true);

      // Проверяем BePaid-специфичные поля
      expect(error.details?.bepaidErrors).toEqual(context.bepaidErrors);
      expect(error.details?.rawResponse).toEqual(context.rawResponse);
      expect(error.details?.gatewayId).toBe(context.gatewayId);
      expect(error.details?.shopId).toBe(context.shopId);
      expect(error.details?.threeDsStatus).toBe(context.threeDsStatus);
    });

    it('should handle BePaid 3DS errors correctly', () => {
      const context = createMockBePaidAPIErrorContext({
        bepaidCode: BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED,
        threeDsStatus: 'auth_failed',
      });
      const error = createBePaidAPIError('3DS authentication failed', context);

      expect(isBePaidAPIError(error)).toBe(true);
      expect(isBePaidRetryableError(error)).toBe(false); // 3DS errors are not retryable
      expect(isBePaidCardError(error)).toBe(false); // Not a card processing error
      expect(getBePaidErrorCategory(error.details!.bepaidCode!)).toBe('THREEDS');
    });

    it('should handle BePaid routing errors correctly', () => {
      const context = createMockBePaidAPIErrorContext({
        httpStatus: BEPAID_HTTP_STATUSES.INTERNAL_SERVER_ERROR,
        bepaidCode: BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR,
      });
      const error = createBePaidAPIError('Routing connection error', context);

      expect(isBePaidAPIError(error)).toBe(true);
      expect(isBePaidRetryableError(error)).toBe(true); // 5xx + routing error
      expect(getBePaidErrorCategory(error.details!.bepaidCode!)).toBe('ROUTING');
    });

    it('should handle BePaid security/fraud errors', () => {
      const context = createMockBePaidAPIErrorContext({
        bepaidCode: BEPAID_ERROR_CODES.RISK_DECLINE,
        providerCode: 'RISK_HIGH',
      });
      const error = createBePaidAPIError('Risk decline', context);

      expect(isBePaidAPIError(error)).toBe(true);
      expect(isBePaidRetryableError(error)).toBe(false); // Security errors are not retryable
      expect(getBePaidErrorCategory(error.details!.bepaidCode!)).toBe('SECURITY');
      expect(error.details?.providerCode).toBe('RISK_HIGH');
    });
  });
});
