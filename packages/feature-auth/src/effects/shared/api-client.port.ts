/**
 * @file packages/feature-auth/src/effects/shared/api-client.port.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — ApiClient Port (Shared)
 * ============================================================================
 * Архитектурная роль:
 * - Единый контракт HTTP-клиента для всех auth-эффектов (login/logout/refresh/register)
 * - Стандартизирован на Effect для единой async-модели в orchestrator
 * - Изолирует effects от деталей реализации HTTP-клиента
 * Принципы:
 * - ✅ Port pattern: объектный интерфейс для HTTP-операций
 * - ✅ Effect-based: все методы возвращают Effect для композиции
 * - ✅ AbortSignal через параметр Effect: единообразная обработка cancellation
 * - ✅ Extensible: легко расширяется новыми методами без breaking changes
 * - ❌ Нет бизнес-логики: только контракт
 */

import type { Effect } from '@livai/app/lib/effect-utils.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Минимальный контракт HTTP-запроса для auth-эффектов.
 * @note Не знает про fetch/axios/baseURL/retry — только post/get с AbortSignal для concurrency.
 * @note Auth headers (например, Authorization) всегда передаются ЯВНО через options.headers,
 *       никакие глобальные interceptors/implicit headers не используются.
 * @note AbortSignal может передаваться через options.signal для явной поддержки cancellation
 *       на уровне HTTP-запроса, либо через параметр Effect (предпочтительно для единообразия).
 *       Если signal передан в обоих местах, приоритет у параметра Effect.
 */
export type ApiRequestOptions = Readonly<{
  /**
   * Явные HTTP-заголовки для запроса.
   * @note Важно для /v1/auth/me — access_token должен передаваться через Authorization header,
   *       а не через глобальное состояние или implicit интерцепторы.
   */
  headers?: Readonly<Record<string, string>>;

  /**
   * AbortSignal для отмены HTTP-запроса.
   * @note Опционален: предпочтительно передавать signal через параметр Effect для единообразия.
   *       Если signal передан и в options, и в параметре Effect, приоритет у параметра Effect.
   */
  signal?: AbortSignal;
}>;

/**
 * Порт для HTTP-клиента auth-домена (Effect-based).
 * Стандартизирован на Effect для единой async-модели в orchestrator:
 * - Единая композиция через orchestrator/withTimeout
 * - Единообразная обработка cancellation через AbortSignal (передаётся через параметр Effect)
 * - Готовность к расширению (retry, isolation, tracing)
 * @note AbortSignal передаётся через параметр Effect (предпочтительно), либо через options.signal.
 *       Если signal передан в обоих местах, приоритет у параметра Effect.
 *       Это обеспечивает единообразную обработку cancellation во всём orchestrator.
 * @note Type naming: явно указывает доменную принадлежность (auth).
 *       Для других доменов используются отдельные порты (BillingApiClientPort, ChatApiClientPort и т.п.).
 */
export type AuthApiClientPort = Readonly<{
  /**
   * POST-запрос с телом запроса.
   * @param url - URL эндпоинта
   * @param body - Тело запроса (сериализуется в JSON)
   * @param options - Опциональные HTTP-заголовки
   * @returns Effect для композиции в orchestrator (AbortSignal передаётся через параметр Effect)
   */
  post: <T>(
    url: string,
    body: unknown,
    options?: ApiRequestOptions,
  ) => Effect<T>;

  /**
   * GET-запрос.
   * @param url - URL эндпоинта
   * @param options - Опциональные HTTP-заголовки
   * @returns Effect для композиции в orchestrator (AbortSignal передаётся через параметр Effect)
   */
  get: <T>(url: string, options?: ApiRequestOptions) => Effect<T>;
}>;
