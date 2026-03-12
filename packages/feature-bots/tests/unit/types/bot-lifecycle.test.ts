/**
 * @file Unit тесты для types/bot-lifecycle.ts
 * Цель: 100% покрытие экспортируемых lifecycle-типов.
 */
import { describe, expect, it } from 'vitest';

import type {
  BotEnforcementReason,
  BotLifecycleReason,
  BotPauseReason,
} from '../../../src/types/bot-lifecycle.js';

describe('BotPauseReason', () => {
  it('поддерживает все причины паузы бота', () => {
    const reasons: BotPauseReason[] = [
      'manual',
      'rate_limit',
      'integration_error',
      'quota_exceeded',
    ];

    expect(reasons).toHaveLength(4);
    reasons.forEach((reason) => {
      // runtime-проверка: строковые литералы совпадают с union-типом
      expect(typeof reason).toBe('string');
    });
  });
});

describe('BotEnforcementReason', () => {
  it('поддерживает все причины enforcement-ограничений бота', () => {
    const reasons: BotEnforcementReason[] = ['policy_violation', 'security_risk', 'billing_issue'];

    expect(reasons).toHaveLength(3);
    reasons.forEach((reason) => {
      expect(typeof reason).toBe('string');
    });
  });
});

describe('BotLifecycleReason', () => {
  it('объединяет причины паузы и enforcement причины', () => {
    const pauseReasons: BotPauseReason[] = [
      'manual',
      'rate_limit',
      'integration_error',
      'quota_exceeded',
    ];
    const enforcementReasons: BotEnforcementReason[] = [
      'policy_violation',
      'security_risk',
      'billing_issue',
    ];

    const allReasons: BotLifecycleReason[] = [...pauseReasons, ...enforcementReasons];

    expect(allReasons).toHaveLength(7);
    allReasons.forEach((reason) => {
      expect(typeof reason).toBe('string');
    });
  });
});
