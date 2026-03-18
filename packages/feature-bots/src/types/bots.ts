/**
 * @file packages/feature-bots/src/types/bots.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Агрегирующие типы состояния и операций ботов
 * ============================================================================
 *
 * Архитектурная роль:
 * - Агрегирующие типы для UI/effects/store (без runtime-зависимостей)
 * - Типы статусов ботов (BotStatus: draft, active, paused, archived, deleted, suspended, deprecated)
 *   с причинами паузы/ограничений (BotPauseReason, BotEnforcementReason)
 * - Система ошибок с категоризацией (7 категорий: validation, policy, permission, channel, webhook, parsing, integration),
 *   severity (low/medium/high/critical), exhaustive union кодов ошибок и контекстом (BotError, BotErrorContext, BotField)
 * - Структура error-mapping для rule-engine (BotErrorMappingConfig, BotErrorMappingRegistry)
 * - Контракт операций для store: `OperationState` из core/state-kit; операции живут только в `state.operations`
 * - Store-форма состояния: `BotsState` (entities + operations), без side-effects и без UI-логики
 * - Базовая информация о боте для UI/store (BotInfo)
 * - BotPauseReason/BotEnforcementReason — атомарные lifecycle-контракты в `types/bot-lifecycle.ts` (единый source-of-truth, без drift/циклов)
 *
 * Принципы:
 * - ❌ Нет бизнес-логики, нет локализации (message генерируется в UI через i18n)
 * - ✅ Exhaustive unions (без unbounded string/Record в domain-типах), discriminated unions для статусов/ошибок
 * - ✅ Immutable / readonly: типы описывают данные, а не поведение (без side-effects)
 * - ✅ Разделение ответственности: статус описывает состояние (без ID), ID в BotInfo
 * - ✅ Scalable rule-engine через registry pattern
 * - ✅ Microservice-ready, vendor-agnostic
 */

import type { BotPolicyAction, BotPolicyDeniedReason, OperationState } from '@livai/core';
import type { ID, ISODateString, JsonObject, TraceId } from '@livai/core-contracts';

import type { BotEnforcementReason, BotPauseReason } from './bot-lifecycle.js';

/* ============================================================================
 * 🧭 TYPES — BOT STATUS (Discriminated Union)
 * ============================================================================
 */

/**
 * Статус бота в системе.
 * Описывает только состояние (lifecycle), без entity-свойств.
 * ID, createdAt, currentVersion хранятся в BotInfo, не дублируются в статусе.
 * Discriminated union для type-safe обработки различных состояний.
 */
export type BotStatus =
  | Readonly<{
    /** Тип статуса: черновик */
    readonly type: 'draft';
  }>
  | Readonly<{
    /** Тип статуса: активен */
    readonly type: 'active';
    /** Дата публикации */
    readonly publishedAt: ISODateString;
  }>
  | Readonly<{
    /** Тип статуса: приостановлен */
    readonly type: 'paused';
    /** Дата приостановки */
    readonly pausedAt: ISODateString;
    /** Причина приостановки */
    readonly reason: BotPauseReason;
  }>
  | Readonly<{
    /** Тип статуса: заархивирован */
    readonly type: 'archived';
    /** Дата архивации */
    readonly archivedAt: ISODateString;
  }>
  | Readonly<{
    /** Тип статуса: удалён */
    readonly type: 'deleted';
    /** Дата удаления */
    readonly deletedAt: ISODateString;
  }>
  | Readonly<{
    /** Тип статуса: приостановлен (внешняя интеграция) */
    readonly type: 'suspended';
    /** Дата приостановки */
    readonly suspendedAt: ISODateString;
    /** Причина приостановки */
    readonly reason: BotEnforcementReason;
  }>
  | Readonly<{
    /** Тип статуса: устарел (deprecated) */
    readonly type: 'deprecated';
    /** Дата устаревания */
    readonly deprecatedAt: ISODateString;
    /** Рекомендуемая замена (опционально) */
    readonly replacementBotId?: ID<'Bot'>;
  }>;

/* ============================================================================
 * ⚠️ BOT ERROR CATEGORIES (Exhaustive Union)
 * ============================================================================
 */

/**
 * Категории ошибок ботов.
 * Exhaustive union для type-safe категоризации.
 */
export type BotErrorCategory =
  | 'validation'
  | 'policy'
  | 'permission'
  | 'channel'
  | 'webhook'
  | 'parsing'
  | 'integration';

/**
 * Уровни серьёзности ошибок для telemetry и alerts.
 * Используется для приоритизации и фильтрации ошибок.
 */
export type BotErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Коды ошибок валидации ботов.
 * Exhaustive union для type-safe обработки ошибок валидации.
 */
export type BotValidationErrorCode =
  | 'BOT_NAME_INVALID'
  | 'BOT_NAME_TOO_SHORT'
  | 'BOT_NAME_TOO_LONG'
  | 'BOT_NAME_DUPLICATE'
  | 'BOT_INSTRUCTION_EMPTY'
  | 'BOT_INSTRUCTION_TOO_LONG'
  | 'BOT_SETTINGS_INVALID'
  | 'BOT_TEMPLATE_NOT_FOUND'
  | 'BOT_VERSION_INVALID'
  | 'BOT_MULTI_AGENT_SCHEMA_INVALID'
  | 'BOT_PROMPT_INVALID'
  | 'BOT_WORKSPACE_ID_INVALID';

/**
 * Коды ошибок политики ботов.
 * Exhaustive union для type-safe обработки ошибок политики.
 */
export type BotPolicyErrorCode =
  | 'BOT_POLICY_ACTION_DENIED'
  | 'BOT_POLICY_MODE_INVALID'
  | 'BOT_POLICY_ROLE_INSUFFICIENT'
  | 'BOT_POLICY_ARCHIVED'
  | 'BOT_POLICY_SYSTEM_BOT_RESTRICTED';

/**
 * Коды ошибок прав доступа ботов.
 * Exhaustive union для type-safe обработки ошибок прав доступа.
 */
export type BotPermissionErrorCode =
  | 'BOT_PERMISSION_DENIED'
  | 'BOT_PERMISSION_READ_DENIED'
  | 'BOT_PERMISSION_WRITE_DENIED'
  | 'BOT_PERMISSION_EXECUTE_DENIED'
  | 'BOT_PERMISSION_DELETE_DENIED'
  | 'BOT_WORKSPACE_ACCESS_DENIED';

/**
 * Коды ошибок каналов ботов.
 * Exhaustive union для type-safe обработки ошибок каналов.
 */
export type BotChannelErrorCode =
  | 'BOT_CHANNEL_NOT_FOUND'
  | 'BOT_CHANNEL_INVALID'
  | 'BOT_CHANNEL_DISABLED'
  | 'BOT_CHANNEL_CONNECTION_FAILED'
  | 'BOT_CHANNEL_RATE_LIMIT_EXCEEDED';

/**
 * Коды ошибок webhook ботов.
 * Exhaustive union для type-safe обработки ошибок webhook.
 */
export type BotWebhookErrorCode =
  | 'BOT_WEBHOOK_URL_INVALID'
  | 'BOT_WEBHOOK_TIMEOUT'
  | 'BOT_WEBHOOK_FAILED'
  | 'BOT_WEBHOOK_RETRY_EXCEEDED'
  // eslint-disable-next-line no-secrets/no-secrets -- код ошибки, не секрет
  | 'BOT_WEBHOOK_SIGNATURE_INVALID'
  | 'BOT_WEBHOOK_RATE_LIMIT_EXCEEDED';

/**
 * Коды ошибок парсинга ботов.
 * Exhaustive union для type-safe обработки ошибок парсинга.
 */
export type BotParsingErrorCode =
  | 'BOT_PARSING_INSTRUCTION_INVALID'
  | 'BOT_PARSING_SETTINGS_INVALID'
  | 'BOT_PARSING_MULTI_AGENT_INVALID'
  | 'BOT_PARSING_PROMPT_INVALID'
  | 'BOT_PARSING_JSON_INVALID';

/**
 * Коды ошибок интеграций ботов.
 * Exhaustive union для type-safe обработки ошибок интеграций.
 */
export type BotIntegrationErrorCode =
  | 'BOT_INTEGRATION_NOT_FOUND'
  | 'BOT_INTEGRATION_INVALID'
  | 'BOT_INTEGRATION_AUTH_FAILED'
  | 'BOT_INTEGRATION_TIMEOUT'
  | 'BOT_INTEGRATION_RATE_LIMIT_EXCEEDED'
  | 'BOT_INTEGRATION_QUOTA_EXCEEDED';

/**
 * Объединённый тип всех кодов ошибок ботов.
 * Используется для type-safe маппинга ошибок.
 */
export type BotErrorCode =
  | BotValidationErrorCode
  | BotPolicyErrorCode
  | BotPermissionErrorCode
  | BotChannelErrorCode
  | BotWebhookErrorCode
  | BotParsingErrorCode
  | BotIntegrationErrorCode;

/**
 * Поля бота для валидации ошибок.
 * Exhaustive union для type-safe обработки полей.
 */
export type BotField =
  | 'name'
  | 'instruction'
  | 'template'
  | 'settings'
  | 'workspace_id'
  | 'version'
  | 'multi_agent_schema'
  | 'prompt';

/**
 * Контекст ошибки бота.
 * Типизированные поля для избежания context-leakage.
 */
export type BotErrorContext = Readonly<{
  /** Поле формы, в котором произошла ошибка */
  readonly field?: BotField;
  /** Значение поля, вызвавшее ошибку */
  readonly value?: string | number | boolean;
  /** Дополнительные данные для логирования */
  readonly details?: JsonObject;
  /** Идентификатор бота (если применимо) */
  readonly botId?: ID<'Bot'>;
  /** Идентификатор версии бота (если применимо) */
  readonly version?: number;
  /** Действие, которое вызвало ошибку */
  readonly action?: BotPolicyAction;
  /** Причина отказа политики (если применимо) */
  readonly policyReason?: BotPolicyDeniedReason;
  /** Trace ID для distributed tracing */
  readonly traceId?: TraceId;
  /** Временная метка ошибки */
  readonly timestamp?: ISODateString;
}>;

/**
 * Ошибка бота с категоризацией и severity.
 * Используется для store, effects и UI.
 * Сообщение (message) генерируется в UI layer через i18n на основе code.
 */
export type BotError = Readonly<{
  /** Категория ошибки */
  readonly category: BotErrorCategory;
  /** Код ошибки */
  readonly code: BotErrorCode;
  /** Уровень серьёзности для telemetry и alerts */
  readonly severity: BotErrorSeverity;
  /** Контекст ошибки */
  readonly context?: BotErrorContext;
  /**
   * Можно ли повторить операцию.
   * Обязательное поле, когда ошибка влияет на retry-логику (rule-engine / effects / UI).
   */
  readonly retryable: boolean;
}>;

/* ============================================================================
 * 🗺️ ERROR MAPPING STRUCTURE
 * ============================================================================
 */

/** Базовые свойства конфигурации маппинга ошибки бота. */
export type BotErrorMappingConfigBase = Readonly<{
  /** UI-friendly код ошибки */
  readonly code: BotErrorCode;
  /** Категория ошибки */
  readonly category: BotErrorCategory;
  /** Уровень серьёзности */
  readonly severity: BotErrorSeverity;
  /** Можно ли повторить операцию */
  readonly retryable: boolean;
}>;

/** Функции для расширенной обработки ошибок. */
export type BotErrorMappingConfigFunctions = Readonly<{
  /** Функция извлечения контекста из исходной ошибки */
  readonly extractContext?: (
    error: unknown,
  ) => BotErrorContext | undefined;
}>;

/**
 * Конфигурация маппинга для одного типа ошибки бота.
 * Используется в rule-engine для детерминированного маппинга ошибок.
 */
export type BotErrorMappingConfig = BotErrorMappingConfigBase & BotErrorMappingConfigFunctions;

/**
 * Registry маппинга ошибок ботов.
 * Single source of truth для всех mapping tables.
 * Используется в rule-engine без if/else-монолита.
 */
export type BotErrorMappingRegistry = Readonly<
  {
    readonly [K in BotErrorCode]: BotErrorMappingConfig;
  }
>;

/* ============================================================================
 * 📊 BOT STATE (Store/Effects/UI)
 * ============================================================================
 */

/**
 * Базовая информация о боте для store.
 * Минимальная структура для UI и effects.
 */
export type BotInfo = Readonly<{
  /** Идентификатор бота */
  readonly id: ID<'Bot'>;
  /** Имя бота */
  readonly name: string;
  /** Статус бота */
  readonly status: BotStatus;
  /** Идентификатор рабочего пространства */
  readonly workspaceId: ID<'Workspace'>;
  /** Текущая версия бота */
  readonly currentVersion: number;
  /** Дата создания */
  readonly createdAt: ISODateString;
  /** Дата последнего обновления */
  readonly updatedAt?: ISODateString;
}>;

/* ============================================================================
 * 🔁 OPERATIONS — core/state-kit (feature-bots)
 * ============================================================================
 */

/**
 * Единый source of truth для ключей операций.
 * Нельзя дублировать эти строки в store: только через OperationKey.
 */
export type OperationKey =
  | 'create'
  | 'update'
  | 'delete';

/**
 * Состояние операции для store/effects/UI.
 * @remarks
 * Это `core/state-kit` (единый контракт операций во всём проекте).
 */
// NOTE: намеренно НЕ вводим alias `BotOperationState`, чтобы не создавать второй уровень абстракции и drift.

type OperationResultByKey<K extends OperationKey> = K extends 'create' ? BotInfo
  : K extends 'update' ? BotInfo
  : K extends 'delete' ? void
  : never;

export type BotsOperations = Readonly<
  {
    readonly [K in OperationKey]: OperationState<OperationResultByKey<K>, K, BotError>;
  }
>;

export type BotsState = Readonly<{
  /**
   * Нормализованное хранилище entities для store-слоя.
   * @remarks
   * `Record` допустим здесь (store layer), но не должен использоваться как domain-модель.
   */
  readonly entities: Readonly<Record<ID<'Bot'>, BotInfo>>;
  readonly operations: BotsOperations;
}>;
