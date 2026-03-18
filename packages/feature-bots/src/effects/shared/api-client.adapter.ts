/**
 * @file packages/feature-bots/src/effects/shared/api-client.adapter.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — ApiClient Adapter (Promise → Effect) [Shared]
 * ============================================================================
 *
 * Архитектурная роль:
 * - Adapter pattern: преобразует Promise-based legacy HTTP-клиент в Effect-based
 *   BotApiClientPort для дальнейшей композиции в orchestrator/withTimeout/withRetry.
 * - Детерминированная Zod-валидация HTTP-ответов по автогенерированным схемам
 *   сервиса `bots-service` (OpenAPI → Zod).
 * - Детерминированная нормализация transport-ошибок в `BotErrorResponse`,
 *   чтобы существующий `feature-bots/src/lib/error-mapper.ts` мог маппить errors
 *   без знания транспортного формата.
 *
 * Принципы:
 * - ✅ SRP: только адаптация Promise → Effect + валидация/нормализация boundary ошибок.
 * - ✅ Domain-safe: внешний интерфейс бросает `BotErrorResponse` (contract), не leaks
 *   transport/raw payload в доменные типы.
 * - ✅ Детерминизм: вход + registry + schemas → один и тот же результат.
 * - ✅ Scalable rule-engine: без if/else-монолита — правила нормализации ошибок
 *   задаются массивом (priority-based).
 * - ✅ Extensible: операции описаны в registry; добавление endpoint'а не меняет core алгоритм.
 * - ✅ AbortSignal propagation: сигнал из вызова Effect прокидывается в `requestOptions.signal` (mismatch диагностируется инвариантом).
 *
 * @note
 * - Этот модуль не делает HTTP сам; HTTP делает legacyClient.
 * - Изоляция transport деталей достигается тем, что legacyClient — единственная точка
 *   взаимодействия с сетью, а наружу бросается только `BotErrorResponse`.
 */

import type { z } from 'zod';

import type { Effect } from '@livai/core/effect';
import { HEADERS } from '@livai/core-contracts';
import { generatedBots } from '@livai/core-contracts/validation/zod';

import type { BotErrorResponse as BotErrorResponseContract } from '../../contracts/BotErrorResponse.js';
import type { BotId, BotWorkspaceId } from '../../domain/Bot.js';
import { getBotRetryable } from '../../domain/BotRetry.js';
import { botErrorMetaByCode, createBotErrorResponse } from '../../lib/bot-errors.js';
import type { OperationId } from '../../types/bot-commands.js';
import type { BotErrorCode, BotErrorContext, BotParsingErrorCode } from '../../types/bots.js';

/* ============================================================================
 * 🧭 TYPES — PROMISE LEGACY HTTP
 * ============================================================================
 */

export type ApiRequestOptions = Readonly<{
  /**
   * Явные HTTP-заголовки.
   * @note Для bots-service обязательно присутствие `X-Workspace-Id`.
   *       Этот заголовок формируется adapter'ом из `workspaceId` входа.
   */
  readonly headers?: Readonly<Record<string, string>>;
}>;

type ApiRequestOptionsWithSignal =
  & ApiRequestOptions
  & Readonly<{
    readonly signal?: AbortSignal;
  }>;

/**
 * Promise-based HTTP-клиент для адаптации.
 *
 * @note
 * Контракт intentionally minimal: адаптер сам строит url/header/body и отдаёт
 * legacyClient только то, что нужно для transport.
 */
export type LegacyApiClient = Readonly<{
  readonly get: <T>(
    url: string,
    options?: ApiRequestOptions & { signal?: AbortSignal; },
  ) => Promise<T>;

  readonly post: <T>(
    url: string,
    body: unknown,
    options?: ApiRequestOptions & { signal?: AbortSignal; },
  ) => Promise<T>;

  readonly put: <T>(
    url: string,
    body: unknown,
    options?: ApiRequestOptions & { signal?: AbortSignal; },
  ) => Promise<T>;
}>;

/* ============================================================================
 * 🧩 TYPES — TRANSPORT SHAPES (bots-service)
 * ============================================================================
 */

type BotResponseTransport = z.infer<typeof generatedBots.BotResponseSchema>;
type BotsListResponseTransport = z.infer<typeof generatedBots.BotsListResponseSchema>;
type BotCreateRequestTransport = z.infer<typeof generatedBots.BotCreateRequestSchema>;
type UpdateInstructionRequestTransport = z.infer<
  typeof generatedBots.UpdateInstructionRequestSchema
>;

/* ============================================================================
 * 🧭 TYPES — PORT (Effect-based)
 * ============================================================================
 */

export type BotApiListBotsInput = Readonly<{
  readonly workspaceId: BotWorkspaceId;
}>;

export type BotApiCreateBotInput = Readonly<{
  readonly workspaceId: BotWorkspaceId;
  readonly operationId?: OperationId;
  readonly body: BotCreateRequestTransport;
}>;

export type BotApiGetBotInput = Readonly<{
  readonly workspaceId: BotWorkspaceId;
  readonly botId: BotId;
}>;

export type BotApiUpdateInstructionInput = Readonly<{
  readonly workspaceId: BotWorkspaceId;
  readonly operationId?: OperationId;
  readonly botId: BotId;
  readonly body: UpdateInstructionRequestTransport;
}>;

export type BotApiClientPort = Readonly<{
  readonly listBots: (
    input: BotApiListBotsInput,
    options?: ApiRequestOptions,
  ) => Effect<BotsListResponseTransport>;

  readonly createBot: (
    input: BotApiCreateBotInput,
    options?: ApiRequestOptions,
  ) => Effect<BotResponseTransport>;

  readonly getBot: (
    input: BotApiGetBotInput,
    options?: ApiRequestOptions,
  ) => Effect<BotResponseTransport>;

  readonly updateInstruction: (
    input: BotApiUpdateInstructionInput,
    options?: ApiRequestOptions,
  ) => Effect<BotResponseTransport>;
}>;

/* ============================================================================
 * 🎛️ CONSTANTS — deterministic error codes
 * ============================================================================
 */

const FALLBACK_PARSING_ERROR_CODE: BotParsingErrorCode = 'BOT_PARSING_JSON_INVALID';

/* ============================================================================
 * 🧰 HELPERS — deterministic plumbing
 * ============================================================================
 */

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object';
}

function isBotErrorCode(value: unknown): value is BotErrorCode {
  if (typeof value !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(botErrorMetaByCode, value);
}

function toHeaderRecord(
  headers?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return headers === undefined ? {} : { ...headers };
}

function mergeHeaders(
  base: Readonly<Record<string, string>>,
  override: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  // Детерминированность: порядок merge фиксирован.
  return { ...base, ...override };
}

const BOT_ID_PATH_PARAM = '{bot_id}' as const;

/** Безопасная интерполяция pathTemplate с `{bot_id}`. */
function interpolateBotPath(pathTemplate: string, botId?: string): string {
  if (!pathTemplate.includes(BOT_ID_PATH_PARAM)) {
    return pathTemplate;
  }

  if (botId === undefined || botId === '') {
    // Fail-fast: нельзя “тихо” подставить undefined → silent corruption URL.
    // ВАЖНО: adapter должен бросать только contract error (BotErrorResponse).
    const context: BotErrorContext = Object.freeze({
      details: Object.freeze({
        reason: 'bot_id_required',
        pathTemplate,
      }),
    });

    throw createBotErrorResponse({
      code: FALLBACK_PARSING_ERROR_CODE,
      context,
    });
  }

  return pathTemplate.replace(BOT_ID_PATH_PARAM, encodeURIComponent(botId));
}

/* ============================================================================
 * 🔒 SECURITY HELPERS — headers/message sanitization
 * ============================================================================
 */

function filterAllowedHeaders(
  headers: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  // Deterministic: строго allow-list только для X-Operation-Id.
  const operationId = headers[HEADERS.OPERATION_ID];
  return operationId !== undefined ? { [HEADERS.OPERATION_ID]: operationId } : {};
}

const MAX_TRANSPORT_MESSAGE_LENGTH = 200;
const SENSITIVE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /authorization/i,
  /bearer\s+/i,
  /token/i,
  /password/i,
  /secret/i,
  /stack/i,
];

function sanitizeTransportMessage(message: string | undefined): string | undefined {
  if (message === undefined) return undefined;

  const trimmed = message.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > MAX_TRANSPORT_MESSAGE_LENGTH) return undefined;

  for (const pattern of SENSITIVE_MESSAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return undefined;
    }
  }

  return trimmed;
}

/* ============================================================================
 * 🎯 ERROR NORMALIZATION — priority based rule-engine
 * ============================================================================
 */

type ErrorNormalizationInput = unknown;

// eslint-disable-next-line no-magic-numbers
type BotErrorNormalizationPriority = 5 | 6 | 10 | 20 | 40 | 90;

/**
 * PRIORITY INVARIANT:
 * - lower value = higher priority (matched earlier)
 * - specific rules MUST have lower priority than generic ones
 */
type BotErrorNormalizationRulePriority = Readonly<{
  readonly priority: BotErrorNormalizationPriority;
}>;

type BotErrorNormalizationRuleMatch = Readonly<{
  readonly match: (input: ErrorNormalizationInput) => boolean;
}>;

type BotErrorNormalizationRuleMap = Readonly<{
  readonly map: (input: ErrorNormalizationInput) => BotErrorResponseContract;
}>;

export type BotErrorNormalizationRule =
  & BotErrorNormalizationRulePriority
  & BotErrorNormalizationRuleMatch
  & BotErrorNormalizationRuleMap;

function getRawErrorCode(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;

  // Варианты транспортных ошибок:
  // - { code: "BOT_..." }
  // - { payload: { code: "BOT_..." } }
  // - { kind: "ApiError", payload: { code: "BOT_..." } }
  if (typeof value['code'] === 'string') return value['code'];

  if (
    isObject(value['payload'])
    && typeof (value['payload'] as Record<string, unknown>)['code'] === 'string'
  ) {
    return (value['payload'] as Record<string, unknown>)['code'] as string;
  }

  return undefined;
}

function getRawErrorMessage(value: unknown): string | undefined {
  if (!isObject(value)) return undefined;

  if (typeof value['message'] === 'string') return value['message'];

  if (
    isObject(value['payload'])
    && typeof (value['payload'] as Record<string, unknown>)['message'] === 'string'
  ) {
    return (value['payload'] as Record<string, unknown>)['message'] as string;
  }

  return undefined;
}

function createUnknownBotErrorResponse(input: unknown): BotErrorResponseContract {
  const rawCode = getRawErrorCode(input);
  const rawMessage = getRawErrorMessage(input);
  const errorName = input instanceof Error ? input.name : undefined;
  const sanitizedRawMessage = sanitizeTransportMessage(rawMessage);
  const context: BotErrorContext = Object.freeze({
    details: Object.freeze({
      cause: Object.freeze({
        // Детерминированный анти-leak: только технический rawCode (если доступен).
        rawCode: rawCode ?? 'unknown',
        ...(errorName !== undefined ? { errorName } : {}),
        ...(sanitizedRawMessage !== undefined ? { safeMessage: sanitizedRawMessage } : {}),
      }),
    }),
  });

  return createBotErrorResponse({
    code: FALLBACK_PARSING_ERROR_CODE,
    context,
  });
}

function createBotErrorResponseFromPossibleCodeMessage(input: unknown): BotErrorResponseContract {
  const codeRaw = getRawErrorCode(input);
  const message = getRawErrorMessage(input);
  const sanitizedMessage = sanitizeTransportMessage(message);

  if (codeRaw === undefined || !isBotErrorCode(codeRaw)) {
    return createUnknownBotErrorResponse(input);
  }

  // Контекст не должен содержать секреты/PII: допускаем только технический rawCode (и опционально rawMessage).
  const sanitizedRawMessage = sanitizedMessage;
  const context: BotErrorContext = Object.freeze({
    details: Object.freeze({
      cause: Object.freeze({
        rawCode: codeRaw,
        ...(sanitizedRawMessage !== undefined ? { safeMessage: sanitizedRawMessage } : {}),
      }),
    }),
  });

  return createBotErrorResponse({
    code: codeRaw,
    ...(sanitizedMessage !== undefined ? { message: sanitizedMessage } : {}),
    context,
  });
}

function isBotErrorResponseShape(input: unknown): input is BotErrorResponseContract {
  if (!isObject(input)) return false;

  const v = input as Record<string, unknown>;

  // Минимальные поля контракта.
  if (
    typeof v['error'] !== 'string'
    || typeof v['code'] !== 'string'
    || typeof v['category'] !== 'string'
    || typeof v['severity'] !== 'string'
    || typeof v['retryable'] !== 'boolean'
  ) {
    return false;
  }

  const codeCandidate = v['code'];
  if (!isBotErrorCode(codeCandidate)) return false;

  // eslint-disable-next-line security/detect-object-injection -- ключ codeCandidate валидирован isBotErrorCode (hasOwnProperty на registry)
  const meta = botErrorMetaByCode[codeCandidate];
  return (
    meta.error === v['error']
    && meta.category === v['category']
    && meta.severity === v['severity']
    && getBotRetryable(codeCandidate) === v['retryable']
  );
}

const DEFAULT_ERROR_NORMALIZATION_RULES: readonly BotErrorNormalizationRule[] = [
  {
    priority: 5,
    match: (input: ErrorNormalizationInput): boolean => {
      if (typeof DOMException !== 'undefined' && input instanceof DOMException) {
        return input.name === 'AbortError';
      }
      return input instanceof Error && input.name === 'AbortError';
    },
    map: (): BotErrorResponseContract => {
      const botErrorContext: BotErrorContext = Object.freeze({
        details: Object.freeze({
          cause: Object.freeze({ name: 'AbortError' }),
        }),
      });

      // Контекст детерминирован: только технические поля (имя ошибки), без user/PII.
      // eslint-disable-next-line @livai/rag/context-leakage
      return createBotErrorResponse({ code: 'BOT_REQUEST_ABORTED', context: botErrorContext });
    },
  },
  {
    priority: 6,
    match: (input: ErrorNormalizationInput): boolean => {
      if (typeof DOMException !== 'undefined' && input instanceof DOMException) {
        return input.name === 'TimeoutError';
      }
      return input instanceof Error && input.name === 'TimeoutError';
    },
    map: (input: ErrorNormalizationInput): BotErrorResponseContract => {
      const errorName = input instanceof Error ? input.name : 'TimeoutError';
      const botErrorContext: BotErrorContext = Object.freeze({
        details: Object.freeze({
          cause: Object.freeze({ name: errorName }),
        }),
      });

      // Контекст детерминирован: только технические поля (имя ошибки), без user/PII.
      return createBotErrorResponse({
        code: 'BOT_CHANNEL_CONNECTION_FAILED',
        // eslint-disable-next-line @livai/rag/context-leakage -- Контекст детерминирован: только технические поля (имя ошибки), без user/PII.
        context: botErrorContext,
      });
    },
  },
  {
    priority: 10,
    match: (input: ErrorNormalizationInput): boolean => isBotErrorResponseShape(input),
    map: (input: ErrorNormalizationInput): BotErrorResponseContract =>
      input as BotErrorResponseContract,
  },
  {
    priority: 20,
    match: (input: ErrorNormalizationInput): boolean =>
      input instanceof Error && input.name !== 'AbortError',
    map: (input: ErrorNormalizationInput): BotErrorResponseContract => {
      const errorName = input instanceof Error ? input.name : 'UnknownError';
      const botErrorContext: BotErrorContext = Object.freeze({
        details: Object.freeze({
          cause: Object.freeze({ name: errorName }),
        }),
      });

      // Контекст детерминирован: только технические поля (имя ошибки), без user/PII.
      return createBotErrorResponse({
        code: 'BOT_CHANNEL_CONNECTION_FAILED',
        // eslint-disable-next-line @livai/rag/context-leakage -- Контекст детерминирован: только технические поля (имя ошибки), без user/PII.
        context: botErrorContext,
      });
    },
  },
  {
    priority: 40,
    match: (input: ErrorNormalizationInput): boolean =>
      isObject(input) && getRawErrorCode(input) !== undefined,
    map: (input: ErrorNormalizationInput): BotErrorResponseContract =>
      createBotErrorResponseFromPossibleCodeMessage(input),
  },
  {
    priority: 90,
    match: (): boolean => true,
    map: (input: ErrorNormalizationInput): BotErrorResponseContract =>
      createUnknownBotErrorResponse(input),
  },
] as const;

export type BotApiClientPortAdapterConfig = Readonly<{
  /**
   * Дополнительные/кастомные правила нормализации boundary-ошибок.
   * @remarks
   * Если переданы — используется именно этот set правил (с сортировкой по `priority`).
   * Если не переданы — используется дефолтный набор.
   */
  readonly errorRules?: readonly BotErrorNormalizationRule[] | undefined;
}>;

function normalizeTransportErrorToBotErrorResponse(
  input: ErrorNormalizationInput,
  rules: readonly BotErrorNormalizationRule[],
): BotErrorResponseContract {
  for (const rule of rules) {
    if (!rule.match(input)) continue;
    return rule.map(input);
  }

  // Недостижимая ветка, но нужна для exhaustiveness.
  return createUnknownBotErrorResponse(input);
}

/* ============================================================================
 * 🧩 OPERATIONS — registry driven (extensible without if/else monolith)
 * ============================================================================
 */

type BotApiOperationName = 'listBots' | 'createBot' | 'getBot' | 'updateInstruction';

type BotApiOperationDefMeta<Name extends BotApiOperationName> = {
  readonly name: Name;
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly pathTemplate: string;
  readonly requestSchema: z.ZodTypeAny | undefined;
  readonly responseSchema: z.ZodTypeAny;
};

type BotApiOperationDefBuilders<Name extends BotApiOperationName> = {
  readonly buildHeaders: (input: BotApiOperationInputMap[Name]) => Readonly<Record<string, string>>;
  readonly buildBody: (input: BotApiOperationInputMap[Name]) => unknown;
};

type BotApiOperationDef<Name extends BotApiOperationName> =
  & BotApiOperationDefMeta<Name>
  & BotApiOperationDefBuilders<Name>;

type BotApiOperationInputMap = Readonly<{
  listBots: BotApiListBotsInput;
  createBot: BotApiCreateBotInput;
  getBot: BotApiGetBotInput;
  updateInstruction: BotApiUpdateInstructionInput;
}>;

type BotApiOperationOutputMap = Readonly<{
  listBots: BotsListResponseTransport;
  createBot: BotResponseTransport;
  getBot: BotResponseTransport;
  updateInstruction: BotResponseTransport;
}>;

const BOT_API_OPERATION_DEFS: Readonly<{ [K in BotApiOperationName]: BotApiOperationDef<K>; }> = {
  listBots: {
    name: 'listBots',
    method: 'GET',
    pathTemplate: '/v1/bots',
    responseSchema: generatedBots.BotsListResponseSchema,
    requestSchema: undefined,
    buildHeaders: (input: BotApiOperationInputMap['listBots']) => ({
      [HEADERS.WORKSPACE_ID]: input.workspaceId,
    }),
    buildBody: () => undefined,
  },
  createBot: {
    name: 'createBot',
    method: 'POST',
    pathTemplate: '/v1/bots',
    requestSchema: generatedBots.BotCreateRequestSchema,
    responseSchema: generatedBots.BotResponseSchema,
    buildHeaders: (input: BotApiOperationInputMap['createBot']) => ({
      [HEADERS.WORKSPACE_ID]: input.workspaceId,
      ...(input.operationId !== undefined ? { [HEADERS.OPERATION_ID]: input.operationId } : {}),
    }),
    buildBody: (input: BotApiOperationInputMap['createBot']) => input.body,
  },
  getBot: {
    name: 'getBot',
    method: 'GET',
    pathTemplate: '/v1/bots/{bot_id}',
    responseSchema: generatedBots.BotResponseSchema,
    requestSchema: undefined,
    buildHeaders: (input: BotApiOperationInputMap['getBot']) => ({
      [HEADERS.WORKSPACE_ID]: input.workspaceId,
    }),
    buildBody: () => undefined,
  },
  updateInstruction: {
    name: 'updateInstruction',
    method: 'PUT',
    pathTemplate: '/v1/bots/{bot_id}/instruction',
    requestSchema: generatedBots.UpdateInstructionRequestSchema,
    responseSchema: generatedBots.BotResponseSchema,
    buildHeaders: (input: BotApiOperationInputMap['updateInstruction']) => ({
      [HEADERS.WORKSPACE_ID]: input.workspaceId,
      ...(input.operationId !== undefined ? { [HEADERS.OPERATION_ID]: input.operationId } : {}),
    }),
    buildBody: (input: BotApiOperationInputMap['updateInstruction']) => input.body,
  },
} as const;

/* ============================================================================
 * ⚙️ adapter factory
 * ============================================================================
 */

function createParsingErrorResponseFromZodIssues(
  operation: BotApiOperationName,
  issues: readonly { path: readonly (string | number)[]; message?: string; }[],
): BotErrorResponseContract {
  const parseIssues = Object.freeze(
    issues.map((i) => ({
      path: i.path.join('.'),
      ...(i.message !== undefined ? { message: i.message } : {}),
    })),
  );

  const context: BotErrorContext = Object.freeze({
    details: Object.freeze({
      operation,
      parseIssues,
    }),
  });

  return createBotErrorResponse({
    code: FALLBACK_PARSING_ERROR_CODE,
    context,
  });
}

function mapZodIssues(
  issues: readonly { path: readonly PropertyKey[]; message?: string; }[],
): readonly { path: readonly (string | number)[]; message?: string; }[] {
  return issues.map((issue) => {
    const sanitizedMessage = sanitizeTransportMessage(issue.message);
    return {
      path: issue.path.map((seg: string | number | symbol) => (
        typeof seg === 'symbol'
          ? seg.toString()
          : seg
      )),
      ...(sanitizedMessage !== undefined ? { message: sanitizedMessage } : {}),
    };
  });
}

function wrapLegacyCallWithEffect(
  legacyClient: LegacyApiClient,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  body: unknown,
  requestOptions: ApiRequestOptionsWithSignal,
  rules: readonly BotErrorNormalizationRule[],
): Effect<unknown> {
  const caller = {
    GET: (opts?: ApiRequestOptionsWithSignal): Promise<unknown> => legacyClient.get(url, opts),
    POST: (opts?: ApiRequestOptionsWithSignal): Promise<unknown> =>
      legacyClient.post(url, body, opts),
    PUT: (opts?: ApiRequestOptionsWithSignal): Promise<unknown> =>
      legacyClient.put(url, body, opts),
  } as const;

  return async (signal?: AbortSignal): Promise<unknown> => {
    // Invariant: мы всегда должны передавать AbortSignal только через requestOptions.signal.
    // Если legacyClient wrapper вызвали с другим signal — это ошибка plumbing/композиции.
    if (signal !== undefined) {
      if (requestOptions.signal === undefined) {
        const botErrorContext: BotErrorContext = Object.freeze({
          details: Object.freeze({
            cause: Object.freeze({ reason: 'signal_provided_but_request_signal_missing' }),
          }),
        });
        throw createBotErrorResponse({
          code: FALLBACK_PARSING_ERROR_CODE,
          context: botErrorContext,
        });
      }

      if (signal !== requestOptions.signal) {
        const botErrorContext: BotErrorContext = Object.freeze({
          details: Object.freeze({
            cause: Object.freeze({ reason: 'signal_mismatch' }),
          }),
        });
        throw createBotErrorResponse({
          code: FALLBACK_PARSING_ERROR_CODE,
          context: botErrorContext,
        });
      }
    }

    try {
      const call = method === 'GET' ? caller.GET : method === 'POST' ? caller.POST : caller.PUT;
      // Это транспортный HTTP-вызов; таймаут задаётся выше (orchestrator/bot-pipeline), а правило статически не видит guard.
      // eslint-disable-next-line @livai/multiagent/orchestration-safety
      return await call(requestOptions);
    } catch (err: unknown) {
      // Нормализуем транспортную ошибку в BotErrorResponse contract.
      throw normalizeTransportErrorToBotErrorResponse(err, rules);
    }
  };
}

export function createBotApiClientPortAdapter(
  /**
   * Contract legacyClient (MUST):
   * - MUST respect AbortSignal (cancel the in-flight request)
   * - MUST reject with transport error/exception for non-2xx responses
   * - MUST not throw non-Error values (recommended, optional in runtime)
   */
  legacyClient: LegacyApiClient,
  config: BotApiClientPortAdapterConfig = {},
): BotApiClientPort {
  const normalizationRules = [...(config.errorRules ?? DEFAULT_ERROR_NORMALIZATION_RULES)]
    .sort((a, b) => a.priority - b.priority);

  const getOperationDef = <Op extends BotApiOperationName>(
    op: Op,
  ): BotApiOperationDef<Op> => {
    // `op` типизирован как ключи registry (BOT_API_OPERATION_DEFS), других вариантов быть не может.
    // eslint-disable-next-line security/detect-object-injection
    return BOT_API_OPERATION_DEFS[op];
  };

  const executeOperation = async <Op extends BotApiOperationName>(
    operation: Op,
    input: BotApiOperationInputMap[Op],
    options: ApiRequestOptions | undefined,
    requestSignal: AbortSignal | undefined,
  ): Promise<BotApiOperationOutputMap[Op]> => {
    const def = getOperationDef(operation);

    // 1) buildRequest()
    const botId: string | undefined = 'botId' in input ? input.botId : undefined;
    const url = interpolateBotPath(def.pathTemplate, botId);

    const headersFromInput = toHeaderRecord(def.buildHeaders(input));
    const headersFromOptions = toHeaderRecord(options?.headers);

    // Детерминированность: заголовки adapter'а имеют приоритет над options.headers.
    // Политика merge:
    // - headersFromInput (adapter-auth) — всегда authoritative (override).
    // - headersFromOptions — фильтруются allow-list'ом, чтобы пользователь не мог
    //   подсунуть tenant headers или другие запрещённые сервисные заголовки.
    const safeOptionsHeaders = filterAllowedHeaders(headersFromOptions);
    const mergedHeaders = mergeHeaders(safeOptionsHeaders, headersFromInput);

    const requestOptions: ApiRequestOptionsWithSignal = {
      headers: mergedHeaders,
      ...(requestSignal !== undefined ? { signal: requestSignal } : {}),
    };

    const body = def.buildBody(input);

    // 2) validateRequest()
    const validateRequest = (): void => {
      if (def.requestSchema === undefined) return;

      const requestValidation = def.requestSchema.safeParse(body);
      if (requestValidation.success) return;

      const mappedIssues = mapZodIssues(
        requestValidation.error.issues as readonly {
          path: readonly PropertyKey[];
          message?: string;
        }[],
      );

      throw createParsingErrorResponseFromZodIssues(operation, mappedIssues);
    };

    // 3) executeTransport()
    const executeTransport = async (): Promise<unknown> => {
      const transportEffect = wrapLegacyCallWithEffect(
        legacyClient,
        def.method,
        url,
        body,
        requestOptions,
        normalizationRules,
      );

      // Важно: сигнал передаём только через requestOptions.signal (чтобы избежать double-signal).
      return transportEffect(requestSignal);
    };

    // 4) validateResponse()
    const validateResponse = (raw: unknown): BotApiOperationOutputMap[Op] => {
      const responseValidation = def.responseSchema.safeParse(raw);
      if (responseValidation.success) {
        return responseValidation.data as BotApiOperationOutputMap[Op];
      }

      const mappedIssues = mapZodIssues(
        responseValidation.error.issues as readonly {
          path: readonly PropertyKey[];
          message?: string;
        }[],
      );

      throw createParsingErrorResponseFromZodIssues(operation, mappedIssues);
    };

    validateRequest();
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Таймаут обеспечивается верхним слоем (orchestrator/bot-pipeline); здесь только ожидание эффекта транспорта.
    const rawResponse = await executeTransport();
    return validateResponse(rawResponse);
  };

  const executeEffect = <Op extends BotApiOperationName>(
    operation: Op,
    input: BotApiOperationInputMap[Op],
    options?: ApiRequestOptions,
  ): Effect<BotApiOperationOutputMap[Op]> => {
    return async (signal?: AbortSignal): Promise<BotApiOperationOutputMap[Op]> => {
      // Все потенциально-throwing вычисления (buildRequest/validate/parse)
      // происходят внутри async-Effect (bulletproof lazy invariant).
      return executeOperation(operation, input, options, signal);
    };
  };

  return {
    listBots: (input, options) => executeEffect('listBots', input, options),
    createBot: (input, options) => executeEffect('createBot', input, options),
    getBot: (input, options) => executeEffect('getBot', input, options),
    updateInstruction: (input, options) => executeEffect('updateInstruction', input, options),
  };
}
