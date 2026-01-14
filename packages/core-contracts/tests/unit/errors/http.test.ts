/**
 * @file Unit тесты для errors/http.ts
 */
import { describe, expect, it } from 'vitest';
import type { ErrorCode, ErrorResponse } from '../../../src/errors/http.js';
import { errorCodes } from '../../../src/errors/http.js';

type Assert<T extends true> = T;
type IfEquals<X, Y, A = true, B = false> = (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? A : B;
type IsReadonlyKey<T, K extends keyof T> = IfEquals<
  { [P in K]: T[K]; },
  { -readonly [P in K]: T[K]; },
  false,
  true
>;
type HasAnyReadonlyKey<T> = true extends { [K in keyof T]-?: IsReadonlyKey<T, K>; }[keyof T] ? true
  : false;

// Если errorCodes перестанет быть readonly, сборка тестов должна падать
export type ErrorCodesReadonlyInvariant = Assert<HasAnyReadonlyKey<typeof errorCodes>>;

describe('errorCodes', () => {
  it('содержит все необходимые коды ошибок', () => {
    expect(errorCodes).toHaveProperty('UNAUTHORIZED');
    expect(errorCodes).toHaveProperty('FORBIDDEN');
    expect(errorCodes).toHaveProperty('VALIDATION_ERROR');
    expect(errorCodes).toHaveProperty('NOT_FOUND');
    expect(errorCodes).toHaveProperty('CONFLICT');
    expect(errorCodes).toHaveProperty('INTERNAL_ERROR');
    expect(errorCodes).toHaveProperty('DOWNSTREAM_UNAVAILABLE');
    expect(errorCodes).toHaveProperty('NOT_IMPLEMENTED');
  });

  it('все значения являются строками', () => {
    Object.values(errorCodes).forEach((code) => {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });
  });

  it('значения соответствуют ключам', () => {
    Object.entries(errorCodes).forEach(([key, value]) => {
      expect(value).toBe(key);
    });
  });

  it('является immutable (as const)', () => {
    // Runtime-проверка не нужна: invariant зафиксирован на уровне типов (см. errorCodesReadonlyInvariant).
    expect(errorCodes).toBeDefined();
  });
});

describe('ErrorCode type', () => {
  it('принимает только допустимые значения', () => {
    // Valid values
    const validCodes: ErrorCode[] = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'CONFLICT',
      'INTERNAL_ERROR',
      'DOWNSTREAM_UNAVAILABLE',
      'NOT_IMPLEMENTED',
    ];

    validCodes.forEach((code) => {
      expect(code).toBeDefined();
    });

    // Type check - это должно компилироваться без ошибок
    const testCode: ErrorCode = 'VALIDATION_ERROR';
    expect(testCode).toBe('VALIDATION_ERROR');
  });

  it('отвергает недопустимые значения', () => {
    // Type check - это должно вызывать TypeScript ошибку компиляции
    // const invalidCode: ErrorCode = 'INVALID_CODE'; // Ожидаемая ошибка TS

    expect(() => {
      // @ts-expect-error - это должно быть ошибкой типа
      const invalidCode: ErrorCode = 'INVALID_CODE';
      return invalidCode;
    }).not.toThrow(); // Runtime проверка - TypeScript уже проверил
  });
});

describe('ErrorResponse type', () => {
  it('валидная структура ErrorResponse', () => {
    const validResponse: ErrorResponse = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      trace_id: 'trace-123',
      details: { field: 'email', reason: 'invalid format' },
    };

    expect(validResponse).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      trace_id: 'trace-123',
      details: { field: 'email', reason: 'invalid format' },
    });
  });

  it('минимальная структура ErrorResponse', () => {
    const minimalResponse: ErrorResponse = {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    };

    expect(minimalResponse).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });

    expect(minimalResponse).not.toHaveProperty('trace_id');
    expect(minimalResponse).not.toHaveProperty('details');
  });

  it('ErrorResponse с null details', () => {
    const responseWithNullDetails: ErrorResponse = {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
    };

    expect(responseWithNullDetails.details).toBeNull();
  });

  it('снапшот структуры ErrorResponse', () => {
    const response: ErrorResponse = {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      trace_id: 'trace-456',
      details: { reason: 'missing_token' },
    };

    expect(response).toMatchSnapshot();
  });
});

describe('Интеграционные тесты типов', () => {
  it('ErrorCode совместим с ErrorResponse.code', () => {
    const codes: ErrorCode[] = Object.values(errorCodes);

    codes.forEach((code) => {
      const response: ErrorResponse = {
        code,
        message: 'Test error',
      };

      expect(response.code).toBe(code);
      expect(typeof response.code).toBe('string');
    });
  });

  it('все errorCodes являются валидными ErrorCode', () => {
    Object.values(errorCodes).forEach((code) => {
      // Type assertion - если это не валидный ErrorCode, будет ошибка компиляции
      const typedCode: ErrorCode = code;
      expect(typedCode).toBe(code);
    });
  });
});
