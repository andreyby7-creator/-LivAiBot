/**
 * @file packages/feature-bots/src/domain/BotAuditEvent.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель событий аудита ботов
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат BotAuditEvent: source-of-truth для событий аудита ботов.
 * - Используется для SIEM/логирования, compliance, forensics и security monitoring.
 * - Vendor-agnostic, SIEM-ready модель для отслеживания lifecycle и изменений ботов.
 * - ВАЖНО: Валидация инвариантов находится в lib/bot-audit-event-validator.ts (assertBotAuditEventInvariant).
 *
 * Принципы:
 * - ✅ SRP: только структура событий аудита (типы, branded types, exhaustive unions) и error types (без валидации и бизнес-логики).
 * - ✅ Deterministic: явные типы событий через exhaustive union для type-safe обработки.
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и error types.
 * - ✅ Immutable: все поля readonly для audit trail integrity.
 * - ✅ Extensible: type-safe context (BotAuditEventContextMap) позволяет эволюцию без ломки core-схемы.
 * - ✅ SIEM-ready: структурированные события, удобные для security monitoring и compliance.
 * - ✅ Strict typing: branded types для EventId, discriminated union для context, без string и Record в domain.
 * - ✅ No dependencies: domain не импортирует ничего из lib.
 */

import type { BotId, BotUserId, BotVersion, BotWorkspaceId, Timestamp } from './Bot.js';

/* ============================================================================
 * 🔐 BRANDED TYPES
 * ========================================================================== */

/**
 * Идентификатор события аудита.
 * Branded-тип, чтобы не путать с произвольным string и другими ID.
 */
export type EventId = string & { readonly __brand: 'EventId'; };

/* ============================================================================
 * 🧩 AUDIT EVENT TYPES
 * ========================================================================== */

/**
 * Типы событий аудита ботов.
 * Exhaustive union для type-safe обработки событий без if/else-монолита.
 */
export type BotAuditEventType =
  | 'bot_created'
  | 'bot_published'
  | 'bot_updated'
  | 'bot_deleted'
  | 'instruction_updated'
  | 'multi_agent_updated'
  | 'config_changed'
  | 'policy_violation';

/* ============================================================================
 * 🧩 EVENT CONTEXT (Type-Safe per Event Type)
 * ========================================================================== */

/** Контекст события bot_created. */
export type BotCreatedContext = Readonly<Record<string, unknown>>;

/** Контекст события bot_published. */
export type BotPublishedContext = Readonly<{
  /** Версия бота, которая была опубликована. */
  readonly version?: BotVersion;
  /** Предыдущая версия (если была). */
  readonly previousVersion?: BotVersion;
}>;

/** Контекст события bot_updated. */
export type BotUpdatedContext = Readonly<{
  /** Поля, которые были обновлены. */
  readonly updatedFields?: readonly string[];
}>;

/** Контекст события bot_deleted. */
export type BotDeletedContext = Readonly<Record<string, unknown>>;

/** Контекст события instruction_updated. */
export type InstructionUpdatedContext = Readonly<{
  /** Версия инструкции после обновления. */
  readonly version?: BotVersion;
  /** Предыдущая версия инструкции. */
  readonly previousVersion?: BotVersion;
}>;

/** Контекст события multi_agent_updated. */
export type MultiAgentUpdatedContext = Readonly<{
  /** Версия мультиагентной схемы после обновления. */
  readonly version?: BotVersion;
  /** Предыдущая версия схемы. */
  readonly previousVersion?: BotVersion;
}>;

/** Контекст события config_changed. */
export type ConfigChangedContext = Readonly<{
  /** Поля конфигурации, которые были изменены. */
  readonly changedFields?: readonly string[];
}>;

/** Контекст события policy_violation. */
export type PolicyViolationContext = Readonly<{
  /** Идентификатор политики, которая была нарушена. */
  readonly policyId?: string;
  /** Код ошибки нарушения. */
  readonly errorCode?: string;
  /** Описание нарушения. */
  readonly violation?: string;
}>;

/**
 * Type-safe контекст события в зависимости от типа события.
 * Discriminated union для type-safe обработки context без type assertions.
 */
export type BotAuditEventContextMap = Readonly<{
  readonly bot_created: BotCreatedContext;
  readonly bot_published: BotPublishedContext;
  readonly bot_updated: BotUpdatedContext;
  readonly bot_deleted: BotDeletedContext;
  readonly instruction_updated: InstructionUpdatedContext;
  readonly multi_agent_updated: MultiAgentUpdatedContext;
  readonly config_changed: ConfigChangedContext;
  readonly policy_violation: PolicyViolationContext;
}>;

/* ============================================================================
 * 🧩 DOMAIN MODEL
 * ========================================================================== */

/**
 * Доменная модель события аудита бота.
 * Generic type для type-safe обработки context в зависимости от типа события.
 *
 * Инварианты:
 * - eventId: уникальный идентификатор события (immutable).
 * - type: один из допустимых типов событий (exhaustive union).
 * - botId: идентификатор бота, к которому относится событие (обязателен).
 * - timestamp: временная метка события (domain-level Timestamp).
 * - userId: пользователь, инициировавший событие (опционально, может отсутствовать для системных событий).
 * - workspaceId: рабочее пространство бота (для multi-tenancy и шардирования).
 * - context: type-safe контекст в зависимости от типа события (проверяется в validator).
 */
export type BotAuditEvent<TType extends BotAuditEventType = BotAuditEventType> = Readonly<{
  /** Уникальный идентификатор события (immutable). */
  readonly eventId: EventId;
  /** Тип события аудита. */
  readonly type: TType;
  /** Идентификатор бота, к которому относится событие. */
  readonly botId: BotId;
  /** Рабочее пространство бота (для multi-tenancy и шардирования). */
  readonly workspaceId: BotWorkspaceId;
  /** Временная метка события (domain-level). */
  readonly timestamp: Timestamp;
  /**
   * Пользователь, инициировавший событие (опционально).
   * Может отсутствовать для системных событий или событий, инициированных автоматически.
   */
  readonly userId?: BotUserId;
  /**
   * Type-safe контекст события (опционально).
   * Тип контекста зависит от типа события (BotAuditEventContextMap).
   */
  readonly context?: BotAuditEventContextMap[TType];
}>;

/* ============================================================================
 * 🧪 ERROR TYPES
 * ========================================================================== */

/**
 * Domain-level ошибка нарушения инвариантов BotAuditEvent.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 */
export type BotAuditEventInvariantError = Readonly<Error>;

export const createBotAuditEventInvariantError = (
  message: string,
): BotAuditEventInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation -- установка name для observability-интеграции
  error.name = 'BotAuditEventInvariantError';
  return Object.freeze(error);
};
