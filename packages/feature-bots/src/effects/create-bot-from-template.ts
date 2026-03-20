/**
 * @file packages/feature-bots/src/effects/create-bot-from-template.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot From Template (Effect Orchestrator)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Оркестратор create-flow из доменного `BotTemplate`.
 * - SRP: только оркестрация, без HTTP/IO внутри (IO выполняется через DI-порты в Effect).
 * - Детерминированность по стандарту проекта: время/идентификаторы берутся из DI (clock/eventIdGenerator),
 *   а не из `Date.now()` внутри.
 * - Расширяемость: pre-flight проверки вынесены в `prepareBotCreationContext(...)`,
 *   а audit-context/mapping делегированы специализированным helper/mapper модулям.
 *
 * Инварианты:
 * - Любые ошибки внутри run-ветки прокидываются наружу через shared lifecycle (`operation-lifecycle`):
 *   layer `error.ts` нормализует их в `BotError`, а pipeline/lifecycle выполняет error/success side-effects.
 * - Создание audit payload выполняется через существующий `create-bot-audit.mapper.ts`
 *   (fail-closed schema validation внутри mapper).
 * - Fallback botId для failure-audit строится детерминированно локальным helper-ом
 *   (`toBotIdFromErrorOrFallback`), чтобы исключить “пропуск” audit события при отсутствии botId в error.context.
 */

import type { BotRole, BotState } from '@livai/core';
import type { Effect } from '@livai/core/effect';

import type { BotId, BotUserId, BotWorkspaceId } from '../domain/Bot.js';
import type { BotTemplate } from '../domain/BotTemplate.js';
import { assertBotTemplateInvariant } from '../domain/BotTemplate.js';
import { createBotErrorResponse } from '../lib/bot-errors.js';
import type { BotAuditEventValues } from '../schemas/index.js';
import type { OperationId } from '../types/bot-commands.js';
import type { BotError, BotInfo } from '../types/bots.js';
import {
  buildActorUserContext,
  buildCreateBotRequestBody,
  buildDraftBotId,
  checkCreatePermissionsOrThrow,
  checkCreatePolicyOrThrow,
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

/* ============================================================================
 * 🧭 PORTS — time/id generators
 * ============================================================================
 */

/**
 * Порт времени (единственный источник timestamp для audit).
 *
 * @remarks
 * Нужен для детерминизма и unit-тестируемости: время инжектируется извне.
 */
export type ClockPort = Readonly<{
  /** Epoch-millis в миллисекундах. */
  readonly now: () => number;
}>;

/**
 * Порт генерации `eventId` для audit-событий.
 *
 * @remarks
 * В production-реализация может использовать crypto/UUID или инкрементальные счётчики.
 * Для unit-тестов можно подменять детерминированным генератором.
 */
export type EventIdGeneratorPort = Readonly<{
  /** Генерирует unique eventId для audit-события. */
  readonly generate: () => string;
}>;

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

  /** Инициатор (опционально). */
  readonly userId?: BotUserId;

  /**
   * Роль инициатора для policy/permissions pre-check.
   * @remarks
   * Permissions могут работать с `role?: undefined`, policy требует роль как union и
   * применяется только после успешной permission-check.
   */
  readonly actorRole?: BotRole;

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
 * 🔁 INTERNAL HELPERS — deterministic fallback ids
 * ============================================================================
 */

// FNV-1a 32bit (детерминированная функция для псевдонимных fallback-идентификаторов)
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

const ID_HASH_HEX_BASE = 16;
const OPERATION_ID_SALT = 'create-bot-operation-v1' as const;

function buildDeterministicFallbackBotId(
  input: Readonly<{
    readonly workspaceId: BotWorkspaceId;
    readonly templateId: string;
    readonly name: string;
  }>,
): BotId {
  const source = `audit-fallback:${input.workspaceId}:${input.templateId}:${input.name}`;
  const hashHex = fnv1a32(source).toString(ID_HASH_HEX_BASE);
  // Минимум: непустая строка, максимум: схемы ограничены 128 символов.
  return (`bot_fallback_${hashHex}` as unknown) as BotId;
}

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
  return buildDeterministicFallbackBotId({
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
  const overrideHashSource = input.instructionOverride ?? '';
  // Salt снижает риск простого dictionary matching по типовым фрагментам instruction в логах/telemetry.
  // Для строгих требований к секретности предпочтителен HMAC с секретным ключом из DI.
  const source =
    `${OPERATION_ID_SALT}:${input.workspaceId}:${input.templateId}:${input.name}:${overrideHashSource}`;
  const hashHex = fnv1a32(source).toString(ID_HASH_HEX_BASE);
  // ID<'Operation'> — бренд строка, runtime-зависимостей нет.
  return (`op_${hashHex}` as unknown) as OperationId;
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

type PrepareBotCreationContextInput = Readonly<{
  readonly request: CreateBotFromTemplateRequest;
  readonly botPermissions: CreateBotEffectConfig['botPermissions'];
  readonly botPolicy: CreateBotEffectConfig['botPolicy'];
  readonly clock: ClockPort;
}>;

type PreparedBotCreationContext = Readonly<{
  readonly draftBotId: BotId;
  readonly policyBotState: BotState;
}>;

function prepareBotCreationContext(
  input: PrepareBotCreationContextInput,
): PreparedBotCreationContext {
  const actorUser = buildActorUserContext({
    userId: input.request.userId,
    actorRole: input.request.actorRole,
  });

  checkCreatePermissionsOrThrow({
    botPermissions: input.botPermissions,
    actorUser,
  });

  if (input.request.userId === undefined || input.request.actorRole === undefined) {
    // Должно быть недостижимо после permission-check, но оставляем fail-closed.
    throw createBotErrorResponse({
      code: 'BOT_PERMISSION_DENIED',
      context: Object.freeze({
        details: Object.freeze({ reason: 'actor_role_or_userid_missing' }),
      }),
    });
  }

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

  checkCreatePolicyOrThrow({
    botPolicy: input.botPolicy,
    userId: input.request.userId,
    actorRole: input.request.actorRole,
    policyBotState,
  });

  return Object.freeze({
    draftBotId,
    policyBotState,
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
  } = createConfig;

  return (request: CreateBotFromTemplateRequest): Effect<BotInfo> => {
    const traceId = request.traceId;
    const userId = request.userId;
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
      const meta = auditMetaPort.next();
      return Object.freeze({
        eventId: meta.eventId,
        timestamp: meta.timestamp,
        ...(traceId !== undefined ? { traceId } : {}),
        ...(userId !== undefined ? { userId } : {}),
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
          templateId: request.template.id,
          name: request.name,
        }),
        workspaceId: request.workspaceId,
        ...(traceId !== undefined ? { traceId } : {}),
        ...(userId !== undefined ? { userId } : {}),
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
