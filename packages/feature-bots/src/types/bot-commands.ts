/**
 * @file packages/feature-bots/src/types/bot-commands.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Команды ботов (строгие типы + константы)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Канонический контракт команд управления ботами для store/effects/UI (BotCommandTypes, BotCommandType, BotCommand)
 * - Масштабируемая модель через map-based определения: BotCommandPayloadMap → auto-generated union BotCommand
 * - Compile-time exhaustiveness: AllBotCommandTypes через `as const satisfies readonly BotCommandType[]`
 * - Микросервисно-нейтральный: сериализуемые payload'ы, без transport деталей
 * - Lifecycle-семантика причин паузы берётся из `types/bot-lifecycle.ts` (BotPauseReason) — без drift контрактов
 *
 * Принципы:
 * - ✅ SRP: только типы/константы команд, без логики исполнения
 * - ✅ Deterministic: одна команда = один тип + один payload shape
 * - ✅ Strict typing: discriminated unions, без «магических» строк по проекту
 * - ✅ Extensible: добавление команды не требует изменения существующих типов consumers
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты
 * - ✅ Observability-friendly: BotCommandMeta поддерживает operationId и traceId
 */

import type { ID, ISODateString, TraceId } from '@livai/core-contracts';

import type { BotPauseReason } from './bot-lifecycle.js';

/* ============================================================================
 * 🧾 COMMAND TYPES (Single Source of Truth)
 * ========================================================================== */

/**
 * Константы типов команд ботов.
 * Используются для исключения опечаток и согласованности между слоями.
 */
export const BotCommandTypes = Object.freeze(
  {
    CREATE_BOT_FROM_TEMPLATE: 'create_bot_from_template',
    CREATE_CUSTOM_BOT: 'create_custom_bot',
    UPDATE_INSTRUCTION: 'update_instruction',
    MANAGE_MULTI_AGENT: 'manage_multi_agent',
    PUBLISH_BOT: 'publish_bot',
    PAUSE_BOT: 'pause_bot',
    RESUME_BOT: 'resume_bot',
    ARCHIVE_BOT: 'archive_bot',
    DELETE_BOT: 'delete_bot',
    SIMULATE_BOT_MESSAGE: 'simulate_bot_message',
  } as const,
);

/** Тип команды бота (discriminant). */
export type BotCommandType = typeof BotCommandTypes[keyof typeof BotCommandTypes];

/** Канонический список всех типов команд (для exhaustive проверок). */
// eslint-disable-next-line functional/prefer-immutable-types -- readonly tuple (as const) + satisfies: безопасный compile-time список для exhaustive checks
export const AllBotCommandTypes = [
  BotCommandTypes.CREATE_BOT_FROM_TEMPLATE,
  BotCommandTypes.CREATE_CUSTOM_BOT,
  BotCommandTypes.UPDATE_INSTRUCTION,
  BotCommandTypes.MANAGE_MULTI_AGENT,
  BotCommandTypes.PUBLISH_BOT,
  BotCommandTypes.PAUSE_BOT,
  BotCommandTypes.RESUME_BOT,
  BotCommandTypes.ARCHIVE_BOT,
  BotCommandTypes.DELETE_BOT,
  BotCommandTypes.SIMULATE_BOT_MESSAGE,
] as const satisfies readonly BotCommandType[];

/* ============================================================================
 * 🧱 COMMON PAYLOAD BUILDING BLOCKS
 * ========================================================================== */

/** Идентификатор операции (идемпотентность) — передаётся явно, без скрытого state. */
export type OperationId = ID<'Operation'>;

/** Контекст команды: минимальные поля для observability без transport leakage. */
export type BotCommandMeta = Readonly<{
  /** Идентификатор операции (идемпотентность) */
  readonly operationId: OperationId;
  /** Временная метка создания команды */
  readonly createdAt: ISODateString;
  /** Trace ID для distributed tracing (опционально) */
  readonly traceId?: TraceId;
}>;

/* ============================================================================
 * 🧩 PAYLOAD TYPES (Per-Command, Strict Shapes)
 * ========================================================================== */

export type CreateBotFromTemplatePayload = Readonly<{
  readonly workspaceId: ID<'Workspace'>;
  readonly templateId: ID<'BotTemplate'>;
  readonly name: string;
  /**
   * Опциональная кастомизация инструкции для шаблона.
   * Если не задано — применяется дефолт из шаблона на стороне домена/сервиса.
   */
  readonly instructionOverride?: string;
}>;

export type CreateCustomBotPayload = Readonly<{
  readonly workspaceId: ID<'Workspace'>;
  readonly name: string;
  readonly instruction: string;
}>;

export type UpdateInstructionPayload = Readonly<{
  readonly botId: ID<'Bot'>;
  readonly instruction: string;
}>;

export type ManageMultiAgentPayload = Readonly<{
  readonly botId: ID<'Bot'>;
  /** Версия схемы (для optimistic concurrency / future-proof) */
  readonly schemaVersion: number;
  /**
   * Serialized схема мультиагента.
   * Детальная доменная модель появится в `domain/MultiAgentSchema.ts`.
   */
  readonly serializedSchema: string;
}>;

export type PublishBotPayload = Readonly<{
  readonly botId: ID<'Bot'>;
  /** Публикуемая версия (если используется version-aware publishing) */
  readonly version?: number;
}>;

export type PauseBotPayload = Readonly<{
  readonly botId: ID<'Bot'>;
  /** Причина паузы (строгий union в `types/bots.ts`) */
  readonly reason: BotPauseReason;
}>;

export type ResumeBotPayload = Readonly<{
  readonly botId: ID<'Bot'>;
}>;

export type ArchiveBotPayload = Readonly<{
  readonly botId: ID<'Bot'>;
}>;

export type DeleteBotPayload = Readonly<{
  readonly botId: ID<'Bot'>;
}>;

export type SimulateBotMessagePayload = Readonly<{
  readonly botId: ID<'Bot'>;
  readonly message: string;
  /** Идентификатор симуляции/диалога для воспроизводимости */
  readonly simulationId: ID<'BotSimulation'>;
}>;

/* ============================================================================
 * 🧭 COMMAND DEFINITIONS (Map-Based)
 * ========================================================================== */

/**
 * Команда бота — то, что инициирует пользователь/система.
 * Discriminated union для type-safe dispatch (без if/else-монолитов).
 */
export type BotCommandPayloadMap = Readonly<{
  readonly [BotCommandTypes.CREATE_BOT_FROM_TEMPLATE]: CreateBotFromTemplatePayload;
  readonly [BotCommandTypes.CREATE_CUSTOM_BOT]: CreateCustomBotPayload;
  readonly [BotCommandTypes.UPDATE_INSTRUCTION]: UpdateInstructionPayload;
  readonly [BotCommandTypes.MANAGE_MULTI_AGENT]: ManageMultiAgentPayload;
  readonly [BotCommandTypes.PUBLISH_BOT]: PublishBotPayload;
  readonly [BotCommandTypes.PAUSE_BOT]: PauseBotPayload;
  readonly [BotCommandTypes.RESUME_BOT]: ResumeBotPayload;
  readonly [BotCommandTypes.ARCHIVE_BOT]: ArchiveBotPayload;
  readonly [BotCommandTypes.DELETE_BOT]: DeleteBotPayload;
  readonly [BotCommandTypes.SIMULATE_BOT_MESSAGE]: SimulateBotMessagePayload;
}>;

export type BotCommand = {
  readonly [K in keyof BotCommandPayloadMap]: Readonly<{
    readonly type: K;
    readonly meta: BotCommandMeta;
    readonly payload: BotCommandPayloadMap[K];
  }>;
}[keyof BotCommandPayloadMap];
