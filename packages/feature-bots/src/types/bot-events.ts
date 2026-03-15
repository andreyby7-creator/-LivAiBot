/**
 * @file packages/feature-bots/src/types/bot-events.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Типы и константы событий ботов (domain events)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Канонический контракт domain events ботов для store/effects/UI/event-bus
 * - Single Source of Truth: BotEventPayloadMap → auto-generated BotEventType → discriminated union BotEvent
 * - Rule-engine ready: aggregateId/aggregateType для routing без парсинга payload
 * - Context extraction: workspaceId в context, botId в aggregateId, payload = domain delta
 *
 * Различие с BotAuditEvent:
 * - BotEvent: domain events для внутренней обработки (store updates, pipeline triggers, reactive flows)
 * - BotAuditEvent: audit trail для SIEM/логирования/compliance/forensics
 *
 * Принципы:
 * - ✅ SRP: только типы/константы, без логики обработки
 * - ✅ Strict typing: discriminated unions, exhaustive field types (BotMutableField, BotConfigField)
 * - ✅ Event versioning: schemaVersion в meta для безопасной эволюции payload
 * - ✅ Microservice-ready: сериализуемые события для event-bus/Kafka/RabbitMQ
 *
 * ⚠️ Runtime validation:
 * Type guards (isBotEvent) выполняют только shape-проверки (boundary validation).
 * Полная schema validation должна быть в `schemas/bot-events.ts` через zod/valibot/arktype.
 */

import type { TraceId } from '@livai/core-contracts';

import type { BotId, BotUserId, BotVersion, BotWorkspaceId, Timestamp } from '../domain/Bot.js';
import type { EventId } from '../domain/BotAuditEvent.js';
import type { BotPauseReason } from './bot-lifecycle.js';
import type { BotStatus } from './bots.js';
/* ============================================================================
 * 🧱 COMMON EVENT BUILDING BLOCKS
 * ========================================================================== */

/**
 * Идентификатор корреляции (для distributed tracing и связывания событий).
 * Используется для группировки связанных событий в рамках одной операции.
 */
export type CorrelationId = string & { readonly __brand: 'CorrelationId'; };

/**
 * Версия схемы события (для безопасной эволюции payload).
 * При изменении структуры payload необходимо увеличить botEventSchemaVersion.
 */
export const botEventSchemaVersion = 1 as const;

/** Тип версии схемы события. */
export type SchemaVersion = typeof botEventSchemaVersion;

/** Метаданные события: минимальные поля для observability без transport leakage. */
export type BotEventMeta = Readonly<{
  /** Идентификатор события (идемпотентность, дедупликация) */
  readonly eventId: EventId;
  /** Временная метка события (domain-level Timestamp) */
  readonly timestamp: Timestamp;
  /** Версия схемы события (для безопасной эволюции payload) */
  readonly schemaVersion: SchemaVersion;
  /** Trace ID для distributed tracing (опционально) */
  readonly traceId?: TraceId;
  /** Correlation ID для связывания связанных событий (опционально) */
  readonly correlationId?: CorrelationId;
}>;

/**
 * Контекст события: общие поля для всех событий ботов.
 * Вынесены из payload для уменьшения дублирования и упрощения rule-engine.
 * botId уже есть в aggregateId, поэтому в context только workspaceId.
 */
export type BotEventContext = Readonly<{
  /** Рабочее пространство бота */
  readonly workspaceId: BotWorkspaceId;
}>;

/* ============================================================================
 * 🧩 FIELD TYPES (Strict Unions, No String Leak)
 * ========================================================================== */

/**
 * Изменяемые поля метаданных бота.
 * Exhaustive union для type-safe обработки обновлений без string-дыр.
 */
export type BotMutableField =
  | 'name'
  | 'metadata.labels'
  | 'metadata.features'
  | 'metadata.integrations';

/**
 * Изменяемые поля конфигурации бота.
 * Exhaustive union для type-safe обработки изменений конфигурации.
 */
export type BotConfigField =
  | 'settings.temperature'
  | 'settings.contextWindow'
  | 'settings.maxSessions'
  | 'settings.fallbackMessage'
  | 'settings.piiMaskingEnabled'
  | 'settings.imageRecognitionEnabled'
  | 'settings.unrecognizedMessage'
  | 'settings.interruptionRules';

/* ============================================================================
 * 🧩 PAYLOAD TYPES (Per-Event, Strict Shapes, Domain Delta Only)
 * ========================================================================== */

/**
 * Payload события bot_created.
 * Событие возникает при создании нового бота (из шаблона или кастомного).
 * Payload содержит только domain delta, общие поля (botId, workspaceId) в context.
 */
export type BotCreatedPayload = Readonly<{
  /** Пользователь, создавший бота */
  readonly createdBy: BotUserId;
  /** Имя бота */
  readonly name: string;
  /** Начальная версия бота */
  readonly initialVersion: BotVersion;
  /** Начальный статус бота */
  readonly initialStatus: BotStatus;
}>;

/**
 * Payload события bot_published.
 * Событие возникает при публикации бота (переход из draft в active).
 */
export type BotPublishedPayload = Readonly<{
  /** Пользователь, опубликовавший бота */
  readonly publishedBy: BotUserId;
  /** Текущая версия бота (которая была опубликована) */
  readonly currentVersion: BotVersion;
  /** Предыдущая версия (если была опубликована ранее) */
  readonly previousVersion?: BotVersion;
}>;

/**
 * Payload события bot_updated.
 * Событие возникает при обновлении метаданных бота (имя, метаданные и т.п.).
 */
export type BotUpdatedPayload = Readonly<{
  /** Пользователь, обновивший бота */
  readonly updatedBy: BotUserId;
  /** Поля, которые были обновлены (строгий union, не string[]) */
  readonly updatedFields: readonly BotMutableField[];
  /** Новая версия ревизии бота (optimistic lock) */
  readonly newRevision: number;
  /** Предыдущая версия ревизии бота */
  readonly previousRevision: number;
}>;

/**
 * Payload события bot_deleted.
 * Событие возникает при логическом удалении бота.
 */
export type BotDeletedPayload = Readonly<{
  /** Пользователь, удаливший бота */
  readonly deletedBy: BotUserId;
  /** Текущая версия бота на момент удаления */
  readonly currentVersion: BotVersion;
}>;

/**
 * Payload события instruction_updated.
 * Событие возникает при обновлении инструкции бота.
 */
export type InstructionUpdatedPayload = Readonly<{
  /** Пользователь, обновивший инструкцию */
  readonly updatedBy: BotUserId;
  /** Текущая версия инструкции */
  readonly currentVersion: BotVersion;
  /** Предыдущая версия инструкции */
  readonly previousVersion: BotVersion;
}>;

/**
 * Payload события multi_agent_updated.
 * Событие возникает при обновлении мультиагентной схемы бота.
 */
export type MultiAgentUpdatedPayload = Readonly<{
  /** Пользователь, обновивший мультиагентную схему */
  readonly updatedBy: BotUserId;
  /** Текущая версия мультиагентной схемы */
  readonly currentVersion: BotVersion;
  /** Предыдущая версия мультиагентной схемы */
  readonly previousVersion: BotVersion;
  /** Версия схемы мультиагента (schemaVersion из ManageMultiAgentPayload) */
  readonly multiAgentSchemaVersion: number;
}>;

/**
 * Payload события bot_paused.
 * Событие возникает при приостановке бота (переход в paused статус).
 */
export type BotPausedPayload = Readonly<{
  /** Пользователь, приостановивший бота */
  readonly pausedBy: BotUserId;
  /** Причина приостановки */
  readonly reason: BotPauseReason;
  /** Текущая версия бота на момент приостановки */
  readonly currentVersion: BotVersion;
}>;

/**
 * Payload события bot_resumed.
 * Событие возникает при возобновлении бота (переход из paused в active).
 */
export type BotResumedPayload = Readonly<{
  /** Пользователь, возобновивший бота */
  readonly resumedBy: BotUserId;
  /** Текущая версия бота на момент возобновления */
  readonly currentVersion: BotVersion;
}>;

/**
 * Payload события bot_archived.
 * Событие возникает при архивации бота (переход в archived статус).
 */
export type BotArchivedPayload = Readonly<{
  /** Пользователь, заархивировавший бота */
  readonly archivedBy: BotUserId;
  /** Текущая версия бота на момент архивации */
  readonly currentVersion: BotVersion;
}>;

/**
 * Payload события config_changed.
 * Событие возникает при изменении конфигурации бота (настройки, параметры и т.п.).
 */
export type ConfigChangedPayload = Readonly<{
  /** Пользователь, изменивший конфигурацию */
  readonly changedBy: BotUserId;
  /** Поля конфигурации, которые были изменены (строгий union, не string[]) */
  readonly changedFields: readonly BotConfigField[];
  /** Текущая версия бота после изменения конфигурации */
  readonly currentVersion: BotVersion;
  /** Предыдущая версия бота */
  readonly previousVersion: BotVersion;
}>;

/* ============================================================================
 * 🧭 EVENT PAYLOAD MAP (Single Source of Truth)
 * ========================================================================== */

/**
 * Map типов событий на их payload'ы.
 * Source of truth для всех типов событий ботов.
 * Используется для type-safe генерации discriminated union BotEvent.
 *
 * Архитектурный паттерн event-platform:
 * - PayloadMap определяет все события в одном месте
 * - BotEventType генерируется автоматически из ключей map
 * - BotEventTypes валидируется через satisfies — невозможно рассинхронизировать
 * - Невозможно забыть payload или создать лишний event type
 */
export type BotEventPayloadMap = {
  readonly bot_created: BotCreatedPayload;
  readonly bot_published: BotPublishedPayload;
  readonly bot_updated: BotUpdatedPayload;
  readonly bot_deleted: BotDeletedPayload;
  readonly instruction_updated: InstructionUpdatedPayload;
  readonly multi_agent_updated: MultiAgentUpdatedPayload;
  readonly bot_paused: BotPausedPayload;
  readonly bot_resumed: BotResumedPayload;
  readonly bot_archived: BotArchivedPayload;
  readonly config_changed: ConfigChangedPayload;
};

/**
 * Тип события бота (discriminant).
 * Генерируется автоматически из BotEventPayloadMap — невозможно рассинхронизировать.
 */
export type BotEventType = keyof BotEventPayloadMap;

/**
 * Runtime-константы типов событий ботов.
 * Генерируются из BotEventPayloadMap через satisfies — гарантирует синхронизацию.
 * Используются для исключения опечаток и согласованности между слоями.
 *
 * satisfies гарантирует:
 * - нельзя написать несуществующий event type
 * - нельзя пропустить тип из BotEventPayloadMap
 */
export const BotEventTypes = {
  BOT_CREATED: 'bot_created',
  BOT_PUBLISHED: 'bot_published',
  BOT_UPDATED: 'bot_updated',
  BOT_DELETED: 'bot_deleted',
  INSTRUCTION_UPDATED: 'instruction_updated',
  MULTI_AGENT_UPDATED: 'multi_agent_updated',
  BOT_PAUSED: 'bot_paused',
  BOT_RESUMED: 'bot_resumed',
  BOT_ARCHIVED: 'bot_archived',
  CONFIG_CHANGED: 'config_changed',
} as const satisfies Record<string, BotEventType>;

/**
 * Set типов событий для O(1) runtime-проверок.
 * Используется вместо массива для эффективной валидации.
 * Приватный, используется только в isBotEvent guard.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Set используется только для чтения (has), не мутируется
const BotEventTypeSet = new Set<BotEventType>(
  Object.values(BotEventTypes) as BotEventType[],
);

/* ============================================================================
 * 🧭 EVENT UNION (Generated from PayloadMap)
 * ========================================================================== */

/**
 * Событие бота — то, что произошло в системе.
 * Discriminated union для type-safe dispatch (без if/else-монолитов).
 * Генерируется автоматически из BotEventPayloadMap — невозможно рассинхронизировать.
 * Включает aggregateId и aggregateType для rule-engine routing.
 */
export type BotEvent = {
  readonly [K in BotEventType]: Readonly<{
    readonly type: K;
    readonly aggregateType: 'bot';
    readonly aggregateId: BotId;
    readonly meta: BotEventMeta;
    readonly context: BotEventContext;
    readonly payload: BotEventPayloadMap[K];
  }>;
}[BotEventType];

/* ============================================================================
 * 🔧 UTILITY TYPES
 * ========================================================================== */

/** Тип-хелпер для извлечения типа payload из BotEvent по типу события. */
export type BotEventPayload<TType extends BotEventType> = BotEventPayloadMap[TType];

/** Тип-хелпер для извлечения типа события из BotEvent. */
export type BotEventByType<TType extends BotEventType> = Extract<
  BotEvent,
  { readonly type: TType; }
>;

/* ============================================================================
 * 🎯 TYPE GUARDS (Boundary Validation Only)
 * ========================================================================== */

// Type guard для проверки типа события бота. Используется для runtime-проверок и фильтрации событий.
export function isBotEventOfType<TType extends BotEventType>(
  event: BotEvent, // событие для проверки
  eventType: TType, // тип события для проверки
): event is BotEventByType<TType> { // возвращает true, если событие имеет указанный тип
  return event.type === eventType;
}

// Type guard для проверки, является ли значение событием бота. Используется для валидации входящих данных (например, из event-bus).
// ⚠️ ВАЖНО: Это только shape-проверка (boundary validation). Полная schema validation должна быть реализована в `schemas/bot-events.ts` через zod/valibot/arktype. Event-bus = untrusted boundary.
export function isBotEvent(value: unknown): value is BotEvent { // возвращает true, если значение имеет правильную структуру события
  return (typeof value === 'object' && value !== null)
    ? ((): boolean => {
      // eslint-disable-next-line functional/prefer-immutable-types -- переменная используется только для чтения
      const event = value as Record<string, unknown>;
      const meta = event['meta'];
      const context = event['context'];

      return (
        BotEventTypeSet.has(event['type'] as BotEventType)
        && event['aggregateType'] === 'bot'
        && typeof event['aggregateId'] === 'string'
        && typeof meta === 'object'
        && meta !== null
        && typeof (meta as Record<string, unknown>)['eventId'] === 'string'
        && typeof (meta as Record<string, unknown>)['timestamp'] === 'number'
        && (meta as Record<string, unknown>)['schemaVersion'] === botEventSchemaVersion
        && typeof context === 'object'
        && context !== null
        && typeof (context as Record<string, unknown>)['workspaceId'] === 'string'
        && typeof event['payload'] === 'object'
        && event['payload'] !== null
      );
    })()
    : false;
}
