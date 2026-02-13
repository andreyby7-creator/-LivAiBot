/**
 * @vitest-environment jsdom
 * @file Unit тесты для useApi
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const effectMocks = vi.hoisted(() => ({
  runPromise: vi.fn(async (value: unknown) => value),
}));

vi.mock('effect', () => ({
  Effect: {
    runPromise: effectMocks.runPromise,
  },
}));

const schemaGuardMocks = vi.hoisted(() => ({
  validateApiRequest: vi.fn((request: unknown) => request),
  validateApiResponse: vi.fn((response: unknown) => response),
}));

vi.mock('../../../src/lib/api-schema-guard', () => ({
  validateApiRequest: schemaGuardMocks.validateApiRequest,
  validateApiResponse: schemaGuardMocks.validateApiResponse,
}));

const errorMappingMocks = vi.hoisted(() => ({
  mapError: vi.fn((error: unknown) => ({
    code: 'SYSTEM_UNKNOWN_ERROR',
    message: String(error),
    timestamp: 123,
  })),
}));

vi.mock('../../../src/lib/error-mapping', () => ({
  mapError: errorMappingMocks.mapError,
}));

const telemetryMocks = vi.hoisted(() => ({
  logFireAndForget: vi.fn(),
}));

vi.mock('../../../src/runtime/telemetry', () => ({
  logFireAndForget: telemetryMocks.logFireAndForget,
}));

import { useApi } from '../../../src/hooks/useApi.js';

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('выполняет успешный вызов с валидаторами и mapResponse', async () => {
    const client = {
      request: vi.fn().mockResolvedValue({ id: '42', name: 'alice' }),
    } as any;

    const contract = {
      getUser: {
        service: 'auth' as const,
        method: 'GET' as const,
        path: (input: unknown) => `/users/${(input as { id: string; }).id}`,
        headers: (input: unknown) => ({ 'x-user-id': (input as { id: string; }).id } as any),
        mapRequest: (input: unknown) => ({ id: (input as { id: string; }).id }),
        mapResponse: (response: unknown) => {
          const r = response as { id: string; name: string; };
          return { ...r, name: r.name.toUpperCase() };
        },
        requestValidator: vi.fn((value: unknown) => ({ success: true as const, value })),
        responseValidator: vi.fn((value: unknown) => ({ success: true as const, value })),
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));
    const response = await result.current['getUser']({ id: '42' });

    expect(response).toEqual({ id: '42', name: 'ALICE' });
    expect(schemaGuardMocks.validateApiRequest).toHaveBeenCalledTimes(1);
    expect(schemaGuardMocks.validateApiResponse).toHaveBeenCalledTimes(1);
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/users/42',
        headers: { 'x-user-id': '42' },
      }),
    );
    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'INFO',
      'API call succeeded',
      expect.objectContaining({ endpoint: '/users/42', method: 'GET' }),
    );
  });

  it('пробрасывает уже нормализованную ошибку без повторного mapError', async () => {
    const mappedError = {
      code: 'NETWORK_TIMEOUT',
      message: 'timeout',
      timestamp: 1,
      details: { kind: 'network' },
    };

    const client = {
      request: vi.fn().mockRejectedValue(mappedError),
    } as any;

    const contract = {
      ping: {
        service: 'gateway',
        method: 'GET',
        path: '/ping',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['ping'](undefined as never)).rejects.toBe(mappedError);
    expect(errorMappingMocks.mapError).not.toHaveBeenCalled();
    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'network', errorCode: 'NETWORK_TIMEOUT' }),
    );
  });

  it('мапит сырой error через mapError и логирует server/client/network/unknown kind', async () => {
    const client = {
      request: vi.fn(),
    } as any;

    const contract = {
      test: {
        service: 'gateway',
        method: 'POST',
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract, context: { locale: 'ru' } }));

    // Создаем объекты ошибок с разными характеристиками для тестирования логики определения типа
    const serverError = Object.assign(new Error('server'), { status: 503 });
    const clientError = Object.assign(new Error('client'), { status: 404 });
    const networkError = new TypeError('network');
    const unknownError = new Error('unknown');

    errorMappingMocks.mapError
      .mockReturnValueOnce({ code: 'HTTP_503', message: 'server error', timestamp: 1 })
      .mockReturnValueOnce({ code: 'HTTP_404', message: 'client error', timestamp: 1 })
      .mockReturnValueOnce({ code: 'NETWORK_ERROR', message: 'network error', timestamp: 1 })
      .mockReturnValueOnce({ code: 'UNKNOWN_ERROR', message: 'unknown error', timestamp: 1 });

    client.request.mockRejectedValueOnce(serverError);
    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'HTTP_503' }),
    );

    client.request.mockRejectedValueOnce(clientError);
    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'HTTP_404' }),
    );

    client.request.mockRejectedValueOnce(networkError);
    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'NETWORK_ERROR' }),
    );

    client.request.mockRejectedValueOnce(unknownError);
    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'UNKNOWN_ERROR' }),
    );

    const errorCalls = telemetryMocks.logFireAndForget.mock.calls
      .filter((call) => call[0] === 'ERROR')
      .map((call) => call[2]?.errorKind);

    expect(errorCalls).toContain('server');
    expect(errorCalls).toContain('client');
    expect(errorCalls).toContain('network');
    expect(errorCalls).toContain('unknown');

    expect(errorMappingMocks.mapError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ endpoint: '/test', method: 'POST', requestId: expect.any(String) }),
      expect.objectContaining({ locale: 'ru', timestamp: expect.any(Number) }),
    );
  });

  it('использует validation kind для SYSTEM_VALIDATION кодов', async () => {
    const mappedError = {
      code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
      message: 'validation',
      timestamp: 1,
    };

    const client = {
      request: vi.fn().mockRejectedValue(mappedError),
    } as any;

    const contract = {
      bad: {
        service: 'gateway',
        method: 'GET',
        path: '/bad',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));
    await expect(result.current['bad'](undefined as never)).rejects.toBe(mappedError);

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'validation' }),
    );
  });

  it('отключает telemetry при telemetryEnabled=false', async () => {
    const client = {
      request: vi.fn().mockResolvedValue({ ok: true }),
    } as any;

    const contract = {
      health: {
        service: 'gateway',
        method: 'GET',
        path: '/health',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract, telemetryEnabled: false }));

    await result.current['health'](undefined as never);
    expect(telemetryMocks.logFireAndForget).not.toHaveBeenCalled();
  });

  it('использует randomUUID для requestId если доступно', async () => {
    const randomUUID = vi.fn(() => 'uuid-123');
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID },
      configurable: true,
    });

    const client = {
      request: vi.fn().mockRejectedValue(new Error('raw error')),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'SYSTEM_UNKNOWN_ERROR',
      message: 'mapped',
      timestamp: 1,
    });

    const contract = {
      fail: {
        service: 'gateway',
        method: 'GET',
        path: '/fail',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));
    await expect(result.current['fail'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'SYSTEM_UNKNOWN_ERROR' }),
    );

    expect(errorMappingMocks.mapError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ requestId: 'uuid-123' }),
      expect.objectContaining({ locale: 'ru', timestamp: expect.any(Number) }),
    );
  });

  it('использует fallback для requestId если crypto недоступно', async () => {
    // Мокаем отсутствие crypto
    const originalCrypto = globalThis.crypto;
    delete (globalThis as any).crypto;

    const client = {
      request: vi.fn().mockRejectedValue(new Error('raw error')),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'SYSTEM_UNKNOWN_ERROR',
      message: 'mapped',
      timestamp: 1,
    });

    const contract = {
      fail: {
        service: 'gateway',
        method: 'GET',
        path: '/fail',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    // Mock Date.now и Math.random для предсказуемого результата
    const mockNow = 1234567890000;
    const mockRandom = 0.123456789;

    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
    vi.spyOn(Math, 'random').mockReturnValue(mockRandom);

    await expect(result.current['fail'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'SYSTEM_UNKNOWN_ERROR' }),
    );

    expect(errorMappingMocks.mapError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        requestId: 'req_1234567890000_4fzzzxj', // BASE36 представление mockRandom 0.123456789
      }),
      expect.objectContaining({ locale: 'ru', timestamp: expect.any(Number) }),
    );

    // Восстанавливаем оригинальные функции
    vi.restoreAllMocks();
    (globalThis as any).crypto = originalCrypto;
  });

  it('возвращает unknown для примитивных ошибок', async () => {
    const client = {
      request: vi.fn().mockRejectedValue('string error'),
    } as any;

    const contract = {
      fail: {
        service: 'gateway',
        method: 'GET',
        path: '/fail',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['fail'](undefined as never)).rejects.toBeDefined();

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'unknown' }),
    );
  });

  it('обрабатывает объект ошибки без status и name', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ customField: 'value' }),
    } as any;

    const contract = {
      fail: {
        service: 'gateway',
        method: 'GET',
        path: '/fail',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['fail'](undefined as never)).rejects.toBeDefined();

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'unknown' }),
    );
  });

  it('обрабатывает null/undefined ошибки', async () => {
    const client = {
      request: vi.fn().mockRejectedValue(null),
    } as any;

    const contract = {
      fail: {
        service: 'gateway',
        method: 'GET',
        path: '/fail',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['fail'](undefined as never)).rejects.toBeDefined();

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'unknown' }),
    );
  });

  it('обрабатывает объект ошибки с нечисловым status', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ status: '500', name: 'CustomError' }),
    } as any;

    const contract = {
      fail: {
        service: 'gateway',
        method: 'GET',
        path: '/fail',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['fail'](undefined as never)).rejects.toBeDefined();

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'unknown' }),
    );
  });

  it('обрабатывает неуспешный API ответ (ApiFailureResponse)', async () => {
    const apiError = {
      kind: 'ApiError',
      code: 'HTTP_404',
      message: 'Not found',
      status: 404,
    };

    const client = {
      request: vi.fn().mockRejectedValue(apiError),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'HTTP_404',
      message: 'Not found',
      timestamp: 1,
    });

    const contract = {
      getItem: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/items/123',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['getItem'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'HTTP_404' }),
    );

    expect(errorMappingMocks.mapError).toHaveBeenCalledWith(
      apiError,
      expect.objectContaining({ endpoint: '/items/123', method: 'GET' }),
      expect.objectContaining({ locale: 'ru', timestamp: expect.any(Number) }),
    );
  });

  it('обрабатывает ошибку с объектом без status но с name TypeError', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ name: 'TypeError', message: 'Network error' }),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'NETWORK_ERROR',
      message: 'Network error',
      timestamp: 1,
    });

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'NETWORK_ERROR' }),
    );

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'network' }),
    );
  });

  it('обрабатывает ошибку с объектом с числовым status >= 500', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ status: 503, message: 'Service unavailable' }),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'HTTP_503',
      message: 'Service unavailable',
      timestamp: 1,
    });

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'HTTP_503' }),
    );

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'server' }),
    );
  });

  it('обрабатывает ошибку с объектом с числовым status >= 400 и < 500', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ status: 404, message: 'Not found' }),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'HTTP_404',
      message: 'Not found',
      timestamp: 1,
    });

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'HTTP_404' }),
    );

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'client' }),
    );
  });

  it('обрабатывает MappedError с HTTP_5xx кодом', async () => {
    const mappedError = {
      code: 'HTTP_500',
      message: 'Internal server error',
      timestamp: 1,
    };

    const client = {
      request: vi.fn().mockRejectedValue(mappedError),
    } as any;

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toBe(mappedError);

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'server' }),
    );
  });

  it('обрабатывает MappedError с HTTP_4xx кодом', async () => {
    const mappedError = {
      code: 'HTTP_400',
      message: 'Bad request',
      timestamp: 1,
    };

    const client = {
      request: vi.fn().mockRejectedValue(mappedError),
    } as any;

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toBe(mappedError);

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'client' }),
    );
  });

  it('обрабатывает MappedError с NETWORK_ кодом', async () => {
    const mappedError = {
      code: 'NETWORK_TIMEOUT',
      message: 'Network timeout',
      timestamp: 1,
    };

    const client = {
      request: vi.fn().mockRejectedValue(mappedError),
    } as any;

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toBe(mappedError);

    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'network' }),
    );
  });

  it('обрабатывает ошибку с объектом с числовым status < 400', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ status: 200, message: 'OK but error' }),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'SYSTEM_UNKNOWN_ERROR',
      message: 'OK but error',
      timestamp: 1,
    });

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'SYSTEM_UNKNOWN_ERROR' }),
    );

    // status < 400 не попадает в server/client, поэтому должен быть unknown
    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'unknown' }),
    );
  });

  it('обрабатывает ошибку с объектом без name TypeError', async () => {
    const client = {
      request: vi.fn().mockRejectedValue({ status: 200, name: 'CustomError' }),
    } as any;

    errorMappingMocks.mapError.mockReturnValue({
      code: 'SYSTEM_UNKNOWN_ERROR',
      message: 'Custom error',
      timestamp: 1,
    });

    const contract = {
      test: {
        service: 'gateway' as const,
        method: 'GET' as const,
        path: '/test',
      },
    } as const;

    const { result } = renderHook(() => useApi({ client, contract }));

    await expect(result.current['test'](undefined as never)).rejects.toEqual(
      expect.objectContaining({ code: 'SYSTEM_UNKNOWN_ERROR' }),
    );

    // name не TypeError, status < 400, поэтому должен быть unknown
    expect(telemetryMocks.logFireAndForget).toHaveBeenCalledWith(
      'ERROR',
      'API call failed',
      expect.objectContaining({ errorKind: 'unknown' }),
    );
  });
});
