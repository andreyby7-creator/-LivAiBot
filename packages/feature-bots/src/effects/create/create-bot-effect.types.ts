/**
 * @file packages/feature-bots/src/effects/create/create-bot-effect.types.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot Effect Types (DI Contracts)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Контракты DI и конфигурация для create-bot orchestrator'ов (template/custom).
 * - Централизует зависимости effect-слоя: store/api/audit/lifecycle + policy + error mapping.
 * - Изолирует create-effect типы от конкретных runtime реализаций (HTTP/Zustand/логгеров).
 *
 * Принципы:
 * - ✅ SRP: только типы и контракты, без бизнес-логики и side-effects.
 * - ✅ Deterministic: поведение effect определяется только явным input/config.
 * - ✅ Extensible: hooks и расширения добавляются через конфигурацию без ломки API.
 * - ✅ Effect-ready: типы совместимы с shared lifecycle helper и Effect-based портами.
 *
 * @remarks
 * - Policy/permission проверки выполняются в orchestrator, здесь фиксируется только DI-контракт.
 * - Нормализация ошибок должна выполняться через `mapBotErrorToUI` + `mapErrorConfig`.
 * - Upstream обязан валидировать `workspaceId` и `request` до вызова effect
 *   (runtime-валидация body обычно выполняется в api-adapter через Zod).
 */

import type { BotPermissions, BotPolicy } from '@livai/core';

import type { BotWorkspaceId } from '../../domain/Bot.js';
import type { MapBotErrorConfig } from '../../lib/error-mapper.js';
import type { OperationId } from '../../types/bot-commands.js';
import type { BotError, BotInfo } from '../../types/bots.js';
import type { BotApiClientPort, BotCreateRequestTransport } from '../shared/api-client.port.js';
import type { BotAuditPort } from '../shared/audit.port.js';
import type { BotsStorePort } from '../shared/bots-store.port.js';
import type {
  OperationLifecycleHelper,
  OperationLifecycleOperationHandler,
} from '../shared/operation-lifecycle.js';

/* ============================================================================
 * 🧭 TYPES — SHARED OPERATION TEMPLATE (DRY для create/update/delete/...)
 * ============================================================================
 */

/**
 * Общий шаблон типизации operation-effect для повторного использования в других flow.
 * Помогает сохранить единый контракт input/output/operation в разных эффектах.
 */
export type OperationEffectTypes<
  TInput,
  TOutput,
  TOperation extends string,
> = Readonly<{
  readonly input: TInput;
  readonly output: TOutput;
  readonly operation: TOperation;
}>;

/* ============================================================================
 * 🧭 TYPES — INPUTS
 * ============================================================================
 */

type CreateBotEffectInputBase = Readonly<{
  readonly workspaceId: BotWorkspaceId;
  readonly operationId?: OperationId;
  readonly request: BotCreateRequestTransport;
}>;

type CreateBotEffectInputHooks = Readonly<{
  readonly onSuccess?: (bot: BotInfo) => void;
  readonly onError?: (error: BotError) => void;
}>;

/** Группа типов input-контракта create-flow. */
export type CreateBotEffectInputTypes = Readonly<{
  readonly base: CreateBotEffectInputBase;
  readonly hooks: CreateBotEffectInputHooks;
}>;

export type CreateBotEffectInput = CreateBotEffectInputBase & CreateBotEffectInputHooks;

/* ============================================================================
 * 🧭 TYPES — DEPENDENCIES (DI)
 * ============================================================================
 */

type CreateBotEffectPorts = Readonly<{
  readonly storePort: BotsStorePort;
  readonly apiClient: BotApiClientPort;
  readonly auditPort: BotAuditPort;
  readonly lifecycleHelper: OperationLifecycleHelper;
}>;

type CreateBotEffectPolicies = Readonly<{
  readonly botPolicy: BotPolicy;
  readonly botPermissions: BotPermissions;
}>;

type CreateBotEffectErrorHandling = Readonly<{
  readonly mapErrorConfig: MapBotErrorConfig;
}>;

type CreateBotEffectOverrides = Readonly<{
  /**
   * Локальное переопределение lifecycle handlers для create-flow.
   * Используется, когда orchestrator требует особых loading/error transitions.
   * Ключи ограничены `'create'`, что совпадает с DEFAULT_OPERATION_HANDLERS в lifecycle helper.
   */
  readonly operationHandlers?: Partial<Record<'create', OperationLifecycleOperationHandler>>;
}>;

/** Группа типов DI-конфигурации create-flow. */
export type CreateBotEffectConfigTypes = Readonly<{
  readonly ports: CreateBotEffectPorts;
  readonly policies: CreateBotEffectPolicies;
  readonly errorHandling: CreateBotEffectErrorHandling;
  readonly overrides: CreateBotEffectOverrides;
}>;

export type CreateBotEffectConfig =
  & CreateBotEffectPorts
  & CreateBotEffectPolicies
  & CreateBotEffectErrorHandling
  & CreateBotEffectOverrides;
