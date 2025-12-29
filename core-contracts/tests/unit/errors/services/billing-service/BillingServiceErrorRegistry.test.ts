import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';

import {
  BILLING_SERVICE_ERROR_REGISTRY,
  getBillingErrorMetadata,
} from '../../../../../src/errors/services/billing-service/BillingServiceErrorRegistry.js';
import {
  createPaymentFailedError,
} from '../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';
import type {
  BillingBehaviorMetadata,
  BillingComplianceMetadata,
  BillingMetadata,
  BillingServiceErrorMetadata,
} from '../../../../../src/errors/services/billing-service/BillingServiceErrorRegistry.js';
import { SERVICE_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode.js';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants.js';
import type { BillingServiceError } from '../../../../../src/errors/services/billing-service/BillingServiceErrorTypes.js';

// ==================== CONSTANTS TESTS ====================

describe('BillingServiceErrorRegistry - Constants', () => {
  describe('BILLING_SERVICE_ERROR_REGISTRY', () => {
    it('should contain all expected billing service error codes', () => {
      const expectedCodes = [
        SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
        SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
        SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR,
      ];

      expectedCodes.forEach((code) => {
        expect(BILLING_SERVICE_ERROR_REGISTRY).toHaveProperty(code);
        expect(BILLING_SERVICE_ERROR_REGISTRY[code as keyof typeof BILLING_SERVICE_ERROR_REGISTRY])
          .toBeDefined();
      });
    });

    it('should have correct count of error codes', () => {
      expect(Object.keys(BILLING_SERVICE_ERROR_REGISTRY)).toHaveLength(3);
    });

    it('should have correct metadata structure for each error', () => {
      Object.values(BILLING_SERVICE_ERROR_REGISTRY).forEach((metadata) => {
        // Base metadata fields
        expect(metadata).toHaveProperty('code');
        expect(metadata).toHaveProperty('description');
        expect(metadata).toHaveProperty('severity');
        expect(metadata).toHaveProperty('category');
        expect(metadata).toHaveProperty('origin');
        expect(metadata).toHaveProperty('httpStatus');
        expect(metadata).toHaveProperty('internalCode');
        expect(metadata).toHaveProperty('loggable');
        expect(metadata).toHaveProperty('visibility');

        // Behavior metadata fields
        expect(metadata).toHaveProperty('refundable');
        expect(metadata).toHaveProperty('subscriptionRequired');
        expect(metadata).toHaveProperty('visibility');

        // Compliance metadata fields
        expect(metadata).toHaveProperty('amountSensitive');
        expect(metadata).toHaveProperty('fraudRisk');
        expect(metadata).toHaveProperty('auditRequired');
        expect(metadata).toHaveProperty('complianceLevel');

        // Type assertions
        expect(typeof metadata.refundable).toBe('boolean');
        expect(typeof metadata.subscriptionRequired).toBe('boolean');
        expect(['public', 'internal']).toContain(metadata.visibility);
        expect(typeof metadata.amountSensitive).toBe('boolean');
        expect(['low', 'medium', 'high']).toContain(metadata.fraudRisk);
        expect(typeof metadata.auditRequired).toBe('boolean');
        expect(['pci', 'gdpr', 'standard']).toContain(metadata.complianceLevel);
      });
    });

    describe('SERVICE_BILLING_PAYMENT_FAILED metadata', () => {
      const metadata =
        BILLING_SERVICE_ERROR_REGISTRY[SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED];

      it('should have correct base properties', () => {
        expect(metadata.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
        expect(metadata.description).toContain('Обработка платежа');
        expect(metadata.severity).toBe(ERROR_SEVERITY.HIGH);
        expect(metadata.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(metadata.origin).toBe(ERROR_ORIGIN.SERVICE);
        expect(metadata.httpStatus).toBe(422);
        expect(metadata.internalCode).toBe('PAYMENT_FAILED');
      });

      it('should have correct behavior properties', () => {
        expect(metadata.refundable).toBe(false);
        expect(metadata.subscriptionRequired).toBe(false);
        expect(metadata.visibility).toBe('public');
      });

      it('should have correct compliance properties', () => {
        expect(metadata.amountSensitive).toBe(true);
        expect(metadata.fraudRisk).toBe('medium');
        expect(metadata.auditRequired).toBe(true);
        expect(metadata.complianceLevel).toBe('pci');
      });
    });

    describe('SERVICE_BILLING_SUBSCRIPTION_ERROR metadata', () => {
      const metadata =
        BILLING_SERVICE_ERROR_REGISTRY[SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR];

      it('should have correct base properties', () => {
        expect(metadata.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR);
        expect(metadata.description).toContain('управления подпиской');
        expect(metadata.severity).toBe(ERROR_SEVERITY.MEDIUM);
        expect(metadata.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(metadata.origin).toBe(ERROR_ORIGIN.SERVICE);
        expect(metadata.httpStatus).toBe(403);
        expect(metadata.internalCode).toBe('SUBSCRIPTION_ERROR');
      });

      it('should have correct behavior properties', () => {
        expect(metadata.refundable).toBe(false);
        expect(metadata.subscriptionRequired).toBe(true);
        expect(metadata.visibility).toBe('public');
      });

      it('should have correct compliance properties', () => {
        expect(metadata.amountSensitive).toBe(false);
        expect(metadata.fraudRisk).toBe('low');
        expect(metadata.auditRequired).toBe(false);
        expect(metadata.complianceLevel).toBe('standard');
      });
    });

    describe('SERVICE_BILLING_REFUND_ERROR metadata', () => {
      const metadata =
        BILLING_SERVICE_ERROR_REGISTRY[SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR];

      it('should have correct base properties', () => {
        expect(metadata.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR);
        expect(metadata.description).toContain('возврата');
        expect(metadata.severity).toBe(ERROR_SEVERITY.HIGH);
        expect(metadata.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(metadata.origin).toBe(ERROR_ORIGIN.SERVICE);
        expect(metadata.httpStatus).toBe(400);
        expect(metadata.internalCode).toBe('REFUND_ERROR');
      });

      it('should have correct behavior properties', () => {
        expect(metadata.refundable).toBe(true);
        expect(metadata.subscriptionRequired).toBe(false);
        expect(metadata.visibility).toBe('public');
      });

      it('should have correct compliance properties', () => {
        expect(metadata.amountSensitive).toBe(true);
        expect(metadata.fraudRisk).toBe('medium');
        expect(metadata.auditRequired).toBe(true);
        expect(metadata.complianceLevel).toBe('pci');
      });
    });
  });
});

// ==================== METADATA FUNCTIONS TESTS ====================

describe('BillingServiceErrorRegistry - Metadata Functions', () => {
  describe('getBillingErrorMetadata', () => {
    it('should return metadata for valid error codes', () => {
      const paymentFailedMeta = getBillingErrorMetadata(
        SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
      );
      expect(paymentFailedMeta).toBeDefined();
      expect(paymentFailedMeta?.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      expect(paymentFailedMeta?.description).toContain('Обработка платежа');

      const subscriptionErrorMeta = getBillingErrorMetadata(
        SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
      );
      expect(subscriptionErrorMeta).toBeDefined();
      expect(subscriptionErrorMeta?.code).toBe(
        SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
      );

      const refundErrorMeta = getBillingErrorMetadata(
        SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR,
      );
      expect(refundErrorMeta).toBeDefined();
      expect(refundErrorMeta?.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR);
    });

    it('should return metadata for BillingServiceError instances', () => {
      // Mock error objects
      const mockPaymentError: BillingServiceError = {
        _tag: 'PaymentFailedError',
        code: SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
        origin: ERROR_ORIGIN.SERVICE,
        category: ERROR_CATEGORY.BUSINESS,
        severity: 'high',
        message: 'Test payment error',
        details: {
          transactionId: 'test-tx',
          amount: 100,
          currency: 'BYN',
          retryable: true,
        },
        timestamp: new Date().toISOString(),
      };

      const metadata = getBillingErrorMetadata(mockPaymentError);
      expect(metadata).toBeDefined();
      expect(metadata?.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
    });

    it('should return undefined for unknown error codes', () => {
      const unknownCode = 'UNKNOWN_ERROR_CODE' as any;
      const metadata = getBillingErrorMetadata(unknownCode);
      expect(metadata).toBeUndefined();
    });

    it('should handle string error codes correctly', () => {
      const metadata = getBillingErrorMetadata(SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
      expect(metadata).toBeDefined();
      expect(metadata?.code).toBe(SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED);
    });

    it('should return same metadata as direct registry access', () => {
      const directAccess =
        BILLING_SERVICE_ERROR_REGISTRY[SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED];
      const functionAccess = getBillingErrorMetadata(
        SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
      );

      expect(functionAccess).toEqual(directAccess);
    });
  });
});

// ==================== TYPE SAFETY TESTS ====================

describe('BillingServiceErrorRegistry - Type Safety', () => {
  it('should have correct BillingServiceErrorMetadata type structure', () => {
    const metadata: BillingServiceErrorMetadata =
      BILLING_SERVICE_ERROR_REGISTRY[SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED];

    // Type assertion for extended metadata
    expect(metadata).toHaveProperty('fraudRisk');
    expect(metadata).toHaveProperty('complianceLevel');

    // Type assertion for base metadata
    expect(metadata).toHaveProperty('code');
    expect(metadata).toHaveProperty('description');
    expect(metadata).toHaveProperty('severity');
  });

  it('should have correct BillingMetadata type structure', () => {
    const metadata: BillingMetadata = {
      refundable: false,
      subscriptionRequired: false,
      visibility: 'public',
      amountSensitive: true,
      fraudRisk: 'medium',
      auditRequired: true,
      complianceLevel: 'pci',
    };

    expect(metadata.fraudRisk).toBe('medium');
  });

  it('should have correct BillingBehaviorMetadata type structure', () => {
    const behavior: BillingBehaviorMetadata = {
      refundable: false,
      subscriptionRequired: false,
      visibility: 'public',
    };

    expect(behavior.visibility).toBe('public');
  });

  it('should have correct BillingComplianceMetadata type structure', () => {
    const compliance: BillingComplianceMetadata = {
      amountSensitive: true,
      fraudRisk: 'medium',
      auditRequired: true,
      complianceLevel: 'pci',
    };

    expect(compliance.fraudRisk).toBe('medium');
    expect(compliance.complianceLevel).toBe('pci');
  });
});

// ==================== EXHAUSTIVENESS TESTS ====================

describe('BillingServiceErrorRegistry - Exhaustiveness', () => {
  it('should cover all BillingServiceError codes', () => {
    const registryCodes = Object.keys(BILLING_SERVICE_ERROR_REGISTRY);

    // Mock type to check exhaustiveness
    const mockErrorCodes: BillingServiceError['code'][] = [
      SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
      SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
      SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR,
    ];

    mockErrorCodes.forEach((code) => {
      expect(registryCodes).toContain(code);
    });

    expect(registryCodes).toHaveLength(mockErrorCodes.length);
  });

  it('should have registry keys matching BillingServiceError codes', () => {
    const registryKeys = Object.keys(
      BILLING_SERVICE_ERROR_REGISTRY,
    ) as BillingServiceError['code'][];

    // All registry keys should be valid BillingServiceError codes
    registryKeys.forEach((key) => {
      expect([
        SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
        SERVICE_ERROR_CODES.SERVICE_BILLING_SUBSCRIPTION_ERROR,
        SERVICE_ERROR_CODES.SERVICE_BILLING_REFUND_ERROR,
        SERVICE_ERROR_CODES.SERVICE_BILLING_WEBPAY_API_ERROR,
      ]).toContain(key);
    });
  });
});

// ==================== INTEGRATION TESTS ====================

describe('BillingServiceErrorRegistry - Integration', () => {
  it('should work with real BillingServiceError instances', () => {
    // Create a real PaymentFailedError instance
    const effect = createPaymentFailedError('test-tx-123', 100, 'BYN');

    const result = Effect.runSync(effect);
    const metadata = getBillingErrorMetadata(result);

    expect(metadata).toBeDefined();
    expect(metadata?.fraudRisk).toBe('medium');
  });

  it('should provide consistent metadata across different access methods', () => {
    const code = SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED;

    const directMetadata =
      BILLING_SERVICE_ERROR_REGISTRY[code as keyof typeof BILLING_SERVICE_ERROR_REGISTRY];
    const functionMetadata = getBillingErrorMetadata(code);

    expect(functionMetadata).toEqual(directMetadata);
    expect(functionMetadata?.code).toBe(code);
  });

  it('should handle all registry keys safely', () => {
    // Test that all registry keys can be safely accessed
    const registryKeys = Object.keys(
      BILLING_SERVICE_ERROR_REGISTRY,
    ) as (keyof typeof BILLING_SERVICE_ERROR_REGISTRY)[];

    registryKeys.forEach((key) => {
      const metadata = getBillingErrorMetadata(key);
      expect(metadata).toBeDefined();
      expect(metadata?.code).toBe(key);
    });
  });
});
