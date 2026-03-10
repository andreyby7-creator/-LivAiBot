/**
 * @file Unit тесты для api-schema-guard.ts
 */

import { Effect, Runtime } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ApiRequestValidator,
  ApiResponseValidator,
  ApiSchemaConfig,
  ApiValidationContext,
  ApiValidationRule,
} from '../../src/input-boundary/api-schema-guard.js';
import {
  combineRequestValidators,
  combineResponseValidators,
  createRestApiSchema,
  enforceStrictValidation,
  getDefaultStrictMode,
  validateApiInteraction,
  validateApiRequest,
  validateApiResponse,
  validateSchemaVersion,
} from '../../src/input-boundary/api-schema-guard.js';
import type {
  ApiValidationContextBase,
  ApiValidationTelemetry,
} from '../../src/input-boundary/api-validation-runtime.js';

describe('api-schema-guard — helpers and config', () => {
  it('getDefaultStrictMode возвращает глобальный strict mode (false по умолчанию)', () => {
    expect(getDefaultStrictMode()).toBe(false);
  });

  it('enforceStrictValidation учитывает локальный strictMode и наличие валидаторов', () => {
    const baseConfig: ApiSchemaConfig = {
      service: 'AUTH',
      method: 'GET',
      endpoint: '/test' as any,
    };

    // non-strict всегда true
    expect(enforceStrictValidation(baseConfig)).toBe(true);

    // strict без валидаторов → false
    expect(enforceStrictValidation({ ...baseConfig, strictMode: true })).toBe(false);

    const dummyValidator: ApiRequestValidator<unknown> = (value) => ({
      success: true,
      value,
    });

    // strict + только requestValidator → false
    expect(
      enforceStrictValidation({
        ...baseConfig,
        strictMode: true,
        requestValidator: dummyValidator,
      }),
    ).toBe(false);

    // strict + оба валидатора → true
    expect(
      enforceStrictValidation({
        ...baseConfig,
        strictMode: true,
        requestValidator: dummyValidator,
        responseValidator: dummyValidator as any,
      }),
    ).toBe(true);
  });

  it('createRestApiSchema создаёт корректную конфигурацию и поддерживает strictMode/версии', () => {
    const requestValidator: ApiRequestValidator<{ id: string; }> = ((
      value: unknown,
    ) => ({
      success: true as const,
      value: value as { id: string; },
    } as const)) as ApiRequestValidator<{
      id: string;
    }>;
    const responseValidator: ApiResponseValidator<{ id: string; }> = ((
      value: unknown,
    ) => ({
      success: true as const,
      value: value as { id: string; },
    } as const)) as ApiResponseValidator<{
      id: string;
    }>;

    const config = createRestApiSchema('AUTH', 'GET', '/users/:id' as any, {
      requestValidator,
      responseValidator,
      maxRequestSize: 42,
      maxResponseSize: 1337,
      schemaVersion: 'v1',
      strictMode: true,
    });

    expect(config.service).toBe('AUTH');
    expect(config.method).toBe('GET');
    expect(config.endpoint).toBe('/users/:id');
    expect(config.requestValidator).toBe(requestValidator);
    expect(config.responseValidator).toBe(responseValidator);
    expect(config.maxRequestSize).toBe(42);
    expect(config.maxResponseSize).toBe(1337);
    expect(config.schemaVersion).toBe('v1');
    expect(config.supportedVersions).toEqual(['v1']);
    expect(config.strictMode).toBe(true);
  });

  it('combineRequestValidators и combineResponseValidators композируют валидаторы через pipeMany', () => {
    const v1: ApiRequestValidator<number> = (value: unknown) =>
      typeof value === 'number' && value > 0
        ? ({ success: true as const, value } as const)
        : ({ success: false as const, errors: [{ message: 'v1' }] as any } as const);
    const v2: ApiRequestValidator<number> = (value: unknown) =>
      typeof value === 'number' && value % 2 === 0
        ? ({ success: true as const, value } as const)
        : ({ success: false as const, errors: [{ message: 'v2' }] as any } as const);

    const combined = combineRequestValidators(v1, v2);

    expect(combined(4, {} as any)).toEqual({ success: true, value: 4 });
    expect(combined(3, {} as any).success).toBe(false);

    const r1: ApiResponseValidator<string> = (value: unknown) =>
      typeof value === 'string' && value.length > 0
        ? ({ success: true as const, value } as const)
        : ({ success: false as const, errors: [{ message: 'r1' }] as any } as const);
    const r2: ApiResponseValidator<string> = (value: unknown) =>
      typeof value === 'string' && value === value.toUpperCase()
        ? ({ success: true as const, value } as const)
        : ({ success: false as const, errors: [{ message: 'r2' }] as any } as const);

    const combinedResp = combineResponseValidators(r1, r2);

    expect(combinedResp('OK', {} as any)).toEqual({ success: true, value: 'OK' });
    expect(combinedResp('fail', {} as any).success).toBe(false);
  });
});

describe('api-schema-guard — validateSchemaVersion', () => {
  const context: ApiValidationContextBase = {
    method: 'GET',
    endpoint: '/test',
    requestId: 'req-1',
    service: 'AUTH',
    telemetry: {} as ApiValidationTelemetry,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ничего не делает если requestedVersion не указан или поддерживается', async () => {
    const localContext = {
      ...context,
      telemetry: {
        onWarning: vi.fn(),
      },
    } satisfies ApiValidationContextBase;

    await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateSchemaVersion(undefined, ['v1', 'v2'], localContext),
    );
    await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateSchemaVersion('v1', ['v1', 'v2'], localContext),
    );

    expect(localContext.telemetry.onWarning).not.toHaveBeenCalled();
  });

  it('логирует warning и создаёт ошибку при несовпадении версии', async () => {
    const telemetry = { onWarning: vi.fn() } satisfies ApiValidationTelemetry;
    const localContext: ApiValidationContextBase = {
      ...context,
      telemetry,
    };

    const effect = validateSchemaVersion('v3', ['v1', 'v2'], localContext);

    const result = await Runtime.runPromise(Runtime.defaultRuntime, Effect.either(effect));
    expect(result._tag).toBe('Left');
    expect(telemetry.onWarning).toHaveBeenCalled();
  });
});

describe('api-schema-guard — validateApiRequest / validateApiResponse / validateApiInteraction', () => {
  const baseContext: ApiValidationContext = {
    method: 'POST',
    endpoint: '/users' as any,
    requestId: 'req-1',
    service: 'AUTH',
  };

  function createOkValidator<T>(): ApiRequestValidator<T> {
    return ((value: unknown) => ({
      success: true as const,
      value: value as T,
    } as const)) as ApiRequestValidator<T>;
  }

  function createFailValidator<T>(): ApiRequestValidator<T> {
    return ((_value: unknown) => ({
      success: false as const,
      errors: [{ message: 'invalid' }] as any,
    } as const)) as ApiRequestValidator<T>;
  }

  it('validateApiRequest успешно валидирует request и применяет правила (pre/post)', async () => {
    const payload = { id: '42' };

    const calls: string[] = [];
    const rules: ApiValidationRule[] = [
      {
        phase: 'pre',
        run: (value) =>
          Effect.sync(() => {
            calls.push(`pre:${(value as any).id}`);
          }) as any,
      },
      {
        phase: 'post',
        run: (value) =>
          Effect.sync(() => {
            calls.push(`post:${(value as any).id}`);
          }) as any,
      },
    ];

    const config: ApiSchemaConfig<typeof payload> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      requestValidator: createOkValidator<typeof payload>(),
      requestRules: rules,
    };

    const result = await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateApiRequest<typeof payload>(payload, config, baseContext),
    );

    expect(result).toEqual(payload);
    expect(calls).toEqual(['pre:42', 'post:42']);
  });

  it('applyRules сортирует правила по priority (два pre-rule выполняются в правильном порядке)', async () => {
    const payload = { id: '42' };

    const calls: string[] = [];
    const rules: ApiValidationRule[] = [
      {
        phase: 'pre',
        priority: 10,
        run: () =>
          Effect.sync(() => {
            calls.push('pre-10');
          }) as any,
      },
      {
        phase: 'pre',
        priority: 1,
        run: () =>
          Effect.sync(() => {
            calls.push('pre-1');
          }) as any,
      },
    ];

    const config: ApiSchemaConfig<typeof payload> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      requestValidator: createOkValidator<typeof payload>(),
      requestRules: rules,
    };

    await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateApiRequest(payload, config, baseContext),
    );

    expect(calls).toEqual(['pre-1', 'pre-10']);
  });

  it('applyRules возвращает succeed если правила есть, но нет ни одного правила для фазы', async () => {
    const payload = { id: '42' };

    const calls: string[] = [];
    const rules: ApiValidationRule[] = [
      {
        phase: 'post',
        run: () =>
          Effect.sync(() => {
            calls.push('post-only');
          }) as any,
      },
    ];

    const config: ApiSchemaConfig<typeof payload> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      // без валидатора → passthrough; post-rule всё равно должен отработать
      requestRules: rules,
      strictMode: false,
    };

    const result = await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateApiRequest(payload, config, baseContext),
    );
    expect(result).toEqual(payload);
    expect(calls).toEqual(['post-only']);
  });

  it('applyRules возвращает ошибку, если правило с maxSize ловит violation (ветка createApiValidationError в applyRules)', async () => {
    const payload = { data: 'x'.repeat(10_000) };
    const ruleRun = vi.fn();

    const rules: ApiValidationRule[] = [
      {
        phase: 'pre',
        maxSize: 1,
        run: () =>
          Effect.sync(() => {
            ruleRun();
          }) as any,
      },
    ];

    const config: ApiSchemaConfig<typeof payload> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      requestValidator: createOkValidator<typeof payload>(),
      requestRules: rules,
    };

    const effect = validateApiRequest(payload, config, baseContext);
    const result = await Runtime.runPromise(Runtime.defaultRuntime, Effect.either(effect));

    expect(result._tag).toBe('Left');
    expect(ruleRun).not.toHaveBeenCalled();
  });

  it('validateApiRequest в strict mode без валидатора возвращает ошибку', async () => {
    const config: ApiSchemaConfig = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      strictMode: true,
    };

    const effect = validateApiRequest({} as any, config as any, baseContext);
    const result = await Runtime.runPromise(Runtime.defaultRuntime, Effect.either(effect));

    expect(result._tag).toBe('Left');
  });

  it('validateApiRequest возвращает ошибку при превышении лимита размера payload', async () => {
    const payload = { id: '42' };

    const config: ApiSchemaConfig<typeof payload> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      requestValidator: createOkValidator<typeof payload>(),
      maxRequestSize: 1,
    };

    const effect = validateApiRequest<typeof payload>(payload, config, baseContext);
    const result = await Runtime.runPromise(Runtime.defaultRuntime, Effect.either(effect));

    expect(result._tag).toBe('Left');
  });

  it('validateApiRequest использует кастомный strictMode=false поверх глобального, пропуская данные без валидатора', async () => {
    const payload = { id: '42' };

    const config: ApiSchemaConfig<typeof payload> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      strictMode: false,
    };

    const result = await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateApiRequest<typeof payload>(payload, config, baseContext),
    );

    expect(result).toEqual(payload);
  });

  it('validateApiResponse валидирует response и учитывает strictMode', async () => {
    const response = { ok: true };

    const config: ApiSchemaConfig<unknown, typeof response> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      responseValidator: createOkValidator<typeof response>() as any,
      strictMode: true,
    };

    const result = await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateApiResponse<typeof response>(response, config, baseContext),
    );

    expect(result).toEqual(response);
  });

  it('validateApiResponse возвращает ошибку, если validator возвращает ошибки', async () => {
    const response = { ok: false };

    const config: ApiSchemaConfig<unknown, typeof response> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      responseValidator: createFailValidator<typeof response>() as any,
    };

    const effect = validateApiResponse<typeof response>(response, config, baseContext);
    const result = await Runtime.runPromise(Runtime.defaultRuntime, Effect.either(effect));

    expect(result._tag).toBe('Left');
  });

  it('validateApiInteraction валидирует и request, и response и возвращает оба значения', async () => {
    const request = { id: '42' };
    const response = { ok: true };

    const config: ApiSchemaConfig<typeof request, typeof response> = {
      service: 'AUTH',
      method: 'POST',
      endpoint: '/users' as any,
      requestValidator: createOkValidator<typeof request>(),
      responseValidator: createOkValidator<typeof response>() as any,
    };

    const result = await Runtime.runPromise(
      Runtime.defaultRuntime,
      validateApiInteraction<typeof request, typeof response>(
        request,
        response,
        config,
        baseContext,
      ),
    );

    expect(result).toEqual({ request, response });
  });
});
