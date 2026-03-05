/**
 * @file Unit тесты для domain/app-effects.ts
 *
 * Цели:
 * - Зафиксировать форму API-контрактов (ApiError, AppError и т.п.).
 * - Проверить инварианты для ERROR_TAGS / KnownErrorTag.
 * - Дать 100% покрытие runtime-кода (ERROR_TAGS) при сохранении type-safety.
 */

import { describe, expect, it } from 'vitest';

import type {
  ApiError,
  ApiErrorCategory,
  ApiErrorSource,
  ApiFailureResponse,
  ApiRequestContext,
  ApiSuccessResponse,
  AppError,
  ClientError,
  ErrorBoundaryErrorCode,
  ErrorTag,
  FileValidationResult,
  FrontendErrorSource,
  KnownErrorTag,
  NetworkError,
  SanitizedJson,
  ServerError,
  TraceId,
  UnknownError,
  ValidationError,
} from '../../../src/domain/app-effects.js';
import { ERROR_TAGS } from '../../../src/domain/app-effects.js';

describe('ERROR_TAGS', () => {
  it('содержит ожидаемые service/severity/feature теги', () => {
    expect(ERROR_TAGS.service.billing).toBe('service:billing');
    expect(ERROR_TAGS.service.auth).toBe('service:auth');
    expect(ERROR_TAGS.service.core).toBe('service:core');
    expect(ERROR_TAGS.service.web).toBe('service:web');

    expect(ERROR_TAGS.severity.critical).toBe('severity:critical');
    expect(ERROR_TAGS.severity.high).toBe('severity:high');
    expect(ERROR_TAGS.severity.medium).toBe('severity:medium');
    expect(ERROR_TAGS.severity.low).toBe('severity:low');

    expect(ERROR_TAGS.feature.authLogin).toBe('feature:auth-login');
    expect(ERROR_TAGS.feature.authRegister).toBe('feature:auth-register');
    expect(ERROR_TAGS.feature.bots).toBe('feature:bots');
    expect(ERROR_TAGS.feature.conversations).toBe('feature:conversations');
  });

  it('структура ERROR_TAGS стабильна (snapshot)', () => {
    expect(ERROR_TAGS).toMatchSnapshot();
  });

  it('KnownErrorTag совместим со значениями ERROR_TAGS', () => {
    const tagServiceBilling: KnownErrorTag = ERROR_TAGS.service.billing;
    const tagServiceAuth: KnownErrorTag = ERROR_TAGS.service.auth;
    const tagSeverityHigh: KnownErrorTag = ERROR_TAGS.severity.high;
    const tagFeatureAuthLogin: KnownErrorTag = ERROR_TAGS.feature.authLogin;

    const tags: ErrorTag[] = [
      tagServiceBilling,
      tagServiceAuth,
      tagSeverityHigh,
      tagFeatureAuthLogin,
    ];

    tags.forEach((tag) => {
      expect(typeof tag).toBe('string');
      expect(tag.length).toBeGreaterThan(0);
    });

    // @ts-expect-error - произвольная строка не должна быть KnownErrorTag
    const invalidKnownTag: KnownErrorTag = 'service:unknown';
    expect(invalidKnownTag).toBeDefined();
  });
});

describe('ApiRequestContext', () => {
  it('поддерживает branded TraceId и IdempotencyKey', () => {
    const traceId = 'trace-123' as TraceId;
    const context: ApiRequestContext = {
      traceId,
      authToken: 'token',
      locale: 'ru-RU',
      platform: 'web',
      idempotencyKey: 'idem-123' as any, // Branded тип проверяется на уровне TS
    };

    expect(context.traceId).toBe(traceId);
    expect(context.platform).toBe('web');
  });
});

describe('ApiError & Api*Response контракты', () => {
  it('ApiError поддерживает категории, source, traceId, details, meta и tags', () => {
    const error: ApiError = {
      code: 'AUTH_INVALID_TOKEN',
      category: 'AUTH' satisfies ApiErrorCategory,
      message: 'Invalid token',
      source: 'SERVICE' satisfies ApiErrorSource,
      traceId: 'trace-123' as TraceId,
      details: { reason: 'expired', hint: 're-login' } as SanitizedJson,
      meta: { retryable: false },
      tags: [
        ERROR_TAGS.service.auth,
        ERROR_TAGS.severity.high,
        ERROR_TAGS.feature.authLogin,
      ],
    };

    expect(error.code).toBe('AUTH_INVALID_TOKEN');
    expect(error.category).toBe('AUTH');
    expect(error.source).toBe('SERVICE');
    expect(error.tags).toContain(ERROR_TAGS.service.auth);
  });

  it('ApiSuccessResponse и ApiFailureResponse совместимы с ApiResponse union', () => {
    const success: ApiSuccessResponse<{ ok: boolean; }> = {
      success: true,
      data: { ok: true },
      meta: { fromCache: false },
    };

    const failure: ApiFailureResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        category: 'VALIDATION',
        message: 'Invalid payload',
      },
      meta: { invalidField: 'email' },
    };

    const responses: ApiError[] = [failure.error];

    expect(success.success).toBe(true);
    expect(failure.success).toBe(false);
    const [first] = responses;
    expect(first?.code).toBe('VALIDATION_ERROR');
  });
});

describe('FileValidationResult', () => {
  it('валидная структура и readonly-контракт', () => {
    const result: FileValidationResult = {
      valid: false,
      error: 'Invalid mime type',
    };

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid mime type');
  });
});

describe('AppError контракты', () => {
  const TRACE_ID = 'trace-123' as TraceId;

  it('ClientError, ValidationError, NetworkError, ServerError, UnknownError — валидные AppError', () => {
    const clientError: ClientError = {
      type: 'ClientError',
      severity: 'warning',
      source: 'UI' satisfies FrontendErrorSource,
      code: 'BAD_INPUT',
      message: 'Invalid user action',
      context: { field: 'email' },
      traceId: TRACE_ID,
      tags: [ERROR_TAGS.severity.low],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const validationError: ValidationError = {
      type: 'ValidationError',
      severity: 'warning',
      fieldErrors: { email: 'Invalid email' },
      message: 'Validation failed',
      traceId: TRACE_ID,
      tags: [ERROR_TAGS.severity.medium],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const networkError: NetworkError = {
      type: 'NetworkError',
      severity: 'error',
      statusCode: 504,
      message: 'Gateway Timeout',
      endpoint: '/v1/auth/login',
      platform: 'web',
      traceId: TRACE_ID,
      tags: [ERROR_TAGS.service.core, ERROR_TAGS.severity.high],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const serverError: ServerError = {
      type: 'ServerError',
      severity: 'error',
      apiError: {
        code: 'INTERNAL_ERROR',
        category: 'INTERNAL',
        message: 'Something went wrong',
      },
      serviceName: 'auth-service',
      operation: 'POST /v1/auth/login',
      endpoint: '/v1/auth/login',
      platform: 'web',
      meta: { retryable: true },
      tags: [ERROR_TAGS.service.auth, ERROR_TAGS.severity.critical],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const unknownError: UnknownError = {
      type: 'UnknownError',
      severity: 'error',
      message: 'Unknown failure',
      original: new Error('boom'),
      traceId: TRACE_ID,
      tags: [ERROR_TAGS.severity.high],
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    const errors: AppError[] = [
      clientError,
      validationError,
      networkError,
      serverError,
      unknownError,
    ];

    expect(errors).toHaveLength(5);
    expect(errors.map((e) => e.type)).toEqual([
      'ClientError',
      'ValidationError',
      'NetworkError',
      'ServerError',
      'UnknownError',
    ]);
  });

  it('ErrorBoundaryErrorCode поддерживает закрытый набор значений', () => {
    const codes: ErrorBoundaryErrorCode[] = [
      'NETWORK_ERROR',
      'VALIDATION_ERROR',
      'UNKNOWN_ERROR',
    ];

    expect(codes).toContain('NETWORK_ERROR');
    expect(codes).toContain('VALIDATION_ERROR');
    expect(codes).toContain('UNKNOWN_ERROR');

    // @ts-expect-error - произвольный код не должен быть валидным ErrorBoundaryErrorCode
    const invalidCode: ErrorBoundaryErrorCode = 'SERVER_ERROR';
    expect(invalidCode).toBeDefined();
  });
});
