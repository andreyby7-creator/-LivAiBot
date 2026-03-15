/**
 * @file packages/feature-bots/src/types/bots-initial.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Initial States, Audit Templates, Pipeline Hooks
 * ============================================================================
 *
 * Архитектурная роль:
 * - Канонические начальные состояния Bot для reset-операций в store/effects
 * - Шаблоны для audit-событий (BotAuditEventTemplateMap) — фабрики для создания audit-событий
 * - Pipeline hooks (BotPipelineHookMap) с приоритетами для автоматических действий при lifecycle-событиях
 * - Immutable registration API (registerBotPipelineHook) для расширения hooks без мутации
 *
 * Принципы:
 * - ✅ SRP: только константы и pure функции, без бизнес-логики
 * - ✅ Immutable: Object.freeze для всех объектов, immutable registration для hooks
 * - ✅ Type-safe: соответствуют типам из types/bots.ts, domain/BotAuditEvent.ts, types/bot-events.ts
 * - ✅ Zero duplication: BotAuditEventTemplateMap auto-generated через satisfies
 * - ✅ Domain-pure: не зависит от store/effects/transport (чистые константы/функции)
 *
 * ⚠️ Runtime validation:
 * Функции (createBotAuditEventTemplate) только создают структуру без валидации.
 * Полная schema validation должна быть в boundary layer (schemas/bot-events.ts) через zod/valibot/arktype.
 */

import type {
  BotAuditEvent,
  BotAuditEventContextMap,
  BotAuditEventType,
} from '../domain/BotAuditEvent.js';
import type { BotEvent, BotEventByType, BotEventType } from './bot-events.js';
import type { BotIdle, BotListState, BotState } from './bots.js';

/* ============================================================================
 * 🎯 CANONICAL INITIAL STATES
 * ============================================================================
 */

/**
 * Начальное состояние операции с ботом (idle).
 * @note Единый источник истины для reset операций.
 */
export const initialBotOperationState: Readonly<BotIdle> = Object.freeze({
  status: 'idle',
});

/**
 * Начальное состояние списка ботов.
 * @note Единый источник истины для reset операций.
 */
export const initialBotListState: Readonly<BotListState> = Object.freeze({
  bots: Object.freeze([]),
  currentBotId: null,
  listState: initialBotOperationState,
  currentBotState: initialBotOperationState,
});

/**
 * Начальное состояние ботов для store.
 * @note Единый источник истины для reset операций.
 */
export const initialBotState: Readonly<BotState> = Object.freeze({
  list: initialBotListState,
  create: initialBotOperationState,
  update: initialBotOperationState,
  delete: initialBotOperationState,
  publish: initialBotOperationState,
  pause: initialBotOperationState,
  resume: initialBotOperationState,
  archive: initialBotOperationState,
});

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
  botId: string, // Идентификатор бота
  workspaceId: string, // Идентификатор рабочего пространства
  userId?: string, // Идентификатор пользователя (опционально)
  context?: BotAuditEventContextMap[TType], // Контекст события (опционально, type-safe в зависимости от eventType)
): Readonly<Omit<BotAuditEvent<TType>, 'eventId' | 'timestamp'>> { // Шаблон audit-события с заполненными полями (eventId и timestamp должны быть добавлены при создании)
  return Object.freeze({
    type: eventType,
    botId: botId as BotAuditEvent<TType>['botId'],
    workspaceId: workspaceId as BotAuditEvent<TType>['workspaceId'],
    ...(userId !== undefined && { userId: userId as BotAuditEvent<TType>['userId'] }),
    ...(context !== undefined && { context }),
  }) as Readonly<Omit<BotAuditEvent<TType>, 'eventId' | 'timestamp'>>;
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
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['bot_created'],
    ) => createBotAuditEventTemplate('bot_created', botId, workspaceId, userId, context),
    bot_published: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['bot_published'],
    ) => createBotAuditEventTemplate('bot_published', botId, workspaceId, userId, context),
    bot_updated: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['bot_updated'],
    ) => createBotAuditEventTemplate('bot_updated', botId, workspaceId, userId, context),
    bot_deleted: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['bot_deleted'],
    ) => createBotAuditEventTemplate('bot_deleted', botId, workspaceId, userId, context),
    instruction_updated: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['instruction_updated'],
    ) => createBotAuditEventTemplate('instruction_updated', botId, workspaceId, userId, context),
    multi_agent_updated: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['multi_agent_updated'],
    ) => createBotAuditEventTemplate('multi_agent_updated', botId, workspaceId, userId, context),
    config_changed: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['config_changed'],
    ) => createBotAuditEventTemplate('config_changed', botId, workspaceId, userId, context),
    policy_violation: (
      botId: string,
      workspaceId: string,
      userId?: string,
      context?: BotAuditEventContextMap['policy_violation'],
    ) => createBotAuditEventTemplate('policy_violation', botId, workspaceId, userId, context),
  } as const satisfies {
    readonly [K in BotAuditEventType]: (
      botId: string,
      workspaceId: string,
      userId?: string,
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
  // eslint-disable-next-line functional/prefer-immutable-types -- void и Promise не могут быть Immutable
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

/**
 * Пустой шаблон pipeline hooks для инициализации.
 * Используется для инициализации hooks в effects/pipeline слое.
 */
export const initialBotPipelineHookMap: Readonly<BotPipelineHookMap> = Object.freeze({});

/**
 * Immutable registration API для добавления hooks.
 * Создает новый map с добавленным hook, не мутируя исходный.
 * @note Упорядочивание по приоритету должно выполняться в lib/bot-pipeline.ts при выполнении.
 */
export function registerBotPipelineHook<TType extends BotEventType>(
  map: Readonly<BotPipelineHookMap>, // Текущий map hooks
  eventType: TType, // Тип события для регистрации hook
  hook: BotPipelineHookFunction<BotEventByType<TType>>, // Hook для регистрации
  priority?: HookPriority, // Приоритет hook (по умолчанию 0)
): Readonly<BotPipelineHookMap> { // Новый map с добавленным hook
  // eslint-disable-next-line functional/prefer-immutable-types -- объект создается и сразу замораживается
  const existingHooks: readonly BotPipelineHookWithPriority<BotEventByType<TType>>[] =
    // eslint-disable-next-line security/detect-object-injection -- eventType валидирован через generic constraint TType extends BotEventType
    map[eventType] ?? Object.freeze([]);
  const newHook: Readonly<BotPipelineHookWithPriority<BotEventByType<TType>>> = Object.freeze({
    hook,
    ...(priority !== undefined && { priority }),
  });

  const updatedMap = Object.freeze({
    ...map,
    [eventType]: Object.freeze([...existingHooks, newHook]),
  });

  return updatedMap as Readonly<BotPipelineHookMap>;
}
