/**
 * @file Unit тесты для effects/shared/api-client.adapter.ts
 * Полное покрытие ApiClient adapter с тестированием всех функций и edge cases
 */

import { describe, expect, it, vi } from 'vitest';

import type { ApiRequestOptions } from '../../../../src/effects/shared/api-client.port.js';
import type { LegacyApiClient } from '../../../../src/effects/shared/api-client.adapter.js';

import { createApiClientPortAdapter } from '../../../../src/effects/shared/api-client.adapter.js';

/* eslint-disable @livai/multiagent/orchestration-safety -- тесты не требуют таймаутов агента */

// ============================================================================
// 🔧 MOCKS & HELPERS
// ============================================================================

/** Создает мок LegacyApiClient для тестов */
function createMockLegacyClient(): LegacyApiClient {
  return {
    post: vi.fn(),
    get: vi.fn(),
  };
}

/** Создает тестовые данные */
function createTestData() {
  return {
    url: '/api/test',
    body: { test: 'data' },
    headers: { 'Content-Type': 'application/json' },
    signal: new AbortController().signal,
  };
}

// ============================================================================
// 🎯 TESTS - createApiClientPortAdapter
// ============================================================================

describe('createApiClientPortAdapter', () => {
  it('создаёт AuthApiClientPort с post и get методами', () => {
    const legacyClient = createMockLegacyClient();
    const adapter = createApiClientPortAdapter(legacyClient);

    expect(adapter).toHaveProperty('post');
    expect(adapter).toHaveProperty('get');
    expect(typeof adapter.post).toBe('function');
    expect(typeof adapter.get).toBe('function');
  });

  it('post метод возвращает Effect функцию', () => {
    const legacyClient = createMockLegacyClient();
    const adapter = createApiClientPortAdapter(legacyClient);

    const effect = adapter.post('/api/test', { data: 'test' });
    expect(typeof effect).toBe('function');
  });

  it('get метод возвращает Effect функцию', () => {
    const legacyClient = createMockLegacyClient();
    const adapter = createApiClientPortAdapter(legacyClient);

    const effect = adapter.get('/api/test');
    expect(typeof effect).toBe('function');
  });

  describe('post method', () => {
    it('вызывает legacyClient.post с правильными параметрами без options', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body } = createTestData();

      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body);
      const result = await effect();

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, undefined);
      expect(result).toBe(mockResult);
    });

    it('вызывает legacyClient.post с правильными параметрами с options', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body, headers } = createTestData();

      const options: ApiRequestOptions = { headers };
      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body, options);
      const result = await effect();

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, options);
      expect(result).toBe(mockResult);
    });

    it('передаёт AbortSignal из Effect параметра в legacyClient.post', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body, signal } = createTestData();

      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body);
      const result = await effect(signal);

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, { signal });
      expect(result).toBe(mockResult);
    });

    it('приоритизирует AbortSignal из Effect параметра над options.signal', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body } = createTestData();

      const effectSignal = new AbortController().signal;
      const optionsSignal = new AbortController().signal;
      const options: ApiRequestOptions = { signal: optionsSignal };

      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body, options);
      const result = await effect(effectSignal);

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, {
        ...options,
        signal: effectSignal, // приоритет у effectSignal
      });
      expect(result).toBe(mockResult);
    });

    it('использует options.signal если Effect signal не передан', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body, signal } = createTestData();

      const options: ApiRequestOptions = { signal };
      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body, options);
      const result = await effect(); // без signal в effect

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, options);
      expect(result).toBe(mockResult);
    });

    it('пробрасывает ошибки из legacyClient.post', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body } = createTestData();

      const testError = new Error('Network error');
      (legacyClient.post as any).mockRejectedValue(testError);

      const effect = adapter.post(url, body);

      await expect(effect()).rejects.toThrow('Network error');
    });

    it('работает с generic типами', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);

      type TestResponse = {
        id: string;
        value: number;
      };

      const mockResult: TestResponse = { id: 'test-123', value: 42 };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post<TestResponse>('/api/test', { data: 'test' });
      const result = await effect();

      expect(result).toEqual(mockResult);
      expect(result.id).toBe('test-123');
      expect(result.value).toBe(42);
    });
  });

  describe('get method', () => {
    it('вызывает legacyClient.get с правильными параметрами без options', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url } = createTestData();

      const mockResult = { data: 'test' };
      (legacyClient.get as any).mockResolvedValue(mockResult);

      const effect = adapter.get(url);
      const result = await effect();

      expect(legacyClient.get).toHaveBeenCalledWith(url, undefined);
      expect(result).toBe(mockResult);
    });

    it('вызывает legacyClient.get с правильными параметрами с options', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, headers } = createTestData();

      const options: ApiRequestOptions = { headers };
      const mockResult = { data: 'test' };
      (legacyClient.get as any).mockResolvedValue(mockResult);

      const effect = adapter.get(url, options);
      const result = await effect();

      expect(legacyClient.get).toHaveBeenCalledWith(url, options);
      expect(result).toBe(mockResult);
    });

    it('передаёт AbortSignal из Effect параметра в legacyClient.get', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, signal } = createTestData();

      const mockResult = { data: 'test' };
      (legacyClient.get as any).mockResolvedValue(mockResult);

      const effect = adapter.get(url);
      const result = await effect(signal);

      expect(legacyClient.get).toHaveBeenCalledWith(url, { signal });
      expect(result).toBe(mockResult);
    });

    it('приоритизирует AbortSignal из Effect параметра над options.signal', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url } = createTestData();

      const effectSignal = new AbortController().signal;
      const optionsSignal = new AbortController().signal;
      const options: ApiRequestOptions = { signal: optionsSignal };

      const mockResult = { data: 'test' };
      (legacyClient.get as any).mockResolvedValue(mockResult);

      const effect = adapter.get(url, options);
      const result = await effect(effectSignal);

      expect(legacyClient.get).toHaveBeenCalledWith(url, {
        ...options,
        signal: effectSignal, // приоритет у effectSignal
      });
      expect(result).toBe(mockResult);
    });

    it('использует options.signal если Effect signal не передан', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, signal } = createTestData();

      const options: ApiRequestOptions = { signal };
      const mockResult = { data: 'test' };
      (legacyClient.get as any).mockResolvedValue(mockResult);

      const effect = adapter.get(url, options);
      const result = await effect(); // без signal в effect

      expect(legacyClient.get).toHaveBeenCalledWith(url, options);
      expect(result).toBe(mockResult);
    });

    it('пробрасывает ошибки из legacyClient.get', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url } = createTestData();

      const testError = new Error('Network error');
      (legacyClient.get as any).mockRejectedValue(testError);

      const effect = adapter.get(url);

      await expect(effect()).rejects.toThrow('Network error');
    });

    it('работает с generic типами', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);

      type TestResponse = {
        items: string[];
        total: number;
      };

      const mockResult: TestResponse = { items: ['a', 'b'], total: 2 };
      (legacyClient.get as any).mockResolvedValue(mockResult);

      const effect = adapter.get<TestResponse>('/api/items');
      const result = await effect();

      expect(result).toEqual(mockResult);
      expect(result.items).toEqual(['a', 'b']);
      expect(result.total).toBe(2);
    });
  });

  describe('AbortSignal edge cases', () => {
    it('работает когда оба signal равны undefined', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body } = createTestData();

      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body, {});
      const result = await effect(undefined); // явное undefined

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, {});
      expect(result).toBe(mockResult);
    });

    it('работает когда options undefined', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body, signal } = createTestData();

      const mockResult = { success: true };
      (legacyClient.post as any).mockResolvedValue(mockResult);

      const effect = adapter.post(url, body, undefined);
      const result = await effect(signal);

      expect(legacyClient.post).toHaveBeenCalledWith(url, body, { signal });
      expect(result).toBe(mockResult);
    });

    it('AbortController.abort() корректно отменяет запрос', async () => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);
      const { url, body } = createTestData();

      const abortController = new AbortController();
      const abortError = new Error('Aborted');
      (legacyClient.post as any).mockImplementation(() => {
        // Имитируем отмену запроса
        abortController.abort();
        throw abortError;
      });

      const effect = adapter.post(url, body);
      await expect(effect(abortController.signal)).rejects.toThrow('Aborted');
    });
  });

  describe('error handling', () => {
    const errorCases = [
      new Error('Network error'),
      new TypeError('Invalid JSON'),
      'String error',
      { message: 'Object error' },
      null,
      undefined,
    ] as const;

    it.each(errorCases)('пробрасывает ошибку %s из post', async (error) => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);

      (legacyClient.post as any).mockRejectedValue(error);
      const effect = adapter.post('/api/test', {});
      await expect(effect()).rejects.toBe(error);
    });

    it.each(errorCases)('пробрасывает ошибку %s из get', async (error) => {
      const legacyClient = createMockLegacyClient();
      const adapter = createApiClientPortAdapter(legacyClient);

      (legacyClient.get as any).mockRejectedValue(error);
      const effect = adapter.get('/api/test');
      await expect(effect()).rejects.toBe(error);
    });
  });
});

/* eslint-enable @livai/multiagent/orchestration-safety */
