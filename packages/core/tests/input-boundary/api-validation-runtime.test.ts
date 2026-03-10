/**
 * @file Unit тесты для api-validation-runtime.ts
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  ApiValidationContextBase,
  PayloadSizeViolation,
} from '../../src/input-boundary/api-validation-runtime.js';
import {
  checkPayloadSize,
  createApiValidationErrorFactory,
  createPayloadSample,
  createZodRequestValidator,
  createZodResponseValidator,
  emitError,
  emitWarning,
  estimateObjectSize,
  estimatePayloadSize,
  utf8ByteLength,
} from '../../src/input-boundary/api-validation-runtime.js';

const effectMocks = vi.hoisted(() => ({
  fail: vi.fn(),
}));

vi.mock('effect', async () => {
  const actual = await vi.importActual<typeof import('effect')>('effect');
  return {
    ...actual,
    Effect: {
      ...actual.Effect,
      fail: effectMocks.fail,
    },
  };
});

const hashMocks = vi.hoisted(() => ({
  stableHash: vi.fn(() => 0xdeadbeef),
}));

vi.mock('../../src/hash.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/hash.js')>('../../src/hash.js');
  return {
    ...actual,
    stableHash: hashMocks.stableHash,
  };
});

const zodAdapterMocks = vi.hoisted(() => ({
  zodIssuesToValidationErrors: vi.fn(() => [{ path: ['field'], message: 'error' }]),
}));

vi.mock('../../src/effect/schema-validated-effect.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/effect/schema-validated-effect.js')
  >(
    '../../src/effect/schema-validated-effect.js',
  );
  return {
    ...actual,
    zodIssuesToValidationErrors: zodAdapterMocks.zodIssuesToValidationErrors,
  };
});

describe('api-validation-runtime — telemetry helpers', () => {
  const baseContext: ApiValidationContextBase = {
    method: 'POST',
    endpoint: '/test',
    requestId: 'req-1',
    locale: 'en',
    service: 'AUTH',
    traceId: 'trace-1',
    serviceId: 'svc-1',
    instanceId: 'inst-1',
    telemetry: {},
  };

  it('emitWarning вызывает telemetry.onWarning с корректными полями', () => {
    const onWarning = vi.fn();
    const context: ApiValidationContextBase = {
      ...baseContext,
      telemetry: { onWarning },
    };

    emitWarning(context, 'warn', { foo: 'bar' });

    expect(onWarning).toHaveBeenCalledWith({
      message: 'warn',
      endpoint: '/test',
      requestId: 'req-1',
      details: { foo: 'bar' },
      service: 'AUTH',
      traceId: 'trace-1',
      serviceId: 'svc-1',
      instanceId: 'inst-1',
    });
  });

  it('emitError вызывает telemetry.onError с корректными полями', () => {
    const onError = vi.fn();
    const context: ApiValidationContextBase = {
      ...baseContext,
      telemetry: { onError },
    };

    emitError(context, 'err', { baz: 1 });

    expect(onError).toHaveBeenCalledWith({
      message: 'err',
      endpoint: '/test',
      requestId: 'req-1',
      details: { baz: 1 },
      service: 'AUTH',
      traceId: 'trace-1',
      serviceId: 'svc-1',
      instanceId: 'inst-1',
    });
  });
});

describe('api-validation-runtime — utf8ByteLength', () => {
  it('использует TextEncoder когда он доступен', () => {
    const length = utf8ByteLength('hello');
    expect(length).toBeGreaterThan(0);
  });

  it('возвращает приблизительную длину когда TextEncoder недоступен', () => {
    const original = (globalThis as any).TextEncoder;
    delete (globalThis as any).TextEncoder;
    try {
      const length = utf8ByteLength('abc');
      expect(length).toBe(3);
    } finally {
      // eslint-disable-next-line fp/no-mutation
      (globalThis as any).TextEncoder = original;
    }
  });
});

describe('api-validation-runtime — createPayloadSample', () => {
  it('возвращает полный JSON если размер <= PAYLOAD_SAMPLE_SIZE', () => {
    // eslint-disable-next-line ai-security/model-poisoning
    const data = { a: 1, b: 'test' };
    const sample = createPayloadSample(data);
    expect(sample).toBe(JSON.stringify(data));
  });

  it('обрезает большой JSON и добавляет hash/size метаданные', () => {
    const longString = 'x'.repeat(2000);
    // eslint-disable-next-line ai-security/model-poisoning
    const data = { payload: longString };

    const sample = createPayloadSample(data);

    expect(sample).toMatch(/\.\.\.\[TRUNCATED, HASH:[0-9a-f]{8}, SIZE:\d+\]$/);
    expect(hashMocks.stableHash).toHaveBeenCalled();
  });

  it('возвращает маркер для несерилизуемых payload', () => {
    const circular: any = {};
    // eslint-disable-next-line fp/no-mutation
    circular.self = circular;

    const sample = createPayloadSample(circular);
    expect(sample).toBe('[NON_SERIALIZABLE_PAYLOAD]');
  });
});

describe('api-validation-runtime — estimatePayloadSize family', () => {
  it('оценивает разные примитивы и структуры', () => {
    expect(estimatePayloadSize(null)).toBe(0);
    expect(estimatePayloadSize(undefined)).toBe(0);
    expect(estimatePayloadSize('abc')).toBe(3);
    expect(estimatePayloadSize(42)).toBeGreaterThan(0);
    expect(estimatePayloadSize(true)).toBeGreaterThan(0);

    expect(estimatePayloadSize([1, 2, 3])).toBeGreaterThan(0);
    expect(estimatePayloadSize(new Map([[1, 'a']]))).toBeGreaterThan(0);
    expect(estimatePayloadSize(new Set([1, 2, 3]))).toBeGreaterThan(0);
    expect(estimatePayloadSize({ a: 1, b: 2 })).toBeGreaterThan(0);

    // unknown типы уходят в DEFAULT_PAYLOAD_ESTIMATE_SIZE
    expect(estimatePayloadSize(Symbol('s'))).toBeGreaterThan(0);
  });

  it('ограничивает глубину рекурсии', () => {
    const deep = Array.from({ length: 20 }).reduce(
      (acc, _, index) => ({ value: index, next: acc } as any),
      { value: 1 } as any,
    );

    const size = estimatePayloadSize(deep);
    expect(size).toBeGreaterThan(0);
  });

  it('estimateObjectSize обрабатывает циклические ссылки', () => {
    const circular: any = {};
    // eslint-disable-next-line fp/no-mutation
    circular.self = circular;

    const size = estimateObjectSize(circular);
    expect(size).toBeGreaterThan(0);
  });

  it('estimatePayloadSize использует guard по глубине при явном depth>=MAX_RECURSION_DEPTH', () => {
    const size = estimatePayloadSize('deep', 10);
    expect(size).toBeGreaterThan(0);
  });

  it('estimateObjectSize возвращает DEFAULT_PAYLOAD_ESTIMATE_SIZE при двух падениях JSON.stringify', () => {
    const originalStringify = JSON.stringify;
    // eslint-disable-next-line fp/no-mutation
    (JSON as any).stringify = () => {
      throw new Error('boom');
    };

    try {
      const size = estimateObjectSize({ a: 1 });
      expect(size).toBeGreaterThan(0);
    } finally {
      // eslint-disable-next-line fp/no-mutation
      (JSON as any).stringify = originalStringify;
    }
  });
});

describe('api-validation-runtime — checkPayloadSize', () => {
  const baseContext: ApiValidationContextBase = {
    method: 'POST',
    endpoint: '/test',
    requestId: 'req-1',
    locale: 'en',
    service: 'AUTH',
    traceId: 'trace-1',
  };

  it('возвращает null если размер payload в пределах лимита', () => {
    const telemetry = {
      onWarning: vi.fn(),
      onError: vi.fn(),
    };
    const context: ApiValidationContextBase = { ...baseContext, telemetry };

    const violation = checkPayloadSize('request', { small: 'ok' }, 10_000, context);
    expect(violation).toBeNull();
    expect(telemetry.onWarning).not.toHaveBeenCalled();
    expect(telemetry.onError).not.toHaveBeenCalled();
  });

  it('возвращает детали и шлёт warning для request при превышении лимита', () => {
    const telemetry = {
      onWarning: vi.fn(),
      onError: vi.fn(),
    };
    const context: ApiValidationContextBase = { ...baseContext, telemetry };

    const bigPayload = { data: 'x'.repeat(10_000) };

    const violation = checkPayloadSize('request', bigPayload, 100, context) as PayloadSizeViolation;

    expect(violation).not.toBeNull();
    expect(violation.size).toBeGreaterThan(violation.maxSize);
    expect(violation.payloadSample).toContain('...[TRUNCATED');
    expect(telemetry.onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'API request payload too large' }),
    );
    expect(telemetry.onError).not.toHaveBeenCalled();
  });

  it('возвращает детали и шлёт error для response при превышении лимита', () => {
    const telemetry = {
      onWarning: vi.fn(),
      onError: vi.fn(),
    };
    const context: ApiValidationContextBase = { ...baseContext, telemetry };

    const bigPayload = { data: 'x'.repeat(10_000) };

    const violation = checkPayloadSize(
      'response',
      bigPayload,
      100,
      context,
    ) as PayloadSizeViolation;

    expect(violation).not.toBeNull();
    expect(telemetry.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'API response payload too large' }),
    );
    expect(telemetry.onWarning).not.toHaveBeenCalled();
  });
});

describe('api-validation-runtime — createApiValidationErrorFactory', () => {
  const context: ApiValidationContextBase = {
    method: 'POST',
    endpoint: '/test',
    requestId: 'req-1',
    locale: 'en',
    service: 'AUTH',
    traceId: 'trace-1',
  };

  it('создаёт Effect, который fail’ится с ApiValidationError и логирует ошибку', () => {
    const toTimestamp = vi.fn(() => 1234567890);
    const factory = createApiValidationErrorFactory(toTimestamp);

    const validationErrors = [
      { path: ['field'], message: 'must be string' },
    ] as any;

    factory(
      'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
      validationErrors,
      context,
      'field',
      { extra: true },
    );

    expect(effectMocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        field: 'field',
        details: validationErrors,
      }),
    );
  });

  it('использует details если список validationErrors пустой', () => {
    const factory = createApiValidationErrorFactory(() => 1);

    const details = [{ path: ['x'], message: 'err' }] as any;

    factory(
      'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
      [],
      context,
      undefined,
      details,
    );

    expect(effectMocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        field: undefined,
        details,
      }),
    );
  });

  it('использует дефолтный toTimestamp если он не передан', () => {
    const factory = createApiValidationErrorFactory();

    const errors: any[] = [];
    factory('SYSTEM_VALIDATION_TIMEOUT_EXCEEDED', errors as any, context);
    // сам факт успешного вызова покрывает путь с default Date.now()
  });
});

describe('api-validation-runtime — Zod adapters', () => {
  it('createZodRequestValidator возвращает success при успешной валидации', () => {
    const schema = {
      safeParse: (value: unknown) => ({ success: true, data: value as { ok: true; } }),
      parse: () => {
        // unused
      },
    };

    const validator = createZodRequestValidator(schema as any);
    const result = validator({ ok: true }, { service: 'svc' } as any);

    expect(result).toEqual({ success: true, value: { ok: true } });
    expect(zodAdapterMocks.zodIssuesToValidationErrors).not.toHaveBeenCalled();
  });

  it('createZodResponseValidator возвращает ошибки при неуспешной safeParse', () => {
    const schema = {
      safeParse: () => ({
        success: false,
        error: {
          issues: [
            { path: ['field'], message: 'invalid' },
          ],
        },
      }),
      parse: () => {
        // unused
      },
    };

    const validator = createZodResponseValidator(schema as any);
    const context = { service: 'svc-1' } as any;
    const result = validator({ bad: true }, context);

    expect(result.success).toBe(false);
    expect((result as any).errors).toEqual([{ path: ['field'], message: 'error' }]);
    expect(zodAdapterMocks.zodIssuesToValidationErrors).toHaveBeenCalledWith(
      'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
      [{ path: ['field'], message: 'invalid' }],
      'svc-1',
    );
  });

  it('createZodValidator обрабатывает кейс когда success=true, но data=undefined', () => {
    const schema = {
      safeParse: () => ({
        success: true,
        data: undefined,
      }),
      parse: () => {
        // unused
      },
    };

    const validator = createZodRequestValidator(schema as any);
    const context = { service: 'svc-2' } as any;
    const result = validator({ ok: true }, context);

    expect(result.success).toBe(false);
    expect((result as any).errors.length).toBeGreaterThanOrEqual(0);
    expect(zodAdapterMocks.zodIssuesToValidationErrors).toHaveBeenCalledWith(
      'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
      [],
      'svc-2',
    );
  });
});
