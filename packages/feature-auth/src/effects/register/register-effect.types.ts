/**
 * @file packages/feature-auth/src/effects/register/register-effect.types.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Register Effect DI Types
 * ============================================================================
 *
 * Определяет DI-контракт для register-effect до реализации логики:
 * порты (*Port), конфигурация (timeouts, concurrency), валидация.
 * Security-critical эффект с портовым DI без глобалов и утечки инфраструктуры.
 */

import type { AuditEventValues } from '../../schemas/index.js';
import type { AuthError } from '../../types/auth.js';
import type { IdentifierHasherPort } from '../login/login-effect.types.js';
import type { AuthApiClientPort } from '../shared/api-client.port.js';
import type { AuthStorePort } from '../shared/auth-store.port.js';

// Re-export для обратной совместимости и единообразия с login/logout
export type { ApiRequestOptions, AuthApiClientPort } from '../shared/api-client.port.js';

/* ============================================================================
 * 🧭 TYPES — CONCURRENCY STRATEGY
 * ========================================================================== */

/**
 * Стратегия конкурентных вызовов register-effect.
 * @remarks
 * - 'ignore'          — новый вызов игнорируется, пока предыдущий не завершится
 * - 'cancel_previous' — активный вызов отменяет предыдущий через AbortController
 * - 'serialize'       — вызовы ставятся в очередь и выполняются по одному
 */
export type ConcurrencyStrategy = 'ignore' | 'cancel_previous' | 'serialize';

/* ============================================================================
 * 🧭 TYPES — REGISTER EFFECT RESULT
 * ========================================================================== */

/**
 * Формальный контракт результата register-effect.
 * @remarks
 * - Явно описывает все возможные исходы register-flow.
 * - Используется для type-safety и документации поведения эффекта.
 * - Соответствует RegisterResult из register.ts (type alias).
 * Union является исчерпывающим.
 * Новые состояния добавляются только через расширение union
 * с обязательным обновлением всех exhaustive switch.
 */
export type RegisterEffectResult =
  | Readonly<{ type: 'success'; userId: string; }>
  | Readonly<{ type: 'mfa_required'; userId: string; }>
  | Readonly<{ type: 'error'; error: AuthError; }>
  | Readonly<{ type: 'cancelled'; }>
  | Readonly<{ type: 'timeout'; }>;

/* ============================================================================
 * 🧭 TYPES — PORTS
 * ========================================================================== */

/**
 * Порт для error-mapper'а.
 * @remarks
 * Нормализует ошибки (HTTP, валидация, инфраструктура) в типизированный AuthError.
 * @warning
 * Запрещён silent fallback. Unmapped cases должны логироваться.
 * При невозможности обработать ошибку — вернуть AuthError с kind: 'unknown_error'.
 */
export type ErrorMapperPort = Readonly<{
  /**
   * Преобразует unknown ошибку в доменный AuthError.
   * @throws никогда не должен выбрасывать: все ошибки преобразуются в AuthError.
   */
  map: (unknownError: unknown) => AuthError;
}>;

/**
 * Порт времени (clock).
 * @remarks
 * - Один источник времени для register-effect, легко подменяется в тестах.
 * - Позволяет детерминированно формировать timestamp'ы для audit/telemetry.
 */
export type ClockPort = Readonly<{
  /** Возвращает текущее время в миллисекундах UnixTimestampMs. */
  now: () => number;
}>;

/**
 * Порт для генерации eventId.
 * @remarks
 * - Обязательная зависимость: обеспечивает детерминизм и единообразие генерации eventId.
 * - В composer должна передаваться default-реализация (например, на основе crypto.randomUUID).
 * - Для детерминизма в тестах рекомендуется передавать кастомный генератор (например, инкрементальный).
 */
export type EventIdGeneratorPort = Readonly<{
  /** Генерирует уникальный идентификатор события для audit-логов. */
  generate: () => string;
}>;

/** Порт генерации traceId для register-flow (детерминизм через DI). */
export type TraceIdGeneratorPort = Readonly<{
  generate: () => string;
}>;

/** Опциональная телеметрия для best-effort observability (не влияет на основной flow). */
export type RegisterTelemetryPort = Readonly<{
  recordAuditFailure: (event: Readonly<{ operation: 'register'; reason: string; }>) => void;
  recordErrorMapperFailure: (event: Readonly<{ operation: 'register'; reason: string; }>) => void;
}>;

/**
 * Порт для audit-логгера событий регистрации.
 * @remarks
 * Best-effort: ошибки логгера не должны ломать регистрацию.
 * Использует AuditEventValues для консистентности с login/logout.
 * @warning
 * Не логировать raw PII. Schema validation до вызова логгера.
 * Эффект не await'ит результат (async-safe).
 */
export type RegisterAuditLoggerPort = Readonly<{
  /**
   * Логирует предварительно провалидированное audit-событие.
   * @returns void | Promise<void> — эффект не await'ит (best-effort).
   */
  logRegisterEvent: (event: AuditEventValues) => void | Promise<void>;
}>;

/**
 * Порт для AbortController.
 * @remarks
 * - Инкапсулирует стратегию создания AbortController (pooling, tracing, telemetry и т.п.).
 * - Используется для реализации стратегии concurrency `'cancel_previous'`.
 */
export type AbortControllerPort = Readonly<{
  /** Создаёт новый AbortController для отмены in-flight операций. */
  create: () => AbortController;
}>;

/* ============================================================================
 * 🧭 TYPES — DI DEPENDENCIES
 * ========================================================================== */

/**
 * DI-зависимости register-effect.
 * @remarks
 * Readonly deps без мутаций. Все side-effects через порты.
 */
export type RegisterEffectDeps = Readonly<{
  /**
   * Порт стора аутентификации.
   * @remarks
   * Единый контракт для всех auth-эффектов. Атомарный batchUpdate для consistency.
   */
  authStore: AuthStorePort;

  /** Effect-based HTTP-клиент для /v1/auth/register. Работает с AbortSignal. */
  apiClient: AuthApiClientPort;

  /** Нормализует ошибки в типизированный AuthError. */
  errorMapper: ErrorMapperPort;

  /** Порт времени для детерминированных timestamp'ов (audit/metadata). */
  clock: ClockPort;

  /** Порт генерации traceId (обязателен, deterministic DI). */
  traceIdGenerator: TraceIdGeneratorPort;

  /** Порт для хеширования идентификаторов в метаданных. Переиспользуется с login-effect. */
  identifierHasher: IdentifierHasherPort;

  /** Порт для audit-логгера событий регистрации. */
  auditLogger: RegisterAuditLoggerPort;

  /** Порт для AbortController (для реализации стратегии concurrency 'cancel_previous'). */
  abortController: AbortControllerPort;

  /** Порт генерации eventId (обязателен, для детерминизма и трассировки). */
  eventIdGenerator: EventIdGeneratorPort;

  /** Best-effort telemetry (опционально). */
  telemetry?: RegisterTelemetryPort | undefined;
}>;

/* ============================================================================
 * 🧭 TYPES — CONFIGURATION
 * ========================================================================== */

/**
 * Feature flags для register-flow.
 * @remarks
 * Закрытый набор флагов (не Record<string, boolean>).
 * @warning
 * Не превращать в policy engine или numeric thresholds. Только boolean флаги.
 */
export type RegisterFeatureFlags = Readonly<{
  /** Резерв под future-флаги (enforceUniqueWorkspaceName, skipAuditLogging и т.п.). */
}>;

/**
 * Config для register-effect (timeouts, feature-flags, concurrency).
 * Инварианты:
 * - Политики вычисляются на уровне composer'а.
 * - hardTimeout >= apiTimeout (если задан).
 * Поведение:
 * - Store update только при success (не при cancellation).
 * - Audit логируется best-effort даже при отмене.
 * - hardTimeout применяется к каждому запросу в очереди отдельно.
 * - При async audit logger возможен reorder: гарантируется уникальность eventId и idempotency в backend.
 */
export type RegisterEffectConfig = Readonly<{
  /** Глобальный hard timeout на весь register-flow. Должен быть >= apiTimeout. */
  hardTimeout: number;

  /** Таймаут для API-вызовов. Если не задан — дефолтный из app-слоя. */
  apiTimeout?: number;

  /** Стратегия конкурентных вызовов. По умолчанию задаётся в composer'е. */
  concurrency?: ConcurrencyStrategy;

  /** Feature flags для register-flow. */
  featureFlags?: RegisterFeatureFlags;
}>;

/* ============================================================================
 * 🔧 VALIDATION — RUNTIME CONFIG VALIDATION
 * ========================================================================== */

/**
 * Ошибка конфигурации register-effect.
 * @remarks Domain-specific error для security-critical эффекта. Корректный prototype chain и stack trace.
 */
// eslint-disable-next-line functional/no-classes -- классы нужны для корректного stack trace и instanceof
export class RegisterConfigError extends Error {
  constructor(message: string) {
    super(message);
    // eslint-disable-next-line functional/no-this-expressions -- конструктор класса требует мутации this
    this.name = 'RegisterConfigError';
  }
}

/**
 * Валидирует конфигурацию register-effect.
 * @throws RegisterConfigError если hardTimeout ≤ 0, apiTimeout ≤ 0 или hardTimeout <= apiTimeout.
 * @remarks Валидация на уровне композиции (при создании эффекта), не при каждом вызове.
 */
export function validateRegisterConfig(
  config: RegisterEffectConfig,
): void {
  if (config.hardTimeout <= 0) {
    throw new RegisterConfigError('register hardTimeout must be > 0');
  }

  if (config.apiTimeout !== undefined && config.apiTimeout <= 0) {
    throw new RegisterConfigError('register apiTimeout must be > 0');
  }

  if (config.apiTimeout !== undefined && config.hardTimeout <= config.apiTimeout) {
    throw new RegisterConfigError('register hardTimeout must exceed apiTimeout');
  }
}
