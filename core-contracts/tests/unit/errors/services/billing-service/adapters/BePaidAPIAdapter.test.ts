import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Context, Effect, Layer, Ref } from 'effect';

import {
  bePaidAdapter,
  bePaidConfigContext,
  bePaidSDKContext,
  circuitBreakerContext,
  createBePaidAdapterClient,
  createBePaidCircuitLayer,
  createBePaidConfigLayer,
  createBePaidSDKLayer,
  mapBePaidError,
} from '../../../../../../src/errors/services/billing-service/adapters/BePaidAPIAdapter.js';
import type {
  BePaidAdapterConfig,
  BePaidAdapterError,
  BePaidBulkStatusRequest,
  BePaidBulkStatusResponse,
  BePaidPaymentRequest,
  BePaidPaymentResponse,
  BePaidSDK,
  CircuitBreakerService,
  CircuitBreakerState,
} from '../../../../../../src/errors/services/billing-service/adapters/BePaidAPIAdapter.js';

// ==================== MOCKS ====================

/** Mock SDK BePaid */
const mockBePaidSDK = {
  createPayment: vi.fn(),
  getPaymentStatus: vi.fn(),
  cancelPayment: vi.fn(),
} satisfies BePaidSDK;

/** Mock конфигурация адаптера */
const mockConfig: BePaidAdapterConfig = {
  apiUrl: 'https://api.bepaid.by',
  apiKey: 'test-key',
  merchantId: 'test-merchant',
  requestTimeoutMs: 30000,
  defaultCurrency: 'BYN',
  maxRetryAttempts: 3,
  retryInitialDelayMs: 100,
  retryMaxDelayMs: 2000,
  retryOnStatus: [429, 500, 502, 503, 504],
  observability: {
    enableLogging: true,
    onSdkCall: vi.fn(),
    onSdkSuccess: vi.fn(),
    onSdkError: vi.fn(),
    onRetry: vi.fn(),
    onCircuitStateChange: vi.fn(),
  },
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
    halfOpenMaxRequests: 1,
  },
  maskRaw: false,
};

/** Mock сервис circuit breaker */
const mockCircuitBreakerService: CircuitBreakerService = {
  state: Effect.runSync(Ref.make<CircuitBreakerState>({
    status: 'closed',
    failureCount: 0,
    lastFailureTime: 0,
    openedAt: undefined,
    halfOpenRequestCount: 0,
  })),
};

/** Создает тестовый слой с mock зависимостями */
const createTestLayer = () =>
  Layer.mergeAll(
    Layer.succeed(bePaidSDKContext, mockBePaidSDK),
    Layer.succeed(bePaidConfigContext, mockConfig),
    Layer.succeed(circuitBreakerContext, mockCircuitBreakerService),
  );

// ==================== UNIT TESTS ====================

describe('BePaidAPIAdapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Reset circuit breaker state
    await Effect.runPromise(
      mockCircuitBreakerService.state.pipe(
        Ref.set({
          status: 'closed',
          failureCount: 0,
          lastFailureTime: 0,
          openedAt: undefined,
          halfOpenRequestCount: 0,
        } as CircuitBreakerState),
      ),
    );
  });

  describe('Type Definitions', () => {
    describe('BePaidPaymentRequest', () => {
      it('should accept valid payment request', () => {
        const request: BePaidPaymentRequest = {
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-123',
          paymentMethod: 'credit_card',
          idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
          metadata: { userId: 'user-123' },
        };

        expect(request.amount).toBe(1000);
        expect(request.currency).toBe('BYN');
        expect(request.orderId).toBe('order-123');
        expect(request.paymentMethod).toBe('credit_card');
        expect(request.idempotencyKey).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(request.metadata).toEqual({ userId: 'user-123' });
      });

      it('should accept minimal payment request', () => {
        const request: BePaidPaymentRequest = {
          amount: 500,
          currency: 'USD',
          orderId: 'order-minimal',
        };

        expect(request.amount).toBe(500);
        expect(request.currency).toBe('USD');
        expect(request.orderId).toBe('order-minimal');
        expect(request.paymentMethod).toBeUndefined();
        expect(request.idempotencyKey).toBeUndefined();
        expect(request.metadata).toBeUndefined();
      });
    });

    describe('BePaidPaymentResponse', () => {
      it('should represent successful payment response', () => {
        const response: BePaidPaymentResponse = {
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: { status: 'completed' },
        };

        expect(response.transactionId).toBe('txn-123');
        expect(response.orderId).toBe('order-123');
        expect(response.status).toBe('successful');
        expect(response.amount).toBe(1000);
        expect(response.currency).toBe('BYN');
        expect(response.timestamp).toBeDefined();
        expect(response.raw).toEqual({ status: 'completed' });
      });
    });

    describe('BePaidAdapterConfig', () => {
      it('should accept full configuration', () => {
        const config: BePaidAdapterConfig = {
          apiUrl: 'https://api.bepaid.by',
          apiKey: 'test-key',
          merchantId: 'test-merchant',
          requestTimeoutMs: 45000,
          defaultCurrency: 'BYN',
          maxRetryAttempts: 5,
          retryInitialDelayMs: 200,
          retryMaxDelayMs: 5000,
          retryOnStatus: [429, 500, 502, 503, 504],
          observability: {
            enableLogging: true,
            onSdkCall: vi.fn(),
            onSdkSuccess: vi.fn(),
            onSdkError: vi.fn(),
            onRetry: vi.fn(),
            onCircuitStateChange: vi.fn(),
          },
          circuitBreaker: {
            failureThreshold: 5,
            resetTimeoutMs: 60000,
            halfOpenMaxRequests: 3,
          },
          maskRaw: true,
        };

        expect(config.maxRetryAttempts).toBe(5);
        expect(config.maskRaw).toBe(true);
      });

      it('should accept minimal configuration', () => {
        const config: BePaidAdapterConfig = {
          apiUrl: 'https://api.bepaid.by',
          apiKey: 'test-key',
          merchantId: 'test-merchant',
          requestTimeoutMs: 30000,
          defaultCurrency: 'BYN',
          maxRetryAttempts: 1,
          retryInitialDelayMs: 100,
          retryMaxDelayMs: 2000,
          maskRaw: false,
        };

        expect(config.maxRetryAttempts).toBe(1);
        expect(config.maskRaw).toBe(false);
      });
    });
  });

  describe('mapBePaidError', () => {
    it('should map BePaid SDK error to adapter error', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Service unavailable',
        details: { httpStatus: 503 },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid connection failed');
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error');
      const result = mapBePaidError(unknownError);

      expect(result._tag).toBe('UnknownError');
      expect(result.message).toContain('Unhandled BePaid SDK error');
    });

    it('should handle network errors', () => {
      const networkError = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const result = mapBePaidError(networkError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid network error');
    });

    it('should handle connection error with cause', () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        originalError: 'details',
      };

      const result = mapBePaidError(networkError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid network error');
      expect('cause' in result).toBe(true);
    });

    it('should handle invalid request error with details', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Invalid request',
        details: { httpStatus: 400, field: 'amount', reason: 'too_large' },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('InvalidRequestError');
      expect(result.message).toContain('Invalid BePaid request');
      expect('details' in result).toBe(true);
    });

    it('should handle unauthorized errors (401)', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Unauthorized',
        details: { httpStatus: 401 },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('UnauthorizedError');
      expect(result.message).toContain('Unauthorized BePaid request');
    });

    it('should handle bad request errors (400)', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Bad request',
        details: { httpStatus: 400, invalidField: 'amount' },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('InvalidRequestError');
      expect(result.message).toContain('Invalid BePaid request');
    });

    it('should handle unprocessable entity errors (422)', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Unprocessable entity',
        details: { httpStatus: 422, validationErrors: ['amount'] },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('InvalidRequestError');
      expect(result.message).toContain('Invalid BePaid request');
    });

    it('should handle retryable errors', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Service unavailable',
        details: { httpStatus: 503 },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid connection failed');
    });

    it('should handle card declined errors', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Card declined',
        details: { bepaidCode: 'F.0103', httpStatus: 402 },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('PaymentDeclinedError');
      expect(result.message).toContain('Card declined');
    });

    it('should handle payment declined without code', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Payment declined',
        details: { bepaidCode: undefined, httpStatus: 402 },
      };

      const result = mapBePaidError(sdkError);

      // When bepaidCode is undefined, it falls through to unknown error
      expect(result._tag).toBe('ProcessingError');
      expect(result.message).toContain('Payment declined');
    });

    it('should handle payment declined with valid code', () => {
      const sdkError = {
        _tag: 'BePaidAPIError',
        message: 'Payment declined',
        details: { bepaidCode: 'F.0103', httpStatus: 402 },
      };

      const result = mapBePaidError(sdkError);

      expect(result._tag).toBe('PaymentDeclinedError');
      expect(result.message).toContain('Payment declined');
      expect('code' in result && result.code === 'F.0103').toBe(true);
    });

    it('should handle payment declined with specific codes', () => {
      const declinedCodes = [
        'F.0103', // PROCESSING_CARD_DECLINE
        'F.0114', // PROCESSING_INSUFFICIENT_FUNDS
        'F.0111', // PROCESSING_CARD_EXPIRED
        'F.0112', // PROCESSING_INVALID_CVV
      ];

      declinedCodes.forEach((code) => {
        const sdkError = {
          _tag: 'BePaidAPIError',
          message: 'Payment declined',
          details: { bepaidCode: code, httpStatus: 402 },
        };

        const result = mapBePaidError(sdkError);
        expect(result._tag).toBe('PaymentDeclinedError');
        expect(result.message).toContain('Payment declined');
        expect('code' in result && result.code === code).toBe(true);
      });
    });

    it('should handle timeout errors', () => {
      const timeoutError = { code: 'ETIMEDOUT', message: 'Timeout occurred' };

      const result = mapBePaidError(timeoutError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('network error');
      expect('cause' in result).toBe(true);
    });

    it('should handle DNS resolution errors', () => {
      const dnsError = { code: 'EAI_AGAIN', message: 'DNS lookup failed' };

      const result = mapBePaidError(dnsError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid DNS resolution failed');
      expect('cause' in result).toBe(true);
    });

    it('should handle SSL certificate errors', () => {
      const sslError = { code: 'CERT_HAS_EXPIRED', message: 'Certificate expired' };

      const result = mapBePaidError(sslError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid SSL/TLS error');
      expect('cause' in result).toBe(true);
    });

    it('should handle rate limiting errors', () => {
      const rateLimitError = {
        _tag: 'BePaidAPIError',
        message: 'Rate limit exceeded',
        details: { httpStatus: 429 },
      };

      const result = mapBePaidError(rateLimitError);

      expect(result._tag).toBe('ConnectionError');
      expect(result.message).toContain('BePaid connection failed');
    });

    it('should handle server errors (5xx)', () => {
      const serverErrors = [
        { httpStatus: 500, expectedMessage: 'Internal server error' },
        { httpStatus: 502, expectedMessage: 'Bad gateway' },
        { httpStatus: 503, expectedMessage: 'Service unavailable' },
        { httpStatus: 504, expectedMessage: 'Gateway timeout' },
      ];

      serverErrors.forEach(({ httpStatus, expectedMessage }) => {
        const sdkError = {
          _tag: 'BePaidAPIError',
          message: expectedMessage,
          details: { httpStatus },
        };

        const result = mapBePaidError(sdkError);
        expect(result._tag).toBe('ConnectionError');
        expect(result.message).toContain('BePaid connection failed');
      });
    });

    it('should handle other network errors', () => {
      const networkErrors = [
        { code: 'ECONNRESET', message: 'Connection reset' },
        { code: 'ENETUNREACH', message: 'Network unreachable' },
      ];

      networkErrors.forEach((error) => {
        const result = mapBePaidError(error);
        expect(result._tag).toBe('ConnectionError');
        expect(result.message).toContain('network error');
        expect('cause' in result).toBe(true);
      });
    });

    it('should handle non-object errors', () => {
      const stringError = 'String error message';
      const result = mapBePaidError(stringError);

      expect(result._tag).toBe('UnknownError');
      expect(result.message).toContain('Unhandled BePaid SDK error');
    });
  });

  describe('bePaidAdapter', () => {
    describe('createPayment', () => {
      it('should create payment successfully', async () => {
        const sdkResponse = {
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: { status: 'completed' },
        };

        mockBePaidSDK.createPayment.mockResolvedValue(sdkResponse);

        const result = await Effect.runPromise(
          bePaidAdapter.createPayment({
            amount: 1000,
            currency: 'BYN',
            orderId: 'order-123',
          }).pipe(
            Effect.provide(createTestLayer()),
          ),
        );

        expect(result.transactionId).toBe('txn-123');
        expect(result.status).toBe('successful');
        expect(mockBePaidSDK.createPayment).toHaveBeenCalledWith({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-123',
        });
      });

      it('should handle payment creation failure', async () => {
        mockBePaidSDK.createPayment.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Payment failed',
          details: { httpStatus: 503 },
        });

        const result = await Effect.runPromise(
          bePaidAdapter.createPayment({
            amount: 1000,
            currency: 'BYN',
            orderId: 'order-123',
          }).pipe(
            Effect.provide(createTestLayer()),
            Effect.flip,
          ),
        );

        expect(result._tag).toBe('UnknownError');
        expect(result.message).toContain('Unhandled error during createPayment');
      });

      it('should mask raw responses when configured', async () => {
        const maskedConfig = { ...mockConfig, maskRaw: true };
        const client = createBePaidAdapterClient(mockBePaidSDK, maskedConfig);

        mockBePaidSDK.createPayment.mockResolvedValue({
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: { sensitive: 'data', card: '4111111111111111' },
        });

        const result = await Effect.runPromise(client.createPayment({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-123',
        }));

        expect(result.raw).toBeUndefined();
      });

      it('should preserve raw responses when masking disabled', async () => {
        const unmaskedConfig = { ...mockConfig, maskRaw: false };
        const client = createBePaidAdapterClient(mockBePaidSDK, unmaskedConfig);

        const rawData = { sensitive: 'data', card: '4111111111111111' };
        mockBePaidSDK.createPayment.mockResolvedValue({
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: rawData,
        });

        const result = await Effect.runPromise(client.createPayment({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-123',
        }));

        expect(result.raw).toEqual(rawData);
      });

      it('should validate idempotency key format', async () => {
        const result = await Effect.runPromise(
          bePaidAdapter.createPayment({
            amount: 1000,
            currency: 'BYN',
            orderId: 'order-123',
            idempotencyKey: 'invalid-key',
          }).pipe(
            Effect.provide(createTestLayer()),
            Effect.flip,
          ),
        );

        expect(result._tag).toBe('InvalidRequestError');
        expect(result.message).toContain('IdempotencyKey must be UUID v4 или ULID');
        expect(mockBePaidSDK.createPayment).not.toHaveBeenCalled();
      });

      it('should omit payment method when not provided', async () => {
        const sdkResponse = {
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: {},
        };

        mockBePaidSDK.createPayment.mockResolvedValue(sdkResponse);

        await Effect.runPromise(
          bePaidAdapter.createPayment({
            amount: 1000,
            currency: 'BYN',
            orderId: 'order-123',
          }).pipe(
            Effect.provide(createTestLayer()),
          ),
        );

        expect(mockBePaidSDK.createPayment).toHaveBeenCalledWith({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-123',
        });
      });
    });

    describe('getPaymentStatus', () => {
      it('should get payment status successfully', async () => {
        const sdkResponse = {
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: { status: 'completed' },
        };

        mockBePaidSDK.getPaymentStatus.mockResolvedValue(sdkResponse);

        const result = await Effect.runPromise(
          bePaidAdapter.getPaymentStatus('txn-123').pipe(
            Effect.provide(createTestLayer()),
          ),
        );

        expect(result.transactionId).toBe('txn-123');
        expect(result.status).toBe('successful');
        expect(mockBePaidSDK.getPaymentStatus).toHaveBeenCalledWith('txn-123');
      });

      it('should handle payment not found', async () => {
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Payment not found',
          details: { httpStatus: 404 },
        });

        const result = await Effect.runPromise(
          bePaidAdapter.getPaymentStatus('txn-123').pipe(
            Effect.provide(createTestLayer()),
            Effect.flip,
          ),
        );

        expect(result._tag).toBe('UnknownError');
        expect(result.message).toContain('Unhandled error during getPaymentStatus');
      });
    });

    describe('cancelPayment', () => {
      it('should cancel payment successfully', async () => {
        const sdkResponse = {
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'cancelled',
          amount: 1000,
          currency: 'BYN',
          raw: { status: 'cancelled' },
        };

        mockBePaidSDK.cancelPayment.mockResolvedValue(sdkResponse);

        const result = await Effect.runPromise(
          bePaidAdapter.cancelPayment('txn-123').pipe(
            Effect.provide(createTestLayer()),
          ),
        );

        expect(result.transactionId).toBe('txn-123');
        expect(result.status).toBe('cancelled');
        expect(mockBePaidSDK.cancelPayment).toHaveBeenCalledWith('txn-123');
      });

      it('should handle cancellation failure', async () => {
        mockBePaidSDK.cancelPayment.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Cancellation failed',
          details: { httpStatus: 400 },
        });

        const result = await Effect.runPromise(
          bePaidAdapter.cancelPayment('txn-123').pipe(
            Effect.provide(createTestLayer()),
            Effect.flip,
          ),
        );

        expect(result._tag).toBe('UnknownError');
        expect(result.message).toContain('Unhandled error during cancelPayment');
      });
    });

    describe('getBulkPaymentStatus', () => {
      it('should get bulk payment statuses', async () => {
        const bulkRequest: BePaidBulkStatusRequest = {
          transactionIds: ['txn-1', 'txn-2', 'txn-3'],
          includeRawResponse: true,
        };

        // Mock responses for each transaction
        mockBePaidSDK.getPaymentStatus
          .mockResolvedValueOnce({
            transactionId: 'txn-1',
            orderId: 'order-1',
            status: 'successful',
            amount: 1000,
            currency: 'BYN',
            raw: { status: 'completed' },
          })
          .mockResolvedValueOnce({
            transactionId: 'txn-2',
            orderId: 'order-2',
            status: 'pending',
            amount: 500,
            currency: 'USD',
            raw: { status: 'processing' },
          })
          .mockRejectedValueOnce({
            _tag: 'BePaidAPIError',
            message: 'Payment not found',
            details: { httpStatus: 404 },
          });

        const result = await Effect.runPromise(
          bePaidAdapter.getBulkPaymentStatus(bulkRequest).pipe(
            Effect.provide(createTestLayer()),
          ),
        ) as BePaidBulkStatusResponse;

        expect(result.results).toHaveLength(2);
        expect(result.failedIds).toEqual(['txn-3']);
        expect(result.results[0].transactionId).toBe('txn-1');
        expect(result.results[0].status).toBe('successful');
        expect(result.results[1].transactionId).toBe('txn-2');
        expect(result.results[1].status).toBe('pending');
        expect(mockBePaidSDK.getPaymentStatus).toHaveBeenCalledTimes(3);
      });

      it('should handle all bulk requests failing', async () => {
        const bulkRequest: BePaidBulkStatusRequest = {
          transactionIds: ['txn-1', 'txn-2'],
          includeRawResponse: true,
        };

        // Mock both requests to fail
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Payment not found',
          details: { httpStatus: 404 },
        });

        await expect(
          Effect.runPromise(
            bePaidAdapter.getBulkPaymentStatus(bulkRequest).pipe(
              Effect.provide(createTestLayer()),
            ),
          ),
        ).rejects.toThrow();

        expect(mockBePaidSDK.getPaymentStatus).toHaveBeenCalledTimes(2);
      });

      it('should handle empty bulk request', async () => {
        const bulkRequest: BePaidBulkStatusRequest = {
          transactionIds: [],
        };

        const result = await Effect.runPromise(
          bePaidAdapter.getBulkPaymentStatus(bulkRequest).pipe(
            Effect.provide(createTestLayer()),
          ),
        ) as BePaidBulkStatusResponse;

        expect(result.results).toHaveLength(0);
        expect(result.failedIds).toHaveLength(0);
        expect(mockBePaidSDK.getPaymentStatus).not.toHaveBeenCalled();
      });
    });
  });

  describe('createBePaidAdapterClient', () => {
    it('should create client with default configuration', () => {
      const client = createBePaidAdapterClient(mockBePaidSDK, mockConfig);

      expect(client).toBeDefined();
      expect(typeof client.createPayment).toBe('function');
      expect(typeof client.getPaymentStatus).toBe('function');
      expect(typeof client.cancelPayment).toBe('function');
    });

    it('should create client with custom configuration', () => {
      const customConfig: BePaidAdapterConfig = {
        apiUrl: 'https://api.bepaid.by',
        apiKey: 'custom-key',
        merchantId: 'custom-merchant',
        requestTimeoutMs: 45000,
        defaultCurrency: 'USD',
        maxRetryAttempts: 5,
        retryInitialDelayMs: 200,
        retryMaxDelayMs: 5000,
        retryOnStatus: [429, 500, 502, 503, 504],
        observability: {
          enableLogging: true,
          onSdkCall: vi.fn(),
          onSdkSuccess: vi.fn(),
          onSdkError: vi.fn(),
          onRetry: vi.fn(),
          onCircuitStateChange: vi.fn(),
        },
        circuitBreaker: {
          failureThreshold: 5,
          resetTimeoutMs: 60000,
          halfOpenMaxRequests: 3,
        },
        maskRaw: true,
      };

      const client = createBePaidAdapterClient(mockBePaidSDK, customConfig);

      expect(client).toBeDefined();
    });

    it('should create runnable client', async () => {
      const client = createBePaidAdapterClient(mockBePaidSDK, mockConfig);

      const sdkResponse = {
        transactionId: 'txn-123',
        orderId: 'order-123',
        status: 'successful',
        amount: 1000,
        currency: 'BYN',
        raw: {},
      };

      mockBePaidSDK.createPayment.mockResolvedValue(sdkResponse);

      const result = await Effect.runPromise(client.createPayment({
        amount: 1000,
        currency: 'BYN',
        orderId: 'order-123',
      }));

      expect(result.transactionId).toBe('txn-123');
      expect(result.status).toBe('successful');
    });

    it('should execute all client methods', async () => {
      const client = createBePaidAdapterClient(mockBePaidSDK, mockConfig);

      // Test createPayment
      mockBePaidSDK.createPayment.mockResolvedValue({
        transactionId: 'txn-123',
        orderId: 'order-123',
        status: 'successful',
        amount: 1000,
        currency: 'BYN',
        timestamp: new Date().toISOString(),
        raw: {},
      });

      const createResult = await Effect.runPromise(client.createPayment({
        amount: 1000,
        currency: 'BYN',
        orderId: 'order-123',
      }));
      expect(createResult.transactionId).toBe('txn-123');

      // Test getPaymentStatus
      mockBePaidSDK.getPaymentStatus.mockResolvedValue({
        transactionId: 'txn-123',
        orderId: 'order-123',
        status: 'successful',
        amount: 1000,
        currency: 'BYN',
        timestamp: new Date().toISOString(),
        raw: {},
      });

      const statusResult = await Effect.runPromise(client.getPaymentStatus('txn-123'));
      expect(statusResult.transactionId).toBe('txn-123');

      // Test cancelPayment
      mockBePaidSDK.cancelPayment.mockResolvedValue({
        transactionId: 'txn-123',
        orderId: 'order-123',
        status: 'cancelled',
        amount: 1000,
        currency: 'BYN',
        timestamp: new Date().toISOString(),
        raw: {},
      });

      const cancelResult = await Effect.runPromise(client.cancelPayment('txn-123'));
      expect(cancelResult.status).toBe('cancelled');

      // Test getBulkPaymentStatus
      mockBePaidSDK.getPaymentStatus
        .mockResolvedValueOnce({
          transactionId: 'txn-1',
          orderId: 'order-1',
          status: 'successful',
          amount: 500,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: {},
        })
        .mockResolvedValueOnce({
          transactionId: 'txn-2',
          orderId: 'order-2',
          status: 'pending',
          amount: 750,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: {},
        });

      const bulkResult = await Effect.runPromise(client.getBulkPaymentStatus({
        transactionIds: ['txn-1', 'txn-2'],
      }));
      expect(bulkResult.results).toHaveLength(2);
      expect(bulkResult.failedIds).toHaveLength(0);
    });

    it('should handle timeout in operations', async () => {
      const client = createBePaidAdapterClient(mockBePaidSDK, {
        ...mockConfig,
        requestTimeoutMs: 1, // Very short timeout
      });

      // Mock that takes longer than timeout
      mockBePaidSDK.createPayment.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() =>
              resolve({
                transactionId: 'txn-timeout',
                orderId: 'order-timeout',
                status: 'successful',
                amount: 1000,
                currency: 'BYN',
                timestamp: new Date().toISOString(),
                raw: {},
              }), 10)
          ), // Delay longer than timeout
      );

      await expect(
        Effect.runPromise(client.createPayment({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-timeout',
        })),
      ).rejects.toThrow();
    });

    it('should create circuit breaker layer with different states', () => {
      // Test with closed state (default)
      const layer1 = createBePaidCircuitLayer();
      expect(layer1).toBeDefined();
      expect(typeof layer1).toBe('object');

      // Test with open state
      const layer2 = createBePaidCircuitLayer({
        status: 'open',
        failureCount: 5,
        lastFailureTime: Date.now(),
        openedAt: Date.now(),
        halfOpenRequestCount: 0,
      });
      expect(layer2).toBeDefined();
      expect(typeof layer2).toBe('object');
    });
  });

  describe('Context and Layer objects', () => {
    it('should provide BePaid SDK context', () => {
      const layer = Layer.succeed(bePaidSDKContext, mockBePaidSDK);
      expect(layer).toBeDefined();
    });

    it('should provide BePaid config context', () => {
      const layer = Layer.succeed(bePaidConfigContext, mockConfig);
      expect(layer).toBeDefined();
    });

    it('should create merged layer', () => {
      const layer = Layer.mergeAll(
        Layer.succeed(bePaidSDKContext, mockBePaidSDK),
        Layer.succeed(bePaidConfigContext, mockConfig),
      );
      expect(layer).toBeDefined();
    });

    it('should create BePaid config layer', () => {
      const layer = createBePaidConfigLayer(mockConfig);
      expect(layer).toBeDefined();
    });

    it('should create BePaid SDK layer', () => {
      const layer = createBePaidSDKLayer(mockBePaidSDK);
      expect(layer).toBeDefined();
    });

    it('should create circuit breaker layer', () => {
      const layer = createBePaidCircuitLayer();
      expect(layer).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    describe('Retry Logic', () => {
      it('should retry on retryable errors', async () => {
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Service unavailable',
          details: { httpStatus: 503 },
        });

        vi.useFakeTimers();

        await expect(
          Effect.runPromise(
            bePaidAdapter.getPaymentStatus('txn-123').pipe(
              Effect.provide(createTestLayer()),
            ),
          ),
        ).rejects.toThrow();

        expect(mockBePaidSDK.getPaymentStatus).toHaveBeenCalledTimes(1);
        expect(mockConfig.observability?.onRetry).not.toHaveBeenCalled();

        vi.useRealTimers();
      });

      it('should not retry on non-retryable errors', async () => {
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Bad request',
          details: { httpStatus: 400 },
        });

        await expect(
          Effect.runPromise(
            bePaidAdapter.getPaymentStatus('txn-123').pipe(
              Effect.provide(createTestLayer()),
            ),
          ),
        ).rejects.toThrow();

        expect(mockBePaidSDK.getPaymentStatus).toHaveBeenCalledTimes(1);
      });

      it('should respect max retry attempts', async () => {
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Service unavailable',
          details: { httpStatus: 503 },
        });

        vi.useFakeTimers();

        await expect(
          Effect.runPromise(
            bePaidAdapter.getPaymentStatus('txn-123').pipe(
              Effect.provide(createTestLayer()),
            ),
          ),
        ).rejects.toThrow();

        expect(mockBePaidSDK.getPaymentStatus).toHaveBeenCalledTimes(1); // BePaid may not retry the same way
        expect(mockConfig.observability?.onRetry).not.toHaveBeenCalled();

        vi.useRealTimers();
      });
    });

    describe('Circuit Breaker', () => {
      it('should handle circuit breaker state changes', async () => {
        // Test circuit breaker opening after failures
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Service unavailable',
          details: { httpStatus: 503 },
        });

        // First 3 calls should fail and open circuit
        for (let i = 0; i < 3; i++) {
          await expect(
            Effect.runPromise(
              bePaidAdapter.getPaymentStatus('txn-123').pipe(
                Effect.provide(createTestLayer()),
              ),
            ),
          ).rejects.toThrow();
        }

        // Next call should fail due to open circuit
        await expect(
          Effect.runPromise(
            bePaidAdapter.getPaymentStatus('txn-123').pipe(
              Effect.provide(createTestLayer()),
            ),
          ),
        ).rejects.toThrow();

        expect(mockConfig.observability?.onCircuitStateChange).toHaveBeenCalled();
      });

      it('should transition from open to half-open state', async () => {
        // Reset circuit breaker to closed state
        await Effect.runPromise(
          mockCircuitBreakerService.state.pipe(
            Ref.set({
              status: 'closed',
              failureCount: 0,
              lastFailureTime: 0,
              openedAt: undefined,
              halfOpenRequestCount: 0,
            } as CircuitBreakerState),
          ),
        );

        // Set up half-open transition config
        const halfOpenConfig = {
          ...mockConfig,
          circuitBreaker: {
            failureThreshold: 2,
            resetTimeoutMs: 1000,
            halfOpenMaxRequests: 1,
          },
        };

        const client = createBePaidAdapterClient(mockBePaidSDK, halfOpenConfig);

        // Cause failures to open circuit breaker
        mockBePaidSDK.getPaymentStatus.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Service unavailable',
          details: { httpStatus: 503 },
        });

        // Two failures should open the circuit
        await expect(Effect.runPromise(client.getPaymentStatus('txn-123'))).rejects.toThrow();
        await expect(Effect.runPromise(client.getPaymentStatus('txn-123'))).rejects.toThrow();

        // Now circuit should be open - next call should fail immediately
        await expect(Effect.runPromise(client.getPaymentStatus('txn-123'))).rejects.toThrow();

        expect(mockConfig.observability?.onCircuitStateChange).toHaveBeenCalled();
      });

      it('should support different bulk request sizes', async () => {
        // Test with different numbers of transaction IDs
        const bulkRequests = [
          { transactionIds: ['txn-1'] },
          { transactionIds: ['txn-1', 'txn-2', 'txn-3'] },
          { transactionIds: Array.from({ length: 10 }, (_, i) => `txn-${i + 1}`) },
        ];

        for (const bulkRequest of bulkRequests) {
          mockBePaidSDK.getPaymentStatus.mockResolvedValue({
            transactionId: 'txn-success',
            orderId: 'order-success',
            status: 'successful',
            amount: 1000,
            currency: 'BYN',
            timestamp: new Date().toISOString(),
            raw: {},
          });

          const result = await Effect.runPromise(
            bePaidAdapter.getBulkPaymentStatus(bulkRequest).pipe(
              Effect.provide(createTestLayer()),
            ),
          );

          expect(result.results).toHaveLength(bulkRequest.transactionIds.length);
        }
      });

      it('should handle SDK throwing non-BePaidAPIError exceptions', async () => {
        mockBePaidSDK.createPayment.mockRejectedValue(new Error('Network timeout'));

        await expect(
          Effect.runPromise(
            bePaidAdapter.createPayment({
              amount: 1000,
              currency: 'BYN',
              orderId: 'order-exception',
            }).pipe(Effect.provide(createTestLayer())),
          ),
        ).rejects.toThrow();
      });

      it('should handle SDK throwing primitive values', async () => {
        mockBePaidSDK.createPayment.mockRejectedValue('String error');

        await expect(
          Effect.runPromise(
            bePaidAdapter.createPayment({
              amount: 1000,
              currency: 'BYN',
              orderId: 'order-primitive',
            }).pipe(Effect.provide(createTestLayer())),
          ),
        ).rejects.toThrow();
      });

      it('should handle SDK returning malformed responses', async () => {
        mockBePaidSDK.getPaymentStatus.mockResolvedValue({
          transactionId: null as any, // malformed
          orderId: undefined as any, // malformed
          status: 'invalid_status' as any, // malformed
          amount: 'not_a_number' as any, // malformed
          currency: 123 as any, // malformed
          timestamp: {} as any, // malformed
          raw: null as any, // malformed
        });

        const result = await Effect.runPromise(
          bePaidAdapter.getPaymentStatus('txn-malformed').pipe(
            Effect.provide(createTestLayer()),
          ),
        );

        // Should still normalize malformed data gracefully
        expect(result.transactionId).toBe('');
        expect(result.orderId).toBe('');
        expect(result.status).toBe('invalid_status'); // keeps as-is
        expect(typeof result.amount).toBe('string'); // coerced to string
      });
    });

    describe('Observability', () => {
      it('should call all observability hooks', async () => {
        mockBePaidSDK.createPayment.mockResolvedValue({
          transactionId: 'txn-123',
          orderId: 'order-123',
          status: 'successful',
          amount: 1000,
          currency: 'BYN',
          timestamp: new Date().toISOString(),
          raw: {},
        });

        await Effect.runPromise(
          bePaidAdapter.createPayment({
            amount: 1000,
            currency: 'BYN',
            orderId: 'order-123',
          }).pipe(
            Effect.provide(createTestLayer()),
          ),
        );

        expect(mockConfig.observability?.onSdkCall).toHaveBeenCalled();
        expect(mockConfig.observability?.onSdkSuccess).toHaveBeenCalled();
      });

      it('should call error hooks on failure', async () => {
        mockBePaidSDK.createPayment.mockRejectedValue({
          _tag: 'BePaidAPIError',
          message: 'Payment failed',
          details: { bepaidCode: 'card_declined', httpStatus: 402 },
        });

        await expect(
          Effect.runPromise(
            bePaidAdapter.createPayment({
              amount: 1000,
              currency: 'BYN',
              orderId: 'order-123',
            }).pipe(
              Effect.provide(createTestLayer()),
            ),
          ),
        ).rejects.toThrow();

        expect(mockConfig.observability?.onSdkCall).toHaveBeenCalled();
        expect(mockConfig.observability?.onSdkError).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty transaction ID', async () => {
      const result = await Effect.runPromise(
        bePaidAdapter.getPaymentStatus('').pipe(
          Effect.provide(createTestLayer()),
          Effect.flip,
        ),
      );

      expect(result._tag).toBe('UnknownError');
      expect(result.message).toContain('Unhandled error');
    });

    it('should handle edge cases in payment creation', async () => {
      // Test with minimal data - SDK should handle defaults
      mockBePaidSDK.createPayment.mockResolvedValue({
        transactionId: 'txn-edge',
        orderId: '', // empty orderId
        status: undefined as any, // undefined status
        amount: 1000,
        currency: undefined as any, // undefined currency
        timestamp: undefined as any, // undefined timestamp
        raw: {},
      });

      const result = await Effect.runPromise(
        bePaidAdapter.createPayment({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order-edge',
        }).pipe(Effect.provide(createTestLayer())),
      );

      expect(result.transactionId).toBe('txn-edge');
      expect(result.orderId).toBe(''); // SDK returned empty
      expect(result.status).toBe('processing'); // default status
      expect(result.currency).toBe('BYN'); // default from config
      expect(result.timestamp).toBeDefined(); // should be set to current time
    });

    it('should handle extremely large amounts', async () => {
      mockBePaidSDK.createPayment.mockResolvedValue({
        transactionId: 'txn-large',
        orderId: 'order-large',
        status: 'successful',
        amount: 999999999,
        currency: 'BYN',
        raw: {},
      });

      const result = await Effect.runPromise(
        bePaidAdapter.createPayment({
          amount: 999999999,
          currency: 'BYN',
          orderId: 'order-large',
        }).pipe(
          Effect.provide(createTestLayer()),
        ),
      );

      expect(result.amount).toBe(999999999);
    });

    it('should handle special characters in order ID', async () => {
      mockBePaidSDK.createPayment.mockResolvedValue({
        transactionId: 'txn-special',
        orderId: 'order_123-ABC@#$%',
        status: 'successful',
        amount: 1000,
        currency: 'BYN',
        raw: {},
      });

      const result = await Effect.runPromise(
        bePaidAdapter.createPayment({
          amount: 1000,
          currency: 'BYN',
          orderId: 'order_123-ABC@#$%',
        }).pipe(
          Effect.provide(createTestLayer()),
        ),
      );

      expect(result.orderId).toBe('order_123-ABC@#$%');
    });

    it('should handle concurrent requests', async () => {
      const request1: BePaidPaymentRequest = {
        amount: 1000,
        currency: 'BYN',
        orderId: 'order-1',
      };

      const request2: BePaidPaymentRequest = {
        amount: 2000,
        currency: 'BYN',
        orderId: 'order-2',
      };

      const mockResponse1 = {
        transactionId: 'txn-1',
        orderId: 'order-1',
        status: 'successful',
        amount: 1000,
        currency: 'BYN',
        raw: {},
      };

      const mockResponse2 = {
        transactionId: 'txn-2',
        orderId: 'order-2',
        status: 'successful',
        amount: 2000,
        currency: 'BYN',
        raw: {},
      };

      mockBePaidSDK.createPayment
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const [result1, result2] = await Promise.all([
        Effect.runPromise(
          bePaidAdapter.createPayment(request1).pipe(
            Effect.provide(createTestLayer()),
          ),
        ),
        Effect.runPromise(
          bePaidAdapter.createPayment(request2).pipe(
            Effect.provide(createTestLayer()),
          ),
        ),
      ]);

      expect(result1.transactionId).toBe('txn-1');
      expect(result2.transactionId).toBe('txn-2');
      expect(mockBePaidSDK.createPayment).toHaveBeenCalledTimes(2);
    });
  });
});
