/**
 * @file packages/feature-bots/src/effects/create-bot-from-template.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot From Template (Effect Orchestrator)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Оркестратор create-flow из доменного `BotTemplate`.
 * - SRP: только оркестрация, без HTTP/IO внутри (IO выполняется через DI-порты в Effect).
 * - Детерминированность: `clock` / `eventIdGenerator`, пары `(eventId, timestamp)` для audit и best-effort `hooks` —
 *   через `shared/orchestrator-runtime` (`createAuditMetaPort`, `wrapBestEffortHook`); без `Date.now()` и random внутри оркестратора.
 * - Детерминированный `operationId` (если не передан явно): `operationIdSalt.createBotFromTemplate` + `buildOperationIdSource`
 *   в `shared/operation-id-fingerprint` (сегменты workspace / template / name; последний — `stableJsonFingerprint` для
 *   `instructionOverride`, не сырая строка — v2 соли, см. реестр в fingerprint-модуле).
 * - Расширяемость: pre-flight проверки вынесены в `prepareBotCreationContext(...)`,
 *   а audit-context/mapping делегированы специализированным helper/mapper модулям.
 * - Публичный контракт входа: `userId` + `actorRole` обязательны в типе `CreateBotFromTemplateRequest`
 *   (канонический actor для guards; дублирующая runtime-проверка не нужна — контракт на уровне TypeScript).
 *
 * Инварианты:
 * - Любые ошибки внутри run-ветки прокидываются наружу через shared lifecycle (`operation-lifecycle`):
 *   layer `error.ts` нормализует их в `BotError`, а pipeline/lifecycle выполняет error/success side-effects.
 * - Создание audit payload выполняется через существующий `create-bot-audit.mapper.ts`
 *   (fail-closed schema validation внутри mapper).
 * - Fallback botId для failure-audit строится детерминированно через {@link buildFallbackBotId}
 *   (`toBotIdFromErrorOrFallback`), чтобы исключить “пропуск” audit события при отсутствии botId в error.context.
 */

import type { BotRole, BotState } from '@livai/core';
import type { Effect } from '@livai/core/effect';

import type { BotId, BotUserId, BotWorkspaceId } from '../domain/Bot.js';
import type { BotTemplate } from '../domain/BotTemplate.js';
import { assertBotTemplateInvariant } from '../domain/BotTemplate.js';
import type { BotAuditEventValues } from '../schemas/index.js';
import type { OperationId } from '../types/bot-commands.js';
import type { BotError, BotInfo } from '../types/bots.js';
import type { CreateBotLikeHelpers } from './create/create-bot.helpers.js';
import {
  buildCreateBotRequestBody,
  buildDraftBotId,
  buildFallbackBotId,
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
import type { BotResponseTransport } from './shared/api-client.port.js';
import {
  buildOperationIdSource,
  operationIdSalt,
  stableJsonFingerprint,
  toDeterministicOperationId,
} from './shared/operation-id-fingerprint.js';
import type { ClockPort, EventIdGeneratorPort } from './shared/orchestrator-runtime.js';
import { createAuditMetaPort, wrapBestEffortHook } from './shared/orchestrator-runtime.js';
import { buildActorUserContext } from './shared/pure-guards.js';

export type { ClockPort, EventIdGeneratorPort } from './shared/orchestrator-runtime.js';

/* ============================================================================
 * 🎯 PUBLIC TYPES — request/deps/config
 * ============================================================================
 */

/** Вход create-flow из шаблона. */
export type CreateBotFromTemplateRequest = {
  readonly workspaceId: BotWorkspaceId;
  readonly template: BotTemplate;

  /** Имя создаваемого бота (может переопределять template.name). */
  readonly name: string;

  /**
   * Опциональная кастомизация инструкции.
   * Если не задано — применяется `template.defaultInstruction`.
   */
  readonly instructionOverride?: string;

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
   * Пакет hooks для `best-effort` (лучшее из возможного) наблюдаемости/интеграции без IO.
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

/** DI-зависимости для create-bot-from-template оркестратора. */
export type CreateBotFromTemplateDeps = {
  readonly clock: ClockPort;
  readonly eventIdGenerator: EventIdGeneratorPort;
};

/* ============================================================================
 * 🔁 INTERNAL HELPERS — deterministic operation id + fallback botId
 * ============================================================================
 */

function toBotIdFromErrorOrFallback(
  input: Readonly<{
    readonly error: BotError;
    readonly workspaceId: BotWorkspaceId;
    readonly templateId: string;
    readonly name: string;
  }>,
): BotId {
  const fromError = input.error.context?.botId;
  if (fromError !== undefined && fromError.toString().trim().length > 0) {
    return fromError;
  }
  return buildFallbackBotId({
    workspaceId: input.workspaceId,
    templateId: input.templateId,
    name: input.name,
  });
}

function resolveDeterministicOperationId(
  input: Readonly<{
    readonly workspaceId: BotWorkspaceId;
    readonly templateId: string;
    readonly name: string;
    readonly instructionOverride?: string | undefined;
  }>,
): OperationId {
  // Последний сегмент — canonical JSON для строки (как для прочих fingerprint payload): единые правила для пробелов,
  // экранирования и будущих расширений; смена соли v1→v2 зафиксирована в `operationIdSalt.createBotFromTemplate`.
  const overrideFingerprint = stableJsonFingerprint(input.instructionOverride ?? '');
  const source = buildOperationIdSource(operationIdSalt.createBotFromTemplate, [
    input.workspaceId,
    input.templateId,
    input.name,
    overrideFingerprint,
  ]);
  return toDeterministicOperationId(source);
}

type PrepareBotCreationContextInput = Readonly<{
  readonly request: CreateBotFromTemplateRequest;
  readonly botPermissions: CreateBotEffectConfig['botPermissions'];
  readonly botPolicy: CreateBotEffectConfig['botPolicy'];
  readonly clock: ClockPort;
  readonly createBotLikeHelpers: CreateBotLikeHelpers;
}>;

function prepareBotCreationContext(
  input: PrepareBotCreationContextInput,
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
    templateId: input.request.template.id,
    name: input.request.name,
  });

  const policyBotState: BotState = Object.freeze({
    // `botId` нужен BotPolicy как строковый идентификатор entity.
    // Это draft-id для policy checks (не финальный persisted botId).
    botId: draftBotId as unknown as string,
    mode: 'draft',
    createdAt: input.clock.now(),
    isSystemBot: false,
  });

  input.createBotLikeHelpers.checkCreatePolicyOrThrow({
    botPolicy: input.botPolicy,
    policyBotState,
    actorUser,
    action: 'configure',
  });
  // `draftBotId` / `policyBotState` нужны только для проверок выше (side-effects); наружу не возвращаем.
}

/* ============================================================================
 * 🎯 PUBLIC API — effect factory
 * ============================================================================
 */

/**
 * Создаёт Effect-оркестратор `create-bot-from-template`.
 *
 * @remarks
 * - store transition + audit emission делегируются shared lifecycle (`operation-lifecycle` + pipeline/error layers).
 * - business pre-checks выполняются детерминированно и синхронно внутри `run` ветки,
 *   чтобы errors были обработаны lifecycle helper'ом единообразно.
 */
export function createBotFromTemplateEffect(
  deps: CreateBotFromTemplateDeps,
  createConfig: CreateBotEffectConfig,
): (request: CreateBotFromTemplateRequest) => Effect<BotInfo> {
  const {
    lifecycleHelper,
    apiClient,
    botPolicy,
    botPermissions,
    createBotLikeHelpers,
  } = createConfig;

  return (request: CreateBotFromTemplateRequest): Effect<BotInfo> => {
    const traceId = request.traceId;
    const rawOnSuccessHook = request.hooks?.onSuccess;
    const rawOnErrorHook = request.hooks?.onError;

    const resolvedOperationId = request.operationId ?? resolveDeterministicOperationId({
      workspaceId: request.workspaceId,
      templateId: request.template.id,
      name: request.name,
      instructionOverride: request.instructionOverride,
    });

    const auditMetaPort = createAuditMetaPort(deps);

    const safeOnSuccessHook = wrapBestEffortHook(rawOnSuccessHook);
    const safeOnErrorHook = wrapBestEffortHook(rawOnErrorHook);

    const buildSuccessAuditCtx = (): CreateBotSuccessAuditContext => {
      const meta = auditMetaPort.nextAuditMeta();
      return Object.freeze({
        eventId: meta.eventId,
        timestamp: meta.timestamp,
        userId: request.userId,
        ...(traceId !== undefined ? { traceId } : {}),
      });
    };

    const mapFailureAuditEvent = (error: BotError): BotAuditEventValues => {
      const meta = auditMetaPort.nextAuditMeta();
      const failureCtx: CreateBotFailureAuditContext = Object.freeze({
        eventId: meta.eventId,
        timestamp: meta.timestamp,
        botId: toBotIdFromErrorOrFallback({
          error,
          workspaceId: request.workspaceId,
          templateId: request.template.id,
          name: request.name,
        }),
        workspaceId: request.workspaceId,
        userId: request.userId,
        ...(traceId !== undefined ? { traceId } : {}),
      });

      return mapCreateBotErrorToAuditEvent(error, failureCtx);
    };

    const run: Effect<BotInfo> = async (signal?: AbortSignal): Promise<BotInfo> => {
      // Инварианты домена проверяем здесь (fail-closed).
      assertBotTemplateInvariant(request.template);

      // 1) Permission/policy pre-flight в одном deterministic helper.
      prepareBotCreationContext({
        request,
        botPermissions,
        botPolicy,
        clock: deps.clock,
        createBotLikeHelpers,
      });

      // 2) Payload create-запроса из шаблона (+ overrides)
      const requestBody = buildCreateBotRequestBody({
        name: request.name,
        template: request.template,
        instructionOverride: request.instructionOverride,
      });

      const createInput: CreateBotEffectInput = Object.freeze({
        workspaceId: request.workspaceId,
        operationId: resolvedOperationId,
        request: requestBody,
      });

      const apiInput = mapCreateBotEffectInputToApiInput(createInput);
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- слой bot-pipeline обеспечивает таймаут/abort
      const transportDto: BotResponseTransport = await apiClient.createBot(apiInput)(signal);

      // 3) DTO boundary → модель feature/store.
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
