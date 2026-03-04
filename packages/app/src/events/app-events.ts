/**
 * @file packages/app/src/events/app-events.ts
 * =============================================================================
 * 📡 APP EVENTS — ДОМАШНЯЯ СХЕМА СОБЫТИЙ С ПОЛНОЙ ВАЛИДАЦИЕЙ, AUDIT LOG И MICROSERVICE PUSH
 * =============================================================================
 * Версия: микросервисно-ориентированная, безопасная, с версионированием,
 * deep-validation payload, расширяемой мета-информацией и автоматическим логированием/пушем.
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

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
 *
 * @example 'Worker' - фоновый воркер
 *
 * @example 'Cron' - запланированная задача
 *
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

/** Генерация ISO timestamp */
function now(): string {
  return new Date().toISOString();
}

/**
 * Создаёт мета-информацию для события (observability, tracing)
 * @param meta - дополнительные данные
 * @param initiator - инициатор события (UI, Worker, Cron)
 */
function createMeta(
  meta?: BaseAppEvent<AppEventType, unknown>['meta'],
  initiator: EventInitiator = 'UI',
): NonNullable<BaseAppEvent<AppEventType, unknown>['meta']> {
  return {
    correlationId: meta?.correlationId ?? uuidv4(),
    source: process.env['APP_EVENT_SOURCE'] ?? 'app',
    initiator,
    ...meta,
  };
}

/**
 * Пуш события в микросервис/queue (Kafka/RabbitMQ)
 * @param event - событие приложения
 */
export async function pushToQueue(event: BaseAppEvent<AppEventType, unknown>): Promise<void> {
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

/**
 * Создаёт событие с полной валидацией payload, логированием и пушем в микросервисы
 * @param type - тип события
 * @param payload - полезная нагрузка события
 * @param schema - Zod схема payload
 * @param meta - опциональная мета-информация
 */
async function createEvent<TType extends AppEventType, TPayload>(
  type: TType,
  payload: TPayload,
  schema: z.ZodType<TPayload>,
  meta?: BaseAppEvent<TType, TPayload>['meta'],
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
  // Audit logging: в продакшене использовать Logger/Observability систему
  if (process.env['NODE_ENV'] !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[AuditLog] Event created: ${type} @ ${event.timestamp}`);
  } else {
    // TODO: Интегрировать с продакшен Logger/Observability
    // Пример: logger.info('Event created', { eventType: type, timestamp: event.timestamp, correlationId: event.meta?.correlationId });
  }

  // Fail-safe: ошибка push не прерывает создание события
  try {
    await pushToQueue(event);
  } catch (error) {
    // В продакшене использовать structured logging
    if (process.env['NODE_ENV'] !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[EventQueue] Failed to push event ${type}:`, error);
    } else {
      // TODO: Интегрировать с продакшен Logger
      // logger.warn('Failed to push event to queue', { eventType: type, error: error.message, correlationId: event.meta?.correlationId });
    }
    // Продолжаем выполнение - событие создано, но не отправлено в очередь
  }

  return event;
}

/** Создаёт событие входа пользователя */
export const createLoginEvent = (
  payload: LoginEventPayload,
  meta?: LoginEvent['meta'],
): Promise<LoginEvent> =>
  createEvent(AppEventType.AuthLogin, payload, LoginEventPayloadSchema, meta);

/** Создаёт событие выхода пользователя */
export const createLogoutEvent = (
  payload: LogoutEventPayload,
  meta?: LogoutEvent['meta'],
): Promise<LogoutEvent> =>
  createEvent(AppEventType.AuthLogout, payload, LogoutEventPayloadSchema, meta);

/** Создаёт событие истечения авторизации */
export const createAuthExpiredEvent = (
  payload: AuthExpiredEventPayload,
  meta?: AuthExpiredEvent['meta'],
): Promise<AuthExpiredEvent> =>
  createEvent(AppEventType.AuthExpired, payload, AuthExpiredEventPayloadSchema, meta);

/** Создаёт событие изменения биллинга */
export const createBillingChangedEvent = (
  payload: BillingChangedEventPayload,
  meta?: BillingChangedEvent['meta'],
): Promise<BillingChangedEvent> =>
  createEvent(AppEventType.BillingChanged, payload, BillingChangedEventPayloadSchema, meta);

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
