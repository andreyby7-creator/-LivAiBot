/**
 * @file packages/feature-auth/src/effects/login/login-audit.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Audit Event Mapper
 * ============================================================================
 *
 * Архитектурная роль:
 * - Pure mapper из результата login-effect + контекста в AuditEventValues.
 * - Инкапсулирует форму audit-событий, чтобы orchestrator не знал про структуру аудита.
 *
 * Принципы:
 * - ❌ Нет бизнес-логики, только проекция данных.
 * - ✅ Использует auditEventSchema для валидации (fail-closed на уровне схемы).
 * - ✅ Immutable возвращаемые объекты.
 */

import type { DomainLoginResult } from '../../domain/LoginResult.js';
import { auditEventSchema } from '../../schemas/index.js';
import type { AuditEventValues } from '../../schemas/index.js';
import type { AuthError } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Публичный результат login-effect (структурно совместим с LoginResult из login.ts).
 *
 * @note Для mfa_required: userId должен извлекаться из domainResult.challenge.userId,
 *       а не из challengeId (challengeId ≠ userId).
 */
export type LoginResultForAudit =
  | Readonly<{ type: 'success'; userId: string; }>
  | Readonly<{ type: 'mfa_required'; challengeId: string; }>
  | Readonly<{ type: 'blocked'; reason: string; }>
  | Readonly<{ type: 'error'; error: AuthError; }>;

/**
 * Контекст для построения audit-события.
 *
 * @note Flattened контекст для уменьшения coupling к внутренней структуре pipeline.
 *       Все необходимые данные передаются напрямую, без глубокого чтения nested структур.
 *       request удален из контекста, так как все данные (ip, userAgent) уже flattened.
 *
 * @note Поля, которые могут отсутствовать, моделируются как `T | undefined` (а не optional-property),
 *       чтобы упростить конструирование с exactOptionalPropertyTypes: true.
 */
export type LoginAuditContext = Readonly<{
  /** Доменный результат логина (для получения sessionId и userId, если нужно). */
  domainResult: DomainLoginResult | undefined;
  /** Timestamp события (ISO 8601). */
  timestamp: string;
  /** Correlation / trace ID для трассировки (опционально). */
  traceId: string | undefined;
  /** Уникальный идентификатор события (генерируется в orchestrator для детерминизма в тестах). */
  eventId: string;
  /** IP адрес клиента (flattened из request.clientContext). */
  ip: string | undefined;
  /** User-Agent клиента (flattened из request.clientContext). */
  userAgent: string | undefined;
  /** Идентификатор устройства (flattened из security-pipeline). */
  deviceId: string | undefined;
  /** Геолокация (flattened из security-pipeline). */
  geo: { readonly lat?: number; readonly lng?: number; } | undefined;
  /** Risk score (0-100, flattened из security-pipeline). */
  riskScore: number | undefined;
  /** Причина блокировки (flattened из security-pipeline, только для blocked событий). */
  blockReason: string | undefined;
}>;

/* ============================================================================
 * 🔧 HELPERS
 * ============================================================================
 */

/**
 * Извлекает userId из domainResult для MFA событий.
 * @note challengeId ≠ userId, поэтому userId должен извлекаться из domainResult.challenge.userId.
 */
function extractUserIdForMfa(context: LoginAuditContext): string | undefined {
  const domain = context.domainResult;
  if (domain?.type === 'mfa_required') {
    return domain.challenge.userId;
  }
  return undefined;
}

/**
 * Извлекает sessionId из domainResult для success событий.
 * @note sessionId доступен только после успешного /me (fail-closed гарантия на уровне orchestrator).
 */
function extractSessionId(context: LoginAuditContext): string | undefined {
  const domain = context.domainResult;
  if (domain?.type === 'success') {
    return domain.me.session?.sessionId;
  }
  return undefined;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Маппит LoginResult + контекст в AuditEventValues и валидирует через auditEventSchema.
 *
 * @note Fail-closed: любая архитектурная ошибка (несоответствие схеме) → исключение.
 * @note Deterministic: eventId генерируется в orchestrator, не внутри маппера.
 * @note Low coupling: контекст flattened, маппер не знает структуру pipeline.
 *
 * @throws ZodError если собранное событие не соответствует схеме (architectural bug).
 */
export function mapLoginResultToAuditEvent(
  result: LoginResultForAudit,
  context: LoginAuditContext,
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
      // ⚠️ Fail-closed: sessionId должен быть доступен после успешного /me
      // Orchestrator гарантирует, что success идет только после успешного /me
      const sessionId = extractSessionId(context);
      if (sessionId === undefined) {
        throw new Error(
          '[login-audit.mapper] login_success audit requires sessionId (orchestrator contract violation)',
        );
      }

      const event: Partial<AuditEventValues> = {
        ...baseEvent,
        type: 'login_success',
        userId: result.userId,
        sessionId,
      };

      return auditEventSchema.parse(event);
    }

    case 'mfa_required': {
      // ⚠️ Критично: challengeId ≠ userId
      // userId должен извлекаться из domainResult.challenge.userId
      // ⚠️ Fail-closed: MFA всегда идет после backend, userId должен быть доступен
      const userId = extractUserIdForMfa(context);
      if (userId === undefined) {
        throw new Error(
          '[login-audit.mapper] mfa_challenge audit requires userId (orchestrator contract violation: MFA always comes after backend)',
        );
      }

      const event: Partial<AuditEventValues> = {
        ...baseEvent,
        type: 'mfa_challenge',
        userId,
        context: {
          challengeId: result.challengeId,
        },
      };

      return auditEventSchema.parse(event);
    }

    case 'blocked': {
      // blockReason передается в flattened контексте (не читаем глубокую структуру pipeline)
      // @note Контракт: policyId опционален в auditEventSchema (z.string().optional())
      //       Если в будущем схема изменится и policyId станет обязательным для policy_violation,
      //       нужно добавить fail-closed проверку аналогично success/MFA:
      //       if (context.blockReason === undefined) throw new Error('policy_violation requires policyId')
      const event: Partial<AuditEventValues> = {
        ...baseEvent,
        type: 'policy_violation',
        policyId: context.blockReason,
        context: {
          reason: result.reason,
          ...(context.blockReason !== undefined ? { blockReason: context.blockReason } : {}),
        },
      };

      return auditEventSchema.parse(event);
    }

    case 'error': {
      // AuthError.kind — публичный union, все значения безопасны для audit
      // (network, invalid_credentials, account_locked, etc. — нет внутренних stack-derived значений)
      const event: Partial<AuditEventValues> = {
        ...baseEvent,
        type: 'login_failure',
        errorCode: result.error.kind,
      };

      return auditEventSchema.parse(event);
    }

    default: {
      const _exhaustive: never = result;
      throw new Error(
        `[login-audit.mapper] Unsupported LoginResult type: ${
          JSON.stringify(
            _exhaustive,
          )
        }`,
      );
    }
  }
}
