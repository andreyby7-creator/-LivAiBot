/**
 * @file packages/feature-bots/src/lib/bot-errors.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bot Errors (Single Source of Truth)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Lib-слой feature-bots: единый registry метаданных для `BotErrorCode`
 *   (category/severity + coarse boundary discriminator `error`).
 * - Слой Error normalization:
 *   - детерминированная фабрика доменной ошибки `BotError` по `BotErrorCode`;
 *   - нормализация `BotErrorResponse` на boundary (frontend/SDK) без дрейфа метаданных.
 * - Anti-corruption слой против drift: canonical metadata по `code` + retryable строго из `domain/BotRetryPolicy`.
 *
 * Принципы:
 * - ✅ SRP: только декларативные таблицы + чистые хелперы (без HTTP/DB/transport side-effects).
 * - ✅ Deterministic: один `BotErrorCode` → один набор метаданных.
 * - ✅ Extensible: добавление нового кода требует обновить один registry (TS заставит).
 * - ✅ Microservice-ready: `statusCode` опционален и не является source-of-truth (может отличаться между boundary).
 *
 * @remarks
 * - В UI/SDK **нельзя** ветвиться по `error` — используйте `code`. `error` остаётся coarse по дизайну.
 * - `context` обязан быть **уже санитизирован** на boundary (без PII/secrets/stack/internal ids).
 */

import type { JsonValue } from '@livai/core-contracts';

import type { BotErrorResponse, BotErrorType } from '../contracts/BotErrorResponse.js';
import { getBotRetryable } from '../domain/BotRetry.js';
import type {
  BotError,
  BotErrorCategory,
  BotErrorCode,
  BotErrorContext,
  BotErrorSeverity,
} from '../types/bots.js';

/* ============================================================================
 * 🧩 SINGLE SOURCE OF TRUTH — BotErrorCode metadata
 * ========================================================================== */

type BotErrorMeta = Readonly<{
  /** Boundary-тип ошибки. Может быть coarse-grained; детализация хранится в `code`. */
  readonly error: BotErrorType;
  /** Категория ошибки (для UI группировки и аналитики). */
  readonly category: BotErrorCategory;
  /** Уровень серьёзности (для telemetry/alerts). */
  readonly severity: BotErrorSeverity;
  /** Опциональный HTTP статус (не обязателен и не является source-of-truth). */
  readonly statusCode?: number | undefined;
}>;

// Coarse-grained discriminators, чтобы не сваливаться в `unknown_error` на boundary.
const channelBase = { error: 'channel_error', category: 'channel' } as const;
const webhookBase = { error: 'webhook_error', category: 'webhook' } as const;
const parsingBase = { error: 'parsing_error', category: 'parsing' } as const;
const integrationBase = { error: 'integration_error', category: 'integration' } as const;

/**
 * Метаданные по всем `BotErrorCode`.
 *
 * @remarks
 * - `retryable` намеренно не хранится здесь: это отдельная domain-политика (`BotRetryPolicy`).
 * - `error` является boundary discriminator и может быть coarse-grained там, где union `BotErrorType`
 *   не покрывает детальные варианты. В UI/SDK **нельзя** ветвиться по `error` — используйте `code`.
 */
export const botErrorMetaByCode: Readonly<Record<BotErrorCode, BotErrorMeta>> = {
  // Validation
  BOT_NAME_INVALID: { error: 'name_invalid', category: 'validation', severity: 'low' },
  BOT_NAME_TOO_SHORT: { error: 'name_too_short', category: 'validation', severity: 'low' },
  BOT_NAME_TOO_LONG: { error: 'name_too_long', category: 'validation', severity: 'low' },
  BOT_NAME_DUPLICATE: { error: 'name_duplicate', category: 'validation', severity: 'medium' },
  BOT_INSTRUCTION_EMPTY: { error: 'instruction_empty', category: 'validation', severity: 'low' },
  BOT_INSTRUCTION_TOO_LONG: {
    error: 'instruction_too_long',
    category: 'validation',
    severity: 'low',
  },
  BOT_SETTINGS_INVALID: { error: 'settings_invalid', category: 'validation', severity: 'medium' },
  BOT_TEMPLATE_NOT_FOUND: {
    error: 'template_not_found',
    category: 'validation',
    severity: 'medium',
    statusCode: 404,
  },
  BOT_VERSION_INVALID: { error: 'version_invalid', category: 'validation', severity: 'medium' },
  BOT_MULTI_AGENT_SCHEMA_INVALID: {
    error: 'multi_agent_schema_invalid',
    category: 'validation',
    severity: 'medium',
  },
  BOT_PROMPT_INVALID: { error: 'prompt_invalid', category: 'validation', severity: 'medium' },
  BOT_WORKSPACE_ID_INVALID: {
    error: 'workspace_id_invalid',
    category: 'validation',
    severity: 'medium',
  },

  // Policy
  BOT_POLICY_ACTION_DENIED: {
    error: 'policy_action_denied',
    category: 'policy',
    severity: 'high',
    statusCode: 403,
  },
  BOT_POLICY_MODE_INVALID: {
    error: 'policy_mode_invalid',
    category: 'policy',
    severity: 'high',
    statusCode: 400,
  },
  BOT_POLICY_ROLE_INSUFFICIENT: {
    error: 'policy_role_insufficient',
    category: 'policy',
    severity: 'high',
    statusCode: 403,
  },
  BOT_POLICY_ARCHIVED: {
    error: 'policy_archived',
    category: 'policy',
    severity: 'high',
    statusCode: 409,
  },
  BOT_POLICY_SYSTEM_BOT_RESTRICTED: {
    error: 'policy_system_bot_restricted',
    category: 'policy',
    severity: 'high',
    statusCode: 403,
  },

  // Permission
  BOT_PERMISSION_DENIED: {
    error: 'permission_denied',
    category: 'permission',
    severity: 'high',
    statusCode: 403,
  },
  BOT_PERMISSION_READ_DENIED: {
    error: 'permission_read_denied',
    category: 'permission',
    severity: 'high',
    statusCode: 403,
  },
  BOT_PERMISSION_WRITE_DENIED: {
    error: 'permission_write_denied',
    category: 'permission',
    severity: 'high',
    statusCode: 403,
  },
  BOT_PERMISSION_EXECUTE_DENIED: {
    error: 'permission_execute_denied',
    category: 'permission',
    severity: 'high',
    statusCode: 403,
  },
  BOT_PERMISSION_DELETE_DENIED: {
    error: 'permission_delete_denied',
    category: 'permission',
    severity: 'high',
    statusCode: 403,
  },
  BOT_WORKSPACE_ACCESS_DENIED: {
    error: 'workspace_access_denied',
    category: 'permission',
    severity: 'high',
    statusCode: 403,
  },

  // Channel
  BOT_CHANNEL_NOT_FOUND: {
    error: 'channel_not_found',
    category: 'channel',
    severity: 'medium',
    statusCode: 404,
  },
  BOT_REQUEST_ABORTED: {
    error: 'channel_error',
    category: 'channel',
    severity: 'low',
  },
  BOT_CHANNEL_INVALID: { ...channelBase, severity: 'medium', statusCode: 400 },
  BOT_CHANNEL_DISABLED: { ...channelBase, severity: 'medium', statusCode: 409 },
  BOT_CHANNEL_CONNECTION_FAILED: { ...channelBase, severity: 'high' },
  BOT_CHANNEL_RATE_LIMIT_EXCEEDED: { ...channelBase, severity: 'medium', statusCode: 429 },

  // Webhook
  BOT_WEBHOOK_URL_INVALID: { ...webhookBase, severity: 'medium', statusCode: 400 },
  BOT_WEBHOOK_TIMEOUT: { ...webhookBase, severity: 'high', statusCode: 504 },
  BOT_WEBHOOK_FAILED: { ...webhookBase, severity: 'high' },
  BOT_WEBHOOK_RETRY_EXCEEDED: { ...webhookBase, severity: 'medium' },
  BOT_WEBHOOK_SIGNATURE_INVALID: { ...webhookBase, severity: 'high', statusCode: 401 },
  BOT_WEBHOOK_RATE_LIMIT_EXCEEDED: { ...webhookBase, severity: 'medium', statusCode: 429 },

  // Parsing
  BOT_PARSING_INSTRUCTION_INVALID: { ...parsingBase, severity: 'medium', statusCode: 400 },
  BOT_PARSING_SETTINGS_INVALID: { ...parsingBase, severity: 'medium', statusCode: 400 },
  BOT_PARSING_MULTI_AGENT_INVALID: { ...parsingBase, severity: 'medium', statusCode: 400 },
  BOT_PARSING_PROMPT_INVALID: { ...parsingBase, severity: 'medium', statusCode: 400 },
  BOT_PARSING_JSON_INVALID: { ...parsingBase, severity: 'medium', statusCode: 400 },

  // Integration
  BOT_INTEGRATION_NOT_FOUND: {
    error: 'integration_not_found',
    category: 'integration',
    severity: 'medium',
    statusCode: 404,
  },
  BOT_INTEGRATION_INVALID: { ...integrationBase, severity: 'medium', statusCode: 400 },
  BOT_INTEGRATION_AUTH_FAILED: { ...integrationBase, severity: 'high', statusCode: 401 },
  BOT_INTEGRATION_TIMEOUT: { ...integrationBase, severity: 'high', statusCode: 504 },
  BOT_INTEGRATION_RATE_LIMIT_EXCEEDED: { ...integrationBase, severity: 'medium', statusCode: 429 },
  BOT_INTEGRATION_QUOTA_EXCEEDED: { ...integrationBase, severity: 'medium', statusCode: 402 },
} as const satisfies Readonly<Record<BotErrorCode, BotErrorMeta>>;

function getBotErrorResponseBase(code: BotErrorCode): Readonly<{
  readonly error: BotErrorType;
  readonly code: BotErrorCode;
  readonly category: BotErrorCategory;
  readonly severity: BotErrorSeverity;
  readonly retryable: boolean;
}> {
  // eslint-disable-next-line security/detect-object-injection -- `code` ограничен union BotErrorCode; mapping exhaustively typed
  const meta = botErrorMetaByCode[code];
  return Object.freeze({
    error: meta.error,
    code,
    category: meta.category,
    severity: meta.severity,
    retryable: getBotRetryable(code),
  });
}

/* ============================================================================
 * 🏭 FACTORIES — BotErrorResponse
 * ========================================================================== */

type CreateBotErrorResponseInputBase = {
  readonly code: BotErrorCode;
  /**
   * Дополнительный контекст ошибки.
   *
   * @remarks
   * Контекст обязан быть **уже санитизирован** на стороне boundary (backend/adapter):
   * - не должен содержать PII, секреты, внутренние идентификаторы, stack traces и т.п.;
   * - должен быть безопасен для передачи в UI/SDK.
   */
  readonly context?: BotErrorContext | undefined;
  readonly message?: string | undefined;
  readonly statusCode?: number | undefined;
};

type CreateBotErrorResponseInputHooks = {
  /**
   * Hook для observability: вызывается, если передан `statusCode`, который конфликтует с canonical meta status.
   *
   * @remarks
   * Этот модуль остаётся pure: сам он ничего не логирует. Логирование/telemetry делается на boundary.
   */
  readonly onStatusCodeOverrideMismatch?: (
    input: Readonly<
      { readonly requested: number; readonly canonical: number; readonly code: BotErrorCode; }
    >,
  ) => void;
};

export type CreateBotErrorResponseInput = Readonly<
  CreateBotErrorResponseInputBase & CreateBotErrorResponseInputHooks
>;

/**
 * Создаёт `BotErrorResponse` из `BotErrorCode`.
 *
 * @remarks
 * - `retryable` вычисляется строго через `getBotRetryable(code)`.
 * - `category/severity/error` берутся из `botErrorMetaByCode` как single source of truth.
 * - `statusCode` можно переопределить параметром; по умолчанию берётся из метаданных (если задан).
 */
export function createBotErrorResponse(input: CreateBotErrorResponseInput): BotErrorResponse {
  const base = getBotErrorResponseBase(input.code);
  const meta = botErrorMetaByCode[input.code];

  const metaStatus = meta.statusCode;
  const requestedStatus = input.statusCode;

  // В dev защищаемся от неконсистентного использования API (200 для permission denied и т.п.)
  if (
    process.env['NODE_ENV'] !== 'production'
    && requestedStatus !== undefined
    && metaStatus !== undefined
    && requestedStatus !== metaStatus
  ) {
    throw new Error(
      `Invalid statusCode override for ${input.code}: requested=${requestedStatus}, meta=${metaStatus}`,
    );
  }

  if (requestedStatus !== undefined && metaStatus !== undefined && requestedStatus !== metaStatus) {
    input.onStatusCodeOverrideMismatch?.({
      requested: requestedStatus,
      canonical: metaStatus,
      code: input.code,
    });
  }

  // Если у кода есть canonical статус — он всегда приоритетнее (anti-drift).
  return Object.freeze({
    ...base,
    ...(input.message !== undefined ? { message: input.message } : {}),
    ...(metaStatus !== undefined
      ? { statusCode: metaStatus }
      : requestedStatus !== undefined
      ? { statusCode: requestedStatus }
      : {}),
    ...(input.context !== undefined ? { context: input.context } : {}),
  });
}

/**
 * Нормализует `BotErrorResponse`, устраняя drift:
 * - `retryable` приводится к `getBotRetryable(code)`;
 * - `error/category/severity` приводятся к метаданным по `code`.
 *
 * @remarks
 * Полезно на границах (API/client), если источник ошибок может прислать неконсистентный payload.
 */
export function normalizeBotErrorResponse(response: BotErrorResponse): BotErrorResponse {
  const base = getBotErrorResponseBase(response.code);
  const meta = botErrorMetaByCode[response.code];

  // Whitelist-подход: не протаскиваем случайные/будущие поля из boundary.
  return Object.freeze({
    ...base,
    ...(response.message !== undefined ? { message: response.message } : {}),
    ...(response.statusCode !== undefined
      ? { statusCode: response.statusCode }
      : meta.statusCode !== undefined
      ? { statusCode: meta.statusCode }
      : {}),
    ...(response.context !== undefined ? { context: response.context } : {}),
    ...(response.traceId !== undefined ? { traceId: response.traceId } : {}),
    ...(response.timestamp !== undefined ? { timestamp: response.timestamp } : {}),
  });
}

/* ============================================================================
 * 🏭 FACTORY — BotError (domain error)
 * ============================================================================
 */

type CreateBotErrorFromCodeOptions = Readonly<{
  /**
   * Опциональная причина ошибки для контекста.
   *
   * @remarks
   * Причина может быть `unknown`, поэтому требуется минимальная “JSON-safe” нормализация.
   * Upstream обязан передавать только безопасные значения (без PII/секретов).
   */
  readonly cause?: unknown;
}>;

function isErrorLike(
  value: unknown,
): value is Readonly<{ readonly name?: string; readonly message?: string; }> {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Readonly<Record<string, unknown>>;
  return typeof v['message'] === 'string'
    && (typeof v['name'] === 'string' || v['name'] === undefined);
}

function safeSerializeCauseForDetails(cause: unknown): JsonValue {
  try {
    if (cause === null) return null;
    if (typeof cause === 'string' || typeof cause === 'number' || typeof cause === 'boolean') {
      return cause;
    }

    if (isErrorLike(cause)) {
      const v = cause as Readonly<{ readonly name?: string; readonly message?: string; }>;
      return `[${v.name ?? 'Error'}] ${v.message ?? ''}`;
    }

    // Для сложных объектов/массивов: избегаем вложенных структур и не-JSON типов.
    // Важно: String(cause) может бросить исключение (например, если value.toString мутирует или падает),
    // поэтому оборачиваем в try/catch.
    return String(cause);
  } catch {
    return '[UnserializableCause]';
  }
}

/**
 * Создаёт доменный `BotError` по `BotErrorCode`.
 *
 * @remarks
 * - `retryable` вычисляется строго через `getBotRetryable(code)`.
 * - `BotError` возвращается как immutable (shallow) объект.
 */
export function createBotErrorFromCode(
  code: BotErrorCode,
  context?: BotErrorContext | undefined,
  options?: CreateBotErrorFromCodeOptions | undefined,
): BotError {
  // eslint-disable-next-line security/detect-object-injection -- `code` ограничен union BotErrorCode; mapping exhaustively typed
  const meta = botErrorMetaByCode[code];
  const retryable = getBotRetryable(code);

  const safeCause = options?.cause !== undefined
    ? safeSerializeCauseForDetails(options.cause)
    : undefined;

  const mergedContext: BotErrorContext | undefined = safeCause === undefined
    ? context
    : Object.freeze(
      context === undefined
        ? {
          details: Object.freeze({
            cause: safeCause,
          }),
        }
        : {
          ...context,
          details: Object.freeze({
            ...(context.details ?? {}),
            cause: safeCause,
          }),
        },
    );

  return Object.freeze({
    category: meta.category,
    code,
    severity: meta.severity,
    retryable,
    ...(mergedContext !== undefined ? { context: mergedContext } : {}),
  });
}
