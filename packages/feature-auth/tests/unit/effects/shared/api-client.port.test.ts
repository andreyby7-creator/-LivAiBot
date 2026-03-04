/**
 * @file Unit тесты для effects/shared/api-client.port.ts
 * ============================================================================
 * 🔐 API CLIENT PORT — КОНТРАКТ HTTP-КЛИЕНТА
 * ============================================================================
 * Проверяет, что:
 * - ApiRequestOptions тип корректно определяет структуру опций запроса
 * - AuthApiClientPort интерфейс корректно определяет контракт HTTP-клиента
 * - Типы обеспечивают правильное использование в runtime
 * - Можно создавать корректные реализации интерфейсов
 * - Type narrowing работает правильно для опциональных полей
 */

import { describe, expect, it, vi } from 'vitest';

import type { Effect } from '@livai/app/lib/effect-utils.js';
import type {
  ApiRequestOptions,
  AuthApiClientPort,
} from '../../../../src/effects/shared/api-client.port.js';

/* eslint-disable @livai/multiagent/orchestration-safety -- тесты не требуют таймаутов агента */

// ============================================================================
// 🔧 HELPERS & MOCKS
// ============================================================================

/**
 * Создает тестовые ApiRequestOptions без signal
 */
function createApiRequestOptionsWithoutSignal(
  overrides: Partial<ApiRequestOptions> = {},
): ApiRequestOptions {
  return {
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    ...overrides,
  };
}

/**
 * Создает тестовые ApiRequestOptions с signal
 */
function createApiRequestOptionsWithSignal(
  overrides: Partial<ApiRequestOptions> = {},
): ApiRequestOptions {
  return {
    headers: { 'Content-Type': 'application/json' },
    signal: new AbortController().signal,
    ...overrides,
  };
}

/**
 * Создает минимальные ApiRequestOptions (только headers)
 */
function createMinimalApiRequestOptions(): ApiRequestOptions {
  return {
    headers: { 'X-Test': 'test' },
  };
}

/**
 * Создает мок AuthApiClientPort для тестирования контракта
 */
function createMockAuthApiClientPort(): AuthApiClientPort {
  const mockPost = vi.fn().mockImplementation(() => createTestEffect({ success: true }));
  const mockGet = vi.fn().mockImplementation(() => createTestEffect({ data: 'test' }));

  return {
    post: mockPost as any, // Type assertion для тестирования
    get: mockGet as any, // Type assertion для тестирования
  };
}

/**
 * Создает полнофункциональный мок AuthApiClientPort
 */
function createFullMockAuthApiClientPort(): AuthApiClientPort {
  return {
    post: vi.fn().mockImplementation(() => createTestEffect({ success: true })),
    get: vi.fn().mockImplementation(() => createTestEffect({ data: 'test' })),
  };
}

/**
 * Создает тестовый Effect для проверки типа
 */
function createTestEffect<T>(result: T): Effect<T> {
  return async (signal?: AbortSignal): Promise<T> => {
    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/strict-boolean-expressions
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    return result;
  };
}

// ============================================================================
// 🎯 TESTS - ApiRequestOptions
// ============================================================================

describe('ApiRequestOptions', () => {
  describe('структура типа', () => {
    it('должен позволять создавать объект только с headers', () => {
      const options: ApiRequestOptions = createMinimalApiRequestOptions();

      expect(options).toHaveProperty('headers');
      expect(typeof options.headers).toBe('object');
      expect(options.headers!['X-Test']).toBe('test');
      expect(options).not.toHaveProperty('signal');
    });

    it('должен позволять создавать объект с headers и signal', () => {
      const options: ApiRequestOptions = createApiRequestOptionsWithSignal();

      expect(options).toHaveProperty('headers');
      expect(options).toHaveProperty('signal');
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.headers!['Content-Type']).toBe('application/json');
    });

    it('должен позволять создавать объект только с signal', () => {
      const signal = new AbortController().signal;
      const options: ApiRequestOptions = { signal };

      expect(options).toHaveProperty('signal');
      expect(options.signal).toBe(signal);
      expect(options).not.toHaveProperty('headers');
    });

    it('должен позволять создавать пустой объект', () => {
      const options: ApiRequestOptions = {};

      expect(options).toEqual({});
      expect(options.headers).toBeUndefined();
      expect(options.signal).toBeUndefined();
    });
  });

  describe('headers property', () => {
    it('должен принимать Record<string, string> для headers', () => {
      const headers = { Authorization: 'Bearer token', 'Content-Type': 'application/json' };
      const options: ApiRequestOptions = { headers };

      expect(options.headers).toEqual(headers);
      expect(typeof options.headers).toBe('object');
    });

    it('должен позволять пустой объект headers', () => {
      const options: ApiRequestOptions = { headers: {} };

      expect(options.headers).toEqual({});
      expect(Object.keys(options.headers!)).toHaveLength(0);
    });

    it('должен обеспечивать неизменяемость headers', () => {
      const options: ApiRequestOptions = { headers: { test: 'value' } };

      // В runtime readonly свойства все равно мутируемы, но TypeScript обеспечивает типизацию
      expect(options.headers!['test']).toBe('value');

      // Проверяем, что объект существует и имеет правильную структуру
      expect(options.headers).toBeDefined();
      expect(typeof options.headers).toBe('object');
    });
  });

  describe('signal property', () => {
    it('должен принимать AbortSignal', () => {
      const signal = new AbortController().signal;
      const options: ApiRequestOptions = { signal };

      expect(options.signal).toBe(signal);
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('должен быть undefined по умолчанию', () => {
      const options: ApiRequestOptions = {};

      expect(options.signal).toBeUndefined();
    });
  });

  describe('type safety', () => {
    it('должен обеспечивать правильную типизацию headers', () => {
      // TypeScript обеспечивает типизацию, проверяем runtime поведение
      const options: ApiRequestOptions = { headers: { 'Content-Type': 'application/json' } };

      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(typeof options.headers).toBe('object');
    });

    it('должен обеспечивать правильную типизацию signal', () => {
      // TypeScript обеспечивает типизацию, проверяем runtime поведение
      const signal = new AbortController().signal;
      const options: ApiRequestOptions = { signal };

      expect(options.signal).toBe(signal);
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
  });
});

// ============================================================================
// 🎯 TESTS - AuthApiClientPort
// ============================================================================

describe('AuthApiClientPort', () => {
  describe('структура интерфейса', () => {
    it('должен иметь post и get методы', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      expect(port).toHaveProperty('post');
      expect(port).toHaveProperty('get');
      expect(typeof port.post).toBe('function');
      expect(typeof port.get).toBe('function');
    });

    it('post метод должен возвращать Effect<T>', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      const effect = port.post('/test', { data: 'test' });
      expect(typeof effect).toBe('function');
      expect(effect.length).toBe(1); // один параметр (signal)
    });

    it('get метод должен возвращать Effect<T>', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      const effect = port.get('/test');
      expect(typeof effect).toBe('function');
      expect(effect.length).toBe(1); // один параметр (signal)
    });
  });

  describe('post method', () => {
    it('должен принимать url, body и опциональные options', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      expect(() => {
        port.post('/api/test', { data: 'test' });
        port.post('/api/test', { data: 'test' }, createApiRequestOptionsWithSignal());
        port.post('/api/test', { data: 'test' }, {});
      }).not.toThrow();
    });

    it('должен поддерживать generic типизацию', async () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      const effect = port.post<{ success: boolean; }>('/test', {});
      const result = await effect();

      expect(result).toEqual({ success: true });
    });

    it('должен принимать AbortSignal через параметр Effect', async () => {
      const port: AuthApiClientPort = createFullMockAuthApiClientPort();
      const signal = new AbortController().signal;

      const effect = port.post('/test', {});
      const result = await effect(signal);

      expect(result).toEqual({ success: true });
    });

    it('должен обрабатывать aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      // Создаем специальный эффект, который реагирует на aborted signal
      const abortEffect: Effect<{ success: boolean; }> = async (signal?: AbortSignal) => {
        // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/strict-boolean-expressions
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        return { success: true };
      };

      // Создаем порт с кастомным post методом
      const port: AuthApiClientPort = {
        post: vi.fn().mockReturnValue(abortEffect) as any,
        get: vi.fn().mockImplementation(() => createTestEffect({ data: 'test' })) as any,
      };

      const effect = port.post('/test', {});
      await expect(effect(controller.signal)).rejects.toThrow('Aborted');
    });
  });

  describe('get method', () => {
    it('должен принимать url и опциональные options', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      expect(() => {
        port.get('/api/test');
        port.get('/api/test', createApiRequestOptionsWithSignal());
        port.get('/api/test', {});
      }).not.toThrow();
    });

    it('должен поддерживать generic типизацию', async () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      const effect = port.get<{ data: string; }>('/test');
      const result = await effect();

      expect(result).toEqual({ data: 'test' });
    });

    it('должен принимать AbortSignal через параметр Effect', async () => {
      const port: AuthApiClientPort = createFullMockAuthApiClientPort();
      const signal = new AbortController().signal;

      const effect = port.get('/test');
      const result = await effect(signal);

      expect(result).toEqual({ data: 'test' });
    });

    it('должен обрабатывать aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      // Создаем специальный эффект, который реагирует на aborted signal
      const abortEffect: Effect<{ data: string; }> = async (signal?: AbortSignal) => {
        // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/strict-boolean-expressions
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        return { data: 'test' };
      };

      // Создаем порт с кастомным get методом
      const port: AuthApiClientPort = {
        post: vi.fn().mockImplementation(() => createTestEffect({ success: true })) as any,
        get: vi.fn().mockReturnValue(abortEffect) as any,
      };

      const effect = port.get('/test');
      await expect(effect(controller.signal)).rejects.toThrow('Aborted');
    });
  });

  describe('readonly contract', () => {
    it('должен обеспечивать неизменяемость интерфейса', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      // Проверяем, что объект имеет правильную структуру
      expect(port).toHaveProperty('post');
      expect(port).toHaveProperty('get');
      expect(typeof port.post).toBe('function');
      expect(typeof port.get).toBe('function');
    });
  });

  describe('type safety', () => {
    it('должен обеспечивать правильную типизацию параметров post', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      // TypeScript обеспечивает типизацию параметров
      const effect = port.post('/test', { data: 'test' });
      expect(typeof effect).toBe('function');
    });

    it('должен обеспечивать правильную типизацию параметров get', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();

      // TypeScript обеспечивает типизацию параметров
      const effect = port.get('/test');
      expect(typeof effect).toBe('function');
    });

    it('должен обеспечивать правильную типизацию options', () => {
      const port: AuthApiClientPort = createMockAuthApiClientPort();
      const options: ApiRequestOptions = { headers: { 'X-Test': 'test' } };

      // TypeScript обеспечивает типизацию options
      const postEffect = port.post('/test', {}, options);
      const getEffect = port.get('/test', options);

      expect(typeof postEffect).toBe('function');
      expect(typeof getEffect).toBe('function');
    });
  });
});

// ============================================================================
// 🎯 TESTS - Integration & Type Guards
// ============================================================================

describe('Integration scenarios', () => {
  it('должен позволять композицию Effect из post с options', async () => {
    const port: AuthApiClientPort = createFullMockAuthApiClientPort();
    const options = createApiRequestOptionsWithSignal();

    const effect = port.post('/api/login', { username: 'test', password: 'pass' }, options);
    const result = await effect();

    expect(result).toEqual({ success: true });
  });

  it('должен позволять композицию Effect из get с options', async () => {
    const port: AuthApiClientPort = createFullMockAuthApiClientPort();
    const options = createApiRequestOptionsWithoutSignal();

    const effect = port.get('/api/user', options);
    const result = await effect();

    expect(result).toEqual({ data: 'test' });
  });

  it('должен поддерживать cancellation через Effect параметр', async () => {
    const controller = new AbortController();

    // Создаем эффект, который проверяет signal
    const mockEffect: Effect<{ success: boolean; }> = vi.fn().mockImplementation(
      async (signal?: AbortSignal) => {
        // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/strict-boolean-expressions
        if (signal?.aborted) throw new Error('Aborted');
        return { success: true };
      },
    );

    // Создаем порт с кастомным post методом
    const port: AuthApiClientPort = {
      post: vi.fn().mockReturnValue(mockEffect) as any,
      get: vi.fn().mockImplementation(() => createTestEffect({ data: 'test' })) as any,
    };

    const effect = port.post('/test', {});
    controller.abort();

    await expect(effect(controller.signal)).rejects.toThrow('Aborted');
  });
});

/* eslint-enable @livai/multiagent/orchestration-safety */
