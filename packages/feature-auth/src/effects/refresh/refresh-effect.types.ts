/**
 * @file packages/feature-auth/src/effects/refresh/refresh-effect.types.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Refresh Effect DI Types
 * ============================================================================
 * Архитектурная роль:
 * - Определяет DI-контракт для refresh-effect до реализации самой логики.
 * - Фиксирует строгий портовый DI-контракт для security-критичного эффекта обновления сессии.
 * - Изолирует refresh-effect от конкретной реализации session-manager и HTTP-клиента.
 * - Стандартизирует конфигурацию (timeouts, concurrency, feature-flags) и результат эффекта.
 */

import type { UnixTimestampMs } from '@livai/core-contracts';

import type { AuditEventValues } from '../../schemas/index.js';
import type { AuthError, SessionState } from '../../types/auth.js';
import type { AuthApiClientPort } from '../shared/api-client.port.js';
import type { AuthStorePort } from '../shared/auth-store.port.js';

// Re-export для единообразия с login/register/logout
export type { ApiRequestOptions, AuthApiClientPort } from '../shared/api-client.port.js';

/* ============================================================================
 * 🧭 TYPES — SESSION MANAGER PORT
 * ========================================================================== */

/**
 * Декларативное решение по сессии для refresh-flow.
 * @remarks
 * - Один детерминированный результат для заданной пары (session, now).
 * - Исключает противоречивые состояния (например, "не refresh, но expired").
 */
export type SessionDecision =
  | Readonly<{ type: 'refresh'; }>
  | Readonly<{ type: 'noop'; reason: 'fresh' | 'not_authenticated'; }>
  | Readonly<{ type: 'invalidate'; reason: RefreshInvalidationReason; }>;

/**
 * Порт над session-manager для policy-решений по сессиям.
 * @remarks
 * - Инкапсулирует rule-engine/политику, предоставляя только решение на уровне SessionDecision.
 * - Изолирует refresh-effect от деталей реализации `lib/session-manager.ts`.
 * - Все функции pure: без побочных эффектов и доступа к внешнему состоянию.
 */
export type SessionManagerPort = Readonly<{
  /**
   * Принимает единое решение по текущей сессии на момент now.
   * @param session - Текущее состояние сессии или null.
   * @param now - Текущее время в миллисекундах UnixTimestampMs.
   * @returns SessionDecision — refresh / noop / invalidate.
   */
  decide: (session: SessionState | null, now: UnixTimestampMs) => SessionDecision;
}>;

/* ============================================================================
 * 🧭 TYPES — SUPPORTING PORTS
 * ========================================================================== */

/**
 * Порт для error-mapper'а.
 * @remarks
 * - Нормализует любые ошибки (HTTP, инфраструктура, валидация) в типизированный AuthError.
 * - Не должен выбрасывать исключения: все ошибки возвращаются как AuthError.
 */
export type ErrorMapperPort = Readonly<{
  /**
   * Преобразует неизвестную ошибку в доменный AuthError.
   * @param unknownError - Любая ошибка (unknown), полученная из внешних слоёв.
   */
  map: (unknownError: unknown) => AuthError;
}>;

/**
 * Порт времени.
 * @remarks
 * - Единственный источник времени для refresh-effect.
 * - Упрощает тестирование и позволяет контролировать clock skew.
 */
export type ClockPort = Readonly<{
  /** Возвращает текущее время в миллисекундах UnixTimestampMs. */
  now: () => UnixTimestampMs;
}>;

/**
 * Порт для генерации eventId.
 * @remarks
 * - Обязателен для детерминизма audit-событий и трассировки.
 * - Реализация может основываться на UUID, счётчиках или других схемах.
 */
export type EventIdGeneratorPort = Readonly<{
  /** Генерирует уникальный идентификатор события для audit-логов. */
  generate: () => string;
}>;

/**
 * Порт для AbortController.
 * @remarks
 * - Используется для реализации стратегии concurrency `'cancel_previous'`.
 * - В refresh-effect `'cancel_previous'` запрещён, но порт оставлен для единообразия DI.
 */
export type AbortControllerPort = Readonly<{
  /** Создаёт новый AbortController для отмены in-flight операций. */
  create: () => AbortController;
}>;

/**
 * Порт для audit-логгера событий refresh-flow.
 * @remarks Best-effort: ошибки логгера не должны ломать основной refresh-flow. Использует AuditEventValues для консистентности с login/logout/register.
 */
export type RefreshAuditLoggerPort = Readonly<{
  /** Логирует предварительно провалидированное audit-событие refresh-flow (fire-and-forget, без await со стороны эффекта). */
  logRefreshEvent: (event: AuditEventValues) => void;
}>;

/** Опциональная телеметрия для best-effort observability (не влияет на основной flow). */
export type RefreshTelemetryPort = Readonly<{
  /** Фиксация ошибок audit-логгера. */
  recordAuditFailure: (event: Readonly<{ operation: 'refresh'; reason: string; }>) => void;

  /** Фиксация ошибок error-mapper'а. */
  recordErrorMapperFailure: (event: Readonly<{ operation: 'refresh'; reason: string; }>) => void;
}>;

/* ============================================================================
 * 🧭 TYPES — DI DEPENDENCIES
 * ========================================================================== */

/**
 * DI-зависимости refresh-effect.
 * @remarks
 * - Readonly deps без мутаций и глобального состояния.
 * - Все side-effects выполняются только через эти порты.
 */
export type RefreshEffectDeps = Readonly<{
  /**
   * Порт стора аутентификации.
   * @remarks
   * - Единый контракт для всех auth-эффектов.
   * - Обеспечивает атомарные обновления через batchUpdate.
   */
  authStore: AuthStorePort;

  /** Effect-based HTTP-клиент для `/v1/auth/refresh` и `/v1/auth/me`. */
  apiClient: AuthApiClientPort;

  /** Нормализует ошибки в типизированный AuthError. */
  errorMapper: ErrorMapperPort;

  /** Порт над `lib/session-manager.ts` для policy-решений по сессиям. */
  sessionManager: SessionManagerPort;

  /** Порт времени для policy и audit timestamps. */
  clock: ClockPort;

  /** Порт для audit-логгера событий refresh-flow. */
  auditLogger: RefreshAuditLoggerPort;

  /** Порт генерации eventId (обязателен, для детерминизма и трассировки). */
  eventIdGenerator: EventIdGeneratorPort;

  /** Best-effort telemetry (опционально). */
  telemetry?: RefreshTelemetryPort | undefined;
}>;

/* ============================================================================
 * 🧭 TYPES — CONFIGURATION
 * ========================================================================== */

/**
 * Политика поведения refresh-effect.
 * @remarks
 * - Один активный режим, без комбинационного взрыва feature-флагов.
 * - Позволяет централизованно управлять степенью строгости политики.
 */
export type RefreshPolicy =
  | 'standard' // дефолтное поведение (баланс UX/безопасность)
  | 'strict' // строгий режим (агрессивная инвалидация, жёсткие TTL/policy)
  | 'legacy'; // совместимость со старым поведением (при необходимости миграций)

/**
 * Стратегия конкурентных вызовов refresh-effect.
 * @remarks
 * - `'serialize'` — вызовы ставятся в очередь и выполняются по одному.
 * - `'ignore'` — новый вызов игнорируется, пока предыдущий не завершится.
 * - `'cancel_previous'` намеренно не поддерживается для refresh (см. инварианты).
 */
export type RefreshConcurrencyStrategy = 'serialize' | 'ignore';

/**
 * Конфигурация refresh-effect (timeouts, concurrency, policy).
 * @remarks
 * - Применяется на этапе композиции эффекта, а не при каждом вызове.
 * - Глобальный hard timeout применяется ко всему refresh-flow (refresh + me).
 * - Policy задаётся через дискретный enum-подобный тип, а не через набор флагов.
 */
export type RefreshEffectConfig = Readonly<{
  /**
   * Hard timeout на весь refresh-flow (refresh + me), в миллисекундах.
   * @remarks
   * - Должен быть > 0 и ≤ REFRESH_MAX_TIMEOUT_MS.
   * - Используется для защиты от зависаний и misconfiguration.
   */
  timeout: number;

  /**
   * Стратегия конкурентных вызовов refresh-effect.
   * @remarks
   * - Строго `'serialize'` или `'ignore'`.
   * - `'cancel_previous'` запрещён (см. инварианты).
   */
  concurrency: RefreshConcurrencyStrategy;

  /**
   * Политика поведения refresh-effect.
   * @remarks
   * - Один активный режим для упрощения reasoning и тестирования.
   * - Конкретная семантика значений определяется на уровне session-manager/policy-engine.
   */
  policy: RefreshPolicy;
}>;

/* ============================================================================
 * 🧭 TYPES — RESULT
 * ========================================================================== */

/**
 * Формальный контракт результата refresh-effect.
 * @remarks
 * - Явно описывает все возможные исходы refresh-flow.
 * - Используется для type-safety и документации поведения эффекта.
 * - Гарантирует idempotency: повторные вызовы не создают дубликаты сессий и не мутируют состояние при noop.
 */
export type RefreshInvalidationReason =
  | 'expired'
  | 'refresh_failed'
  | 'security_policy'
  | 'unknown';

export type RefreshResult =
  | Readonly<{ type: 'success'; userId: string; }>
  | Readonly<{ type: 'error'; error: AuthError; }>
  | Readonly<{ type: 'invalidated'; reason: RefreshInvalidationReason; }>
  | Readonly<{ type: 'noop'; reason: 'already_fresh' | 'not_authenticated'; }>;

/* ============================================================================
 * 🔧 VALIDATION — CONFIG VALIDATION
 * ========================================================================== */

/**
 * Ошибка конфигурации refresh-effect.
 * @remarks Domain-specific error для security-critical эффекта. Обеспечивает корректный prototype chain и stack trace.
 */
// eslint-disable-next-line functional/no-classes -- классы нужны для корректного stack trace и instanceof
export class RefreshConfigError extends Error {
  constructor(message: string) {
    super(message);
    // eslint-disable-next-line functional/no-this-expressions -- конструктор класса требует мутации this
    this.name = 'RefreshConfigError';
  }
}

/**
 * Валидирует конфигурацию refresh-effect.
 * @throws RefreshConfigError если timeout ≤ 0 или concurrency не 'serialize'/'ignore'.
 * @remarks Валидация выполняется на этапе композиции, а не при каждом вызове эффекта.
 */
const REFRESH_MAX_TIMEOUT_MS = 60_000;

export function validateRefreshConfig(
  config: RefreshEffectConfig,
): void {
  if (config.timeout <= 0 || config.timeout > REFRESH_MAX_TIMEOUT_MS) {
    throw new RefreshConfigError(`refresh timeout must be > 0 and <= ${REFRESH_MAX_TIMEOUT_MS}ms`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime защита от некорректной конфигурации поверх типовой гарантии
  if (config.concurrency !== 'serialize' && config.concurrency !== 'ignore') {
    throw new RefreshConfigError('refresh concurrency must be "serialize" or "ignore"');
  }
}
