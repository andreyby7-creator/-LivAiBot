/**
 * @file packages/feature-auth/src/lib/session-manager.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Session Manager (Domain-Pure Service)
 * ============================================================================
 * Domain-pure сервис для управления жизненным циклом сессий аутентификации.
 * Вычисляет deadlines для proactive refresh, принимает решения о expire/invalidate,
 * проверяет лимиты одновременных сессий.
 * Интегрируется с AuthPolicy (sessionMaxLifetimeMs) и SessionPolicy (TTL, concurrent limits).
 * Изолирует бизнес-логику от orchestration-слоя (effects).
 * Принципы:
 * - ✅ Domain-pure: без side-effects, без HTTP / store / effects
 * - ✅ Deterministic: `now` передаётся извне (injected)
 * - ✅ Fail-closed: безопасные решения по умолчанию
 * - ✅ Clock skew protection: проверка issuedAt не в будущем
 */

import type { AuthPolicyConfig } from '@livai/core';
import type { UnixTimestampMs } from '@livai/core-contracts';

import type { SessionPolicy } from '../domain/SessionPolicy.js';
import type { SessionState } from '../types/auth.js';

/* ============================================================================
 * CONSTANTS
 * ============================================================================
 */

/** Дефолтное время до истечения для proactive refresh (30 секунд) */
const DEFAULT_REFRESH_PROACTIVE_WINDOW_MS = 30_000;

/* ============================================================================
 * TYPES
 * ============================================================================
 */

export type SessionManagerConfig = Readonly<{
  readonly authPolicy: Readonly<AuthPolicyConfig>;
  readonly sessionPolicy?: SessionPolicy | undefined;
  readonly refreshProactiveWindowMs?: number | undefined;
}>;

export type InvalidationReason =
  | 'expired'
  | 'policy_violation'
  | 'concurrent_limit_exceeded';

export type NewSessionDenialReason =
  | 'concurrent_limit_exceeded'
  | 'policy_violation';

/* ============================================================================
 * SESSION MANAGER
 * ============================================================================
 */

/**
 * Domain-pure сервис для управления жизненным циклом сессий.
 * Вычисляет deadlines, принимает решения о expire/invalidate/refresh,
 * проверяет лимиты одновременных сессий.
 */
/* eslint-disable functional/no-classes -- immutable service object без mutable state */
/* eslint-disable functional/no-this-expressions -- readonly поля, нет мутаций */
export class SessionManager {
  private readonly authPolicyConfig: Readonly<AuthPolicyConfig>;
  private readonly sessionPolicy: SessionPolicy | undefined;
  private readonly refreshProactiveWindowMs: number;

  /**
   * Создаёт экземпляр SessionManager с валидацией конфигурации.
   * @throws Error если refreshProactiveWindowMs < 0
   * @throws Error если authPolicy.sessionMaxLifetimeMs <= 0
   */
  public constructor(
    config: Readonly<SessionManagerConfig>, // Конфигурация SessionManager
  ) {
    // Валидация refreshProactiveWindowMs (fail-fast на misconfiguration)
    const windowMs = config.refreshProactiveWindowMs ?? DEFAULT_REFRESH_PROACTIVE_WINDOW_MS;
    if (windowMs < 0) {
      throw new Error(
        `[SessionManager] refreshProactiveWindowMs must be >= 0, got ${windowMs}`,
      );
    }
    this.refreshProactiveWindowMs = windowMs;

    // Валидация sessionMaxLifetimeMs (fail-fast на absurd config)
    if (config.authPolicy.sessionMaxLifetimeMs <= 0) {
      throw new Error(
        `[SessionManager] authPolicy.sessionMaxLifetimeMs must be > 0, got ${config.authPolicy.sessionMaxLifetimeMs}`,
      );
    }

    // Сохраняем конфигурацию AuthPolicy для проверки sessionMaxLifetimeMs
    this.authPolicyConfig = config.authPolicy;
    this.sessionPolicy = config.sessionPolicy;
  }

  /**
   * Парсит ISO-8601 строку в UnixTimestampMs.
   * Fail-closed: невалидная дата → null.
   * ⚠️ ОГРАНИЧЕНИЕ: Использует Date.parse(), который имеет известные проблемы:
   * - Различия в runtime (браузер vs Node.js vs Edge)
   * - Неоднозначность timezone parsing
   * - Edge cases с ISO форматами
   * Идеологически domain должен работать с UnixTimestampMs, но текущая реализация
   * SessionState использует ISO строки для совместимости с API.
   * ⚠️ ПРОИЗВОДИТЕЛЬНОСТЬ: Метод вызывается несколько раз для одной сессии
   * (expiresAt в isExpired/getRefreshDeadline, issuedAt в shouldInvalidate).
   * Оптимизация: orchestration может распарсить один раз и передавать UnixTimestampMs.
   */
  private parseTimestamp(
    value: string, // ISO-8601 строка даты
  ): UnixTimestampMs | null { // UnixTimestampMs или null если дата невалидна
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  /**
   * Exhaustive check для union типов.
   * Гарантирует compile-time проверку всех вариантов.
   * @throws Error если код достижим (нарушение exhaustiveness)
   */
  private assertNever(
    value: never, // Значение типа never (не должно быть достижимо)
  ): never { // Всегда выбрасывает ошибку
    throw new Error(
      `[SessionManager] Unhandled session status: ${JSON.stringify(value)}`,
    );
  }

  /**
   * Проверяет, истёк ли срок сессии.
   * Fail-closed: отсутствие сессии или невалидная дата → `true`.
   * Валидация времени строго через injected `now`.
   * Примечание: рекомендуется проверять первым перед другими методами SessionManager,
   * так как expired сессия должна обрабатываться до refresh/invalidate решений.
   */
  public isExpired(
    session: SessionState | null, // Состояние сессии (может быть null или любого статуса)
    now: UnixTimestampMs, // Текущее время в миллисекундах (injected извне)
  ): boolean { // `true` если сессия истекла или отсутствует, `false` если активна
    if (session === null) {
      return true;
    }

    switch (session.status) {
      case 'active': {
        const expiresAtMs = this.parseTimestamp(session.expiresAt);
        if (expiresAtMs === null) {
          return true; // Fail-closed: невалидная дата = истекшая сессия
        }
        return now >= expiresAtMs;
      }

      case 'expired':
      case 'revoked':
      case 'suspended': {
        return true;
      }

      default: {
        // Exhaustive check: TypeScript гарантирует, что все варианты SessionState обработаны
        // Если этот код достижим, значит TypeScript не смог проверить exhaustiveness
        return this.assertNever(session);
      }
    }
  }

  /**
   * Определяет, нужно ли триггерить refresh сессии.
   * Proactive refresh: триггерится до истечения (за refreshProactiveWindowMs мс).
   * Fail-closed: отсутствие сессии или невалидная дата → `false`.
   * ⚠️ ВАЖНО: Метод проверяет только expiresAt, не учитывает sessionMaxLifetimeMs.
   * Refresh не продлевает максимальное время жизни сессии (hard limit из AuthPolicy).
   * Если sessionAge > sessionMaxLifetimeMs, refresh может быть бессмысленным.
   * Примечание: метод может вернуть `true` для expired сессии (если deadline вычислен
   * до истечения expiresAt, но сессия уже expired по времени). Рекомендуется проверять
   * `isExpired` перед вызовом для корректной обработки expired сессий.
   */
  public shouldRefresh(
    session: SessionState | null, // Состояние сессии (может быть null или любого статуса)
    now: UnixTimestampMs, // Текущее время в миллисекундах (injected извне)
  ): boolean { // `true` если нужно начать refresh, `false` иначе
    if (session === null) {
      return false;
    }

    if (session.status !== 'active') {
      return false;
    }

    const deadline = this.getRefreshDeadline(session);
    return deadline > 0 && now >= deadline;
  }

  /**
   * Вычисляет timestamp, когда нужно начать proactive refresh.
   * ⚠️ КРИТИЧНО: Deadline — часть политики, не эффекта.
   * Избавляет от "минус 30 секунд" в эффектах.
   * Fail-closed: отсутствие сессии или невалидная дата → `0` (прошлое время).
   */
  public getRefreshDeadline(
    session: SessionState | null, // Состояние сессии (может быть null или любого статуса)
  ): UnixTimestampMs { // Timestamp в миллисекундах, когда нужно начать refresh, или `0` если сессия невалидна
    if (session === null) {
      return 0;
    }

    if (session.status !== 'active') {
      return 0;
    }

    const expiresAtMs = this.parseTimestamp(session.expiresAt);
    if (expiresAtMs === null) {
      return 0; // Fail-closed: невалидная дата = deadline в прошлом
    }

    const deadline = expiresAtMs - this.refreshProactiveWindowMs;
    return Math.max(0, deadline); // Защита от отрицательных значений
  }

  /**
   * Определяет, нужно ли инвалидировать активную сессию на основе политики.
   * Проверяет только active сессии. Для уже инвалидированных (expired/revoked/suspended)
   * возвращает `false` (сессия уже инвалидирована, дополнительная инвалидация не требуется).
   * Проверяет: истечение по expiresAt, sessionMaxLifetimeMs (AuthPolicy),
   * TTL из SessionPolicy (если задан, применяется дополнительно).
   * Оба лимита должны быть соблюдены.
   * Fail-closed: отсутствие сессии, невалидная дата или clock skew → `true`.
   */
  public shouldInvalidate(
    session: SessionState | null, // Состояние сессии (может быть null или любого статуса)
    now: UnixTimestampMs, // Текущее время в миллисекундах (injected извне)
  ): boolean { // `true` если active сессию нужно инвалидировать, `false` иначе (включая уже инвалидированные)
    if (session === null) {
      return true;
    }

    if (session.status !== 'active') {
      return false; // Уже инвалидирована (expired/revoked/suspended)
    }

    // Проверка истечения по expiresAt
    if (this.isExpired(session, now)) {
      return true;
    }

    // Проверка максимального времени жизни сессии через AuthPolicy
    const issuedAtMs = this.parseTimestamp(session.issuedAt);
    if (issuedAtMs === null) {
      return true; // Fail-closed: невалидная дата = инвалидация
    }

    // Clock skew protection: issuedAt не должен быть в будущем
    if (issuedAtMs > now) {
      return true; // Fail-closed: clock skew = инвалидация
    }

    const sessionAgeMs = now - issuedAtMs;
    if (sessionAgeMs > this.authPolicyConfig.sessionMaxLifetimeMs) {
      return true;
    }

    // Проверка TTL из SessionPolicy (если задан, применяется дополнительно к AuthPolicy)
    // Оба лимита должны быть соблюдены: сессия инвалидируется при нарушении любого из них
    if (this.sessionPolicy?.sessionTtlSeconds !== undefined) {
      const maxLifetimeMs = this.sessionPolicy.sessionTtlSeconds * 1000;
      if (sessionAgeMs > maxLifetimeMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверяет, можно ли открыть новую сессию с учётом лимитов одновременных сессий.
   * Учитывает только активные и не истекшие сессии.
   * Использует SessionPolicy из конфигурации SessionManager.
   * Fail-closed: если политика не задана → возвращает `true` (разрешено).
   */
  public canOpenNewSession(
    existingSessions: readonly SessionState[], // Массив существующих сессий
    now: UnixTimestampMs, // Текущее время для проверки истечения
  ): boolean { // `true` если можно открыть новую сессию, `false` иначе
    if (this.sessionPolicy === undefined) {
      return true;
    }

    if (this.sessionPolicy.maxConcurrentSessions === undefined) {
      return true;
    }

    // Подсчёт активных и не истекших сессий
    const activeSessionsCount = existingSessions.filter(
      (session) => session.status === 'active' && !this.isExpired(session, now),
    ).length;

    return activeSessionsCount < this.sessionPolicy.maxConcurrentSessions;
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
