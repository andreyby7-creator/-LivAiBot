/**
 * @file packages/app/src/types/common.ts
 * ============================================================================
 * 🧱 ОБЩИЕ ТИПЫ ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Этот файл содержит фундаментальные типы, которые:
 * - Не зависят от конкретных доменов (auth, bots, chat и т.д.)
 * - Используются всеми feature-пакетами и инфраструктурными слоями
 * - Подходят для микросервисной архитектуры
 * - Устойчивы к росту системы и расширению на новые платформы
 *
 * Принципы:
 * - Минимум связей
 * - Максимум переиспользования
 * - Чёткая семантика
 */

/* ========================================================================== */
/* 🔑 БАЗОВЫЕ УТИЛИТАРНЫЕ ТИПЫ */
/* ========================================================================== */

// Импортируем фундаментальные типы из core-contracts
import type {
  ID,
  ISODateString,
  Json,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ReadonlyJsonObject,
  TraceId,
} from '@livai/core-contracts';

// Re-export для обратной совместимости
export type { ID, ISODateString, Json, JsonArray, JsonObject, JsonPrimitive, JsonValue, TraceId };

/** Nullable helper. */
export type Nullable<T> = T | null;

/** Optional helper. */
export type Optional<T> = T | undefined;

/** Maybe helper - объединяет null и undefined. Полезно для API ответов и Effect паттернов. */
export type Maybe<T> = T | null | undefined;

/**
 * Deep readonly helper. Используется для иммутабельных DTO.
 * Для JSON payload использует ReadonlyJsonObject для более строгой типизации.
 *
 * @note Для JSON-объектов применяется ReadonlyJsonObject для явной фиксации immutability
 *       и предотвращения случайных мутаций в runtime.
 */
export type Immutable<T> = T extends Function ? T
  : T extends JsonObject ? ReadonlyJsonObject
  : T extends JsonArray ? readonly Immutable<JsonValue>[]
  : T extends (infer U)[] ? readonly Immutable<U>[]
  : T extends object ? { readonly [K in keyof T]: Immutable<T[K]>; }
  : T;

/* ========================================================================== */
/* 🌍 ПЛАТФОРМЕННЫЕ ТИПЫ */
/* ========================================================================== */

/**
 * Поддерживаемые платформы клиента.
 * Позволяет feature-пакетам адаптировать поведение под среду выполнения.
 */
export type Platform = 'web' | 'pwa' | 'mobile' | 'admin';

/**
 * Контекст исполнения приложения.
 * Может расширяться в будущем (например, для A/B тестов или tenant-режима).
 */
export type AppContext = {
  platform: Platform;
  locale: string; // RFC 5646: en-US, ru-RU
  timezone?: string; // IANA: Europe/Riga
  tenantId?: ID<'Tenant'>;
  experimentGroup?: string;
};

/* ========================================================================== */
/* 📦 БАЗОВЫЕ КОНТРАКТЫ ДЛЯ МИКРОСЕРВИСОВ */
/* ========================================================================== */

/**
 * Базовый контракт для всех API DTO.
 * Все входные/выходные модели микросервисов должны его расширять.
 *
 * @example
 * type UserDTO = BaseDTO<'User'> & { name: string; email: string; };
 */
export type BaseDTO<IDType extends string = string> = {
  /** Уникальный идентификатор объекта */
  id: ID<IDType>;

  /** Дата создания в ISO формате */
  createdAt: ISODateString;

  /** Дата последнего обновления */
  updatedAt?: ISODateString;
};

/** Контракт для пагинированных ответов API. */
export type PaginatedResponse<T> = {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
};

/** Успешный ответ API. */
export type ApiSuccess<T> = {
  readonly success: true;
  readonly data: T;
  readonly meta?: Json;
};

/** Ошибочный ответ API. */
export type ApiFailure = {
  readonly success: false;
  readonly error: ApiError;
  readonly meta?: Json;
};

/**
 * Контракт стандартного API ответа с дискриминацией.
 * Предотвращает несогласованные состояния (success=true без data).
 *
 * @example
 * const response: ApiResponse<User[]> =
 *   { success: true, data: users, meta: { total: 100 } } |
 *   { success: false, error: apiError, meta: { traceId: "abc" } };
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/* ========================================================================== */
/* ❌ ОШИБКИ И СОСТОЯНИЯ */
/* ========================================================================== */

/** Категории ошибок. Совместимо с backend-кодами микросервисов. */
export type ErrorCategory =
  | 'VALIDATION'
  | 'AUTH'
  | 'PERMISSION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'INTERNAL';

/** Источник ошибки для distributed tracing. */
export type ErrorSource = 'CLIENT' | 'GATEWAY' | 'SERVICE';

/** Универсальная ошибка API с поддержкой distributed tracing. */
export type ApiError = {
  /** Машинно-обрабатываемый код */
  code: string;

  /** Категория ошибки */
  category: ErrorCategory;

  /** Человекочитаемое сообщение */
  message: string;

  /** Источник ошибки для observability */
  source?: ErrorSource;

  /** Trace ID для distributed tracing (branded type для type-safety) */
  traceId?: TraceId;

  /** Дополнительные данные для логирования и аналитики */
  details?: Json;

  /** Причина ошибки для Effect error chaining */
  cause?: unknown;
};

/** Состояние асинхронного процесса. Используется в store, hooks и UI. */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/** Состояние ожидания асинхронного процесса. */
export type AsyncIdle = { status: 'idle'; };

/** Состояние выполнения асинхронного процесса. */
export type AsyncLoading = { status: 'loading'; };

/** Успешное завершение асинхронного процесса. */
export type AsyncSuccess<T> = { status: 'success'; data: T; };

/** Ошибка в асинхронном процессе. */
export type AsyncError = { status: 'error'; error: ApiError; };

/**
 * Универсальный контейнер состояния запроса с дискриминацией.
 * Предотвращает несогласованные состояния (success без data, error без error).
 *
 * @example
 * const state: AsyncState<User> =
 *   { status: "idle" } |
 *   { status: "loading" } |
 *   { status: "success"; data: user } |
 *   { status: "error"; error: apiError };
 */
export type AsyncState<T> =
  | AsyncIdle
  | AsyncLoading
  | AsyncSuccess<T>
  | AsyncError;

/* ========================================================================== */
/* 🔁 EVENT-DRIVEN И REALTIME */
/* ========================================================================== */

/**
 * Тип события, приходящего по WebSocket/SSE с типизированным каналом.
 *
 * @example
 * RealtimeEvent<"CHAT_MESSAGE", Message>
 * RealtimeEvent<"USER_JOINED", { userId: UserID }>
 */
export type RealtimeEvent<
  TType extends string = string,
  TPayload = Json,
> = {
  /** Типизированный тип события */
  readonly type: TType;

  /** Временная метка */
  readonly timestamp: ISODateString;

  /** Payload события */
  readonly payload: TPayload;
};

/** Подписка на события. */
export type Subscription = {
  readonly channel: string;
  readonly unsubscribe: VoidFn;
};

/* ========================================================================== */
/* 🔒 SECURITY & FEATURE FLAGS */
/* ========================================================================== */

/** Контекст авторизации. Используется feature-auth и api-client. */
export type AuthContext =
  | { isAuthenticated: false; }
  | {
    isAuthenticated: true;
    accessToken: string;
    refreshToken?: string;
  };

/** Универсальный формат feature-флагов. */
export type FeatureFlags = Record<string, boolean>;

/* ========================================================================== */
/* 🧩 UTILITY CONTRACTS */
/* ========================================================================== */

/** Функция без аргументов. */
export type VoidFn = () => void;

/** Функция-обработчик с параметром. */
export type Handler<T> = (value: T) => void;

/** Универсальный тип для идентифицируемых сущностей. */
export type Identifiable = {
  id: ID;
};

/** Контракт для логируемых сущностей. */
export type Loggable = {
  toLog(): Json;
};

/** Асинхронная функция без параметров. */
export type AsyncFn<T> = () => Promise<T>;

/* ========================================================================== */
/* 🛣️ ROUTING И НАВИГАЦИЯ */
/* ========================================================================== */

/** Роли пользователей в системе. Enum обеспечивает лучшую автокомплитацию и предотвращает опечатки. */
export enum UserRoles {
  GUEST = 'GUEST',
  USER = 'USER',
  PREMIUM_USER = 'PREMIUM_USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
  PARTICIPANT = 'PARTICIPANT',
  SUPER_ADMIN = 'SUPER_ADMIN',
  SYSTEM = 'SYSTEM',
}

/** Все доступные роли пользователей (для exhaustive проверок). */
export const AllUserRoles = Object.values(UserRoles) as readonly UserRoles[];

/**
 * Branded type для ID роли пользователя.
 * Обеспечивает полную type-safety для feature flag checks и route guards.
 */
export type UserRoleID = ID<'UserRole'>;

/**
 * Branded type для ID модуля приложения.
 * Обеспечивает полную type-safety для feature flag checks и route guards.
 */
export type AppModuleID = ID<'AppModule'>;

/** Вспомогательный тип для exhaustive проверки ролей. Гарантирует, что все роли из UserRoles учтены в массиве. */
export type ExhaustiveRoleCheck<T extends readonly UserRoles[]> = T extends
  readonly [UserRoles, ...UserRoles[]] ? T['length'] extends typeof AllUserRoles.length ? T
  : never
  : never;

/** Модули/фичи приложения для категоризации маршрутов. Enum обеспечивает лучшую автокомплитацию и type-safety. */
export enum AppModules {
  AUTH = 'auth',
  BOTS = 'bots',
  CHAT = 'chat',
  BILLING = 'billing',
}

/**
 * Конфигурация маршрута приложения.
 * Описывает метаданные для декларативной маршрутизации.
 *
 * @template TMeta - Опциональный тип метаданных для future-proof расширения конфигурации маршрута
 *                   без изменения базовой структуры. Позволяет добавлять route-specific metadata
 *                   (breadcrumbs, analytics, permissions и т.п.) без breaking changes.
 */
export type RouteConfig<TMeta extends ReadonlyJsonObject = ReadonlyJsonObject> = {
  /** Путь маршрута (например, '/login', '/bots/:botId') */
  readonly path: string;

  /** Уникальный идентификатор маршрута для поиска и ссылок */
  readonly name: string;

  /** Модуль/фича приложения, к которому относится маршрут */
  readonly module: AppModules;

  /** Требует ли маршрут аутентификации */
  readonly protected: boolean;

  /** Список ролей, которым разрешен доступ (только если protected: true) */
  readonly allowedRoles?: readonly UserRoles[];

  /** Опциональные метаданные для расширения конфигурации маршрута */
  readonly meta?: TMeta;
};
