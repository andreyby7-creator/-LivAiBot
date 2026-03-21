/**
 * @file packages/feature-bots/src/effects/create-custom-bot.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Custom Bot (Effect Orchestrator)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Оркестратор create-flow **без** доменного `BotTemplate` (кастомные name/instruction/settings).
 * - SRP: только оркестрация, без HTTP/IO внутри (IO выполняется через DI-порты в Effect).
 * - Детерминированность по стандарту проекта: время/идентификаторы берутся из DI (clock/eventIdGenerator),
 *   а не из `Date.now()` внутри.
 * - Pre-flight: `prepareCustomBotCreationContext(...)` (permissions `create` + policy `create_custom` на синтетическом draft).
 * - Публичный контракт входа: `userId` + `actorRole` обязательны в типе `CreateCustomBotRequest`
 *   (канонический actor для guards).
 *
 * Инварианты:
 * - Любые ошибки внутри run-ветки прокидываются наружу через shared lifecycle (`operation-lifecycle`):
 *   layer `error.ts` нормализует их в `BotError`, а pipeline/lifecycle выполняет error/success side-effects.
 * - Создание audit payload выполняется через существующий `create-bot-audit.mapper.ts`
 *   (fail-closed schema validation внутри mapper).
 * - Fallback botId для failure-audit строится детерминированно через {@link buildFallbackBotId}
 *   (`toBotIdFromErrorOrFallback`), с {@link customBotCreateSourceId} как техническим `templateId` для хэша.
 * - Паритет с `create-bot-from-template.ts`: тот же `CreateBotEffectConfig`, `lifecycleHelper.runOperation`, те же порты времени/id
 *   (`CreateBotFromTemplateDeps`), отличается входом и policy action (`create_custom` vs `configure` + `BotTemplate`).
 * - Детерминированный `operationId`: соль `create-custom-bot-operation-v2` + stable JSON для `settings` (осознанный
 *   breaking change относительно прежнего `JSON.stringify` + `create-custom-bot-operation-v1` — idempotency-ключи сменились).
 */

import type { BotRole, BotState } from '@livai/core';
import type { Effect } from '@livai/core/effect';

import type { BotId, BotUserId, BotWorkspaceId } from '../domain/Bot.js';
import type { BotSettings } from '../domain/BotSettings.js';
import type { BotAuditEventValues } from '../schemas/index.js';
import type { OperationId } from '../types/bot-commands.js';
import type { BotError, BotInfo } from '../types/bots.js';
import type { CreateBotLikeHelpers } from './create/create-bot.helpers.js';
import {
  buildCustomCreateBotRequestBody,
  buildDraftBotId,
  buildFallbackBotId,
  customBotCreateSourceId,
} from './create/create-bot.helpers.js';
import {
  mapCreateBotEffectInputToApiInput,
  mapCreateBotResponseToBotInfo,
} from './create/create-bot-api.mapper.js';
import type {
  CreateBotFailureAuditContext,
  CreateBotSuccessAuditContext,
} from './create/create-bot-audit.mapper.js';
import {
  mapCreateBotErrorToAuditEvent,
  mapCreateBotResultToAuditEvent,
} from './create/create-bot-audit.mapper.js';
import type {
  CreateBotEffectConfig,
  CreateBotEffectInput,
} from './create/create-bot-effect.types.js';
import { updateCreateBotState } from './create/create-bot-store-updater.js';
import type {
  ClockPort,
  CreateBotFromTemplateDeps,
  EventIdGeneratorPort,
} from './create-bot-from-template.js';
import type { BotResponseTransport } from './shared/api-client.port.js';
import {
  buildOperationIdSourceWithStableJson,
  operationIdSalt,
  toDeterministicOperationId,
} from './shared/operation-id-fingerprint.js';
import { buildActorUserContext } from './shared/pure-guards.js';

/* ============================================================================
 * 🎯 PUBLIC TYPES — request / deps (clock+eventId — SSOT в create-bot-from-template.ts)
 * ============================================================================
 */

/** DI-зависимости: те же `clock` + `eventIdGenerator`, что у `create-bot-from-template`. */
export type CreateCustomBotDeps = CreateBotFromTemplateDeps;

/** Вход create-flow: кастомный бот (без шаблона). */
export type CreateCustomBotRequest = {
  readonly workspaceId: BotWorkspaceId;
  readonly name: string;
  readonly instruction: string;
  readonly settings: BotSettings;

  /** Опциональная привязка к каталогу (если UI выбрал базовый шаблон как стартовую точку). */
  readonly templateId?: string;

  /** Идентификатор операции (idem-potency и correlated tracing). */
  readonly operationId?: OperationId;

  /** Correlation traceId для audit (опционально). */
  readonly traceId?: string;

  /** Инициатор (обязателен для permission/policy pre-check). */
  readonly userId: BotUserId;

  /**
   * Роль инициатора для policy/permissions pre-check.
   * @remarks
   * Вместе с `userId` задаёт канонический `ActorUserContext` для guards (без смешанного режима).
   */
  readonly actorRole: BotRole;

  /**
   * Пакет hooks для `best-effort` наблюдаемости/интеграции без IO.
   *
   * @remarks
   * Вынесен в отдельный тип, чтобы избежать `functional/no-mixed-types`:
   * в объекте request должны быть только данные (без function-мемберов).
   */
  readonly hooks?: Readonly<{
    /** Hook вызывается после успешного store-update (best-effort, без IO). */
    readonly onSuccess?: (bot: BotInfo) => void;

    /** Hook вызывается после маппинга ошибки (best-effort, без IO). */
    readonly onError?: (error: BotError) => void;
  }>;
};

/* ============================================================================
 * 🔁 INTERNAL HELPERS — deterministic operation id + fallback botId + pre-flight
 * ============================================================================
 */

function toBotIdFromErrorOrFallback(
  input: Readonly<{
    readonly error: BotError;
    readonly workspaceId: BotWorkspaceId;
    readonly name: string;
  }>,
): BotId {
  const fromError = input.error.context?.botId;
  if (fromError !== undefined && fromError.toString().trim().length > 0) {
    return fromError;
  }
  return buildFallbackBotId({
    workspaceId: input.workspaceId,
    templateId: customBotCreateSourceId,
    name: input.name,
  });
}

function resolveDeterministicOperationId(
  input: Readonly<{
    readonly workspaceId: BotWorkspaceId;
    readonly name: string;
    readonly instruction: string;
    readonly settings: BotSettings;
    readonly templateId?: string | undefined;
  }>,
): OperationId {
  const templatePart = input.templateId ?? '';
  const source = buildOperationIdSourceWithStableJson(
    operationIdSalt.createCustomBot,
    [input.workspaceId, input.name, input.instruction, templatePart],
    input.settings,
  );
  return toDeterministicOperationId(source);
}

function wrapBestEffortHook<T>(
  hook?: ((value: T) => void) | undefined,
): ((value: T) => void) | undefined {
  if (hook === undefined) return undefined;
  return (value: T): void => {
    try {
      hook(value);
    } catch {
      // Hooks best-effort: не ломаем основной flow.
    }
  };
}

type PrepareCustomBotCreationContextInput = Readonly<{
  readonly request: CreateCustomBotRequest;
  readonly botPermissions: CreateBotEffectConfig['botPermissions'];
  readonly botPolicy: CreateBotEffectConfig['botPolicy'];
  readonly clock: ClockPort;
  readonly createBotLikeHelpers: CreateBotLikeHelpers;
}>;

function prepareCustomBotCreationContext(
  input: PrepareCustomBotCreationContextInput,
): void {
  const actorUser = buildActorUserContext({
    userId: input.request.userId,
    actorRole: input.request.actorRole,
  });

  input.createBotLikeHelpers.checkCreatePermissionsOrThrow({
    botPermissions: input.botPermissions,
    actorUser,
    action: 'create',
  });

  const draftBotId = buildDraftBotId({
    workspaceId: input.request.workspaceId,
    templateId: customBotCreateSourceId,
    name: input.request.name,
  });

  const policyBotState: BotState = Object.freeze({
    botId: draftBotId as unknown as string,
    mode: 'draft',
    createdAt: input.clock.now(),
    isSystemBot: false,
  });

  input.createBotLikeHelpers.checkCreatePolicyOrThrow({
    botPolicy: input.botPolicy,
    policyBotState,
    actorUser,
    action: 'create_custom',
  });
}

type AuditMetaPort = Readonly<{
  readonly next: () => Readonly<{ readonly eventId: string; readonly timestamp: number; }>;
}>;

function createAuditMetaPort(
  deps: Readonly<{
    readonly clock: ClockPort;
    readonly eventIdGenerator: EventIdGeneratorPort;
  }>,
): AuditMetaPort {
  return Object.freeze({
    next: (): Readonly<{ readonly eventId: string; readonly timestamp: number; }> =>
      Object.freeze({
        eventId: deps.eventIdGenerator.generate(),
        timestamp: deps.clock.now(),
      }),
  });
}

/* ============================================================================
 * 🎯 PUBLIC API — effect factory
 * ============================================================================
 */

/**
 * Создаёт Effect-оркестратор `create-custom-bot`.
 *
 * @remarks
 * - store transition + audit emission делегируются shared lifecycle (`operation-lifecycle` + pipeline/error layers).
 * - business pre-checks выполняются детерминированно и синхронно внутри `run` ветки,
 *   чтобы errors были обработаны lifecycle helper'ом единообразно (как в `createBotFromTemplateEffect`).
 */
export function createCustomBotEffect(
  deps: CreateCustomBotDeps,
  createConfig: CreateBotEffectConfig,
): (request: CreateCustomBotRequest) => Effect<BotInfo> {
  const {
    lifecycleHelper,
    apiClient,
    botPolicy,
    botPermissions,
    createBotLikeHelpers,
  } = createConfig;

  return (request: CreateCustomBotRequest): Effect<BotInfo> => {
    const traceId = request.traceId;
    const rawOnSuccessHook = request.hooks?.onSuccess;
    const rawOnErrorHook = request.hooks?.onError;

    const resolvedOperationId = request.operationId ?? resolveDeterministicOperationId({
      workspaceId: request.workspaceId,
      name: request.name,
      instruction: request.instruction,
      settings: request.settings,
      templateId: request.templateId,
    });

    const auditMetaPort = createAuditMetaPort(deps);

    const safeOnSuccessHook = wrapBestEffortHook(rawOnSuccessHook);
    const safeOnErrorHook = wrapBestEffortHook(rawOnErrorHook);

    const buildSuccessAuditCtx = (): CreateBotSuccessAuditContext => {
      const meta = auditMetaPort.next();
      return Object.freeze({
        eventId: meta.eventId,
        timestamp: meta.timestamp,
        userId: request.userId,
        ...(traceId !== undefined ? { traceId } : {}),
      });
    };

    const mapFailureAuditEvent = (error: BotError): BotAuditEventValues => {
      const meta = auditMetaPort.next();
      const failureCtx: CreateBotFailureAuditContext = Object.freeze({
        eventId: meta.eventId,
        timestamp: meta.timestamp,
        botId: toBotIdFromErrorOrFallback({
          error,
          workspaceId: request.workspaceId,
          name: request.name,
        }),
        workspaceId: request.workspaceId,
        userId: request.userId,
        ...(traceId !== undefined ? { traceId } : {}),
      });

      return mapCreateBotErrorToAuditEvent(error, failureCtx);
    };

    const run: Effect<BotInfo> = async (signal?: AbortSignal): Promise<BotInfo> => {
      prepareCustomBotCreationContext({
        request,
        botPermissions,
        botPolicy,
        clock: deps.clock,
        createBotLikeHelpers,
      });

      const requestBody = buildCustomCreateBotRequestBody({
        name: request.name,
        instruction: request.instruction,
        settings: request.settings,
        templateId: request.templateId,
      });

      const createInput: CreateBotEffectInput = Object.freeze({
        workspaceId: request.workspaceId,
        operationId: resolvedOperationId,
        request: requestBody,
      });

      const apiInput = mapCreateBotEffectInputToApiInput(createInput);
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- слой bot-pipeline обеспечивает таймаут/abort
      const transportDto: BotResponseTransport = await apiClient.createBot(apiInput)(signal);

      return mapCreateBotResponseToBotInfo(transportDto);
    };

    return lifecycleHelper.runOperation({
      operation: 'create',
      idempotencyKey: resolvedOperationId,
      run,
      setSuccessState: (storePort, result) => {
        updateCreateBotState(storePort, result);
      },
      onSuccess: (result) => {
        safeOnSuccessHook?.(result);
      },
      onFailure: (error) => {
        safeOnErrorHook?.(error);
      },
      mapSuccessAuditEvent: (result) =>
        mapCreateBotResultToAuditEvent(result, buildSuccessAuditCtx()),
      mapFailureAuditEvent,
    });
  };
}
