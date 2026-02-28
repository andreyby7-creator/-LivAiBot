/**
 * @file packages/feature-auth/src/domain/ClientContext.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — ClientContext DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт информации о клиентском окружении
 * - Используется в LoginRequest, RegisterRequest, LogoutRequest и других запросах
 * - Immutable, extensible, security-aware
 * - **Boundary DTO**: Transport metadata, не domain entity
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware (PII handling)
 * - ✅ Boundary DTO (transport layer, не core domain)
 *
 * @boundary-dto Transport metadata DTO на границе domain/transport.
 * @domain-boundary Разделяет transport concerns (security, session, analytics) от core domain.
 *
 * @example
 * const context: ClientContext = {
 *   ip: '192.168.1.1',
 *   deviceId: 'device-xyz',
 *   userAgent: 'Mozilla/5.0...',
 *   locale: 'en-US',
 *   timezone: 'America/New_York',
 *   geo: { lat: 40.7128, lng: -74.0060 },
 *   sessionId: 'session-123',
 *   appVersion: '1.0.0'
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * DTO информации о клиентском окружении (Version 1)
 *
 * **Boundary DTO**: Transport metadata для передачи между слоями.
 * Используется для: security (IP, deviceId), analytics (locale, timezone, geo),
 * session (sessionId, appVersion).
 *
 * ⚠️ **PII**: IP и geo могут быть PII → используйте `sanitizeClientContext()` для logs/audits.
 * ⚠️ **Rule-engine**: Все поля опциональны → используйте helper функции (`getIp()`, `getDeviceId()`).
 * ⚠️ **Orchestrators**: Используйте `createEmptyClientContext()` вместо `{}` или `undefined`.
 * 💡 **Extensibility**: Для breaking changes → `ClientContext = ClientContextV1 | ClientContextV2`.
 */
export type ClientContextV1 = {
  /** IP адрес клиента (IPv4 или IPv6) */
  readonly ip?: string;

  /** Идентификатор устройства (для device binding и fraud detection) */
  readonly deviceId?: string;

  /** User-Agent строка браузера/приложения */
  readonly userAgent?: string;

  /** Локаль клиента (например, 'en-US', 'ru-RU') */
  readonly locale?: string;

  /** Часовой пояс клиента (например, 'America/New_York', 'Europe/Moscow') */
  readonly timezone?: string;

  /** Геолокация клиента (координаты) */
  readonly geo?: {
    /** Широта */
    readonly lat: number;
    /** Долгота */
    readonly lng: number;
  };

  /** Идентификатор сессии (для tracking и audit) */
  readonly sessionId?: string;

  /** Версия приложения клиента */
  readonly appVersion?: string;
};

/**
 * Текущая версия ClientContext (V1).
 * При breaking changes создайте ClientContextV2 и используйте union type.
 */
export type ClientContext = ClientContextV1;

/* ============================================================================
 * 🔧 HELPER FUNCTIONS — Safe Accessors
 * ============================================================================
 *
 * Безопасный доступ к полям ClientContext для rule-engine.
 * Возвращают `string | null` вместо `string | undefined` для deterministic поведения.
 */

/**
 * Извлекает IP адрес или null.
 *
 * @example
 * const ip = getIp(context); // '192.168.1.1' | null
 */
export function getIp(ctx: ClientContext): string | null {
  return ctx.ip ?? null;
}

/** Извлекает deviceId или null. */
export function getDeviceId(ctx: ClientContext): string | null {
  return ctx.deviceId ?? null;
}

/** Извлекает userAgent или null. */
export function getUserAgent(ctx: ClientContext): string | null {
  return ctx.userAgent ?? null;
}

/** Извлекает locale или null. */
export function getLocale(ctx: ClientContext): string | null {
  return ctx.locale ?? null;
}

/** Извлекает timezone или null. */
export function getTimezone(ctx: ClientContext): string | null {
  return ctx.timezone ?? null;
}

/** Извлекает geo координаты или null. */
export function getGeo(ctx: ClientContext): { readonly lat: number; readonly lng: number; } | null {
  return ctx.geo ?? null;
}

/** Извлекает sessionId или null. */
export function getSessionId(ctx: ClientContext): string | null {
  return ctx.sessionId ?? null;
}

/** Извлекает appVersion или null. */
export function getAppVersion(ctx: ClientContext): string | null {
  return ctx.appVersion ?? null;
}

/**
 * Создает пустой ClientContext для orchestrators.
 * Используйте вместо `{}` или `undefined` для предотвращения null propagation.
 *
 * @example
 * const context = request.clientContext ?? createEmptyClientContext();
 * const ip = getIp(context); // null (deterministic)
 */
export function createEmptyClientContext(): ClientContext {
  return {};
}

/* ============================================================================
 * 🔒 SECURITY UTILITIES — Sanitization
 * ============================================================================
 */

/**
 * Безопасная версия ClientContext без PII полей (ip, geo).
 * Используется для audit trails, logs, telemetry.
 */
export type ClientContextSafe = Omit<ClientContext, 'ip' | 'geo'>;

/**
 * Удаляет PII поля (ip, geo) для безопасного логирования/аудита.
 * Сохраняет: deviceId, userAgent, locale, timezone, sessionId, appVersion.
 *
 * @example
 * logger.info('Login attempt', { context: sanitizeClientContext(context) });
 */
export function sanitizeClientContext(ctx: ClientContext): ClientContextSafe {
  const { deviceId, userAgent, locale, timezone, sessionId, appVersion } = ctx;
  return {
    ...(deviceId !== undefined && { deviceId }),
    ...(userAgent !== undefined && { userAgent }),
    ...(locale !== undefined && { locale }),
    ...(timezone !== undefined && { timezone }),
    ...(sessionId !== undefined && { sessionId }),
    ...(appVersion !== undefined && { appVersion }),
  };
}
