/**
 * @file packages/feature-auth/src/effects/shared/api-client.adapter.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — ApiClient Adapter (Promise → Effect) [Shared]
 * ============================================================================
 * Архитектурная роль:
 * - Адаптер для преобразования Promise-based HTTP-клиента в Effect-based AuthApiClientPort
 * - Обеспечивает единую async-модель в orchestrator (стандартизация на Effect)
 * - Изолирует Promise-based API от Effect-based orchestrator
 * - Используется во всех auth-эффектах (login/logout/refresh/register)
 * Принципы:
 * - ✅ Adapter pattern: оборачивает Promise в Effect без изменения логики
 * - ✅ AbortSignal propagation: корректная передача signal из Effect в Promise
 * - ✅ Fail-closed: ошибки Promise пробрасываются в Effect
 * - ✅ Zero overhead: минимальная обёртка, без дополнительной логики
 * - ❌ Нет бизнес-логики: только адаптация контракта
 */

import type { Effect } from '@livai/core/effect';

import type { ApiRequestOptions, AuthApiClientPort } from './api-client.port.js';

/* ============================================================================
 * 🧭 TYPES — LEGACY API CLIENT
 * ============================================================================
 */

/**
 * Promise-based HTTP-клиент (для адаптации).
 * @note Используется только в адаптере для преобразования в AuthApiClientPort.
 */
export type LegacyApiClient = Readonly<{
  post<T>(
    url: string,
    body: unknown,
    options?: ApiRequestOptions & { signal?: AbortSignal; },
  ): Promise<T>;
  get<T>(url: string, options?: ApiRequestOptions & { signal?: AbortSignal; }): Promise<T>;
}>;

/* ============================================================================
 * 🔧 ADAPTER
 * ============================================================================
 */

/**
 * Создаёт AuthApiClientPort из Promise-based HTTP-клиента.
 * Оборачивает Promise-методы в Effect для единой async-модели:
 * - AbortSignal передаётся из Effect-параметра в Promise options
 * - Ошибки Promise пробрасываются в Effect
 * - Готовность к композиции через orchestrator/withTimeout
 * @param legacyClient - Promise-based HTTP-клиент для адаптации
 * @returns Effect-based AuthApiClientPort для использования в orchestrator
 *
 * @example
 * const promiseClient: LegacyApiClient = { post: ..., get: ... };
 * const effectClient = createApiClientPortAdapter(promiseClient);
 * const result = await effectClient.post('/api/data', body)(signal);
 */
export function createApiClientPortAdapter(
  legacyClient: LegacyApiClient, // Promise-based HTTP-клиент
): AuthApiClientPort { // Effect-based порт
  return {
    post: <T>(
      url: string, // URL эндпоинта
      body: unknown, // Тело запроса
      options?: ApiRequestOptions, // Опциональные HTTP-заголовки
    ): Effect<T> => {
      // Effect: (signal?: AbortSignal) => Promise<T>
      return async (signal?: AbortSignal): Promise<T> => {
        // Передаём AbortSignal из Effect-параметра в Promise options
        // Приоритет у параметра Effect, если signal передан в обоих местах
        const effectiveSignal = signal ?? options?.signal;
        const requestOptions = effectiveSignal !== undefined
          ? { ...options, signal: effectiveSignal }
          : options;
        return legacyClient.post<T>(url, body, requestOptions);
      };
    },

    get: <T>(
      url: string, // URL эндпоинта
      options?: ApiRequestOptions, // Опциональные HTTP-заголовки
    ): Effect<T> => {
      // Effect: (signal?: AbortSignal) => Promise<T>
      return async (signal?: AbortSignal): Promise<T> => {
        // Передаём AbortSignal из Effect-параметра в Promise options
        // Приоритет у параметра Effect, если signal передан в обоих местах
        const effectiveSignal = signal ?? options?.signal;
        const requestOptions = effectiveSignal !== undefined
          ? { ...options, signal: effectiveSignal }
          : options;
        return legacyClient.get<T>(url, requestOptions);
      };
    },
  };
}
