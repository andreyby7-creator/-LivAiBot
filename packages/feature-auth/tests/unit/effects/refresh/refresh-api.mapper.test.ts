/**
 * @file Unit тесты для effects/refresh/refresh-api.mapper.ts
 * Цель: 100% покрытие runtime-части (RefreshApiMapperError + request/response mapping, все ветви).
 */

import { describe, expect, it } from 'vitest';

import type { MeResponse } from '../../../../src/domain/MeResponse.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';
import type {
  LoginTokenPairValues,
  MeResponseValues,
  RefreshTokenRequestValues,
} from '../../../../src/schemas/index.js';
import type { SessionState } from '../../../../src/types/auth.js';
import {
  mapRefreshRequestToApiPayload,
  mapRefreshResponseToDomain,
  RefreshApiMapperError,
} from '../../../../src/effects/refresh/refresh-api.mapper.js';

describe('effects/refresh/refresh-api.mapper', () => {
  describe('RefreshApiMapperError', () => {
    it('сохраняет prototype chain, name и message', () => {
      const error = new RefreshApiMapperError('boom');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RefreshApiMapperError);
      expect(error.name).toBe('RefreshApiMapperError');
      expect(error.message).toBe('boom');
    });
  });

  describe('mapRefreshRequestToApiPayload', () => {
    const sessionState = {} as SessionState;

    it('маппит непустой refreshToken в валидный транспортный payload и делает freeze', () => {
      const payload = mapRefreshRequestToApiPayload(
        sessionState,
        'refresh-token-123',
      );

      expect(Object.isFrozen(payload)).toBe(true);
      expect(payload).toEqual<RefreshTokenRequestValues>({
        refreshToken: 'refresh-token-123',
      });
    });

    it("fail-fast: выбрасывает RefreshApiMapperError при пустом refreshToken (trim === '')", () => {
      expect(() =>
        mapRefreshRequestToApiPayload(
          sessionState,
          '' as unknown as string,
        )
      ).toThrow(RefreshApiMapperError);

      expect(() =>
        mapRefreshRequestToApiPayload(
          sessionState,
          '' as unknown as string,
        )
      ).toThrow('[refresh-api.mapper] refreshToken must not be empty');
    });

    it('fail-fast: выбрасывает RefreshApiMapperError при нестроковом refreshToken (typeof !== "string")', () => {
      expect(() =>
        mapRefreshRequestToApiPayload(
          sessionState,
          42 as unknown as string,
        )
      ).toThrow(RefreshApiMapperError);

      expect(() =>
        mapRefreshRequestToApiPayload(
          sessionState,
          42 as unknown as string,
        )
      ).toThrow('[refresh-api.mapper] refreshToken must not be empty');
    });
  });

  describe('mapRefreshResponseToDomain', () => {
    const createLoginTokenPairValues = (
      overrides: Partial<LoginTokenPairValues> = {},
    ): LoginTokenPairValues => ({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      issuedAt: '2026-01-01T00:00:00.000Z',
      scope: ['read'],
      metadata: { deviceId: 'device-1' },
      ...overrides,
    });

    const createMeResponseValues = (
      overrides: Partial<MeResponseValues> = {},
    ): MeResponseValues => ({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
      },
      roles: ['user'],
      permissions: ['read'],
      session: {
        sessionId: 'session-1',
        ip: '127.0.0.1',
        deviceId: 'device-1',
        userAgent: 'Mozilla/5.0',
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-12-31T23:59:59.000Z',
      },
      features: { beta: true },
      context: { org: 'org-1' },
      ...overrides,
    });

    it('корректно маппит tokenPairDto и meDto в domain и делает freeze результата', () => {
      const tokenPairDto = createLoginTokenPairValues();
      const meDto = createMeResponseValues();

      const result = mapRefreshResponseToDomain(
        tokenPairDto,
        meDto,
      );

      expect(Object.isFrozen(result)).toBe(true);
      expect(result.tokenPair).toBeDefined();
      expect(result.me).toBeDefined();

      const tokenPair = result.tokenPair as TokenPair;
      const me = result.me as MeResponse;

      expect(Object.isFrozen(tokenPair)).toBe(true);
      expect(Object.isFrozen(me)).toBe(true);
      expect(Object.isFrozen(me.user)).toBe(true);
      expect(Object.isFrozen(me.roles)).toBe(true);
      expect(Object.isFrozen(me.permissions)).toBe(true);
      expect(me.session ? Object.isFrozen(me.session) : true).toBe(true);
      expect(me.features ? Object.isFrozen(me.features) : true).toBe(true);
      expect(me.context ? Object.isFrozen(me.context) : true).toBe(true);

      // Проверяем, что массивы/объекты не разделяют ссылку с исходными DTO
      expect(tokenPair.scope).not.toBe(tokenPairDto.scope);
      expect(me.roles).not.toBe(meDto.roles);
      expect(me.permissions).not.toBe(meDto.permissions);
    });

    it('корректно маппит tokenPairDto без meDto и не добавляет поле me в результат', () => {
      const tokenPairDto = createLoginTokenPairValues();

      const result = mapRefreshResponseToDomain(
        tokenPairDto,
      );

      expect(Object.isFrozen(result)).toBe(true);
      expect(result.tokenPair).toBeDefined();
      expect('me' in result ? result.me : undefined).toBeUndefined();
    });

    it('fail-closed: невалидный tokenPairDto выбрасывает RefreshApiMapperError с префиксом tokenPairDto', () => {
      const badTokenPairDto = {} as unknown as LoginTokenPairValues;

      expect(() =>
        mapRefreshResponseToDomain(
          badTokenPairDto,
        )
      ).toThrow(RefreshApiMapperError);

      expect(() =>
        mapRefreshResponseToDomain(
          badTokenPairDto,
        )
      ).toThrow('[refresh-api.mapper] Invalid tokenPairDto:');
    });

    it('fail-closed: невалидный meDto выбрасывает RefreshApiMapperError с префиксом meDto', () => {
      const tokenPairDto = createLoginTokenPairValues();
      const badMeDto = {} as unknown as MeResponseValues;

      expect(() =>
        mapRefreshResponseToDomain(
          tokenPairDto,
          badMeDto,
        )
      ).toThrow(RefreshApiMapperError);

      expect(() =>
        mapRefreshResponseToDomain(
          tokenPairDto,
          badMeDto,
        )
      ).toThrow('[refresh-api.mapper] Invalid meDto:');
    });
  });
});
