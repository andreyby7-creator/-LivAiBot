/**
 * @file packages/app/src/lib/auth-token-adapter.ts
 * ============================================================================
 * 🔗 AUTH TOKEN ADAPTER — АДАПТЕР ДЛЯ ПОЛУЧЕНИЯ ТОКЕНОВ ИЗ FEATURE-AUTH
 * ============================================================================
 *
 * Архитектурная роль:
 * - Адаптер для получения access token из feature-auth store через порт.
 * - Инкапсулирует доступ к токенам, абстрагируя детали реализации стора.
 * - Используется HTTP-клиентами для автоматического добавления Authorization header.
 *
 * Инварианты:
 * - ❌ HTTP-клиент НЕ подписывается напрямую на Zustand-store.
 * - ✅ Доступ к токенам идёт только через адаптер/порт (функции app-слоя).
 * - ✅ Адаптер не хранит токены, только предоставляет функцию для их получения.
 * - ✅ Токены берутся из feature-auth store (единственный источник правды).
 * - ✅ Deterministic: одинаковое состояние store → одинаковый результат.
 * - ✅ Immutable: адаптер защищён от мутаций через Object.freeze.
 *
 * @remarks
 * - В текущей архитектуре feature-auth токены могут храниться в httpOnly cookies
 *   или secure memory, но для HTTP-запросов нужен адаптер, который получает токен
 *   из store через порт (если токены хранятся в store) или из другого источника.
 * - Если токены хранятся в httpOnly cookies, браузер автоматически отправляет их,
 *   и этот адаптер может не использоваться для таких запросов.
 * - Если токены доступны через `AuthState.context.accessToken` (для SSR или других случаев),
 *   адаптер извлекает их оттуда.
 * - Адаптер поддерживает async получение токенов для SSR (например, fetch из secure memory).
 * - Адаптер поддерживает опциональное логирование для мониторинга failed auth flows.
 */

import type { UseAuthStorePort } from '../hooks/useAuth.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/**
 * Опциональный логгер для мониторинга попыток получения токенов.
 * @remarks
 * - Используется для безопасного логирования failed token access (без токенов в логах).
 * - Помогает отслеживать проблемы с аутентификацией в production.
 */
export type AuthTokenAdapterLogger = Readonly<{
  /**
   * Логирует предупреждение о недоступности токена.
   * @param message - Сообщение для логирования.
   * @param context - Контекст (статус аутентификации и т.д.).
   */
  readonly warn: (message: string, context?: Readonly<Record<string, unknown>>) => void;
}>;

/**
 * Конфигурация для создания адаптера токенов.
 */
export type AuthTokenAdapterConfig = Readonly<{
  /**
   * Опциональный логгер для мониторинга failed token access.
   * @remarks
   * - Если не предоставлен, логирование не выполняется (fail-silent).
   * - Рекомендуется использовать в production для мониторинга auth flows.
   */
  readonly logger?: AuthTokenAdapterLogger;
}>;

/**
 * Адаптер для получения access token из feature-auth store.
 * @remarks
 * - Предоставляет функцию `getAccessToken()` для получения текущего access token.
 * - Возвращает `null` если токен недоступен (не аутентифицирован, токен истек и т.д.).
 * - Не подписывается на изменения store напрямую (это ответственность вызывающей стороны).
 * - Immutable: защищён от мутаций через Object.freeze.
 * - Async: поддерживает асинхронное получение токенов для SSR (например, fetch из secure memory).
 */
export type AuthTokenAdapter = Readonly<{
  /**
   * Получает текущий access token из feature-auth store.
   * @returns Promise с access token или `null` если токен недоступен.
   * @remarks
   * - Токен берётся из feature-auth store через порт.
   * - Проверяет `AuthState.context.accessToken` для SSR или других случаев.
   * - Поддерживает async получение токенов (например, из secure memory для SSR).
   * - Если токены хранятся в httpOnly cookies, эта функция может возвращать `null`
   *   (токены отправляются браузером автоматически).
   * - Deterministic: одинаковое состояние store → одинаковый результат.
   */
  readonly getAccessToken: () => Promise<string | null>;
}>;

/* ============================================================================
 * 🏗 FACTORY
 * ========================================================================== */

/**
 * Создаёт адаптер для получения токенов из feature-auth store.
 * @param authStore - Порт стора аутентификации из `UseAuthDeps`.
 * @param config - Опциональная конфигурация (логгер для мониторинга).
 * @returns Immutable адаптер с async функцией `getAccessToken()`.
 * @remarks
 * - Адаптер использует `authStore.getAuthState()` для получения текущего состояния.
 * - Если `AuthState.status === 'authenticated'`, токен извлекается из `AuthState.context.accessToken`
 *   (для SSR или других случаев, когда токены доступны через context).
 * - Поддерживает async получение токенов для SSR (например, fetch из secure memory).
 * - В текущей архитектуре feature-auth токены могут не храниться в store (только в httpOnly cookies),
 *   поэтому адаптер может возвращать `null` и полагаться на httpOnly cookies.
 * - Адаптер защищён от мутаций через Object.freeze для production safety.
 * - Опциональное логирование помогает мониторить failed auth flows в production.
 *
 * @example
 * ```typescript
 * // Базовое использование (async)
 * const adapter = createAuthTokenAdapter(authStore);
 * const token = await adapter.getAccessToken();
 * if (token) {
 *   headers['Authorization'] = `Bearer ${token}`;
 * }
 *
 * // С логированием для production
 * const adapter = createAuthTokenAdapter(authStore, {
 *   logger: { warn: (msg, ctx) => console.warn(msg, ctx) }
 * });
 * ```
 */
export function createAuthTokenAdapter(
  authStore: UseAuthStorePort,
  config?: AuthTokenAdapterConfig,
): AuthTokenAdapter {
  const logger = config?.logger;

  const adapter: AuthTokenAdapter = {
    // Используем явный Promise.resolve вместо async для удовлетворения линтера
    // (async функция требует хотя бы один await, но здесь все операции синхронные)
    // API остаётся async для поддержки будущего расширения (SSR, secure memory fetch)
    getAccessToken: (): Promise<string | null> => {
      // @note: Если getAuthState() станет async в будущем, нужно будет обновить адаптер.
      // Сейчас это правильный компромисс: синхронный доступ к состоянию через порт.
      const authState = authStore.getAuthState();

      // Если пользователь аутентифицирован, проверяем наличие токена в context
      // (для SSR или других случаев, когда токены доступны через context)
      if (authState.status === 'authenticated') {
        // Проверяем токен в context (для SSR или других случаев)
        // Используем индексную сигнатуру для доступа к Record<string, unknown>
        const contextToken = authState.context?.['accessToken'];
        if (typeof contextToken === 'string' && contextToken.length > 0) {
          // Возвращаем через Promise.resolve для консистентности async API
          // и возможности расширения для async получения токенов (например, из secure memory для SSR)
          return Promise.resolve(contextToken);
        }

        // Токен недоступен через context - логируем для мониторинга (если logger предоставлен)
        if (logger) {
          logger.warn('Auth token requested but not available in context', {
            status: authState.status,
            hasContext: authState.context !== undefined,
            hasSession: authState.session !== undefined,
            contextHasToken: typeof contextToken === 'string',
          });
        }

        // В текущей архитектуре feature-auth токены могут храниться в httpOnly cookies
        // или secure memory, а не в store. Возвращаем null - браузер отправит cookies автоматически.
        // Для SSR можно расширить адаптер для async получения токенов из secure memory.
        return Promise.resolve(null);
      }

      // Пользователь не аутентифицирован - токен недоступен
      if (logger) {
        logger.warn('Auth token requested but user is not authenticated', {
          status: authState.status,
        });
      }

      return Promise.resolve(null);
    },
  } as const;

  // Защищаем адаптер от мутаций в production (immutable guarantee)
  if (process.env['NODE_ENV'] === 'production') {
    Object.freeze(adapter);
  }

  return adapter;
}
