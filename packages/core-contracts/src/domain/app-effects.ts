/**
 * @file @livai/core-contracts/src/domain/app-effects.ts
 *
 * ============================================================================
 * ⚡ APP EFFECTS & ERROR CONTRACTS — КОНТРАКТЫ ДЛЯ ЭФФЕКТОВ И ОШИБОК
 * ============================================================================
 *
 * Минимальный набор типов, необходимых для core effect-слоя и error-mapping.
 * Без доменной логики и runtime-зависимостей.
 *
 * Используется для:
 * - API контракты (ApiRequestContext, ApiError, ApiResponse) для типизации запросов/ответов
 * - Error контракты (AppError, ClientError, ServerError, ValidationError, NetworkError, UnknownError)
 * - Tracing типы (TraceId, IdempotencyKey) для distributed tracing
 * - Error tags для динамической фильтрации и алертинга
 * - Re-export типов из common.ts (ISODateString, Json*) для обратной совместимости
 *
 * Принципы:
 * - Zero business logic
 * - Zero runtime dependencies
 * - Детерминированность
 * - Полная типобезопасность через branded types (TraceId, IdempotencyKey)
 * - Immutability по умолчанию (readonly)
 * - SanitizedJson контракт для предотвращения утечки PII/секретов
 * - Future-proof расширяемость через metadata в ApiResponse
 *
 * Границы слоёв:
 * - @livai/core-contracts (app-effects) — чистый типовой слой, foundation для effect-слоя.
 * - @livai/core (effect) — использует эти контракты для реализации доменной логики и error-mapping.
 * - @livai/app — использует эти контракты для UI и runtime-специфичных модулей.
 *
 * @note Эти типы намеренно дублируют форму типов из @livai/app, но живут в foundation-слое
 *       для независимости core от app и возможности переиспользования в других runtime.
 */

/* ============================================================================
 * 📅 TIME & JSON
 * ============================================================================
 *
 * ВАЖНО:
 * - Этот файл живёт в foundation-слое (@livai/core-contracts) и описывает только
 *   чистые типы/контракты без привязки к runtime / UI / конкретным сервисам.
 * - Слой core/effect использует эти контракты для реализации доменной логики
 *   и обработки ошибок, оставаясь независимым от конкретных платформ.
 * - Слой app добавляет runtime-детали (конкретные transport-клиенты, UI, логирование).
 */

import type {
  ISODateString,
  Json,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ReadonlyJsonObject,
} from './common.js';

// Re-export для обратной совместимости (если где-то используется прямой импорт из app-effects)
export type { ISODateString, Json, JsonArray, JsonObject, JsonPrimitive, JsonValue };

/* ============================================================================
 * 🧩 TRACING & ERROR TAGS
 * ============================================================================
 */

/**
 * Branded trace-id для distributed tracing.
 * ВАЖНО: traceId предназначен для корреляции логов между frontend/backend
 * и не должен логироваться в публичные логи или отображаться пользователю.
 */
export type TraceId = string & { readonly __brand: 'TraceId'; };

/**
 * Branded-тип для ключа идемпотентности.
 * Используется только для критичных write-операций.
 */
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey'; };

/**
 * SanitizedJson — JSON без PII/секретов.
 * Контракт: сюда нельзя класть чувствительные данные (пароли, токены, email и т.п.).
 */
export type SanitizedJson = Json;

/**
 * Тег ошибки для динамической фильтрации/алертинга.
 * Рекомендуемый формат: "service:<name>", "severity:<level>", "feature:<name>".
 */
export type ErrorTag = string;

/**
 * Набор рекомендуемых тегов ошибок.
 * Используйте эти константы для гарантированной консистентности в алертинге/логах.
 */
export const ERROR_TAGS = {
  service: {
    billing: 'service:billing',
    auth: 'service:auth',
    core: 'service:core',
    web: 'service:web',
  },
  severity: {
    critical: 'severity:critical',
    high: 'severity:high',
    medium: 'severity:medium',
    low: 'severity:low',
  },
  feature: {
    authLogin: 'feature:auth-login',
    authRegister: 'feature:auth-register',
    bots: 'feature:bots',
    conversations: 'feature:conversations',
  },
} as const;

/**
 * Известные (зарегистрированные) теги ошибок.
 * Подходит для строгих мест (алерты, метрики), где нужны только whitelisted-теги.
 */
export type KnownErrorTag =
  | (typeof ERROR_TAGS.service)[keyof typeof ERROR_TAGS.service]
  | (typeof ERROR_TAGS.severity)[keyof typeof ERROR_TAGS.severity]
  | (typeof ERROR_TAGS.feature)[keyof typeof ERROR_TAGS.feature];

/* ============================================================================
 * 🌐 API CONTRACTS (СОВМЕСТИМЫЕ С packages/app/src/types/api.ts)
 * ========================================================================== */

/** Контекст API запроса. Используется для трассировки и авторизации. */
export interface ApiRequestContext {
  /** Уникальный trace-id запроса (для distributed tracing) */
  readonly traceId?: TraceId;

  /** Текущий пользователь/сессия */
  readonly authToken?: string;

  /** Текущая локаль */
  readonly locale?: string;

  /** Платформа клиента (web, pwa, mobile, admin) */
  readonly platform?: string;

  /** 🔁 Ключ идемпотентности для критичных write-операций */
  readonly idempotencyKey?: IdempotencyKey;
}

/** Категории ошибок API. */
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

/** Источник ошибки API. */
export type ApiErrorSource =
  | 'CLIENT'
  | 'GATEWAY'
  | 'SERVICE';

/** Универсальная ошибка API. */
export interface ApiError {
  /** Машинно-обрабатываемый код ошибки */
  readonly code: string;

  /** Категория ошибки */
  readonly category: ApiErrorCategory;

  /** Человекочитаемое сообщение */
  readonly message: string;

  /** Где произошла ошибка */
  readonly source?: ApiErrorSource;

  /** Trace-id для корреляции логов */
  readonly traceId?: TraceId;

  /**
   * Дополнительные данные для логирования и отладки.
   * ВАЖНО: только SanitizedJson — без PII/секретов.
   */
  readonly details?: SanitizedJson;

  /**
   * Дополнительные структурированные данные для расширения контракта
   * без изменения union-типов.
   * Immutable JSON-объект для явной фиксации immutability.
   */
  readonly meta?: ReadonlyJsonObject;

  /**
   * Теги для динамической фильтрации/алертинга.
   * Формат тегов: "service:<name>", "severity:<level>", "feature:<name>" и т.п.
   */
  readonly tags?: readonly ErrorTag[];
}

/** Успешный ответ API. */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  /** Immutable JSON-объект для явной фиксации immutability. */
  readonly meta?: ReadonlyJsonObject;
}

/** Ошибочный ответ API. */
export interface ApiFailureResponse {
  readonly success: false;
  readonly error: ApiError;
  /** Immutable JSON-объект для явной фиксации immutability. */
  readonly meta?: ReadonlyJsonObject;
}

/** Универсальный ответ API. */
export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiFailureResponse;

/** Результат валидации файла (совместим с packages/app/src/types/api.ts) */
export type FileValidationResult = Readonly<{
  valid: boolean;
  error?: string;
}>;

/* ============================================================================
 * ❌ APP ERROR CONTRACTS (СОВМЕСТИМЫЕ С packages/app/src/types/errors.ts)
 * ========================================================================== */

/** Источник ошибки для frontend. */
export type FrontendErrorSource =
  | 'UI'
  | 'NETWORK'
  | 'VALIDATION'
  | 'AUTH'
  | 'UNKNOWN';

/** Ошибка, вызванная некорректным действием пользователя. */
export interface ClientError {
  readonly type: 'ClientError';
  readonly severity: 'warning';
  readonly source: FrontendErrorSource;
  readonly code: string;
  readonly message: string;
  /** Immutable JSON-объект для явной фиксации immutability. */
  readonly context?: ReadonlyJsonObject;
  /** Trace-id для корреляции с backend-логами (не показывать пользователю). */
  readonly traceId?: TraceId;
  /**
   * Теги для динамической фильтрации/алертинга.
   * Формат тегов: "service:<name>", "severity:<level>", "feature:<name>" и т.п.
   */
  readonly tags?: readonly ErrorTag[];
  readonly timestamp: ISODateString;
}

/** Ошибка валидации данных (формы, payload, API request). */
export interface ValidationError {
  readonly type: 'ValidationError';
  readonly severity: 'warning';
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly message: string;
  /** Trace-id для корреляции с backend-логами (не показывать пользователю). */
  readonly traceId?: TraceId;
  readonly tags?: readonly ErrorTag[];
  readonly timestamp: ISODateString;
}

/** Ошибка сети или отказ backend сервиса. */
export interface NetworkError {
  readonly type: 'NetworkError';
  readonly severity: 'error';
  readonly statusCode?: number;
  readonly message: string;
  readonly endpoint?: string;
  readonly platform?: string;
  /** Trace-id для корреляции с backend-логами (не показывать пользователю). */
  readonly traceId?: TraceId;
  readonly tags?: readonly ErrorTag[];
  readonly timestamp: ISODateString;
}

/** Ошибка, возвращаемая backend сервисом через API контракт. */
export interface ServerError {
  readonly type: 'ServerError';
  readonly severity: 'error';
  readonly apiError: ApiError;

  /** Имя backend-сервиса, вернувшего ошибку (например, "billing", "auth"). */
  readonly serviceName?: string;

  /** Операция/endpoint внутри сервиса (например, "CreateInvoice", "POST /v1/invoices"). */
  readonly operation?: string;

  readonly endpoint?: string;
  readonly platform?: string;
  /** Дополнительные структурированные данные для расширения контракта. Immutable JSON-объект для явной фиксации immutability. */
  readonly meta?: ReadonlyJsonObject;
  /**
   * Теги для динамической фильтрации/алертинга.
   * Формат тегов: "service:<name>", "severity:<level>", "feature:<name>" и т.п.
   */
  readonly tags?: readonly ErrorTag[];
  readonly timestamp: ISODateString;
}

/** Ошибка, которая не подпадает под известные категории. */
export interface UnknownError {
  readonly type: 'UnknownError';
  readonly severity: 'error';
  readonly message: string;
  readonly original?: unknown;
  /** Trace-id для корреляции с backend-логами (не показывать пользователю). */
  readonly traceId?: TraceId;
  readonly tags?: readonly ErrorTag[];
  readonly timestamp: ISODateString;
}

/** Универсальный контракт ошибки приложения. */
export type AppError =
  | ClientError
  | ServerError
  | ValidationError
  | NetworkError
  | UnknownError;

/** Код ошибки для error-boundary маппинга. */
export type ErrorBoundaryErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';
