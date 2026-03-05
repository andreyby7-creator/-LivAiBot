/**
 * @file packages/feature-auth/src/effects/refresh/refresh-audit.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Refresh Audit Event Mapper
 * ============================================================================
 * Маппит результат refresh-effect и контекст сессии в AuditEventValues для audit-слоя.
 * Архитектурная роль:
 * - Pure mapper из результата refresh-effect + контекста в AuditEventValues.
 * - Инкапсулирует форму audit-событий, чтобы orchestrator не знал про структуру аудита.
 * Принципы:
 * - ❌ Нет бизнес-логики, только проекция данных.
 * - ✅ Использует auditEventSchema для валидации (fail-closed на уровне схемы).
 * - ✅ Immutable возвращаемые объекты.
 * - ✅ Deterministic: eventId и timestamp приходят извне/через DI (clock + eventIdGenerator).
 */

import type { AuditEventValues } from '../../schemas/index.js';
import { auditEventSchema } from '../../schemas/index.js';
import type { SessionState } from '../../types/auth.js';
import type { ClockPort, EventIdGeneratorPort, RefreshResult } from './refresh-effect.types.js';

/* ============================================================================
 * 🧭 TYPES
 * ========================================================================== */

/**
 * Контекст для построения refresh audit-события.
 * @remarks
 * - Flattened контекст: хранит только минимально необходимые поля для аудита.
 * - Строится напрямую из SessionState без metadata enricher.
 */
export type RefreshAuditContext = Readonly<{
  /** Уникальный идентификатор события (генерируется через EventIdGeneratorPort). */
  eventId: string;
  /** Временная метка события (ISO 8601, построенная через ClockPort). */
  timestamp: string;
  /** Идентификатор пользователя (опционально, зарезервировано для будущего расширения). */
  userId?: string;
  /** Идентификатор сессии из SessionState. */
  sessionId?: string;
  /** Идентификатор устройства из SessionState.device. */
  deviceId?: string;
  /** IP адрес устройства из SessionState.device. */
  ip?: string;
  /** Геолокация устройства из SessionState.device. */
  geo?: AuditEventValues['geo'];
}>;

/* ============================================================================
 * 🔧 CONTEXT BUILDER
 * ========================================================================== */

/**
 * Строит RefreshAuditContext из SessionState, используя ClockPort и EventIdGeneratorPort.
 * @remarks
 * - Извлекает sessionId и device-метаданные напрямую из SessionState.
 * - Генерирует eventId и timestamp через DI-порты для детерминизма и тестируемости.
 * - ⚠️ **Требование к состоянию сессии:** для извлечения device info (deviceId, ip, geo)
 *   требуется `sessionState.status === 'active'`. Для других статусов (expired, revoked, suspended)
 *   эти поля будут `undefined` в возвращаемом контексте.
 */
export function createRefreshAuditContext(
  sessionState: SessionState,
  clock: ClockPort,
  eventIdGenerator: EventIdGeneratorPort,
): RefreshAuditContext {
  const eventId = eventIdGenerator.generate();
  const timestamp = new Date(clock.now()).toISOString();

  const device = sessionState.status === 'active' ? sessionState.device : undefined;

  const deviceId = device?.deviceId;
  const ip = device?.ip;
  const geo = device?.geo
    ? {
      lat: device.geo.lat,
      lng: device.geo.lng,
    }
    : undefined;

  return {
    eventId,
    timestamp,
    sessionId: sessionState.sessionId,
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(ip !== undefined ? { ip } : {}),
    ...(geo !== undefined ? { geo } : {}),
  };
}

/* ============================================================================
 * 🔧 HELPERS
 * ========================================================================== */

/**
 * Маппинг типов RefreshResult → типов AuditEventValues['type'].
 * @remarks
 * - success / error → token_refresh.
 * - invalidated → session_revoked.
 */
const REFRESH_AUDIT_EVENT_TYPE: Record<
  Exclude<RefreshResult['type'], 'noop'>,
  AuditEventValues['type']
> = {
  success: 'token_refresh',
  error: 'token_refresh',
  invalidated: 'session_revoked',
} as const;

/* ============================================================================
 * 🎯 MAIN API
 * ========================================================================== */

/**
 * Строит полностью готовое AuditEventValues для refresh-аудита (кроме noop).
 * @remarks
 * - Единая точка, где комбинируются base-поля, тип события и context.
 * - Упрощает future-proof расширение: новые поля добавляются в одном месте.
 */
function buildRefreshAuditEvent(
  result: Exclude<RefreshResult, { readonly type: 'noop'; }>,
  context: RefreshAuditContext,
): Readonly<AuditEventValues> {
  const baseEvent: Partial<AuditEventValues> = {
    eventId: context.eventId,
    timestamp: context.timestamp,
    ...(context.userId !== undefined ? { userId: context.userId } : {}),
    ...(context.sessionId !== undefined ? { sessionId: context.sessionId } : {}),
    ...(context.deviceId !== undefined ? { deviceId: context.deviceId } : {}),
    ...(context.ip !== undefined ? { ip: context.ip } : {}),
    ...(context.geo !== undefined ? { geo: context.geo } : {}),
  };

  const eventType = REFRESH_AUDIT_EVENT_TYPE[result.type];
  let eventContext: Record<string, unknown> | undefined;

  const specificFields: Partial<AuditEventValues> = {};

  if (result.type === 'success') {
    specificFields.userId = result.userId;
  } else if (result.type === 'error') {
    specificFields.errorCode = result.error.kind;
    eventContext = {
      errorCode: result.error.kind,
    };
  } else {
    // invalidated
    eventContext = {
      reason: result.reason,
    };
  }

  const event: Partial<AuditEventValues> = {
    ...baseEvent,
    type: eventType,
    ...specificFields,
    ...(eventContext !== undefined ? { context: eventContext } : {}),
  };

  const parsed = auditEventSchema.parse(event);
  return Object.freeze(parsed);
}

/**
 * Маппит RefreshResult + контекст в AuditEventValues и валидирует через auditEventSchema.
 * @remarks
 * - Для `noop` возвращает `null` (аудит не пишется).
 * - Для остальных вариантов возвращает frozen AuditEventValues (immutable, SIEM-ready).
 * @throws ZodError если собранное событие не соответствует схеме (architectural bug).
 */
export function mapRefreshResultToAuditEvent(
  result: RefreshResult,
  context: RefreshAuditContext,
): Readonly<AuditEventValues> | null {
  if (result.type === 'noop') {
    return null;
  }

  return buildRefreshAuditEvent(result, context);
}
