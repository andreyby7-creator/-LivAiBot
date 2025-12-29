/**
 * @file fraudDetectionTypes.test.ts - Тесты для типов fraud detection
 *
 * Проверяет константы и типы fraudDetectionTypes.ts
 */

import { describe, expect, it } from 'vitest';

import { RULE_PRIORITIES } from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionTypes.js';
import type { FraudDecision } from '../../../../../../src/errors/services/billing-service/policies/fraudDetectionTypes.js';

describe('FraudDetectionTypes', () => {
  describe('RULE_PRIORITIES', () => {
    it('should have correct priority values', () => {
      expect(RULE_PRIORITIES.PAYMENT_METHOD_MISMATCH).toBe(1);
      expect(RULE_PRIORITIES.RAPID_ATTEMPTS).toBe(2);
      expect(RULE_PRIORITIES.UNUSUAL_AMOUNT).toBe(3);
      expect(RULE_PRIORITIES.DEVICE_FINGERPRINT).toBe(4);
      expect(RULE_PRIORITIES.GEOLOCATION_MISMATCH).toBe(5);
      expect(RULE_PRIORITIES.EXCESSIVE_RETRIES).toBe(6);
      expect(RULE_PRIORITIES.VELOCITY_ATTACK).toBe(10);
    });

    it('should have ascending priority values (except velocity attack)', () => {
      const priorities = [
        RULE_PRIORITIES.PAYMENT_METHOD_MISMATCH,
        RULE_PRIORITIES.RAPID_ATTEMPTS,
        RULE_PRIORITIES.UNUSUAL_AMOUNT,
        RULE_PRIORITIES.DEVICE_FINGERPRINT,
        RULE_PRIORITIES.GEOLOCATION_MISMATCH,
        RULE_PRIORITIES.EXCESSIVE_RETRIES,
      ];

      // Check ascending order for most priorities
      priorities.forEach((priority, index) => {
        if (index < priorities.length - 1) {
          expect(priority).toBeLessThan(priorities[index + 1]);
        }
      });

      // Velocity attack should have highest priority
      expect(RULE_PRIORITIES.VELOCITY_ATTACK).toBeGreaterThan(RULE_PRIORITIES.EXCESSIVE_RETRIES);
    });

    it('should be defined as const object', () => {
      // Verify it's a frozen/const object structure
      expect(typeof RULE_PRIORITIES).toBe('object');
      expect(Object.isFrozen(RULE_PRIORITIES)).toBe(false); // as const doesn't freeze at runtime

      // Verify values are as expected
      expect(RULE_PRIORITIES.PAYMENT_METHOD_MISMATCH).toBe(1);
    });

    it('should have all required priority keys', () => {
      const expectedKeys = [
        'PAYMENT_METHOD_MISMATCH',
        'RAPID_ATTEMPTS',
        'UNUSUAL_AMOUNT',
        'DEVICE_FINGERPRINT',
        'GEOLOCATION_MISMATCH',
        'EXCESSIVE_RETRIES',
        'VELOCITY_ATTACK',
      ];

      const actualKeys = Object.keys(RULE_PRIORITIES);
      expect(actualKeys).toHaveLength(expectedKeys.length);
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
    });

    it('should have integer values', () => {
      const values = Object.values(RULE_PRIORITIES);
      values.forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      });
    });
  });

  describe('Type safety', () => {
    it('should allow creating typed objects', () => {
      // Test that we can create objects with the types
      const fraudDecision: FraudDecision = {
        _tag: 'Clean',
        score: 0,
        evaluatedRules: 0,
      };

      expect(fraudDecision._tag).toBe('Clean');
      expect(fraudDecision.score).toBe(0);
    });

    it('should support discriminated unions', () => {
      const cleanDecision: FraudDecision = {
        _tag: 'Clean',
        score: 5,
        evaluatedRules: 2,
      };

      const suspiciousDecision: FraudDecision = {
        _tag: 'Suspicious',
        score: 30,
        reasons: ['velocity_attack'],
        evaluatedRules: 3,
        triggeredRules: ['rule1'],
      };

      expect(cleanDecision._tag).toBe('Clean');
      expect(suspiciousDecision._tag).toBe('Suspicious');
      expect(suspiciousDecision.reasons).toContain('velocity_attack');
    });
  });
});
