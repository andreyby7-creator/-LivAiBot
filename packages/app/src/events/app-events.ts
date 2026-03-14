/**
 * @file packages/app/src/events/app-events.ts
 * =============================================================================
 * 📡 APP EVENTS — ДОМАШНЯЯ СХЕМА СОБЫТИЙ С ПОЛНОЙ ВАЛИДАЦИЕЙ, AUDIT LOG И MICROSERVICE PUSH
 * =============================================================================
 *
 * Архитектурная роль:
 * - Централизованная схема событий приложения для audit log и микросервисной интеграции.
 * - Инкапсулирует создание типизированных событий с полной валидацией payload через Zod.
 * - Предоставляет type-safe фабрики событий (createLoginEvent, createLogoutEvent, etc.) и type guards.
 * - Автоматическое логирование в production через telemetry runtime.
 *
 * Инварианты:
 * - ❌ Нет бизнес-логики обработки событий (только создание и валидация структуры).
 * - ❌ Нет прямых зависимостей от конкретных брокеров сообщений (только через DI-порт pushToQueue).
 * - ❌ Нет UI-логики и derived-состояния (только чистые данные событий).
 * - ✅ Type-safe: все события типизированы через discriminated union и type guards.
 * - ✅ Версионируемо: payloadVersion и eventVersion для безопасной эволюции схем.
 * - ✅ Observability-ready: автоматическое логирование через telemetry runtime в production.
 * - ✅ Microservice-ready: события готовы для push в Kafka/RabbitMQ через DI-порт.
 * - ✅ Testable: dependency injection для pushToQueue позволяет мокировать в тестах.
 *
 * Расширяемость:
 * - Новые типы событий добавляются через расширение `AppEventType` enum и создание соответствующих схем/фабрик.
 * - Версионирование payload: при изменении структуры payload повышать `payloadVersion` в схеме Zod.
 * - Мета-информация расширяется через опциональный параметр `meta` с произвольными полями.
 * - Push в очередь инжектируется через `EventDeps` (по умолчанию используется `pushToQueue`).
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type { TelemetryMetadata } from '@livai/core-contracts';

import { infoFireAndForget, warnFireAndForget } from '../lib/telemetry-runtime.js';
import { UserRoles } from '../types/common.js';

/* ========================================================================== */
/* 🧩 КОНСТАНТЫ И ТИПЫ */
/* ========================================================================== */

/** Типы событий приложения (enum для автокомплита и защиты от опечаток) */
export const enum AppEventType {
  /** Пользователь вошёл в систему */
  AuthLogin = 'auth.login',
  /** Пользователь вышел из системы */
  AuthLogout = 'auth.logout',
  /** Истёк токен авторизации */
  AuthExpired = 'auth.expired',
  /** Изменился тариф / биллинг */
  BillingChanged = 'billing.changed',
}

/** Версии схем событий для evolution */
export const eventSchemaVersions = {
  [AppEventType.AuthLogin]: 1,
  [AppEventType.AuthLogout]: 1,
  [AppEventType.AuthExpired]: 1,
  [AppEventType.BillingChanged]: 1,
} as const;

/**
 * Тип инициатора события. Принимает любые строки для гибкости,
 * но рекомендуется использовать стандартные значения для консистентности
 *
 * @example 'UI' - пользовательский интерфейс
 * @example 'Worker' - фоновый воркер
 * @example 'Cron' - запланированная задача
 * @example 'api' - внешний API вызов
 */
export type EventInitiator = string;

/* ========================================================================== */
/* 🔐 SCHEMAS PAYLOAD */
/* ========================================================================== */

/**
 * Схема payload события входа пользователя
 * @version 1 - Начальная версия схемы
 * При изменении структуры payload повышать payloadVersion
 */
export const LoginEventPayloadSchema = z.object({
  payloadVersion: z.literal(1),
  userId: z.string(),
  roles: z.array(z.enum(Object.values(UserRoles))),
  method: z.enum(['email', 'oauth', 'sso', 'api_key']),
  source: z.string().optional(),
});

/**
 * Схема payload события выхода пользователя
 * @version 1 - Начальная версия схемы
 * При изменении структуры payload повышать payloadVersion
 */
export const LogoutEventPayloadSchema = z.object({
  payloadVersion: z.literal(1),
  userId: z.string(),
  roles: z.array(z.enum(Object.values(UserRoles))),
  reason: z.enum(['manual', 'security', 'system']),
  source: z.string().optional(),
});

/**
 * Схема payload события истечения авторизации
 * @version 1 - Начальная версия схемы
 * При изменении структуры payload повышать payloadVersion
 */
export const AuthExpiredEventPayloadSchema = z.object({
  payloadVersion: z.literal(1),
  userId: z.string(),
  reason: z.enum(['token_expired', 'revoked', 'invalid']),
  source: z.string().optional(),
});

/**
 * Схема payload события изменения биллинга
 * @version 1 - Начальная версия схемы
 * При изменении структуры payload повышать payloadVersion
 */
export const BillingChangedEventPayloadSchema = z.object({
  payloadVersion: z.literal(1),
  userId: z.string(),
  plan: z.string(),
  previousPlan: z.string().optional(),
  reason: z.enum(['upgrade', 'downgrade', 'renewal', 'cancellation']),
  source: z.string().optional(),
});

/* ========================================================================== */
/* 🔗 TYPES FROM SCHEMA */
/* ========================================================================== */

export type LoginEventPayload = z.infer<typeof LoginEventPayloadSchema>;
export type LogoutEventPayload = z.infer<typeof LogoutEventPayloadSchema>;
export type AuthExpiredEventPayload = z.infer<typeof AuthExpiredEventPayloadSchema>;
export type BillingChangedEventPayload = z.infer<typeof BillingChangedEventPayloadSchema>;

/** Базовый контракт события приложения */
export type BaseAppEvent<TType extends AppEventType, TPayload> = {
  readonly type: TType;
  readonly version: '1.0.0'; // Версия контракта события (breaking changes)
  readonly eventVersion: number; // Версия payload schema (для evolution)
  readonly timestamp: string;
  readonly payload: TPayload;
  readonly meta?: {
    correlationId?: string;
    source?: string;
    initiator?: EventInitiator;
    [key: string]: unknown;
  };
};

/* ========================================================================== */
/* 🔐 EVENTS */
/* ========================================================================== */

export type LoginEvent = BaseAppEvent<AppEventType.AuthLogin, LoginEventPayload>;
export type LogoutEvent = BaseAppEvent<AppEventType.AuthLogout, LogoutEventPayload>;
export type AuthExpiredEvent = BaseAppEvent<AppEventType.AuthExpired, AuthExpiredEventPayload>;
export type BillingChangedEvent = BaseAppEvent<
  AppEventType.BillingChanged,
  BillingChangedEventPayload
>;
export type AppEvent = LoginEvent | LogoutEvent | AuthExpiredEvent | BillingChangedEvent;

/* ========================================================================== */
/* 🏭 EVENT FACTORIES + AUDIT LOG MICROSERVICE PUSH */
/* ========================================================================== */

/** Зависимости для создания событий (для тестирования и расширяемости) */
export type EventDeps = {
  pushToQueue: (event: BaseAppEvent<AppEventType, unknown>) => Promise<void>;
};

/** Генерация ISO timestamp */
function now(): string {
  return new Date().toISOString();
}

/** Создаёт мета-информацию для события (observability, tracing) */
function createMeta(
  meta?: BaseAppEvent<AppEventType, unknown>['meta'], // дополнительные данные
  initiator: EventInitiator = 'UI', // инициатор события (UI, Worker, Cron)
): NonNullable<BaseAppEvent<AppEventType, unknown>['meta']> {
  return {
    correlationId: meta?.correlationId ?? uuidv4(),
    source: process.env['APP_EVENT_SOURCE'] ?? 'app',
    initiator,
    ...meta,
  };
}

/** Логирует создание события (development или production) */
function logEventCreation<TType extends AppEventType>(
  type: TType, // тип события
  event: BaseAppEvent<TType, unknown>, // созданное событие
): void {
  if (process.env['NODE_ENV'] !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[AuditLog] Event created: ${type} @ ${event.timestamp}`);
    return;
  }

  // Интеграция с продакшен Logger/Observability через telemetry runtime
  const metadata: TelemetryMetadata = {
    component: 'app-events',
    eventType: type,
    timestamp: event.timestamp,
    ...(event.meta?.correlationId != null && { correlationId: event.meta.correlationId }),
    ...(event.meta?.source != null && { source: event.meta.source }),
    ...(event.meta?.initiator != null && { initiator: event.meta.initiator }),
  };
  infoFireAndForget('Event created', metadata);
}

/** Обрабатывает ошибку при push события в очередь */
function handlePushError<TType extends AppEventType>(
  error: unknown, // ошибка
  type: TType, // тип события
  event: BaseAppEvent<TType, unknown>, // событие
): void {
  if (process.env['NODE_ENV'] !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[EventQueue] Failed to push event ${type}:`, error);
    return;
  }

  // Интеграция с продакшен Logger через telemetry runtime
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const metadata: TelemetryMetadata = {
    component: 'app-events',
    eventType: type,
    error: errorMessage,
    ...(errorStack != null && { stack: errorStack }),
    ...(error instanceof Error && { errorName: error.name }),
    ...(event.meta?.correlationId != null && { correlationId: event.meta.correlationId }),
    ...(event.meta?.source != null && { source: event.meta.source }),
    ...(event.meta?.initiator != null && { initiator: event.meta.initiator }),
  };
  warnFireAndForget('Failed to push event to queue', metadata);
}

/** Пуш события в микросервис/queue (Kafka/RabbitMQ) */
export async function pushToQueue(
  event: BaseAppEvent<AppEventType, unknown>, // событие приложения
): Promise<void> {
  try {
    // Placeholder для будущей реализации Kafka продюсера
    // Будет: await kafkaProducer.send({ topic: 'app-events', messages: [{ value: JSON.stringify(event) }] });
    await Promise.resolve(); // Обеспечиваем асинхронное поведение для будущей интеграции с Kafka
    // eslint-disable-next-line no-unused-expressions
    event; // Параметр намеренно не используется до интеграции с Kafka
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to push event to queue', err);
  }
}

/** Создаёт событие с полной валидацией payload, логированием и пушем в микросервисы */
async function createEvent<TType extends AppEventType, TPayload>(
  type: TType, // тип события
  payload: TPayload, // полезная нагрузка события
  schema: z.ZodType<TPayload>, // Zod схема payload
  meta?: BaseAppEvent<TType, TPayload>['meta'], // опциональная мета-информация
  deps: EventDeps = { pushToQueue }, // опциональные зависимости (для тестирования и расширяемости)
): Promise<BaseAppEvent<TType, TPayload>> {
  schema.parse(payload); // fail-fast проверка
  const event: BaseAppEvent<TType, TPayload> = {
    type,
    version: '1.0.0' as const,
    eventVersion: eventSchemaVersions[type],
    timestamp: now(),
    payload,
    meta: createMeta(meta),
  };

  logEventCreation(type, event);

  // Fail-safe: ошибка push не прерывает создание события
  try {
    await deps.pushToQueue(event);
  } catch (error) {
    handlePushError(error, type, event);
    // Продолжаем выполнение - событие создано, но не отправлено в очередь
  }

  return event;
}

/** Создаёт событие входа пользователя */
export const createLoginEvent = (
  payload: LoginEventPayload,
  meta?: LoginEvent['meta'],
  deps?: EventDeps,
): Promise<LoginEvent> =>
  createEvent(AppEventType.AuthLogin, payload, LoginEventPayloadSchema, meta, deps);

/** Создаёт событие выхода пользователя */
export const createLogoutEvent = (
  payload: LogoutEventPayload,
  meta?: LogoutEvent['meta'],
  deps?: EventDeps,
): Promise<LogoutEvent> =>
  createEvent(AppEventType.AuthLogout, payload, LogoutEventPayloadSchema, meta, deps);

/** Создаёт событие истечения авторизации */
export const createAuthExpiredEvent = (
  payload: AuthExpiredEventPayload,
  meta?: AuthExpiredEvent['meta'],
  deps?: EventDeps,
): Promise<AuthExpiredEvent> =>
  createEvent(AppEventType.AuthExpired, payload, AuthExpiredEventPayloadSchema, meta, deps);

/** Создаёт событие изменения биллинга */
export const createBillingChangedEvent = (
  payload: BillingChangedEventPayload,
  meta?: BillingChangedEvent['meta'],
  deps?: EventDeps,
): Promise<BillingChangedEvent> =>
  createEvent(AppEventType.BillingChanged, payload, BillingChangedEventPayloadSchema, meta, deps);

/* ========================================================================== */
/* 🔍 TYPE GUARDS */
/* ========================================================================== */

/** Проверка события входа пользователя */
export function isLoginEvent(event: AppEvent): event is LoginEvent {
  const parseResult = LoginEventPayloadSchema.safeParse(event.payload);
  if (
    !parseResult.success
    && process.env['NODE_ENV'] !== 'production'
    && process.env['NODE_ENV'] !== 'test'
  ) {
    // eslint-disable-next-line no-console
    console.warn('Invalid LoginEvent payload', event.payload);
  }
  return event.type === AppEventType.AuthLogin && parseResult.success;
}

/** Проверка события выхода пользователя */
export function isLogoutEvent(event: AppEvent): event is LogoutEvent {
  const parseResult = LogoutEventPayloadSchema.safeParse(event.payload);
  if (
    !parseResult.success
    && process.env['NODE_ENV'] !== 'production'
    && process.env['NODE_ENV'] !== 'test'
  ) {
    // eslint-disable-next-line no-console
    console.warn('Invalid LogoutEvent payload', event.payload);
  }
  return event.type === AppEventType.AuthLogout && parseResult.success;
}

/** Проверка события истечения авторизации */
export function isAuthExpiredEvent(event: AppEvent): event is AuthExpiredEvent {
  const parseResult = AuthExpiredEventPayloadSchema.safeParse(event.payload);
  if (
    !parseResult.success
    && process.env['NODE_ENV'] !== 'production'
    && process.env['NODE_ENV'] !== 'test'
  ) {
    // eslint-disable-next-line no-console
    console.warn('Invalid AuthExpiredEvent payload', event.payload);
  }
  return event.type === AppEventType.AuthExpired && parseResult.success;
}

/** Проверка события изменения биллинга */
export function isBillingChangedEvent(event: AppEvent): event is BillingChangedEvent {
  const parseResult = BillingChangedEventPayloadSchema.safeParse(event.payload);
  if (
    !parseResult.success
    && process.env['NODE_ENV'] !== 'production'
    && process.env['NODE_ENV'] !== 'test'
  ) {
    // eslint-disable-next-line no-console
    console.warn('Invalid BillingChangedEvent payload', event.payload);
  }
  return event.type === AppEventType.BillingChanged && parseResult.success;
}
