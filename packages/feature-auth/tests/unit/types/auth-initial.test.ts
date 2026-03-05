/**
 * @file Unit тесты для types/auth-initial.ts
 * Полное покрытие канонических начальных состояний аутентификации
 */

import { describe, expect, it } from 'vitest';

import type { AuthState, SecurityState, SessionState } from '../../../src/types/auth.js';
import {
  createInitialSessionState,
  initialAuthState,
  initialSecurityState,
} from '../../../src/types/auth-initial.js';
import type { ReadonlyDeep } from '../../../src/types/auth-risk.js';

// ============================================================================
// 🔐 CANONICAL INITIAL STATES — КАНОНИЧЕСКИЕ НАЧАЛЬНЫЕ СОСТОЯНИЯ
// ============================================================================

describe('initialAuthState', () => {
  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(initialAuthState)).toBe(true);
    expect(() => {
      // @ts-expect-error — тестируем иммутабельность
      // eslint-disable-next-line fp/no-mutation
      initialAuthState.status = 'authenticated';
    }).toThrow();
  });

  it('должен иметь правильный тип AuthState', () => {
    const state: AuthState = initialAuthState;
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('должен иметь статус unauthenticated', () => {
    expect(initialAuthState.status).toBe('unauthenticated');
  });

  it('должен быть доступен для чтения', () => {
    expect(initialAuthState.status).toBe('unauthenticated');
  });
});

describe('createInitialSessionState', () => {
  it('должен быть функцией', () => {
    expect(typeof createInitialSessionState).toBe('function');
  });

  it('должен возвращать null', () => {
    const result = createInitialSessionState();
    expect(result).toBeNull();
  });

  it('должен возвращать ReadonlyDeep<SessionState | null>', () => {
    const result: ReadonlyDeep<SessionState | null> = createInitialSessionState();
    expect(result).toBeNull();
  });

  it('должен возвращать один и тот же результат при каждом вызове', () => {
    const result1 = createInitialSessionState();
    const result2 = createInitialSessionState();
    expect(result1).toBe(result2);
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it('должен быть pure функцией (без побочных эффектов)', () => {
    const result1 = createInitialSessionState();
    const result2 = createInitialSessionState();
    expect(result1).toBe(result2);
  });
});

describe('initialSecurityState', () => {
  it('должен быть замороженным объектом', () => {
    expect(Object.isFrozen(initialSecurityState)).toBe(true);
    expect(() => {
      // @ts-expect-error — тестируем иммутабельность
      // eslint-disable-next-line fp/no-mutation
      initialSecurityState.status = 'blocked';
    }).toThrow();
  });

  it('должен иметь правильный тип SecurityState', () => {
    const state: SecurityState = initialSecurityState;
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('должен иметь статус secure', () => {
    expect(initialSecurityState.status).toBe('secure');
  });

  it('должен быть доступен для чтения', () => {
    expect(initialSecurityState.status).toBe('secure');
  });
});

// ============================================================================
// 🧪 INTEGRATION TESTS — ИНТЕГРАЦИОННЫЕ ТЕСТЫ
// ============================================================================

describe('Initial States Integration', () => {
  it('все экспорты должны быть определены', () => {
    expect(initialAuthState).toBeDefined();
    expect(createInitialSessionState).toBeDefined();
    expect(initialSecurityState).toBeDefined();
  });

  it('константы должны быть иммутабельными, функция должна возвращать null', () => {
    // Проверяем иммутабельность констант
    expect(Object.isFrozen(initialAuthState)).toBe(true);
    expect(Object.isFrozen(initialSecurityState)).toBe(true);

    // Проверяем функцию
    expect(createInitialSessionState()).toBeNull();

    // Проверяем типы
    const authState: AuthState = initialAuthState;
    const securityState: SecurityState = initialSecurityState;
    const sessionState: ReadonlyDeep<SessionState | null> = createInitialSessionState();

    expect(authState.status).toBe('unauthenticated');
    expect(securityState.status).toBe('secure');
    expect(sessionState).toBeNull();
  });

  it('начальные состояния должны соответствовать ожиданиям для reset операций', () => {
    // Это канонические значения для атомарного reset
    expect(initialAuthState.status).toBe('unauthenticated');
    expect(initialSecurityState.status).toBe('secure');
    expect(createInitialSessionState()).toBeNull();
  });
});
