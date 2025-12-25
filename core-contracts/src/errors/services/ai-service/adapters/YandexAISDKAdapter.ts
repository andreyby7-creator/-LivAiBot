/**
 * @file YandexAISDKAdapter.ts
 *
 * Адаптер Yandex AI SDK.
 *
 * Назначение:
 *  - Инкапсуляция работы с Yandex AI SDK
 *  - Mapping SDK ошибок в доменные typed errors
 *  - Трансформация request / response форматов
 *  - Управление таймаутами и отказоустойчивостью
 *  - Подготовка к connection pooling и retries
 *
 * Архитектурные принципы:
 *  - SDK isolation
 *  - Transport-agnostic
 *  - Typed error boundary
 *  - Effect-first design
 */

import { Context, Duration, Effect, Layer } from 'effect';

// ==================== ДОМЕННЫЕ ТИПЫ ====================

/** Входной запрос к AI */
export type AICompletionRequest = {
  readonly prompt: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly metadata?: Record<string, unknown>;
};

/** Ответ AI */
export type AICompletionResponse = {
  readonly text: string;
  readonly model: string;
  readonly usage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalTokens?: number;
  } | undefined;
  /** Raw SDK response (for debugging / observability only) */
  readonly raw?: unknown;
};

// ==================== ОШИБКИ АДАПТЕРА ====================

/** Базовая ошибка Yandex AI адаптера */
export type YandexAIAdapterError =
  | {
    readonly _tag: 'Yandex.ConnectionError';
    readonly message: string;
    readonly cause?: unknown;
  }
  | {
    readonly _tag: 'Yandex.InvalidRequestError';
    readonly message: string;
    readonly details?: unknown;
  }
  | {
    readonly _tag: 'Yandex.UnauthorizedError';
    readonly message: string;
  }
  | {
    readonly _tag: 'Yandex.QuotaExceededError';
    readonly message: string;
  }
  | {
    readonly _tag: 'Yandex.UnknownError';
    readonly message: string;
    readonly cause?: unknown;
  };

// ==================== КОНФИГУРАЦИЯ ====================

/** Конфигурация адаптера */
export type YandexAISDKAdapterConfig = {
  /** Таймаут запроса */
  readonly requestTimeoutMs: number;
  /** Идентификатор модели */
  readonly model: string;
};

// ==================== SDK АБСТРАКЦИЯ ====================

/**
 * Минимальный контракт Yandex AI SDK.
 *
 * Изолирует внешний SDK от доменной логики.
 */
export type YandexAISDK = {
  readonly complete: (params: {
    prompt: string;
    temperature?: number;
    maxTokens?: number;
  }) => Promise<{
    text: string;
    model: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }>;
};

type YandexAISDKResponse = Awaited<ReturnType<YandexAISDK['complete']>>;

// ==================== CONTEXT ====================

/** Context для внедрения SDK */
export const yandexAISDKContext = Context.GenericTag<YandexAISDK>('YandexAISDK');

/** Context для конфигурации */
export const yandexAIConfigContext = Context.GenericTag<YandexAISDKAdapterConfig>('YandexAIConfig');

// ==================== ERROR MAPPING ====================

/**
 * Преобразует ошибки SDK в доменные ошибки.
 */
export function mapSDKError(error: unknown): YandexAIAdapterError {
  if (typeof error !== 'object' || error === null) {
    return {
      _tag: 'Yandex.UnknownError',
      message: 'Unknown non-object error',
      cause: error,
    } as const;
  }

  const e = error as Record<string, unknown>;
  const code = typeof e['code'] === 'string' ? e['code'] : undefined;

  switch (code) {
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ECONNRESET':
    case 'ETIMEDOUT':
      return {
        _tag: 'Yandex.ConnectionError',
        message: `Connection failed to Yandex AI: ${code}`,
        cause: error,
      } as const;

    case 'UNAUTHORIZED':
      return {
        _tag: 'Yandex.UnauthorizedError',
        message: 'Unauthorized request to Yandex AI',
      } as const;

    case 'QUOTA_EXCEEDED':
      return {
        _tag: 'Yandex.QuotaExceededError',
        message: 'Yandex AI quota exceeded',
      } as const;

    case 'INVALID_ARGUMENT':
      return {
        _tag: 'Yandex.InvalidRequestError',
        message: 'Invalid request to Yandex AI',
        details: e,
      } as const;

    default:
      return {
        _tag: 'Yandex.UnknownError',
        message: 'Unhandled Yandex AI SDK error',
        cause: error,
      } as const;
  }
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

/**
 * Создаёт Effect-адаптер для Yandex AI SDK.
 */
export const yandexAISDKAdapter = {
  /**
   * Выполняет completion запрос к Yandex AI.
   */
  complete(
    request: AICompletionRequest,
  ): Effect.Effect<
    AICompletionResponse,
    YandexAIAdapterError,
    YandexAISDK | YandexAISDKAdapterConfig
  > {
    return Effect.gen(function*() {
      const sdk = yield* yandexAISDKContext;
      const config = yield* yandexAIConfigContext;

      const effect = Effect.tryPromise({
        try: () =>
          sdk.complete({
            prompt: request.prompt,
            ...(request.temperature !== undefined && { temperature: request.temperature }),
            ...(request.maxTokens !== undefined && { maxTokens: request.maxTokens }),
          }),
        catch: mapSDKError,
      });

      const response = yield* effect.pipe(
        Effect.timeoutFail({
          duration: Duration.millis(config.requestTimeoutMs),
          onTimeout: () => ({
            _tag: 'Yandex.UnknownError' as const,
            message: `Yandex AI request timeout after ${config.requestTimeoutMs}ms`,
            cause: undefined,
          }),
        }),
      );

      const sdkResponse: YandexAISDKResponse = response;
      return {
        text: sdkResponse.text,
        model: sdkResponse.model || config.model,
        usage: sdkResponse.usage,
        raw: response,
      };
    });
  },
};

// ==================== LAYERS ====================

/**
 * Создаёт слой конфигурации адаптера.
 */
export const createYandexAIConfigLayer = (
  config: YandexAISDKAdapterConfig,
): Layer.Layer<never, never, YandexAISDKAdapterConfig> =>
  Layer.effect(yandexAIConfigContext, Effect.succeed(config));

/**
 * Создаёт слой SDK.
 *
 * SDK передаётся извне (infra слой).
 */
export const createYandexAISDKLayer = (
  sdk: YandexAISDK,
): Layer.Layer<never, never, YandexAISDK> => Layer.effect(yandexAISDKContext, Effect.succeed(sdk));
