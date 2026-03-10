/**
 * @file packages/app/src/types/api.ts
 * ============================================================================
 * 🌐 БАЗОВЫЕ API КОНТРАКТЫ ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Этот файл описывает универсальные типы для взаимодействия с backend
 * микросервисами (REST, WebSocket, SSE).
 *
 * Принципы:
 * - Строгая типизация
 * - Discriminated unions вместо boolean-флагов
 * - Совместимость с микросервисной архитектурой
 * - Готовность к observability, tracing и distributed systems
 * - Zero-runtime-cost, только типы
 */

export type { HttpMethod, ServiceName } from '@livai/core-contracts';
import type { HttpMethod } from '@livai/core-contracts';

import type { ID, ISODateString, Json, Platform } from './common.js';
import type { UiAuthContext } from './ui-contracts.js';

/* ========================================================================== */
/* 🧱 БАЗОВЫЕ HTTP КОНТРАКТЫ */
/* ========================================================================== */

// HttpMethod и ServiceName импортируются из @livai/core-contracts (foundation)

/** Контекст API запроса. Используется для трассировки и авторизации. */
export type ApiRequestContext = {
  /** Уникальный trace-id запроса (для distributed tracing) */
  readonly traceId?: string;

  /** Текущий пользователь/сессия */
  readonly authToken?: string;

  /** Текущая локаль */
  readonly locale?: string;

  /** Платформа клиента (web, pwa, mobile, admin) */
  readonly platform?: Platform;

  /** 🔁 Ключ идемпотентности для критичных write-операций */
  readonly idempotencyKey?: string;
};

/* ========================================================================== */
/* 📦 API RESPONSE (УСИЛЕННЫЙ DISCRIMINATED UNION) */
/* ========================================================================== */

/** Категории ошибок API. Синхронизируются с backend контрактами. */
export type ApiErrorCategory =
  | 'VALIDATION'
  | 'AUTH'
  | 'PERMISSION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'DEPENDENCY'
  | 'INTERNAL';

/** Источник ошибки. Критично для микросервисных систем. */
export type ApiErrorSource =
  | 'CLIENT'
  | 'GATEWAY'
  | 'SERVICE';

/**
 * Универсальная ошибка API.
 * Передаётся между сервисами и фронтендами без потери контекста.
 */
export type ApiError = {
  /** Машинно-обрабатываемый код ошибки */
  readonly code: string;

  /** Категория ошибки */
  readonly category: ApiErrorCategory;

  /** Человекочитаемое сообщение */
  readonly message: string;

  /** Где произошла ошибка */
  readonly source?: ApiErrorSource;

  /** Trace-id для корреляции логов */
  readonly traceId?: string;

  /** Дополнительные данные для логирования и отладки */
  readonly details?: Json;
};

/** Успешный ответ API. */
export type ApiSuccessResponse<T> = {
  readonly success: true;
  readonly data: T;
  readonly meta?: Json;
};

/** Ошибочный ответ API. */
export type ApiFailureResponse = {
  readonly success: false;
  readonly error: ApiError;
  readonly meta?: Json;
};

/** Универсальный ответ API. Используется в api-client, effects и hooks. */
export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiFailureResponse;

/* ========================================================================== */
/* 📊 ПАГИНАЦИЯ И СПИСКИ */
/* ========================================================================== */

/** Параметры пагинации для API запросов. */
export type PaginationParams = {
  readonly limit: number;
  readonly offset: number;
};

/** Контракт пагинированного ответа. */
export type PaginatedResult<T> = {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
};

/* ========================================================================== */
/* 🔄 REALTIME API (WEBSOCKET / SSE) */
/* ========================================================================== */

/**
 * Типизированное realtime событие.
 * Позволяет строго описывать события по каналам.
 *
 * @example
 * RealtimeEvent<"CHAT_MESSAGE", Message>
 */
export type RealtimeEvent<
  TType extends string = string,
  TPayload = Json,
> = {
  /** Тип события */
  readonly type: TType;

  /** Временная метка */
  readonly timestamp: ISODateString;

  /** Payload события */
  readonly payload: TPayload;
};

/** Контракт подписки на realtime события. */
export type RealtimeSubscription = {
  /** Имя канала */
  channel: string;

  /** Отписка от канала */
  unsubscribe: () => void;
};

/* ========================================================================== */
/* 🔁 API REQUEST CONTRACTS */
/* ========================================================================== */

/**
 * Универсальное описание API запроса.
 * Используется api-client для построения вызовов.
 */
export type ApiRequest<TBody = unknown, TQuery = unknown> = {
  method: HttpMethod;
  url: string;
  body?: TBody;
  query?: TQuery;
  headers?: Record<string, string>;
  context?: ApiRequestContext;
  retryPolicy?: ApiRetryPolicy;
  signal?: AbortSignal;
};

/**
 * 🔄 Политика повторов для нестабильных сетей.
 * Используется в mobile и high-load сценариях.
 */
export type ApiRetryPolicy = {
  /** Количество попыток */
  readonly retries: number;

  /** Задержка между попытками в мс */
  readonly backoffMs: number;
};

/** Универсальный API handler. Используется в эффектах. */
export type ApiHandler<TReq, TRes> = (
  request: TReq,
) => Promise<ApiResponse<TRes>>;

/* ========================================================================== */
/* 🧩 DOMAIN-AGNOSTIC DTO КОНТРАКТЫ */
/* ========================================================================== */

/** Базовый DTO для всех API сущностей. Все доменные DTO должны расширять этот контракт. */
export type BaseApiDTO = {
  readonly id: ID;
  readonly createdAt: ISODateString;
  readonly updatedAt?: ISODateString;
};

/** Контракт soft-delete сущностей. */
export type SoftDeletable = {
  readonly deletedAt?: ISODateString;
};

/** Контракт версии сущности. Используется для optimistic locking. */
export type VersionedEntity = {
  readonly version: number;
};

/* ========================================================================== */
/* 🔒 API SECURITY */
/* ========================================================================== */

/** Алиас для UiAuthContext для обратной совместимости */
export type ApiAuthContext = UiAuthContext;

/** Заголовки, используемые во всех сервисах. */
export type ApiHeaders = {
  readonly 'x-trace-id'?: string;
  readonly 'x-request-id'?: string;
  readonly Authorization?: string;
};

/* ========================================================================== */
/* 🧠 OBSERVABILITY */
/* ========================================================================== */

/** Метаданные для мониторинга запросов. */
export type ApiMetrics = {
  /** Время выполнения запроса в мс */
  readonly durationMs: number;

  /** HTTP статус */
  readonly statusCode: number;

  /** Имя сервиса-источника */
  readonly service: string;
};

/* ========================================================================== */
/* 🔧 API CLIENT CONFIGURATION */
/* ========================================================================== */

/** Конфигурация API клиента. Используется для создания экземпляра ApiClient. */
export type ApiClientConfig = {
  /** Базовый URL API */
  readonly baseUrl: string;

  /** Заголовки по умолчанию */
  readonly defaultHeaders?: ApiHeaders;

  /** Таймаут запросов в мс */
  readonly timeoutMs?: number;

  /** Количество повторных попыток */
  readonly retries?: number;

  /** Кастомная реализация fetch */
  readonly fetchImpl?: typeof fetch;

  /**
   * Адаптер для получения access token из feature-auth store.
   * @remarks
   * - Если предоставлен, токен автоматически добавляется в Authorization header.
   * - Поддерживает async получение токенов для SSR (например, fetch из secure memory).
   * - Если токены хранятся в httpOnly cookies, адаптер может не использоваться
   *   (браузер отправляет cookies автоматически).
   * - HTTP-клиент НЕ подписывается напрямую на Zustand-store; доступ к токенам
   *   идёт только через адаптер/порт (функции app-слоя).
   */
  readonly getAccessToken?: () => Promise<string | null>;

  /**
   * Политика повторных попыток для обработки ошибок.
   * @remarks
   * - Если не предоставлена, используется дефолтная логика: retriable из EffectError.
   * - Позволяет кастомизировать retry логику (429, rate limits, exponential backoff и т.д.).
   * - Расширяемость без изменения core логики.
   */
  readonly retryPolicy?: (error: unknown) => boolean;

  /**
   * Хук для трансформации запроса перед отправкой.
   * @remarks
   * - Позволяет модифицировать RequestInit перед fetch (например, добавить correlation ID).
   * - Минимальная расширяемость без overengineering.
   */
  readonly beforeRequest?: (init: RequestInit) => RequestInit;

  /**
   * Хук для трансформации ответа после получения.
   * @remarks
   * - Позволяет модифицировать Response перед парсингом (например, логирование метрик).
   * - Минимальная расширяемость без overengineering.
   */
  readonly afterResponse?: (response: Response) => Response;
};

/* ========================================================================== */
/* 📁 FILE UPLOAD CONTRACTS */
/* ========================================================================== */

/** Domain статус загрузки файла (бизнес-логика) */
export type UploadDomainStatus = 'idle' | 'uploading' | 'success' | 'error';

/** Результат валидации файла */
export type FileValidationResult = Readonly<{
  valid: boolean;
  error?: string;
}>;

/** UI статус файла для отображения (не зависит от Core) */
export type AppFileStatus =
  | Readonly<{ type: 'pending'; label: string; }>
  | Readonly<{ type: 'progress'; label: string; }>
  | Readonly<{ type: 'success'; label: string; }>
  | Readonly<{ type: 'error'; label: string; }>;

export type InternalFileInfo = Readonly<{
  id: string;
  file: File;
  uploadStatus: UploadDomainStatus;
  uploadProgress?: number;
  errorMessage?: string;
}>;
