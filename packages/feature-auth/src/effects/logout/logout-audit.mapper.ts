/**
 * @file packages/feature-auth/src/effects/logout/logout-audit.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Logout Audit Event Mapper
 * ============================================================================
 * Маппит результат logout-effect и контекст в AuditEventValues для audit-слоя.
 *
 * Архитектурная роль:
 * - Pure mapper из результата logout-effect + контекста в AuditEventValues.
 * - Инкапсулирует форму audit-событий, чтобы orchestrator не знал про структуру аудита.
 *
 * Принципы:
 * - ❌ Нет бизнес-логики, только проекция данных.
 * - ✅ Использует auditEventSchema для валидации (fail-closed на уровне схемы).
 * - ✅ Immutable возвращаемые объекты.
 */

import { auditEventSchema } from '../../schemas/index.js';
import type { AuditEventValues } from '../../schemas/index.js';
import type { AuthError } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Публичный результат logout-effect (структурно совместим с LogoutResult из logout.ts).
 */
export type LogoutResultForAudit =
  | Readonly<{ type: 'success'; }>
  | Readonly<{ type: 'error'; error: AuthError; }>;

/**
 * Контекст для построения audit-события.
 * @note Flattened контекст для уменьшения coupling к внутренней структуре.
 *       Все необходимые данные передаются напрямую, без глубокого чтения nested структур.
 * @note Поля, которые могут отсутствовать, моделируются как `T | undefined` (а не optional-property),
 *       чтобы упростить конструирование с exactOptionalPropertyTypes: true.
 */
export type LogoutAuditContext = Readonly<{
  /** Timestamp события (ISO 8601). */
  timestamp: string;
  /** Уникальный идентификатор события (генерируется в orchestrator для детерминизма в тестах). */
  eventId: string;
  /** Correlation / trace ID для трассировки (опционально). */
  traceId: string | undefined;
  /** ID пользователя (undefined = pre-auth logout scenario). */
  userId: string | undefined;
  /** IP адрес клиента (flattened из request.clientContext, опционально). */
  ip: string | undefined;
  /** User-Agent клиента (flattened из request.clientContext, опционально). */
  userAgent: string | undefined;
  /** Идентификатор устройства (flattened из security-pipeline, опционально). */
  deviceId: string | undefined;
  /** Геолокация (flattened из security-pipeline, опционально). */
  geo: { readonly lat?: number; readonly lng?: number; } | undefined;
  /** Risk score (0-100, flattened из security-pipeline, опционально). */
  riskScore: number | undefined;
}>;

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Маппит LogoutResult + контекст в AuditEventValues и валидирует через auditEventSchema.
 * @note Fail-closed: любая архитектурная ошибка (несоответствие схеме) → исключение.
 * @note Deterministic: eventId генерируется в orchestrator, не внутри маппера.
 * @note Low coupling: контекст flattened, маппер не знает структуру pipeline.
 * @throws ZodError если собранное событие не соответствует схеме (architectural bug).
 */
export function mapLogoutResultToAuditEvent(
  result: LogoutResultForAudit,
  context: LogoutAuditContext,
): AuditEventValues {
  const baseEvent = {
    eventId: context.eventId,
    timestamp: context.timestamp,
    ip: context.ip,
    userAgent: context.userAgent,
    deviceId: context.deviceId,
    geo: context.geo,
    riskScore: context.riskScore,
    correlationId: context.traceId,
  } satisfies Partial<AuditEventValues>;

  switch (result.type) {
    case 'success': {
      const event: Partial<AuditEventValues> = {
        ...baseEvent,
        type: 'logout_success',
        // userId опционален для pre-auth logout scenario
        ...(context.userId !== undefined ? { userId: context.userId } : {}),
      };

      return auditEventSchema.parse(event);
    }

    case 'error': {
      // AuthError.kind — публичный union, все значения безопасны для audit
      // (network, invalid_credentials, account_locked, etc. — нет внутренних stack-derived значений)
      const event: Partial<AuditEventValues> = {
        ...baseEvent,
        type: 'logout_failure',
        errorCode: result.error.kind,
        // userId опционален для pre-auth logout scenario
        ...(context.userId !== undefined ? { userId: context.userId } : {}),
      };

      return auditEventSchema.parse(event);
    }

    default: {
      const _exhaustive: never = result;
      throw new Error(
        `[logout-audit.mapper] Unsupported LogoutResult type: ${
          JSON.stringify(
            _exhaustive,
          )
        }`,
      );
    }
  }
}

/**
 * Маппит revoke error в AuditEventValues и валидирует через auditEventSchema.
 * @note Revoke error — отдельное событие, не являющееся результатом logout-effect.
 * @note Fail-closed: любая архитектурная ошибка (несоответствие схеме) → исключение.
 * @note Deterministic: eventId генерируется в orchestrator, не внутри маппера.
 * @throws ZodError если собранное событие не соответствует схеме (architectural bug).
 */
export function mapRevokeErrorToAuditEvent(
  error: AuthError,
  context: LogoutAuditContext,
): AuditEventValues {
  const baseEvent = {
    eventId: context.eventId,
    timestamp: context.timestamp,
    ip: context.ip,
    userAgent: context.userAgent,
    deviceId: context.deviceId,
    geo: context.geo,
    riskScore: context.riskScore,
    correlationId: context.traceId,
  } satisfies Partial<AuditEventValues>;

  // AuthError.kind — публичный union, все значения безопасны для audit
  const event: Partial<AuditEventValues> = {
    ...baseEvent,
    type: 'revoke_error',
    errorCode: error.kind,
    // userId опционален для revoke (выполняется после reset)
    ...(context.userId !== undefined ? { userId: context.userId } : {}),
  };

  return auditEventSchema.parse(event);
}

/**
 * Маппит revoke skipped (из-за превышения лимита) в AuditEventValues и валидирует через auditEventSchema.
 * @note Revoke skipped — отдельное событие, когда revoke не выполнен из-за превышения лимита параллельных запросов.
 * @note Fail-closed: любая архитектурная ошибка (несоответствие схеме) → исключение.
 * @note Deterministic: eventId генерируется в orchestrator, не внутри маппера.
 * @throws ZodError если собранное событие не соответствует схеме (architectural bug).
 */
export function mapRevokeSkippedToAuditEvent(
  context: LogoutAuditContext,
): AuditEventValues {
  const baseEvent = {
    eventId: context.eventId,
    timestamp: context.timestamp,
    ip: context.ip,
    userAgent: context.userAgent,
    deviceId: context.deviceId,
    geo: context.geo,
    riskScore: context.riskScore,
    correlationId: context.traceId,
  } satisfies Partial<AuditEventValues>;

  const event: Partial<AuditEventValues> = {
    ...baseEvent,
    type: 'revoke_skipped_due_to_limit',
    // userId опционален для revoke (выполняется после reset)
    ...(context.userId !== undefined ? { userId: context.userId } : {}),
  };

  return auditEventSchema.parse(event);
}
