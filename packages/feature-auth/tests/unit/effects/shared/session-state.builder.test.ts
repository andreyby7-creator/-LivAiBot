/**
 * @file Unit тесты для effects/shared/session-state.builder.ts
 * ============================================================================
 * 🔐 SESSION STATE BUILDER — ПОСТРОЕНИЕ СЕССИИ
 * ============================================================================
 *
 * Проверяет, что:
 * - Возвращает null если meSession отсутствует (intentional absence)
 * - Fail-fast: выбрасывает ошибку если issuedAt отсутствует
 * - Fail-fast: выбрасывает ошибку если expiresAt отсутствует
 * - Валидация ISO формата дат (Date.parse возвращает NaN)
 * - Fail-closed: проверка инварианта issuedAt <= expiresAt
 * - Fallback логика для дат (me.session > tokenPair)
 * - Copy-on-write: создает копию deviceInfo
 * - Shallow freeze: защита от мутаций
 */

import { describe, expect, it } from 'vitest';

import { buildSessionState } from '../../../../src/effects/shared/session-state.builder.js';
import type { BuildSessionStateParams } from '../../../../src/effects/shared/session-state.builder.js';
import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type { MeSessionInfo } from '../../../../src/domain/MeResponse.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';

/* eslint-disable functional/no-conditional-statements -- в тестах используем if для type narrowing SessionState union type */
/* eslint-disable fp/no-mutation -- в тестах намеренно используем мутации для удаления полей и проверки frozen */
/* eslint-disable @livai/rag/context-leakage -- тестовые helper функции не требуют очистки контекста */

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-123',
    deviceType: 'desktop',
    ...overrides,
  };
}

function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: '2026-12-31T23:59:59.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMeSession(overrides: Partial<MeSessionInfo> = {}): MeSessionInfo {
  return {
    sessionId: 'session-123',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    ...overrides,
  };
}

function createParams(overrides: Partial<BuildSessionStateParams> = {}): BuildSessionStateParams {
  return {
    deviceInfo: createDeviceInfo(),
    tokenPair: createTokenPair(),
    meSession: createMeSession(),
    ...overrides,
  };
}

// ============================================================================
// 📋 BUILD SESSION STATE — ОСНОВНЫЕ СЦЕНАРИИ
// ============================================================================

describe('buildSessionState', () => {
  describe('Успешное построение SessionState', () => {
    it('строит SessionState с данными из meSession', () => {
      const params = createParams();

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('active');
      if (result?.status === 'active') {
        expect(result.sessionId).toBe('session-123');
        expect(result.issuedAt).toBe('2026-01-01T00:00:00.000Z');
        expect(result.expiresAt).toBe('2026-12-31T23:59:59.000Z');
        expect(result.device).toEqual(createDeviceInfo());
      }
    });

    it('использует fallback на tokenPair для issuedAt если отсутствует в meSession', () => {
      const params = createParams({
        meSession: (() => {
          const session = createMeSession();
          delete (session as { issuedAt?: string; }).issuedAt;
          return session;
        })(),
      });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.issuedAt).toBe('2026-01-01T00:00:00.000Z'); // из tokenPair
        expect(result.expiresAt).toBe('2026-12-31T23:59:59.000Z'); // из meSession
      }
    });

    it('использует fallback на tokenPair для expiresAt если отсутствует в meSession', () => {
      const params = createParams({
        meSession: (() => {
          const session = createMeSession();
          delete (session as { expiresAt?: string; }).expiresAt;
          return session;
        })(),
      });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.issuedAt).toBe('2026-01-01T00:00:00.000Z'); // из meSession
        expect(result.expiresAt).toBe('2026-12-31T23:59:59.000Z'); // из tokenPair
      }
    });

    it('использует fallback на tokenPair для обеих дат если отсутствуют в meSession', () => {
      const params = createParams({
        meSession: (() => {
          const session = createMeSession();
          delete (session as { issuedAt?: string; expiresAt?: string; }).issuedAt;
          delete (session as { issuedAt?: string; expiresAt?: string; }).expiresAt;
          return session;
        })(),
      });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.issuedAt).toBe('2026-01-01T00:00:00.000Z'); // из tokenPair
        expect(result.expiresAt).toBe('2026-12-31T23:59:59.000Z'); // из tokenPair
      }
    });

    it('создает копию deviceInfo (copy-on-write)', () => {
      const deviceInfo = createDeviceInfo();
      const params = createParams({ deviceInfo });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.device).not.toBe(deviceInfo); // разные объекты
        expect(result.device).toEqual(deviceInfo); // но с одинаковыми данными
      }
    });

    it('возвращает frozen SessionState', () => {
      const params = createParams();

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      expect(() => {
        // @ts-expect-error -- проверка что объект frozen
        result.status = 'expired';
      }).toThrow();
    });
  });

  describe('Intentional absence (meSession === undefined)', () => {
    it('возвращает null если meSession отсутствует', () => {
      const params = createParams({ meSession: undefined });

      const result = buildSessionState(params);

      expect(result).toBeNull();
    });
  });

  describe('Fail-fast: Missing issuedAt', () => {
    it('выбрасывает ошибку если issuedAt отсутствует в meSession и tokenPair', () => {
      const params = createParams({
        meSession: (() => {
          const session = createMeSession();
          delete (session as { issuedAt?: string; }).issuedAt;
          return session;
        })(),
        tokenPair: (() => {
          const pair = createTokenPair();
          delete (pair as { issuedAt?: string; }).issuedAt;
          return pair;
        })(),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow(
        '[session-state.builder] Missing issuedAt: required field absent in me.session and tokenPair',
      );
    });

    it('выбрасывает ошибку если issuedAt пустая строка в meSession и tokenPair', () => {
      const params = createParams({
        meSession: createMeSession({ issuedAt: '' }),
        tokenPair: createTokenPair({ issuedAt: '' }),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow(
        '[session-state.builder] Missing issuedAt: required field absent in me.session and tokenPair',
      );
    });
  });

  describe('Fail-fast: Missing expiresAt', () => {
    it('выбрасывает ошибку если expiresAt отсутствует в meSession и tokenPair (undefined)', () => {
      const params = createParams({
        meSession: (() => {
          const session = createMeSession();
          delete (session as { expiresAt?: string; }).expiresAt;
          return session;
        })(),
        tokenPair: {
          ...createTokenPair(),
          expiresAt: undefined as unknown as string, // runtime safety: может прийти undefined из внешних данных
        } as TokenPair,
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow(
        '[session-state.builder] Missing expiresAt: required field absent in me.session and tokenPair',
      );
    });

    it('выбрасывает ошибку если expiresAt пустая строка', () => {
      const params = createParams({
        meSession: createMeSession({ expiresAt: '' }),
        tokenPair: createTokenPair({ expiresAt: '' }),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow(
        '[session-state.builder] Missing expiresAt: required field absent in me.session and tokenPair',
      );
    });
  });

  describe('Валидация ISO формата дат', () => {
    it('выбрасывает ошибку если issuedAt невалидный ISO формат', () => {
      const params = createParams({
        meSession: createMeSession({ issuedAt: 'invalid-date' }),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow('[session-state.builder] Invalid date format: must be ISO-8601');
    });

    it('выбрасывает ошибку если expiresAt невалидный ISO формат', () => {
      const params = createParams({
        meSession: createMeSession({ expiresAt: 'not-a-date' }),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow('[session-state.builder] Invalid date format: must be ISO-8601');
    });

    it('выбрасывает ошибку если issuedAt невалидный (fallback на tokenPair тоже невалидный)', () => {
      // Если meSession.issuedAt невалидный, но tokenPair.issuedAt валидный - fallback сработает
      // Поэтому проверяем случай, когда оба невалидные через удаление issuedAt из meSession
      const params = createParams({
        meSession: (() => {
          const session = createMeSession();
          delete (session as { issuedAt?: string; }).issuedAt;
          return session;
        })(),
        tokenPair: {
          ...createTokenPair(),
          issuedAt: 'invalid-date',
        } as TokenPair,
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow('[session-state.builder] Invalid date format: must be ISO-8601');
    });

    it('выбрасывает ошибку если expiresAt невалидный (meSession имеет приоритет, но невалидный)', () => {
      const params = createParams({
        meSession: createMeSession({
          expiresAt: 'invalid-date-string',
        }),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow('[session-state.builder] Invalid date format: must be ISO-8601');
    });
  });

  describe('Fail-closed: Invariant issuedAt <= expiresAt', () => {
    it('выбрасывает ошибку если issuedAt > expiresAt', () => {
      const params = createParams({
        meSession: createMeSession({
          issuedAt: '2026-12-31T23:59:59.000Z',
          expiresAt: '2026-01-01T00:00:00.000Z',
        }),
      });

      expect(() => {
        buildSessionState(params);
      }).toThrow('[session-state.builder] Invariant violated: issuedAt');
    });

    it('принимает issuedAt === expiresAt (граничный случай)', () => {
      const sameDate = '2026-01-01T00:00:00.000Z';
      const params = createParams({
        meSession: createMeSession({
          issuedAt: sameDate,
          expiresAt: sameDate,
        }),
      });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.issuedAt).toBe(sameDate);
        expect(result.expiresAt).toBe(sameDate);
      }
    });
  });

  describe('Различные форматы ISO-8601', () => {
    it('принимает ISO-8601 без миллисекунд', () => {
      const params = createParams({
        meSession: createMeSession({
          issuedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-12-31T23:59:59Z',
        }),
      });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.issuedAt).toBe('2026-01-01T00:00:00Z');
        expect(result.expiresAt).toBe('2026-12-31T23:59:59Z');
      }
    });

    it('принимает ISO-8601 с миллисекундами', () => {
      const params = createParams({
        meSession: createMeSession({
          issuedAt: '2026-01-01T00:00:00.123Z',
          expiresAt: '2026-12-31T23:59:59.456Z',
        }),
      });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.issuedAt).toBe('2026-01-01T00:00:00.123Z');
        expect(result.expiresAt).toBe('2026-12-31T23:59:59.456Z');
      }
    });
  });

  describe('DeviceInfo с дополнительными полями', () => {
    it('сохраняет все поля deviceInfo', () => {
      const deviceInfo = createDeviceInfo({
        os: 'Windows 11',
        browser: 'Chrome 112',
        ip: '1.2.3.4',
        geo: { lat: 55.7558, lng: 37.6173 },
        userAgent: 'Mozilla/5.0',
        appVersion: '1.0.0',
        lastUsedAt: '2026-01-01T00:00:00.000Z',
      });
      const params = createParams({ deviceInfo });

      const result = buildSessionState(params);

      expect(result).not.toBeNull();
      if (result?.status === 'active') {
        expect(result.device).toEqual(deviceInfo);
      }
    });
  });
});

/* eslint-enable functional/no-conditional-statements */
/* eslint-enable fp/no-mutation */
/* eslint-enable @livai/rag/context-leakage */
