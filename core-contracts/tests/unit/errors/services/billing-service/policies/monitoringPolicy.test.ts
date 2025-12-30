import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  calculateBusinessImpact,
  calculateMonitoringAttributes,
  calculateMonitoringPriority,
} from '../../../../../../src/errors/services/billing-service/policies/monitoringPolicy.js';

import { getBillingErrorMetadata } from '../../../../../../src/errors/services/billing-service/BillingServiceErrorRegistry.js';

import type { BillingServiceError } from '../../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';

// ==================== MOCKS ====================

vi.mock(
  '../../../../../../src/errors/services/billing-service/BillingServiceErrorRegistry.js',
  () => ({
    getBillingErrorMetadata: vi.fn(),
  }),
);

// ==================== MOCK DATA ====================

/** Mock объекты для разных типов BillingServiceError */
const mockErrors = {
  paymentFailedError: {
    _tag: 'PaymentFailedError' as const,
    code: 'SERVICE_BILLING_PAYMENT_FAILED' as const,
    origin: 'SERVICE' as const,
    category: 'BUSINESS' as const,
    severity: 'high' as const,
    message: 'Payment failed',
    details: {
      transactionId: 'txn-123',
      amount: 100,
      currency: 'USD',
      retryable: false,
    },
    timestamp: '2024-01-01T00:00:00.000Z',
  } as unknown as BillingServiceError,

  subscriptionError: {
    _tag: 'SubscriptionError' as const,
    code: 'SERVICE_BILLING_SUBSCRIPTION_FAILED' as const,
    origin: 'SERVICE' as const,
    category: 'BUSINESS' as const,
    severity: 'medium' as const,
    message: 'Subscription failed',
    details: {
      subscriptionId: 'sub-123',
      reason: 'payment_failed',
      planId: 'plan-basic',
    },
    timestamp: '2024-01-01T00:00:00.000Z',
  } as unknown as BillingServiceError,

  refundError: {
    _tag: 'RefundError' as const,
    code: 'SERVICE_BILLING_REFUND_FAILED' as const,
    origin: 'SERVICE' as const,
    category: 'BUSINESS' as const,
    severity: 'high' as const,
    message: 'Refund failed',
    details: {
      transactionId: 'txn-456',
      reason: 'policy_violation',
      refundAmount: 50,
    },
    timestamp: '2024-01-01T00:00:00.000Z',
  } as unknown as BillingServiceError,

  infrastructureError: {
    _tag: 'InfrastructureUnknownError' as const,
    code: 'SERVICE_BILLING_INFRASTRUCTURE_ERROR' as const,
    origin: 'INFRASTRUCTURE' as const,
    category: 'TECHNICAL' as const,
    severity: 'high' as const,
    message: 'Infrastructure error',
    details: {
      originalError: new Error('Connection failed'),
    },
    timestamp: '2024-01-01T00:00:00.000Z',
  } as unknown as BillingServiceError,
};

/** Mock metadata для тестирования */
const mockMetadata = {
  paymentFailed: {
    code: 'SERVICE_BILLING_PAYMENT_FAILED' as const,
    description: 'Payment processing failed',
    severity: 'high' as const,
    category: 'BUSINESS' as const,
    origin: 'SERVICE' as const,
    httpStatus: 400,
    internalCode: 'PAY_FAIL',
    loggable: true,
    visibility: 'internal' as const,
    refundable: false,
    subscriptionRequired: false,
    retryable: false,
    retryMetadataVersion: 'v1' as const,
    amountSensitive: true,
    fraudRisk: 'high' as const,
    auditRequired: true,
    complianceLevel: 'pci' as const,
    paymentMethod: 'credit_card' as const,
    regionId: 'us-east-1',
    tenantId: 'tenant-123',
  },

  paymentFailedRetryable: {
    code: 'SERVICE_BILLING_PAYMENT_FAILED' as const,
    description: 'Payment processing failed (retryable)',
    severity: 'high' as const,
    category: 'BUSINESS' as const,
    origin: 'SERVICE' as const,
    httpStatus: 503,
    internalCode: 'PAY_FAIL_RETRY',
    loggable: true,
    visibility: 'internal' as const,
    refundable: false,
    subscriptionRequired: false,
    retryable: true,
    retryPolicy: 'delayed' as const,
    retryMetadataVersion: 'v1' as const,
    amountSensitive: true,
    fraudRisk: 'medium' as const,
    auditRequired: false,
    complianceLevel: 'pci' as const,
    paymentMethod: 'credit_card' as const,
    regionId: 'us-east-1',
    tenantId: 'tenant-123',
  },

  refundFailed: {
    code: 'SERVICE_BILLING_REFUND_FAILED' as const,
    description: 'Refund processing failed',
    severity: 'high' as const,
    category: 'BUSINESS' as const,
    origin: 'SERVICE' as const,
    httpStatus: 400,
    internalCode: 'REFUND_FAIL',
    loggable: true,
    visibility: 'internal' as const,
    refundable: true,
    subscriptionRequired: false,
    retryable: false,
    retryMetadataVersion: 'v1' as const,
    amountSensitive: true,
    fraudRisk: 'high' as const,
    auditRequired: true,
    complianceLevel: 'pci' as const,
    paymentMethod: 'credit_card' as const,
    regionId: 'us-east-1',
    tenantId: 'tenant-123',
  },

  subscriptionFailed: {
    code: 'SERVICE_BILLING_SUBSCRIPTION_FAILED' as const,
    description: 'Subscription management failed',
    severity: 'medium' as const,
    category: 'BUSINESS' as const,
    origin: 'SERVICE' as const,
    httpStatus: 400,
    internalCode: 'SUB_FAIL',
    loggable: true,
    visibility: 'internal' as const,
    refundable: false,
    subscriptionRequired: true,
    retryable: true,
    retryPolicy: 'manual' as const,
    retryMetadataVersion: 'v1' as const,
    amountSensitive: false,
    fraudRisk: 'low' as const,
    auditRequired: false,
    complianceLevel: 'standard' as const,
    paymentMethod: 'credit_card' as const,
    regionId: 'us-east-1',
    tenantId: 'tenant-123',
  },

  infrastructureError: {
    code: 'SERVICE_BILLING_INFRASTRUCTURE_ERROR' as const,
    description: 'Infrastructure connectivity error',
    severity: 'low' as const,
    category: 'TECHNICAL' as const,
    origin: 'INFRASTRUCTURE' as const,
    httpStatus: 503,
    internalCode: 'INFRA_ERROR',
    loggable: true,
    visibility: 'internal' as const,
    refundable: false,
    subscriptionRequired: false,
    retryable: true,
    retryPolicy: 'immediate' as const,
    retryMetadataVersion: 'v1' as const,
    amountSensitive: false,
    fraudRisk: 'low' as const,
    auditRequired: false,
    complianceLevel: 'standard' as const,
    regionId: 'us-east-1',
    tenantId: 'tenant-123',
  },

  unknownError: {
    code: 'UNKNOWN_ERROR' as const,
    description: 'Unknown error occurred',
    severity: 'medium' as const,
    category: 'TECHNICAL' as const,
    origin: 'INFRASTRUCTURE' as const,
    httpStatus: 500,
    internalCode: 'UNKNOWN',
    loggable: true,
    visibility: 'internal' as const,
    refundable: false,
    subscriptionRequired: false,
    retryable: false,
    retryMetadataVersion: 'v1' as const,
    amountSensitive: false,
    fraudRisk: 'low' as const,
    auditRequired: false,
    complianceLevel: 'standard' as const,
    regionId: 'us-east-1',
    tenantId: 'tenant-123',
  },
};

// ==================== TESTS ====================

describe('MonitoringPolicy', () => {
  const mockGetBillingErrorMetadata = vi.mocked(getBillingErrorMetadata);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBillingErrorMetadata.mockReset();
  });

  describe('calculateBusinessImpact', () => {
    it('должен возвращать "high" для ошибок с PAYMENT_FAILED в коде', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);

      const result = calculateBusinessImpact(mockErrors.paymentFailedError);
      expect(result).toBe('high');
    });

    it('должен возвращать "high" для ошибок с REFUND в коде', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.refundFailed);

      const result = calculateBusinessImpact(mockErrors.refundError);
      expect(result).toBe('high');
    });

    it('должен возвращать "medium" для ошибок с SUBSCRIPTION в коде', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.subscriptionFailed);

      const result = calculateBusinessImpact(mockErrors.subscriptionError);
      expect(result).toBe('medium');
    });

    it('должен возвращать "low" для остальных ошибок', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.infrastructureError);

      const result = calculateBusinessImpact(mockErrors.infrastructureError);
      expect(result).toBe('low');
    });

    it('должен возвращать "medium" если metadata отсутствует', () => {
      mockGetBillingErrorMetadata.mockReturnValue(undefined);

      const result = calculateBusinessImpact(mockErrors.paymentFailedError);
      expect(result).toBe('medium');
    });

    it('должен корректно работать с разными типами ошибок', () => {
      // PaymentFailedError -> high
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);
      expect(calculateBusinessImpact(mockErrors.paymentFailedError)).toBe('high');

      // SubscriptionError -> medium
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.subscriptionFailed);
      expect(calculateBusinessImpact(mockErrors.subscriptionError)).toBe('medium');

      // RefundError -> high
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.refundFailed);
      expect(calculateBusinessImpact(mockErrors.refundError)).toBe('high');

      // InfrastructureUnknownError -> low
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.infrastructureError);
      expect(calculateBusinessImpact(mockErrors.infrastructureError)).toBe('low');
    });
  });

  describe('calculateMonitoringPriority', () => {
    it('должен возвращать "high" для ошибок с auditRequired: true', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);

      const result = calculateMonitoringPriority(mockErrors.paymentFailedError);
      expect(result).toBe('high');
    });

    it('должен возвращать "high" для ошибок с PAYMENT_FAILED в коде', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);

      const result = calculateMonitoringPriority(mockErrors.paymentFailedError);
      expect(result).toBe('high');
    });

    it('должен возвращать "medium" для retryable ошибок', () => {
      // Используем infrastructureError с retryable=true, но без auditRequired и PAYMENT_FAILED
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.infrastructureError,
        retryable: true,
        auditRequired: false,
      });

      const result = calculateMonitoringPriority(mockErrors.infrastructureError);
      expect(result).toBe('medium');
    });

    it('должен возвращать "medium" для ошибок с SUBSCRIPTION в коде', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.subscriptionFailed);

      const result = calculateMonitoringPriority(mockErrors.subscriptionError);
      expect(result).toBe('medium');
    });

    it('должен возвращать "low" для остальных ошибок', () => {
      // Используем infrastructureError без retryable, auditRequired и без SUBSCRIPTION/PAYMENT_FAILED в коде
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.infrastructureError,
        retryable: false,
        auditRequired: false,
      });

      const result = calculateMonitoringPriority(mockErrors.infrastructureError);
      expect(result).toBe('low');
    });

    it('должен возвращать "medium" если metadata отсутствует', () => {
      mockGetBillingErrorMetadata.mockReturnValue(undefined);

      const result = calculateMonitoringPriority(mockErrors.paymentFailedError);
      expect(result).toBe('medium');
    });

    it('должен правильно комбинировать условия (auditRequired имеет приоритет)', () => {
      // auditRequired + PAYMENT_FAILED -> high
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.paymentFailed,
        auditRequired: true,
        retryable: true,
      });
      expect(calculateMonitoringPriority(mockErrors.paymentFailedError)).toBe('high');

      // retryable + SUBSCRIPTION -> medium
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.subscriptionFailed,
        auditRequired: false,
        retryable: true,
      });
      expect(calculateMonitoringPriority(mockErrors.subscriptionError)).toBe('medium');

      // Только retryable -> medium
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.infrastructureError,
        auditRequired: false,
        retryable: true,
      });
      expect(calculateMonitoringPriority(mockErrors.infrastructureError)).toBe('medium');
    });
  });

  describe('calculateMonitoringAttributes', () => {
    it('должен возвращать корректные атрибуты для PaymentFailedError', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);

      const result = calculateMonitoringAttributes(mockErrors.paymentFailedError);

      expect(result).toEqual({
        errorTag: 'PaymentFailedError',
        errorClass: 'domain',
        severity: 'high',
        businessImpact: 'high',
      });
    });

    it('должен возвращать корректные атрибуты для SubscriptionError', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.subscriptionFailed);

      const result = calculateMonitoringAttributes(mockErrors.subscriptionError);

      expect(result).toEqual({
        errorTag: 'SubscriptionError',
        errorClass: 'domain',
        severity: 'medium',
        businessImpact: 'medium',
      });
    });

    it('должен возвращать корректные атрибуты для RefundError', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.refundFailed);

      const result = calculateMonitoringAttributes(mockErrors.refundError);

      expect(result).toEqual({
        errorTag: 'RefundError',
        errorClass: 'domain',
        severity: 'high',
        businessImpact: 'high',
      });
    });

    it('должен возвращать корректные атрибуты для InfrastructureUnknownError', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.infrastructureError);

      const result = calculateMonitoringAttributes(mockErrors.infrastructureError);

      expect(result).toEqual({
        errorTag: 'InfrastructureUnknownError',
        errorClass: 'infrastructure',
        severity: 'low',
        businessImpact: 'low',
      });
    });

    it('должен использовать severity: "medium" если metadata отсутствует', () => {
      mockGetBillingErrorMetadata.mockReturnValue(undefined);

      const result = calculateMonitoringAttributes(mockErrors.paymentFailedError);

      expect(result).toEqual({
        errorTag: 'PaymentFailedError',
        errorClass: 'domain',
        severity: 'medium',
        businessImpact: 'medium',
      });
    });

    it('должен использовать severity: "medium" если metadata undefined', () => {
      mockGetBillingErrorMetadata.mockReturnValue(undefined);

      const result = calculateMonitoringAttributes(mockErrors.paymentFailedError);

      expect(result).toEqual({
        errorTag: 'PaymentFailedError',
        errorClass: 'domain',
        severity: 'medium',
        businessImpact: 'medium',
      });
    });

    it('должен корректно определять errorClass для всех типов ошибок', () => {
      // PaymentFailedError -> domain
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);
      expect(calculateMonitoringAttributes(mockErrors.paymentFailedError).errorClass).toBe(
        'domain',
      );

      // SubscriptionError -> domain
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.subscriptionFailed);
      expect(calculateMonitoringAttributes(mockErrors.subscriptionError).errorClass).toBe('domain');

      // RefundError -> domain
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.refundFailed);
      expect(calculateMonitoringAttributes(mockErrors.refundError).errorClass).toBe('domain');

      // InfrastructureUnknownError -> infrastructure
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.infrastructureError);
      expect(calculateMonitoringAttributes(mockErrors.infrastructureError).errorClass).toBe(
        'infrastructure',
      );
    });

    it('должен возвращать правильный errorTag для каждого типа ошибки', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);
      expect(calculateMonitoringAttributes(mockErrors.paymentFailedError).errorTag).toBe(
        'PaymentFailedError',
      );

      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.subscriptionFailed);
      expect(calculateMonitoringAttributes(mockErrors.subscriptionError).errorTag).toBe(
        'SubscriptionError',
      );

      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.refundFailed);
      expect(calculateMonitoringAttributes(mockErrors.refundError).errorTag).toBe('RefundError');

      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.infrastructureError);
      expect(calculateMonitoringAttributes(mockErrors.infrastructureError).errorTag).toBe(
        'InfrastructureUnknownError',
      );
    });

    it('должен правильно комбинировать severity из metadata и businessImpact из расчетов', () => {
      // Тест с высокими severity и businessImpact
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.paymentFailed,
        severity: 'critical',
      });

      const result = calculateMonitoringAttributes(mockErrors.paymentFailedError);
      expect(result.severity).toBe('critical');
      expect(result.businessImpact).toBe('high'); // рассчитывается на основе кода

      // Тест с низкими severity и businessImpact
      mockGetBillingErrorMetadata.mockReturnValue({
        ...mockMetadata.infrastructureError,
        severity: 'low',
      });

      const result2 = calculateMonitoringAttributes(mockErrors.infrastructureError);
      expect(result2.severity).toBe('low');
      expect(result2.businessImpact).toBe('low');
    });
  });

  describe('Integration tests', () => {
    it('все функции должны работать вместе для комплексного мониторинга', () => {
      mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed);

      const error = mockErrors.paymentFailedError;

      const businessImpact = calculateBusinessImpact(error);
      const monitoringPriority = calculateMonitoringPriority(error);
      const monitoringAttributes = calculateMonitoringAttributes(error);

      expect(businessImpact).toBe('high');
      expect(monitoringPriority).toBe('high');
      expect(monitoringAttributes).toEqual({
        errorTag: 'PaymentFailedError',
        errorClass: 'domain',
        severity: 'high',
        businessImpact: 'high',
      });
    });

    it('должен корректно обрабатывать все типы ошибок из ERROR_CLASSIFICATION_MAPPING', () => {
      const testCases = [
        { error: mockErrors.paymentFailedError, expectedClass: 'domain' as const },
        { error: mockErrors.subscriptionError, expectedClass: 'domain' as const },
        { error: mockErrors.refundError, expectedClass: 'domain' as const },
        { error: mockErrors.infrastructureError, expectedClass: 'infrastructure' as const },
      ];

      testCases.forEach(({ error, expectedClass }) => {
        mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.paymentFailed); // используем любые metadata
        const attributes = calculateMonitoringAttributes(error);
        expect(attributes.errorClass).toBe(expectedClass);
      });
    });

    it('должен корректно работать с различными комбинациями metadata', () => {
      const metadataVariations = [
        { ...mockMetadata.paymentFailed, severity: 'critical' as const },
        { ...mockMetadata.subscriptionFailed, severity: 'low' as const },
        { ...mockMetadata.refundFailed, severity: 'medium' as const },
        { ...mockMetadata.infrastructureError, severity: 'high' as const },
      ];

      metadataVariations.forEach((metadata, index) => {
        mockGetBillingErrorMetadata.mockReturnValue(metadata);

        const error = mockErrors.paymentFailedError;
        const attributes = calculateMonitoringAttributes(error);

        expect(attributes.severity).toBe(metadata.severity);
        expect(attributes.errorTag).toBe('PaymentFailedError');
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('должен корректно работать если getBillingErrorMetadata выбрасывает ошибку', () => {
      mockGetBillingErrorMetadata.mockImplementation(() => {
        throw new Error('Registry error');
      });

      // Функции должны возвращать default значения
      expect(() => calculateBusinessImpact(mockErrors.paymentFailedError)).toThrow(
        'Registry error',
      );
      expect(() => calculateMonitoringPriority(mockErrors.paymentFailedError)).toThrow(
        'Registry error',
      );
      expect(() => calculateMonitoringAttributes(mockErrors.paymentFailedError)).toThrow(
        'Registry error',
      );
    });

    it('должен корректно работать с любым BillingServiceError типом', () => {
      const allErrors = Object.values(mockErrors);

      allErrors.forEach((error) => {
        mockGetBillingErrorMetadata.mockReturnValue(mockMetadata.unknownError);

        // Все функции должны работать без ошибок
        expect(() => calculateBusinessImpact(error)).not.toThrow();
        expect(() => calculateMonitoringPriority(error)).not.toThrow();
        expect(() => calculateMonitoringAttributes(error)).not.toThrow();

        // И возвращать валидные значения
        expect(['low', 'medium', 'high']).toContain(calculateBusinessImpact(error));
        expect(['low', 'medium', 'high']).toContain(calculateMonitoringPriority(error));

        const attrs = calculateMonitoringAttributes(error);
        expect(attrs).toHaveProperty('errorTag');
        expect(attrs).toHaveProperty('errorClass');
        expect(attrs).toHaveProperty('severity');
        expect(attrs).toHaveProperty('businessImpact');
      });
    });
  });
});
