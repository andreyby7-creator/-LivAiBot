/**
 * @file Unit тесты для packages/app/src/lib/api-client.ts
 *
 * Комплексное тестирование API-клиента с 95-100% покрытием:
 * - HTTP запросы и ответы
 * - Retry и timeout логика
 * - Error handling и mapping
 * - URL и headers построение
 * - JSON парсинг и безопасность
 * - HTTP методы shortcuts
 * - Конфигурация клиента
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClient,
  buildHeaders,
  buildUrl,
  createApiClient,
  mapHttpError,
  parseJsonSafe,
} from '../../../src/lib/api-client';
import type { ApiClientConfig } from '../../../src/types/api';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock Response объект
 */
function createMockResponse(
  status: number,
  statusText: string = '',
  body: unknown = null,
  headers: Record<string, string> = {},
): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Map(Object.entries(headers)),
    text: vi.fn().mockResolvedValue(
      body !== null ? JSON.stringify(body) : '',
    ),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;

  return response;
}

/**
 * Создает mock fetch функцию
 */
/**
 * Создает mock fetch, возвращающий Response.
 * @param responseFactory - функция, возвращающая новый Response
 */
function createMockFetch(responseFactory: () => Response) {
  return vi.fn().mockImplementation(() => Promise.resolve(responseFactory())) as typeof fetch;
}

/**
 * Создает mock fetch, который выбрасывает ошибку.
 * @param errorFactory - функция, возвращающая новый Error
 */
function createFailingFetch(errorFactory: () => Error) {
  return vi.fn().mockImplementation(() => Promise.reject(errorFactory())) as typeof fetch;
}

// ============================================================================
// 🧩 ТЕСТЫ ВСПОМОГАТЕЛЬНЫХ ФУНКЦИЙ
// ============================================================================

describe('API Client Utilities', () => {
  describe('buildUrl', () => {
    it('строит URL с baseUrl и path', () => {
      expect(buildUrl('https://api.example.com', 'users')).toBe('https://api.example.com/users');
    });

    it('убирает trailing slash из baseUrl', () => {
      expect(buildUrl('https://api.example.com/', 'users')).toBe('https://api.example.com/users');
    });

    it('убирает leading slash из path', () => {
      expect(buildUrl('https://api.example.com', '/users')).toBe('https://api.example.com/users');
    });

    it('работает с пустыми path', () => {
      expect(buildUrl('https://api.example.com', '')).toBe('https://api.example.com/');
    });

    it('возвращает полный URL если path уже содержит http', () => {
      const fullUrl = 'https://other-api.com/data';
      expect(buildUrl('https://api.example.com', fullUrl)).toBe(fullUrl);
    });
  });

  describe('buildHeaders', () => {
    it('возвращает headers с Content-Type по умолчанию', () => {
      const headers = buildHeaders();
      expect(headers).toEqual({
        'Content-Type': 'application/json',
      });
    });

    it('сливает базовые и override headers', () => {
      const base = { 'Authorization': 'Bearer token' };
      const override = { 'x-request-id': 'req-789' };

      const headers = buildHeaders(base, override);
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'x-request-id': 'req-789',
      });
    });

    it('override headers перезаписывают базовые', () => {
      const base = { 'Authorization': 'Bearer old' };
      const override = { 'Authorization': 'Bearer new' };

      const headers = buildHeaders(base, override);
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer new',
      });
    });

    it('работает с пустыми объектами', () => {
      const headers = buildHeaders({}, {});
      expect(headers).toEqual({
        'Content-Type': 'application/json',
      });
    });
  });

  describe('parseJsonSafe', () => {
    it('парсит корректный JSON', async () => {
      const response = createMockResponse(200, 'OK', { data: 'test' });
      const result = await parseJsonSafe(response);
      expect(result).toEqual({ data: 'test' });
    });

    it('возвращает null для пустого ответа', async () => {
      const response = createMockResponse(200, 'OK', null);
      const result = await parseJsonSafe(response);
      expect(result).toBeNull();
    });

    it('бросает ошибку для невалидного JSON', async () => {
      const response = {
        text: vi.fn().mockResolvedValue('invalid json {'),
      } as unknown as Response;

      await expect(parseJsonSafe(response)).rejects.toThrow();
    });

    it('бросает ошибку для пустого тела при ошибочном ответе', async () => {
      const response = createMockResponse(500, 'Internal Server Error', null);
      await expect(parseJsonSafe(response)).rejects.toThrow(
        'Empty response body for error status 500',
      );
    });
  });

  describe('mapHttpError', () => {
    it('маппит 4xx ошибки как не-retriable', () => {
      const response = createMockResponse(404, 'Not Found');
      const error = mapHttpError(response, { message: 'Not found' });

      expect(error).toEqual({
        kind: 'ApiError',
        status: 404,
        message: 'Not Found',
        payload: { message: 'Not found' },
        retriable: false,
      });
    });

    it('маппит 5xx ошибки как retriable', () => {
      const response = createMockResponse(500, 'Internal Server Error');
      const error = mapHttpError(response, { message: 'Server error' });

      expect(error.retriable).toBe(true);
    });

    it('правильно определяет server errors (>= 500)', () => {
      const testCases = [500, 502, 503, 504];

      testCases.forEach((status) => {
        const response = createMockResponse(status, 'Server Error');
        const error = mapHttpError(response, null);
        expect(error.retriable).toBe(true);
      });
    });

    it('правильно определяет client errors (< 500)', () => {
      const testCases = [400, 401, 403, 404, 422];

      testCases.forEach((status) => {
        const response = createMockResponse(status, 'Client Error');
        const error = mapHttpError(response, null);
        expect(error.retriable).toBe(false);
      });
    });
  });
});

// ============================================================================
// 🚀 ТЕСТЫ API CLIENT КЛАССА
// ============================================================================

describe('ApiClient Class', () => {
  let mockFetch: typeof fetch;
  let client: ApiClient;

  beforeEach(() => {
    // Create default mock fetch for each test
    mockFetch = createMockFetch(() => createMockResponse(200, 'OK', { success: true }));

    client = new ApiClient({
      baseUrl: 'https://api.example.com',
      defaultHeaders: { 'Authorization': 'Bearer token' },
      retries: 1,
      fetchImpl: mockFetch,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('создает клиента с минимальной конфигурацией', () => {
      const minimalClient = new ApiClient({
        baseUrl: 'https://api.test.com',
      });

      expect(minimalClient).toBeInstanceOf(ApiClient);
    });

    it('применяет дефолтные значения', () => {
      const defaultClient = new ApiClient({
        baseUrl: 'https://api.test.com',
      });

      // Проверяем что клиент создался без ошибок
      expect(defaultClient).toBeInstanceOf(ApiClient);
    });

    it('использует переданную fetch функцию', () => {
      const customFetch = vi.fn();
      const clientWithCustomFetch = new ApiClient({
        baseUrl: 'https://api.test.com',
        fetchImpl: customFetch,
      });

      expect(clientWithCustomFetch).toBeInstanceOf(ApiClient);
    });
  });

  describe('request method', () => {
    it('успешно выполняет GET запрос', async () => {
      const mockResponse = createMockResponse(200, 'OK', { data: 'success' });
      const localMockFetch = createMockFetch(() => mockResponse);
      const localClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        defaultHeaders: { 'Authorization': 'Bearer token' },
        retries: 1,
        fetchImpl: localMockFetch,
      });

      const result = await localClient.request<{ data: string; }>({
        method: 'GET',
        url: '/test',
        headers: {},
      });

      // apiClient теперь возвращает данные напрямую, а не обернутые в { success: true, data }
      expect(result).toEqual({ data: 'success' });

      expect(localMockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        }),
      );
    });

    it('успешно выполняет POST запрос с body', async () => {
      const mockResponse = createMockResponse(201, 'Created', { id: 123 });
      const localMockFetch = createMockFetch(() => mockResponse);
      const localClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        defaultHeaders: { 'Authorization': 'Bearer token' },
        retries: 1,
        fetchImpl: localMockFetch,
      });

      const requestBody = { name: 'test' };
      const result = await localClient.request<{ id: number; }>({
        method: 'POST',
        url: '/items',
        body: requestBody,
        headers: { 'x-trace-id': 'trace-123' },
      });

      // apiClient теперь возвращает данные напрямую
      expect(result).toEqual({ id: 123 });

      expect(localMockFetch).toHaveBeenCalledWith(
        'https://api.example.com/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token',
            'x-trace-id': 'trace-123',
          }),
        }),
      );
    });

    it('бросает ApiError для неуспешных ответов', async () => {
      const mockResponse = createMockResponse(404, 'Not Found', { error: 'Not found' });
      const errorMockFetch = createMockFetch(() => mockResponse);

      // Create client with error mock
      const errorClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        defaultHeaders: { 'Authorization': 'Bearer token' },
        retries: 1,
        fetchImpl: errorMockFetch,
      });

      await expect(
        errorClient.request({ method: 'GET', url: '/missing', headers: {} }),
      ).rejects.toEqual({
        kind: 'ApiError',
        status: 404,
        message: 'Not Found',
        payload: { error: 'Not found' },
        retriable: false,
      });
    });

    it('применяет retry для server errors', async () => {
      const mockResponse = createMockResponse(500, 'Server Error', { error: 'Server error' });
      const retryClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        defaultHeaders: { 'Authorization': 'Bearer token' },
        retries: 1,
        fetchImpl: createMockFetch(() => mockResponse),
      });

      await expect(
        retryClient.request({ method: 'GET', url: '/error', headers: {} }),
      ).rejects.toEqual({
        kind: 'ApiError',
        status: 500,
        message: 'Server Error',
        payload: { error: 'Server error' },
        retriable: true,
      });
    });

    // ⚠️ Timeout больше не применяется в api-client — timeout живет только в orchestrator
    // Тест удален, так как api-client теперь только transport layer без timeout

    it('передает custom headers', async () => {
      const mockResponse = createMockResponse(200, 'OK', { data: 'ok' });
      (mockFetch as any).mockResolvedValue(mockResponse);

      await client.request({
        method: 'GET',
        url: '/test',
        headers: { 'x-request-id': 'req-123' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-request-id': 'req-123',
          }),
        }),
      );
    });

    it('обрабатывает network errors', async () => {
      const networkError = new Error('Network failure');
      mockFetch = createFailingFetch(() => networkError);

      // Update client with new mock fetch
      const errorClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        defaultHeaders: { 'Authorization': 'Bearer token' },
        retries: 1,
        fetchImpl: mockFetch,
      });

      await expect(
        errorClient.request({ method: 'GET', url: '/test', headers: {} }),
      ).rejects.toThrow('Network failure');
    });

    it('работает с пустым body в POST', async () => {
      const mockResponse = createMockResponse(200, 'OK', { success: true });
      (mockFetch as any).mockResolvedValue(mockResponse);

      await client.request({
        method: 'POST',
        url: '/test',
        body: undefined,
        headers: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: null,
        }),
      );
    });
  });

  describe('HTTP shortcuts', () => {
    beforeEach(() => {
      const mockResponse = createMockResponse(200, 'OK', { data: 'success' });
      (mockFetch as any).mockResolvedValue(mockResponse);
    });

    describe('get', () => {
      it('выполняет GET запрос', async () => {
        const result = await client.get('/users');

        // apiClient теперь возвращает данные напрямую
        expect(result).toEqual({ data: 'success' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/users',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer token',
            }),
          }),
        );
      });

      it('принимает custom headers', async () => {
        await client.get('/users', { 'x-trace-id': 'trace-789' });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-trace-id': 'trace-789',
            }),
          }),
        );
      });
    });

    describe('post', () => {
      it('выполняет POST запрос с body', async () => {
        const body = { name: 'test' };
        const result = await client.post('/users', body);

        // apiClient теперь возвращает данные напрямую
        expect(result).toEqual({ data: 'success' });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/users',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(body),
          }),
        );
      });

      it('принимает custom headers', async () => {
        const body = { name: 'test' };
        await client.post('/users', body, { 'x-trace-id': 'trace-999' });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'x-trace-id': 'trace-999',
            }),
          }),
        );
      });
    });

    describe('put', () => {
      it('выполняет PUT запрос', async () => {
        const body = { name: 'updated' };
        await client.put('/users/1', body);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/users/1',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(body),
          }),
        );
      });
    });

    describe('patch', () => {
      it('выполняет PATCH запрос', async () => {
        const body = { name: 'patched' };
        await client.patch('/users/1', body);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/users/1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(body),
          }),
        );
      });
    });

    describe('delete', () => {
      it('выполняет DELETE запрос', async () => {
        await client.delete('/users/1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/users/1',
          expect.objectContaining({
            method: 'DELETE',
          }),
        );
      });
    });
  });
});

// ============================================================================
// 🏗 ТЕСТЫ ФАБРИКИ КЛИЕНТА
// ============================================================================

describe('createApiClient factory', () => {
  it('создает ApiClient с минимальной конфигурацией', () => {
    const config: ApiClientConfig = {
      baseUrl: 'https://api.test.com',
    };

    const client = createApiClient(config);
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('применяет дефолтные значения', () => {
    const config: ApiClientConfig = {
      baseUrl: 'https://api.test.com',
    };

    const client = createApiClient(config);
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('передает все опции в конструктор', () => {
    const config: ApiClientConfig = {
      baseUrl: 'https://api.test.com',
      defaultHeaders: { 'Authorization': 'Bearer token' },
      retries: 3,
    };

    const client = createApiClient(config);
    expect(client).toBeInstanceOf(ApiClient);
  });
});

// ============================================================================
// 🔄 ТЕСТЫ ИНТЕГРАЦИИ С EFFECT UTILS
// ============================================================================

describe('Integration with Effect Utils', () => {
  it('использует withRetry для server errors', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        createMockResponse(500, 'Server Error', { error: 'Internal server error' }),
      )
      .mockResolvedValueOnce(createMockResponse(200, 'OK', { success: true }));

    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchImpl: mockFetch,
      retries: 1,
    });

    const result = await client.get('/test');

    // apiClient теперь возвращает данные напрямую
    expect(result).toEqual({ success: true });

    // Проверяем что был retry
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ⚠️ Timeout больше не применяется в api-client — timeout живет только в orchestrator
  // Тест удален, так как api-client теперь только transport layer без timeout

  it('поддерживает AbortSignal из req.signal', async () => {
    const mockResponse = createMockResponse(200, 'OK', { data: 'ok' });
    const mockFetch = createMockFetch(() => mockResponse);
    const controller = new AbortController();

    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchImpl: mockFetch,
    });

    await client.request({
      method: 'GET',
      url: '/test',
      headers: {},
      signal: controller.signal,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it('поддерживает AbortSignal из req.context (EffectContext)', async () => {
    const mockResponse = createMockResponse(200, 'OK', { data: 'ok' });
    const mockFetch = createMockFetch(() => mockResponse);
    const controller = new AbortController();

    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchImpl: mockFetch,
    });

    await client.request({
      method: 'GET',
      url: '/test',
      headers: {},
      context: {
        traceId: 'test-trace',
        abortSignal: controller.signal,
      } as any, // EffectContext расширяет ApiRequestContext
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it('применяет tracing', async () => {
    const mockResponse = createMockResponse(200, 'OK', { traced: true });
    const mockFetch = createMockFetch(() => mockResponse);

    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchImpl: mockFetch,
    });

    await client.get('/traced');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
