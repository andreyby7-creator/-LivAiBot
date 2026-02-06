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
import { Mutex } from 'async-mutex';
import { Effect } from 'effect';

import { createApiClient } from './api-client.js';
import type { ApiClient } from './api-client.js';
import { logFireAndForget } from './telemetry.js';

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

/* ============================================================================
 * 🏗️ IMPLEMENTATION
 * ========================================================================== */

/** Сервис аутентификации с потокобезопасным управлением токенами. */
export class AuthService {
  /** Mutex для синхронизации refresh операций */
  private readonly refreshMutex = new Mutex();

  /** API клиент для HTTP запросов */
  private readonly apiClient: ApiClient;

  constructor(apiClientOverride?: ApiClient) {
    // Validate mutex initialization (will be used in refresh method)
    if (!(this.refreshMutex instanceof Mutex)) {
      throw new Error('Mutex initialization failed');
    }

    // Создаем API клиент для auth сервиса (или используем переданный для тестирования)
    this.apiClient = apiClientOverride ?? createApiClient({
      baseUrl: this.getApiBaseUrl(),
    });
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

  /** Runtime validation для CoreTokenPairResponse */
  private validateCoreTokenResponse(data: unknown): asserts data is CoreTokenPairResponse {
    if (data === null || data === undefined || typeof data !== 'object') {
      throw new Error('TokenPair response must be an object');
    }

    const obj = data as Record<string, unknown>;

    const accessToken = obj['access_token'];
    if (typeof accessToken !== 'string' || accessToken.trim() === '') {
      throw new Error('TokenPair response must have valid access_token string');
    }

    const refreshToken = obj['refresh_token'];
    if (typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      throw new Error('TokenPair response must have valid refresh_token string');
    }

    if (obj['token_type'] !== 'bearer') {
      throw new Error('TokenPair response must have token_type "bearer"');
    }

    const expiresIn = obj['expires_in'];
    if (typeof expiresIn !== 'number' || expiresIn < 0) {
      throw new Error('TokenPair response must have non-negative expires_in number');
    }

    const userId = obj['user_id'];
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('TokenPair response must have valid user_id string');
    }

    const workspaceId = obj['workspace_id'];
    if (typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      throw new Error('TokenPair response must have valid workspace_id string');
    }
  }

  /** Преобразует ответ API в формат AuthService */
  private mapCoreTokenResponseToAuthResponse(
    coreResponse: CoreTokenPairResponse,
  ): TokenPairResponse {
    // Runtime validation для безопасности
    this.validateCoreTokenResponse(coreResponse);

    return {
      accessToken: coreResponse.access_token,
      refreshToken: coreResponse.refresh_token,
      expiresAt: Date.now() + Math.max(0, coreResponse.expires_in * MILLISECONDS_PER_SECOND), // expires_in в секундах -> timestamp, защита от отрицательных значений
    };
  }

  /** Преобразует API ошибку в AuthError */
  private mapApiErrorToAuthError(apiError: unknown): AuthError {
    // Проверяем на EffectError (из api-client)
    if (this.isEffectError(apiError)) {
      return this.mapEffectErrorToAuthError(apiError as { kind: string; status: number; });
    }

    // ApiError (стандартный тип)
    if (this.isApiError(apiError)) {
      return this.mapApiCategoryToAuthError(apiError as { category: string; });
    }

    // Network ошибки
    if (this.isNetworkError(apiError)) {
      return { type: 'network', message: 'Network connection failed' };
    }

    return { type: 'server_error', status: HTTP_STATUS_INTERNAL_SERVER_ERROR };
  }

  private isEffectError(error: unknown): error is { kind: string; status: number; } {
    return error !== null && typeof error === 'object' && 'kind' in error && 'status' in error;
  }

  private isApiError(error: unknown): error is { category: string; } {
    return error !== null && typeof error === 'object' && 'category' in error;
  }

  private isNetworkError(error: unknown): error is Error {
    return error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch');
  }

  private mapEffectErrorToAuthError(effectError: { kind: string; status: number; }): AuthError {
    if (effectError.kind === 'ApiError' && typeof effectError.status === 'number') {
      const status = effectError.status;

      if (status === HTTP_STATUS_UNAUTHORIZED) {
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
  private isUnauthorizedError(error: unknown): boolean {
    if (error === null || error === undefined || typeof error !== 'object') {
      return false;
    }

    const errorObj = error as Record<string, unknown>;

    // Проверяем EffectError
    const status = errorObj['status'];
    if (typeof status === 'number' && status === HTTP_STATUS_UNAUTHORIZED) {
      return true;
    }

    // Проверяем ApiError через kind
    const kind = errorObj['kind'];
    if (kind === 'ApiError' && 'status' in errorObj) {
      const apiStatus = errorObj['status'];
      return typeof apiStatus === 'number' && apiStatus === HTTP_STATUS_UNAUTHORIZED;
    }

    return false;
  }

  /** Преобразует неизвестные ошибки в AuthError */
  private mapUnknownErrorToAuthError(error: unknown): AuthError {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { type: 'network', message: error.message };
      }
      // Добавляем поддержку DOMException для SSR/fetch polyfills
      if (error instanceof DOMException && error.name === 'NetworkError') {
        return { type: 'network', message: error.message };
      }
    }

    return { type: 'server_error', status: HTTP_STATUS_INTERNAL_SERVER_ERROR };
  }

  /** Выполняет вход пользователя. @returns Effect с токенами или ошибкой */
  login(request: LoginRequest): Effect.Effect<AuthError, TokenPairResponse> {
    return Effect.flip(
      Effect.tryPromise<TokenPairResponse, AuthError>({
        try: async () => {
          logFireAndForget('INFO', 'Auth login: started', {
            source: 'AuthService',
            username: request.username,
          });

          const response = await this.apiClient.post<
            { email: string; password: string; },
            CoreTokenPairResponse
          >(
            '/auth/login',
            {
              email: request.username,
              password: request.password,
            },
          );

          if (!response.success) {
            const failureResponse = response as { error: unknown; };
            logFireAndForget('WARN', 'Auth login: failed', {
              source: 'AuthService',
              username: request.username,
              error: failureResponse.error,
            });
            throw this.mapApiErrorToAuthError(failureResponse.error);
          }

          logFireAndForget('INFO', 'Auth login: completed successfully', {
            source: 'AuthService',
            username: request.username,
          });

          return this.mapCoreTokenResponseToAuthResponse(response.data);
        },
        catch: (error) => this.mapUnknownErrorToAuthError(error),
      }),
    );
  }

  /** Обновляет access токен через refresh токен (thread-safe через mutex). */
  refresh(refreshToken: string): Effect.Effect<AuthError, TokenPairResponse> {
    return Effect.flip(
      Effect.tryPromise<TokenPairResponse, AuthError>({
        try: async () => {
          // Логируем начало ожидания mutex для отладки параллельных refresh
          logFireAndForget('INFO', 'Auth refresh mutex: waiting for access', {
            source: 'AuthService',
            refreshTokenPrefix: `${refreshToken.substring(0, TOKEN_PREFIX_LENGTH)}...`,
          });

          // Используем mutex для предотвращения параллельных refresh запросов
          return this.refreshMutex.runExclusive(async () => {
            // Логируем получение доступа к mutex
            logFireAndForget('INFO', 'Auth refresh mutex: acquired access', {
              source: 'AuthService',
              refreshTokenPrefix: `${refreshToken.substring(0, TOKEN_PREFIX_LENGTH)}...`,
            });

            try {
              const response = await this.apiClient.post<
                { refresh_token: string; },
                CoreTokenPairResponse
              >(
                '/auth/refresh',
                { refresh_token: refreshToken },
              );

              if (!response.success) {
                const failureResponse = response as { error: unknown; };
                // Если refresh токен недействителен - это специальный случай
                if (this.isUnauthorizedError(failureResponse.error)) {
                  throw { type: 'token_expired' } as AuthError;
                }
                throw this.mapApiErrorToAuthError(failureResponse.error);
              }

              const result = this.mapCoreTokenResponseToAuthResponse(response.data);

              // Логируем успешное завершение refresh
              logFireAndForget('INFO', 'Auth refresh: completed successfully', {
                source: 'AuthService',
                refreshTokenPrefix: `${refreshToken.substring(0, TOKEN_PREFIX_LENGTH)}...`,
              });

              return result;
            } finally {
              // Логируем освобождение mutex
              logFireAndForget('INFO', 'Auth refresh mutex: released access', {
                source: 'AuthService',
                refreshTokenPrefix: `${refreshToken.substring(0, TOKEN_PREFIX_LENGTH)}...`,
              });
            }
          });
        },
        catch: (error) => {
          // Логируем ошибку refresh для отладки
          const authError = typeof error === 'object' && error !== null && 'type' in error
            ? error as AuthError
            : this.mapUnknownErrorToAuthError(error);

          logFireAndForget('WARN', 'Auth refresh: failed', {
            source: 'AuthService',
            errorType: authError.type,
            refreshTokenPrefix: `${refreshToken.substring(0, TOKEN_PREFIX_LENGTH)}...`,
          });

          return authError;
        },
      }),
    );
  }

  /** Выполняет выход пользователя (локально очищает токены даже при API ошибке). */
  logout(): Effect.Effect<AuthError, void> {
    return Effect.flip(
      Effect.tryPromise<void, AuthError>({
        try: async () => {
          logFireAndForget('INFO', 'Auth logout: started', {
            source: 'AuthService',
          });

          const response = await this.apiClient.post<{}, void>('/auth/logout', {});

          if (!response.success) {
            const failureResponse = response as { error: unknown; };
            // Для logout не критичны ошибки - логируем через telemetry
            logFireAndForget('WARN', 'Auth logout: API call failed', {
              source: 'AuthService',
              error: failureResponse.error,
            });
          } else {
            logFireAndForget('INFO', 'Auth logout: completed successfully', {
              source: 'AuthService',
            });
          }

          return undefined;
        },
        catch: (error) => this.mapUnknownErrorToAuthError(error),
      }),
    );
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
