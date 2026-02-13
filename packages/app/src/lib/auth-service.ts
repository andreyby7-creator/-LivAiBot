/**
 * @file packages/app/src/lib/auth-service.ts
 * ============================================================================
 * 🔐 AUTH SERVICE — СЕРВИС АУТЕНТИФИКАЦИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Управление аутентификацией пользователя (login/logout/refresh)
 * - Синхронизация refresh токенов через mutex
 * - Чистые API контракты без UI зависимостей
 * - Модульный синглтон для всего приложения
 *
 * Свойства:
 * - Thread-safe refresh через async-mutex
 * - Effect-based error handling
 * - Zero UI coupling (чистый domain слой)
 * - SSR-safe (нет window/localStorage зависимостей)
 *
 * Логирование:
 * - Mutex operations: waiting/acquired/released для отладки параллельных refresh
 * - Auth operations: start/success/failure для всех методов
 * - Sensitive data: токены маскируются (показывается только префикс)
 *
 * Runtime validation:
 * - Строгая проверка структуры TokenPairResponse от API
 * - Валидация всех обязательных полей перед использованием
 * - Защита от malformed данных от бэкенда
 */

import type { TokenPairResponse as CoreTokenPairResponse } from '@livai/core-contracts';
import { generatedAuth } from '@livai/core-contracts/validation/zod';
import { Mutex } from 'async-mutex';
import { Effect } from 'effect';
import { z } from 'zod';

import { createApiClient } from './api-client.js';
import type { ApiClient } from './api-client.js';
import { isIsolationError } from './effect-isolation.js';
import type { Effect as EffectType } from './effect-utils.js';
import { orchestrate, step } from './orchestrator.js';
import { isSchemaValidationError, validatedEffect } from './schema-validated-effect.js';
import { logFireAndForget } from './telemetry-runtime.js';

/* ============================================================================
 * 🏷️ AUTH ТИПЫ
 * ========================================================================== */

/** Запрос на вход в систему с username/password. */
export type LoginRequest = {
  /** Email или username пользователя */
  readonly username: string;
  /** Пароль пользователя */
  readonly password: string;
};

/** Пара токенов после успешной аутентификации. */
export type TokenPairResponse = {
  /** Access токен для API запросов */
  readonly accessToken: string;
  /** Refresh токен для обновления access токена */
  readonly refreshToken: string;
  /** Время истечения access токена (timestamp) */
  readonly expiresAt: number;
};

/** Типы ошибок аутентификации (discriminated union). */
export type AuthError =
  | { readonly type: 'network'; readonly message: string; }
  | { readonly type: 'invalid_credentials'; }
  | { readonly type: 'token_expired'; }
  | { readonly type: 'server_error'; readonly status: number; };

/* ============================================================================
 * 📊 CONSTANTS
 * ========================================================================== */

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;
const TOKEN_PREFIX_LENGTH = 8;
const MILLISECONDS_PER_SECOND = 1000;
const API_TIMEOUT_MS = 30_000; // 30 секунд для API запросов
const MAX_ISOLATION_ERROR_DEPTH = 5; // Максимальная глубина unwrap для IsolationError

/* ============================================================================
 * 🏗️ IMPLEMENTATION
 * ========================================================================== */

/** Сервис аутентификации с потокобезопасным управлением токенами. */
export class AuthService {
  /** Mutex для синхронизации refresh операций */
  private readonly refreshMutex = new Mutex();

  /** Безопасно получает префикс токена для логирования (защита от пустых/null значений) */
  private getTokenPrefix(token: string | null | undefined): string {
    return token?.slice(0, TOKEN_PREFIX_LENGTH) ?? '';
  }

  /** API клиент для HTTP запросов */
  private readonly apiClient: ApiClient;

  /** Clock функция для получения текущего времени (для тестирования) */
  private readonly clock: () => number;

  constructor(apiClientOverride?: ApiClient, clockOverride?: () => number) {
    // Создаем API клиент для auth сервиса (или используем переданный для тестирования)
    this.apiClient = apiClientOverride ?? createApiClient({
      baseUrl: this.getApiBaseUrl(),
    });
    // Clock для детерминированного тестирования
    this.clock = clockOverride ?? Date.now;
  }

  /** Получает базовый URL API из переменных окружения */
  protected getApiBaseUrl(): string {
    // В production берем из env, в dev используем дефолт
    const processEnv = typeof process !== 'undefined' ? process.env : undefined;
    const viteEnv = typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined>; }).env
      : undefined;

    return processEnv?.['VITE_API_BASE_URL']
      ?? viteEnv?.['VITE_API_BASE_URL']
      ?? 'http://localhost:8000/api/v1';
  }

  /** Zod схема для валидации CoreTokenPairResponse (расширенная версия с обязательными полями) */
  private readonly tokenPairResponseSchema = generatedAuth.TokenPairResponseSchema.extend({
    token_type: z.literal('bearer'),
    expires_in: z.number().nonnegative(),
    user_id: z.string().uuid(),
    workspace_id: z.string().uuid(),
  });

  /** Преобразует ответ API в формат AuthService */
  private mapCoreTokenResponseToAuthResponse(
    coreResponse: CoreTokenPairResponse,
  ): TokenPairResponse {
    return {
      accessToken: coreResponse.access_token,
      refreshToken: coreResponse.refresh_token,
      expiresAt: this.clock() + Math.max(0, coreResponse.expires_in * MILLISECONDS_PER_SECOND), // expires_in в секундах -> timestamp, защита от отрицательных значений
    };
  }

  /** Единый метод для преобразования любой ошибки в AuthError */
  private mapErrorToAuthError(error: unknown, context?: 'login' | 'refresh' | 'logout'): AuthError {
    // Используем рекурсивный unwrap для извлечения оригинальной ошибки из всех обёрток
    const originalError = this.unwrapError(error);

    logFireAndForget('INFO', 'AuthService: mapErrorToAuthError - processing', {
      source: 'AuthService',
      ...(context !== undefined && { context }),
      originalErrorType: typeof originalError,
      isError: originalError instanceof Error,
      hasKind: typeof originalError === 'object'
        && originalError !== null
        && 'kind' in originalError,
      hasStatus: typeof originalError === 'object'
        && originalError !== null
        && 'status' in originalError,
      hasCategory: typeof originalError === 'object'
        && originalError !== null
        && 'category' in originalError,
      isEffectError: this.isEffectError(originalError),
      isUnauthorizedError: this.isUnauthorizedError(originalError),
    });

    // Если это уже AuthError, возвращаем как есть
    if (
      typeof originalError === 'object'
      && originalError !== null
      && !(originalError instanceof Error)
      && 'type' in originalError
    ) {
      const errorType = (originalError as { type: string; }).type;
      if (['network', 'invalid_credentials', 'token_expired', 'server_error'].includes(errorType)) {
        return originalError as AuthError;
      }
    }

    // Network ошибки - проверяем ПЕРВЫМИ
    if (this.isNetworkError(originalError)) {
      const message = originalError instanceof Error
        ? originalError.message
        : 'Network connection failed';
      return { type: 'network', message };
    }

    // Проверяем на SchemaValidationError (из validatedEffect)
    if (isSchemaValidationError(originalError)) {
      // Ошибка валидации схемы - это server_error
      return { type: 'server_error', status: HTTP_STATUS_INTERNAL_SERVER_ERROR };
    }

    // Проверяем на EffectError (из api-client) - ВАЖНО: проверяем ДО ApiError
    // EffectError имеет структуру { kind: 'ApiError', status: number, ... }
    // Используем структурное распознавание вместо instanceof
    if (this.isEffectError(originalError)) {
      return this.mapEffectErrorToAuthError(
        originalError as { kind: string; status: number; },
        context,
      );
    }

    // ApiError (стандартный тип) - проверяем ПОСЛЕ EffectError
    if (this.isApiError(originalError)) {
      return this.mapApiCategoryToAuthError(originalError as { category: string; });
    }

    return { type: 'server_error', status: HTTP_STATUS_INTERNAL_SERVER_ERROR };
  }

  private isEffectError(error: unknown): error is { kind: string; status: number; } {
    if (error === null || typeof error !== 'object') {
      logFireAndForget('INFO', 'AuthService: isEffectError - not an object', {
        source: 'AuthService',
        errorType: typeof error,
      });
      return false;
    }
    // Проверяем, что это не Error instance (EffectError - это обычный объект)
    if (error instanceof Error) {
      logFireAndForget('INFO', 'AuthService: isEffectError - is Error instance', {
        source: 'AuthService',
        errorName: error.name,
      });
      return false;
    }
    const errorObj = error as Record<string, unknown>;
    return 'kind' in errorObj
      && 'status' in errorObj
      && typeof errorObj['kind'] === 'string'
      && typeof errorObj['status'] === 'number';
  }

  private isApiError(error: unknown): error is { category: string; } {
    return error !== null && typeof error === 'object' && 'category' in error;
  }

  /**
   * Рекурсивно извлекает оригинальную ошибку из всех инфраструктурных обёрток.
   * Работает с IsolationError, TimeoutError и другими обёртками через cause/originalError.
   * Использует структурное распознавание вместо instanceof для надёжности.
   */
  private unwrapError(error: unknown, maxDepth: number = MAX_ISOLATION_ERROR_DEPTH): unknown {
    let current = error;
    let depth = 0;

    while (depth < maxDepth) {
      // Если это IsolationError, используем специальный unwrap
      if (isIsolationError(current)) {
        logFireAndForget('INFO', 'AuthService: unwrapError - unwrapping IsolationError', {
          source: 'AuthService',
          depth,
          originalErrorType: typeof current.originalError,
        });
        current = current.originalError;
        depth++;
        continue;
      }

      // Проверяем наличие cause (стандартное поле для обёрнутых ошибок)
      if (
        typeof current === 'object'
        && current !== null
        && 'cause' in current
        && (current as { cause: unknown; }).cause !== null
        && (current as { cause: unknown; }).cause !== undefined
      ) {
        logFireAndForget('INFO', 'AuthService: unwrapError - unwrapping cause', {
          source: 'AuthService',
          depth,
        });
        current = (current as { cause: unknown; }).cause;
        depth++;
        continue;
      }

      // Проверяем наличие originalError (альтернативное поле)
      if (
        typeof current === 'object'
        && current !== null
        && 'originalError' in current
        && (current as { originalError: unknown; }).originalError !== null
        && (current as { originalError: unknown; }).originalError !== undefined
      ) {
        logFireAndForget('INFO', 'AuthService: unwrapError - unwrapping originalError', {
          source: 'AuthService',
          depth,
        });
        current = (current as { originalError: unknown; }).originalError;
        depth++;
        continue;
      }

      // Проверяем наличие error (для Effect UnknownException и других обёрток)
      if (
        typeof current === 'object'
        && current !== null
        && 'error' in current
        && (current as { error: unknown; }).error !== null
        && (current as { error: unknown; }).error !== undefined
      ) {
        logFireAndForget('INFO', 'AuthService: unwrapError - unwrapping error field', {
          source: 'AuthService',
          depth,
        });
        current = (current as { error: unknown; }).error;
        depth++;
        continue;
      }

      // Больше нет обёрток - возвращаем текущую ошибку
      break;
    }

    // Логируем overflow для диагностики
    if (depth >= maxDepth) {
      logFireAndForget('WARN', 'AuthService: Error unwrap depth limit reached', {
        source: 'AuthService',
        maxDepth,
        message: 'Error nesting exceeds maximum depth, returning partially unwrapped error',
      });
    }

    return current;
  }

  /** Улучшенная проверка network ошибок (поддержка всех типов) */
  private isNetworkError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
      return false;
    }

    // TypeError с fetch (Node.js, браузер)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // DOMException NetworkError (браузер, polyfills)
    // Защита от SSR: DOMException может быть undefined в Node.js
    if (
      typeof DOMException !== 'undefined'
      && error instanceof DOMException
      && error.name === 'NetworkError'
    ) {
      return true;
    }

    // AbortError (timeout, cancellation)
    if (error.name === 'AbortError') {
      return true;
    }

    // Общие network ошибки по сообщению
    const networkKeywords = ['network', 'connection', 'timeout', 'ECONNREFUSED', 'ENOTFOUND'];
    const lowerMessage = error.message.toLowerCase();
    return networkKeywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()));
  }

  private mapEffectErrorToAuthError(
    effectError: { kind: string; status: number; },
    context?: 'login' | 'refresh' | 'logout',
  ): AuthError {
    if (effectError.kind === 'ApiError' && typeof effectError.status === 'number') {
      const status = effectError.status;

      // 401 семантически разный в зависимости от контекста
      if (status === HTTP_STATUS_UNAUTHORIZED) {
        if (context === 'refresh') {
          return { type: 'token_expired' };
        }
        // login и logout
        return { type: 'invalid_credentials' };
      }

      if (status === HTTP_STATUS_BAD_REQUEST) {
        return { type: 'invalid_credentials' };
      }

      return { type: 'server_error', status };
    }

    return { type: 'server_error', status: HTTP_STATUS_INTERNAL_SERVER_ERROR };
  }

  private mapApiCategoryToAuthError(apiError: { category: string; }): AuthError {
    if (apiError.category === 'AUTH') {
      return { type: 'invalid_credentials' };
    }

    return { type: 'server_error', status: HTTP_STATUS_INTERNAL_SERVER_ERROR };
  }

  /** Проверяет, является ли ошибка 401 Unauthorized */
  /** Проверяет, является ли ошибка уже AuthError */
  private isAuthError(error: unknown): error is AuthError {
    if (error === null || typeof error !== 'object') {
      return false;
    }
    const err = error as { type?: unknown; };
    if (typeof err.type !== 'string') {
      return false;
    }
    return err.type === 'network'
      || err.type === 'invalid_credentials'
      || err.type === 'token_expired'
      || err.type === 'server_error';
  }

  private isUnauthorizedError(error: unknown): boolean {
    // Используем рекурсивный unwrap для извлечения оригинальной ошибки из всех обёрток
    const originalError = this.unwrapError(error);

    if (
      originalError === null || originalError === undefined || typeof originalError !== 'object'
    ) {
      return false;
    }

    // Если это Error instance, не может быть EffectError (EffectError - это обычный объект)
    if (originalError instanceof Error) {
      return false;
    }

    const errorObj = originalError as Record<string, unknown>;

    // Проверяем EffectError через status
    const status = errorObj['status'];
    if (typeof status === 'number' && status === HTTP_STATUS_UNAUTHORIZED) {
      logFireAndForget('INFO', 'AuthService: isUnauthorizedError - found 401 via status', {
        source: 'AuthService',
        status,
      });
      return true;
    }

    // Проверяем ApiError через kind
    const kind = errorObj['kind'];
    if (kind === 'ApiError' && 'status' in errorObj) {
      const apiStatus = errorObj['status'];
      if (typeof apiStatus === 'number' && apiStatus === HTTP_STATUS_UNAUTHORIZED) {
        logFireAndForget('INFO', 'AuthService: isUnauthorizedError - found 401 via kind', {
          source: 'AuthService',
          kind,
          apiStatus,
        });
        return true;
      }
    }

    logFireAndForget('INFO', 'AuthService: isUnauthorizedError - not unauthorized', {
      source: 'AuthService',
      ...(typeof status === 'string' || typeof status === 'number' || typeof status === 'boolean'
        ? { status: String(status) }
        : {}),
      ...(typeof kind === 'string' || typeof kind === 'number' || typeof kind === 'boolean'
        ? { kind: String(kind) }
        : {}),
    });
    return false;
  }

  /** Выполняет вход пользователя. @returns Effect с токенами или ошибкой */
  login(request: LoginRequest): Effect.Effect<AuthError, TokenPairResponse> {
    return Effect.tryPromise(async (): Promise<TokenPairResponse> => {
      logFireAndForget('INFO', 'Auth login: started', {
        source: 'AuthService',
        username: request.username,
      });

      // Создаем Effect для API запроса
      const apiCallEffect: EffectType<CoreTokenPairResponse> = async () => {
        // apiClient.post() возвращает TResponse напрямую или бросает EffectError при ошибке
        return this.apiClient.post<
          { email: string; password: string; },
          CoreTokenPairResponse
        >(
          '/auth/login',
          {
            email: request.username,
            password: request.password,
          },
        );
      };

      // Валидируем ответ через Zod схему
      const validatedApiCall = validatedEffect(
        this.tokenPairResponseSchema,
        apiCallEffect,
        { service: 'AUTH' },
      );

      // Выполняем через orchestrator с timeout и isolation
      const result = await orchestrate([
        step('auth-login', validatedApiCall, API_TIMEOUT_MS),
      ])();

      logFireAndForget('INFO', 'Auth login: completed successfully', {
        source: 'AuthService',
        username: request.username,
      });

      return this.mapCoreTokenResponseToAuthResponse(result as CoreTokenPairResponse);
    }).pipe(
      Effect.mapError((rawError) => {
        // Нормализуем ошибку: извлекаем оригинальную из всех инфраструктурных обёрток
        const error = this.unwrapError(rawError);

        // Если ошибка уже AuthError, возвращаем как есть
        if (this.isAuthError(error)) {
          return error;
        }
        // Остальные ошибки мапим через общий метод
        return this.mapErrorToAuthError(error, 'login');
      }),
    ) as unknown as Effect.Effect<AuthError, TokenPairResponse>;
  }

  /** Обновляет access токен через refresh токен (thread-safe через mutex). */
  refresh(refreshToken: string): Effect.Effect<AuthError, TokenPairResponse> {
    return Effect.tryPromise(async (): Promise<TokenPairResponse> => {
      // Логируем начало ожидания mutex для отладки параллельных refresh
      logFireAndForget('INFO', 'Auth refresh mutex: waiting for access', {
        source: 'AuthService',
        refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
      });

      // Используем mutex для предотвращения параллельных refresh запросов
      return this.refreshMutex.runExclusive(async () => {
        // Логируем получение доступа к mutex
        logFireAndForget('INFO', 'Auth refresh mutex: acquired access', {
          source: 'AuthService',
          refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
        });

        try {
          // Создаем Effect для API запроса
          const apiCallEffect: EffectType<CoreTokenPairResponse> = async () => {
            // apiClient.post() возвращает TResponse напрямую или бросает EffectError при ошибке
            return this.apiClient.post<
              { refresh_token: string; },
              CoreTokenPairResponse
            >(
              '/auth/refresh',
              { refresh_token: refreshToken },
            );
          };

          // Валидируем ответ через Zod схему
          const validatedApiCall = validatedEffect(
            this.tokenPairResponseSchema,
            apiCallEffect,
            { service: 'AUTH' },
          );

          // Выполняем через orchestrator с timeout и isolation
          const apiResult = await orchestrate([
            step('auth-refresh', validatedApiCall, API_TIMEOUT_MS),
          ])();

          const mappedResult = this.mapCoreTokenResponseToAuthResponse(
            apiResult as CoreTokenPairResponse,
          );

          // Логируем успешное завершение refresh
          logFireAndForget('INFO', 'Auth refresh: completed successfully', {
            source: 'AuthService',
            refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
          });

          return mappedResult;
        } finally {
          // Логируем освобождение mutex
          logFireAndForget('INFO', 'Auth refresh mutex: released access', {
            source: 'AuthService',
            refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
          });
        }
      });
    }).pipe(
      Effect.mapError((rawError) => {
        logFireAndForget('INFO', 'AuthService: refresh mapError - raw error received', {
          source: 'AuthService',
          rawErrorType: typeof rawError,
          isIsolationError: isIsolationError(rawError),
          isError: rawError instanceof Error,
          ...(rawError instanceof Error && rawError.name ? { errorName: rawError.name } : {}),
        });

        // Нормализуем ошибку: извлекаем оригинальную из всех инфраструктурных обёрток
        const error = this.unwrapError(rawError);

        logFireAndForget('INFO', 'AuthService: refresh mapError - after unwrap', {
          source: 'AuthService',
          errorType: typeof error,
          isError: error instanceof Error,
          isAuthError: this.isAuthError(error),
          isUnauthorizedError: this.isUnauthorizedError(error),
          hasKind: typeof error === 'object' && error !== null && 'kind' in error,
          hasStatus: typeof error === 'object' && error !== null && 'status' in error,
        });

        // Если ошибка уже AuthError, возвращаем как есть
        if (this.isAuthError(error)) {
          const authError = error;
          logFireAndForget('WARN', 'Auth refresh: failed', {
            source: 'AuthService',
            errorType: authError.type,
            refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
          });
          return authError;
        }

        // Специальный случай для refresh: 401 → token_expired
        // Проверяем ДО общего маппинга, чтобы правильно обработать 401
        if (this.isUnauthorizedError(error)) {
          const authError: AuthError = { type: 'token_expired' };
          logFireAndForget('WARN', 'Auth refresh: failed', {
            source: 'AuthService',
            errorType: authError.type,
            refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
          });
          return authError;
        }

        // Остальные ошибки мапим через общий метод
        const authError = this.mapErrorToAuthError(error, 'refresh');
        logFireAndForget('WARN', 'Auth refresh: failed', {
          source: 'AuthService',
          errorType: authError.type,
          refreshTokenPrefix: `${this.getTokenPrefix(refreshToken)}...`,
        });
        return authError;
      }),
    ) as unknown as Effect.Effect<AuthError, TokenPairResponse>;
  }

  /** Выполняет выход пользователя (локально очищает токены даже при API ошибке). */
  logout(): Effect.Effect<never, void> {
    return Effect.catchAll(
      Effect.tryPromise(async (): Promise<void> => {
        logFireAndForget('INFO', 'Auth logout: started', {
          source: 'AuthService',
        });

        // Создаем Effect для API запроса
        const apiCallEffect: EffectType<void> = async () => {
          // apiClient.post() возвращает TResponse напрямую или бросает EffectError при ошибке
          // Для logout не критичны ошибки - они будут обработаны в catch блоке
          await this.apiClient.post<{}, void>('/auth/logout', {});
          logFireAndForget('INFO', 'Auth logout: completed successfully', {
            source: 'AuthService',
          });
        };

        // Выполняем через orchestrator с timeout и isolation
        // Игнорируем ошибки - logout должен всегда успешно завершаться
        try {
          await orchestrate([
            step('auth-logout', apiCallEffect, API_TIMEOUT_MS),
          ])();
        } catch (orchestratorError) {
          // Логируем ошибку, но не пробрасываем - logout всегда успешен
          const authError = this.mapErrorToAuthError(orchestratorError, 'logout');
          logFireAndForget('WARN', 'Auth logout: orchestrator error (ignored)', {
            source: 'AuthService',
            errorType: authError.type,
          });
        }
      }).pipe(
        Effect.mapError((error) => {
          // Логируем ошибку, но не пробрасываем - logout всегда успешен
          const authError = this.mapErrorToAuthError(error, 'logout');
          logFireAndForget('WARN', 'Auth logout: error (ignored)', {
            source: 'AuthService',
            errorType: authError.type,
          });
          return authError;
        }),
      ),
      () => Effect.succeed(undefined as void), // Всегда успех, игнорируем любые ошибки
    ) as unknown as Effect.Effect<never, void>;
  }
}

/* ============================================================================
 * 🏗️ МОДУЛЬНЫЙ СИНГЛТОН
 * ========================================================================== */

/** Модульный синглтон AuthService (один экземпляр на приложение). */
export const authService = new AuthService();

/* ============================================================================
 * 🏭 FACTORY ДЛЯ DEPENDENCY INJECTION
 * ========================================================================== */

/** Фабрика для создания AuthService с DI (для тестирования). */
export const createAuthService = (apiClient?: ApiClient): AuthService => {
  return new AuthService(apiClient);
};
