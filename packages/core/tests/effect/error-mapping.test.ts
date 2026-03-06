/**
 * @file Unit тесты для error-mapping.ts
 * Цель: 100% coverage для публичного API: mapError, mapErrorBoundaryError, createDomainError, chainMappers.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  MapErrorConfig,
  MappedError,
  ServiceErrorCode,
  ServicePrefix,
  ValidationErrorLike,
} from '../../src/effect/error-mapping.js';
import {
  chainMappers,
  createDomainError,
  errorMessages,
  mapError,
  mapErrorBoundaryError,
} from '../../src/effect/error-mapping.js';

const BASE_CONFIG: MapErrorConfig = { locale: 'en', timestamp: 123_456_789 };
const RU_CONFIG: MapErrorConfig = { locale: 'ru', timestamp: 123_456_789 };
const ISO_TS = '2026-03-06T00:00:00.000Z';

function mkMappedError(
  code: MappedError['code'],
  overrides?: Partial<MappedError>,
): MappedError {
  return {
    code,
    message: `msg:${code}`,
    timestamp: BASE_CONFIG.timestamp,
    ...overrides,
  };
}

describe('effect/error-mapping', () => {
  describe('mapError', () => {
    it('маппит TaggedError (валидный code) и сохраняет безопасный originError для Error', () => {
      const err = new Error('boom');
      const tagged = { code: 'AUTH_INVALID_TOKEN', service: 'AUTH' } as const;

      const mapped = mapError(tagged, { any: 'details' }, BASE_CONFIG, undefined);
      // TaggedError не является Error → originError undefined
      expect(mapped.code).toBe('AUTH_INVALID_TOKEN');
      expect(mapped.service).toBe('AUTH');
      expect(mapped.message).toBe('Invalid token');
      expect(mapped.details).toEqual({ any: 'details' });
      expect(mapped.timestamp).toBe(BASE_CONFIG.timestamp);
      expect(mapped.originError).toBeUndefined();

      const mappedFromError = mapError(err, undefined, BASE_CONFIG, 'SYSTEM');
      expect(mappedFromError.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(mappedFromError.service).toBe('SYSTEM');
      expect(mappedFromError.originError).toEqual({ name: 'Error', message: 'boom' });
    });

    it('покрывает ветки локализации в errorMessages (en/ru) и дополнительные validation-коды', () => {
      const codesToCover = [
        'AUTH_INVALID_TOKEN',
        'AUTH_USER_NOT_FOUND',
        'BILLING_INSUFFICIENT_FUNDS',
        'AI_MODEL_NOT_FOUND',
        'SYSTEM_UNKNOWN_ERROR',
        'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
        'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE',
        'SYSTEM_VALIDATION_REQUEST_HEADERS_INVALID',
        'SYSTEM_VALIDATION_RESPONSE_HEADERS_INVALID',
        'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
        'SYSTEM_VALIDATION_TIMEOUT_EXCEEDED',
      ] as const satisfies readonly ServiceErrorCode[];

      codesToCover.forEach((code) => {
        const mappedEn = mapError(
          { code, service: 'SYSTEM' } as const,
          undefined,
          BASE_CONFIG,
          undefined,
        );
        expect(mappedEn.code).toBe(code);
        expect(typeof mappedEn.message).toBe('string');
        expect(mappedEn.message.length).toBeGreaterThan(0);

        const mappedRu = mapError(
          { code, service: 'SYSTEM' } as const,
          undefined,
          RU_CONFIG,
          undefined,
        );
        expect(mappedRu.code).toBe(code);
        expect(typeof mappedRu.message).toBe('string');
        expect(mappedRu.message.length).toBeGreaterThan(0);
        // Для ru ветки (locale !== 'en') — сообщение должно отличаться от en для кодов где это заложено
        expect(mappedRu.message).not.toBe(mappedEn.message);
      });
    });

    it('покрывает все errorMessages (en/ru) напрямую', () => {
      (Object.entries(errorMessages) as [ServiceErrorCode, (locale?: string) => string][])
        .forEach(([, factory]) => {
          const en = factory('en');
          const ru = factory('ru');

          expect(typeof en).toBe('string');
          expect(en.length).toBeGreaterThan(0);

          expect(typeof ru).toBe('string');
          expect(ru.length).toBeGreaterThan(0);
        });
    });

    it('маппит EffectError.kind через прямой доменный маппинг и выводит service из префикса kind', () => {
      const effectLike = { kind: 'ai/model-not-found' };
      const mapped = mapError(effectLike, undefined, BASE_CONFIG, undefined);

      expect(mapped.code).toBe('AI_MODEL_NOT_FOUND');
      expect(mapped.service).toBe('AI');
      expect(mapped.message).toBe('AI model not found');
      expect(mapped.originError).toBeUndefined();
    });

    it('маппит системный EffectError.kind через SYSTEM_EFFECT_ERROR_MAP (Timeout → SYSTEM)', () => {
      const effectLike = { kind: 'Timeout' };
      const mapped = mapError(effectLike, undefined, BASE_CONFIG, undefined);

      expect(mapped.code).toBe('SYSTEM_VALIDATION_TIMEOUT_EXCEEDED');
      expect(mapped.service).toBe('SYSTEM');
      expect(mapped.message).toBe('Validation timeout exceeded');
    });

    it('для неизвестного kind делает fallback code=SYSTEM_UNKNOWN_ERROR, но определяет service из kind; service param имеет приоритет', () => {
      const effectLike = { kind: 'billing/some-new-error' };

      const mappedDetected = mapError(effectLike, undefined, BASE_CONFIG, undefined);
      expect(mappedDetected.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(mappedDetected.service).toBe('BILLING');
      expect(mappedDetected.message).toBe('Unknown error');

      const mappedOverride = mapError(effectLike, undefined, BASE_CONFIG, 'AUTH');
      expect(mappedOverride.service).toBe('AUTH');
    });

    it('если kind имеет неизвестный префикс, service не определяется (getServiceFromKind → undefined)', () => {
      const effectLike = { kind: 'unknown/some-error' };
      const mapped = mapError(effectLike, undefined, BASE_CONFIG, undefined);
      expect(mapped.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(mapped.service).toBeUndefined();
      expect(mapped.message).toBe('Unknown error');
    });

    it('если kind начинается с / (пустой префикс), service не определяется (getServiceFromKind: kindParts[0] === "")', () => {
      const effectLike = { kind: '/no-prefix' };
      const mapped = mapError(effectLike, undefined, BASE_CONFIG, undefined);
      expect(mapped.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(mapped.service).toBeUndefined();
    });

    it('не пытается маппить kind если он не строка (typeof guard) и делает общий fallback', () => {
      const effectLike = { kind: 123 };
      const mapped = mapError(effectLike, undefined, BASE_CONFIG, undefined);
      expect(mapped.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(mapped.service).toBeUndefined();
      expect(mapped.message).toBe('Unknown error');
    });

    it('если TaggedError.code не существует в errorMessages, message падает в SYSTEM_UNKNOWN_ERROR (edge-case runtime)', () => {
      const weirdTagged = { code: 'NOT_A_REAL_CODE', service: 'SYSTEM' } as unknown as {
        code: string;
        service?: ServicePrefix | undefined;
      };
      const mapped = mapError(weirdTagged, undefined, BASE_CONFIG, undefined);

      // code сохраняется как есть (runtime), но message — safe fallback
      expect(mapped.code).toBe('NOT_A_REAL_CODE');
      expect(mapped.service).toBe('SYSTEM');
      expect(mapped.message).toBe('Unknown error');
    });
  });

  describe('mapErrorBoundaryError', () => {
    it('определяет NETWORK_ERROR по структурному type (не по тексту) и строит UnknownError + telemetry', () => {
      const e = new Error('validation failed') as Error & { type?: string; };
      // eslint-disable-next-line fp/no-mutation
      e.type = 'NetworkError';

      const result = mapErrorBoundaryError(e, { timestamp: ISO_TS as never });
      expect(result.appError.type).toBe('UnknownError');
      // Narrow AppError → UnknownError
      if (result.appError.type !== 'UnknownError') {
        throw new Error(`expected UnknownError, got: ${String(result.appError.type)}`);
      }
      expect(result.appError.message).toBe('validation failed');
      expect(result.appError.original).toBe(e);
      expect(result.appError.timestamp).toBe(ISO_TS);

      expect(result.telemetryData.mappedErrorCode).toBe('NETWORK_ERROR');
      expect(result.telemetryData.originalErrorType).toBe('Error');
      expect(result.telemetryData.errorMessage).toBe('validation failed');
    });

    it('определяет VALIDATION_ERROR по имени (ZodError) даже если message выглядит как network', () => {
      // eslint-disable-next-line functional/no-classes
      class ZodError extends Error {}
      const e = new ZodError('fetch failed');

      const result = mapErrorBoundaryError(e, { timestamp: ISO_TS as never });
      expect(result.telemetryData.mappedErrorCode).toBe('VALIDATION_ERROR');
    });

    it('делает fallback на message: fetch/network → NETWORK_ERROR; validation → VALIDATION_ERROR; иначе UNKNOWN_ERROR', () => {
      expect(
        mapErrorBoundaryError(new Error('fetch failed'), { timestamp: ISO_TS as never })
          .telemetryData.mappedErrorCode,
      )
        .toBe('NETWORK_ERROR');

      expect(
        mapErrorBoundaryError(new Error('Validation: bad input'), { timestamp: ISO_TS as never })
          .telemetryData.mappedErrorCode,
      )
        .toBe('VALIDATION_ERROR');

      expect(
        mapErrorBoundaryError(new Error('something else'), { timestamp: ISO_TS as never })
          .telemetryData.mappedErrorCode,
      )
        .toBe('UNKNOWN_ERROR');
    });
  });

  describe('createDomainError', () => {
    it('использует code/service из первой validation ошибки, если параметры не переданы', () => {
      const errors: readonly ValidationErrorLike[] = [{
        code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        service: 'SYSTEM',
        field: 'email',
        message: 'bad email',
        details: { x: 1 },
      }];

      const domainErr = createDomainError(errors, BASE_CONFIG, undefined, undefined);
      expect(domainErr.code).toBe('SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID');
      expect(domainErr.service).toBe('SYSTEM');
      expect(domainErr.details).toEqual({ validationErrors: errors });
      expect(domainErr.message).toBe('Request schema validation failed');
    });

    it('для пустого массива использует fallback code и service (или переданные параметры)', () => {
      const empty: readonly ValidationErrorLike[] = [];

      const domainErrFallback = createDomainError(empty, BASE_CONFIG, undefined, undefined);
      expect(domainErrFallback.code).toBe('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID');
      expect(domainErrFallback.service).toBe('SYSTEM');
      expect(domainErrFallback.message).toBe('Response schema validation failed');

      const domainErrOverride = createDomainError(
        empty,
        BASE_CONFIG,
        'SYSTEM_UNKNOWN_ERROR',
        'AUTH',
      );
      expect(domainErrOverride.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(domainErrOverride.service).toBe('AUTH');
      expect(domainErrOverride.message).toBe('Unknown error');
    });
  });

  describe('chainMappers', () => {
    it('возвращает первый non-UNKNOWN и не вызывает последующие мапперы', () => {
      const m1 = vi.fn(() => mkMappedError('AUTH_INVALID_TOKEN', { service: 'AUTH' }));
      const m2 = vi.fn(() => mkMappedError('BILLING_INSUFFICIENT_FUNDS', { service: 'BILLING' }));

      const chained = chainMappers(m1, m2);
      const res = chained({ any: 'err' }, undefined, BASE_CONFIG, undefined);

      expect(res.code).toBe('AUTH_INVALID_TOKEN');
      expect(m1).toHaveBeenCalledTimes(1);
      expect(m2).toHaveBeenCalledTimes(0);
    });

    it('если ранние мапперы возвращают UNKNOWN, берет первый non-UNKNOWN дальше по цепочке', () => {
      const m1 = vi.fn(() => mkMappedError('SYSTEM_UNKNOWN_ERROR'));
      const m2 = vi.fn((_err: unknown, details: unknown) =>
        mkMappedError('BILLING_INSUFFICIENT_FUNDS', { service: 'BILLING', details })
      );

      const chained = chainMappers(m1, m2);
      const res = chained({ any: 'err' }, { d: 1 }, BASE_CONFIG, undefined);

      expect(res.code).toBe('BILLING_INSUFFICIENT_FUNDS');
      expect(res.details).toEqual({ d: 1 });
      expect(m1).toHaveBeenCalledTimes(1);
      expect(m2).toHaveBeenCalledTimes(1);
    });

    it('если все мапперы UNKNOWN или мапперов нет, возвращает дефолтный UNKNOWN с originError (для Error) и service from arg', () => {
      const err = new Error('x');

      const chainedEmpty = chainMappers();
      const resEmpty = chainedEmpty(err, undefined, BASE_CONFIG, 'SYSTEM');
      expect(resEmpty.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(resEmpty.service).toBe('SYSTEM');
      expect(resEmpty.originError).toEqual({ name: 'Error', message: 'x' });

      const chainedUnknowns = chainMappers(
        () => mkMappedError('SYSTEM_UNKNOWN_ERROR'),
        () => mkMappedError('SYSTEM_UNKNOWN_ERROR'),
      );
      const resUnknowns = chainedUnknowns({ x: 1 }, undefined, BASE_CONFIG, undefined);
      expect(resUnknowns.code).toBe('SYSTEM_UNKNOWN_ERROR');
      expect(resUnknowns.originError).toBeUndefined();
    });
  });
});
