/**
 * @file packages/feature-bots/src/types/bots-initial.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Initial States, Audit Templates, Pipeline Hooks
 * ============================================================================
 *
 * Архитектурная роль:
 * - Канонические начальные состояния `BotsState` для reset-операций в store/effects
 * - Шаблоны для audit-событий (BotAuditEventTemplateMap) — фабрики для создания audit-событий
 * - Pipeline hooks (BotPipelineHookMap) с приоритетами для автоматических действий при lifecycle-событиях
 * - Immutable registration API (registerBotPipelineHook) для расширения hooks без мутации
 *
 * Принципы:
 * - ✅ SRP: только константы и pure функции, без бизнес-логики
 * - ✅ Immutable: Object.freeze для констант/реестров; factories возвращают plain object + Readonly типы
 * - ✅ Type-safe: соответствуют типам из `types/bots.ts`, `domain/BotAuditEvent.ts`, `types/bot-events.ts`
 * - ✅ Zero duplication: BotAuditEventTemplateMap auto-generated через satisfies
 * - ✅ Runtime-agnostic: не зависит от zustand/React/Next; годится для SSR и unit-тестов
 *
 * ⚠️ Runtime validation:
 * Функции (createBotAuditEventTemplate) только создают структуру без валидации.
 * Полная schema validation должна быть в boundary layer (schemas/bot-events.ts) через zod/valibot/arktype.
 */

import type { OperationState } from '@livai/core';

import type { BotId, BotUserId, BotWorkspaceId } from '../domain/Bot.js';
import type {
  BotAuditEvent,
  BotAuditEventContextMap,
  BotAuditEventType,
} from '../domain/BotAuditEvent.js';
import type { BotEvent, BotEventByType, BotEventType } from './bot-events.js';
import type { BotError, BotInfo, BotsState } from './bots.js';

/* ============================================================================
 * 🎯 CANONICAL INITIAL STATES
 * ============================================================================
 */

/* eslint-disable functional/prefer-immutable-types -- В этом файле используются branded primitive ID-типы (string & brand), которые иммутабельны по конструкции. Плагин eslint-plugin-functional иногда ошибочно классифицирует такие типы как ReadonlyDeep и требует Immutable, поэтому правило отключено локально для этого файла. */

/**
 * Локальный runtime helper для `idle`-состояния.
 *
 * ⚠️ ВАЖНО:
 * Это локальная минимальная реализация idle-состояния.
 * Должна соответствовать контракту `OperationState` из `core/state-kit`.
 * При изменении core — синхронизировать.
 */
const idle = <T, Op extends string, E>(): OperationState<T, Op, E> => ({ status: 'idle' });

/**
 * Начальное состояние ботов для store.
 * @note Единый источник истины для reset операций.
 */
export const initialBotsState = Object.freeze({
  entities: Object.freeze({}),
  operations: Object.freeze({
    create: idle<BotInfo, 'create', BotError>(),
    update: idle<BotInfo, 'update', BotError>(),
    delete: idle<void, 'delete', BotError>(),
  }),
}) satisfies Readonly<BotsState>;

/* ============================================================================
 * 📋 AUDIT EVENT TEMPLATES
 * ============================================================================
 */

/**
 * Шаблон для создания audit-события по типу события.
 * Generic type для type-safe создания шаблонов с правильным context.
 * @note Runtime validation должна быть в boundary layer (schemas/bot-events.ts).
 * Эта функция только создает структуру, валидация выполняется на boundary.
 */
export function createBotAuditEventTemplate<TType extends BotAuditEventType>(
  eventType: TType, // Тип audit-события
  botId: BotId, // Идентификатор бота
  workspaceId: BotWorkspaceId, // Идентификатор рабочего пространства
  userId?: BotUserId, // Идентификатор пользователя (опционально)
  context?: BotAuditEventContextMap[TType], // Контекст события (опционально, type-safe в зависимости от eventType)
): Readonly<Omit<BotAuditEvent<TType>, 'eventId' | 'timestamp'>> { // Шаблон audit-события с заполненными полями (eventId и timestamp должны быть добавлены при создании)
  return {
    type: eventType,
    botId,
    workspaceId,
    ...(userId !== undefined && { userId }),
    ...(context !== undefined && { context }),
  };
}

/**
 * Map шаблонов для всех типов audit-событий.
 * Автоматически генерируется из BotAuditEventContextMap — zero duplication.
 * Используется для быстрого создания шаблонов по типу события.
 * @note Автогенерация через satisfies для устранения boilerplate при добавлении новых типов событий.
 */
export const BotAuditEventTemplateMap = Object.freeze(
  {
    bot_created: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['bot_created'],
    ) => createBotAuditEventTemplate('bot_created', botId, workspaceId, userId, context),
    bot_published: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['bot_published'],
    ) => createBotAuditEventTemplate('bot_published', botId, workspaceId, userId, context),
    bot_updated: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['bot_updated'],
    ) => createBotAuditEventTemplate('bot_updated', botId, workspaceId, userId, context),
    bot_deleted: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['bot_deleted'],
    ) => createBotAuditEventTemplate('bot_deleted', botId, workspaceId, userId, context),
    instruction_updated: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['instruction_updated'],
    ) => createBotAuditEventTemplate('instruction_updated', botId, workspaceId, userId, context),
    multi_agent_updated: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['multi_agent_updated'],
    ) => createBotAuditEventTemplate('multi_agent_updated', botId, workspaceId, userId, context),
    config_changed: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['config_changed'],
    ) => createBotAuditEventTemplate('config_changed', botId, workspaceId, userId, context),
    policy_violation: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap['policy_violation'],
    ) => createBotAuditEventTemplate('policy_violation', botId, workspaceId, userId, context),
  } as const satisfies {
    readonly [K in BotAuditEventType]: (
      botId: BotId,
      workspaceId: BotWorkspaceId,
      userId?: BotUserId,
      context?: BotAuditEventContextMap[K],
    ) => Readonly<Omit<BotAuditEvent<K>, 'eventId' | 'timestamp'>>;
  },
);

/**
 * Тип шаблона audit-события.
 * Используется для type-safe создания audit-событий.
 */
export type BotAuditEventTemplate =
  typeof BotAuditEventTemplateMap[keyof typeof BotAuditEventTemplateMap];

/* ============================================================================
 * 🔗 PIPELINE HOOKS (Lifecycle Event Handlers)
 * ============================================================================
 */

/**
 * Приоритет выполнения hook (меньше = выше приоритет).
 * Используется для детерминированного упорядочивания hooks при выполнении.
 */
export type HookPriority = number;

/**
 * Функция-обработчик pipeline hook для lifecycle-события.
 * Используется для автоматических действий при возникновении domain events.
 */
export type BotPipelineHookFunction<TEvent extends BotEvent = BotEvent> = (
  event: TEvent, // Domain event бота
) => void | Promise<void>; // Результат обработки (может быть void, Promise, или Effect)

/**
 * Данные hook (приоритет).
 * Отдельный тип для разделения функции и данных (избегает no-mixed-types).
 */
export type BotPipelineHookData = Readonly<{
  /** Приоритет выполнения (меньше = выше приоритет, по умолчанию 0) */
  readonly priority?: HookPriority;
}>;

/**
 * Hook с приоритетом для детерминированного упорядочивания.
 * @note Hooks выполняются в порядке приоритета (ascending: 0, 1, 2...).
 * @note Hooks с одинаковым приоритетом могут выполняться в любом порядке (для детерминированности используйте Effect.sequential в lib слое).
 */
export type BotPipelineHookWithPriority<TEvent extends BotEvent = BotEvent> = Readonly<
  BotPipelineHookData & {
    /** Функция-обработчик hook */
    readonly hook: BotPipelineHookFunction<TEvent>;
  }
>;

/**
 * Map pipeline hooks для всех типов lifecycle-событий.
 * Используется для регистрации автоматических действий при событиях.
 * @note Hooks хранятся с приоритетами для детерминированного упорядочивания.
 * @note Логика упорядочивания и выполнения должна быть в lib/bot-pipeline.ts (Effect.sequential).
 */
export type BotPipelineHookMap = Readonly<
  {
    readonly [K in BotEventType]?: readonly BotPipelineHookWithPriority<BotEventByType<K>>[];
  }
>;

const EMPTY_HOOKS: readonly BotPipelineHookWithPriority<BotEvent>[] = Object.freeze([]);

/**
 * Пустой шаблон pipeline hooks для инициализации.
 * Используется для инициализации hooks в effects/pipeline слое.
 */
export const initialBotPipelineHookMap = Object.freeze({}) satisfies Readonly<BotPipelineHookMap>;

/**
 * Immutable registration API для добавления hooks.
 * Создает новый map с добавленным hook, не мутируя исходный.
 * @note Предполагается, что регистрация происходит на этапе инициализации (не в hot-path).
 * @note Упорядочивание по приоритету должно выполняться в lib/bot-pipeline.ts при выполнении.
 */
export function registerBotPipelineHook<TType extends BotEventType>(
  map: Readonly<BotPipelineHookMap>, // Текущий map hooks
  eventType: TType, // Тип события для регистрации hook
  hook: BotPipelineHookFunction<BotEventByType<TType>>, // Hook для регистрации
  priority?: HookPriority, // Приоритет hook (@default 0)
): Readonly<BotPipelineHookMap> { // Новый map с добавленным hook
  const existingHooks: readonly BotPipelineHookWithPriority<BotEventByType<TType>>[] =
    // eslint-disable-next-line security/detect-object-injection -- eventType валидирован через generic constraint TType extends BotEventType
    map[eventType]
      ?? (EMPTY_HOOKS as readonly BotPipelineHookWithPriority<BotEventByType<TType>>[]);
  const newHook: Readonly<BotPipelineHookWithPriority<BotEventByType<TType>>> = Object.freeze({
    hook,
    ...(priority !== undefined && { priority }),
  });

  const updatedMap = Object.freeze({
    ...map,
    [eventType]: Object.freeze([...existingHooks, newHook]),
  });

  return updatedMap;
}

/* eslint-enable functional/prefer-immutable-types */
