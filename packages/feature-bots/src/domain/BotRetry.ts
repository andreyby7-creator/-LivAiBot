/**
 * @file packages/feature-bots/src/domain/BotRetry.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Retry-политика для BotErrorCode
 * ============================================================================
 *
 * Архитектурная роль:
 * - Централизованная retry-политика для `BotErrorCode` (ошибки ботов по категориям).
 * - Тонкая обёртка над core-примитивом `@livai/core/resilience/retry-policy`.
 * - Source-of-truth для retryability в feature-bots (effects, error-mapper, DTO-фабрики).
 *
 * Принципы:
 * - ✅ SRP: только retry-политика и helper’ы, без бизнес-логики.
 * - ✅ Deterministic: один код ошибки → одно решение по retry.
 * - ✅ Domain-pure: без side-effects и transport-деталей.
 * - ✅ Extensible: добавление нового кода ошибки требует явного обновления политики.
 *
 * @remarks
 * - Ключ `BotRetryKey` должен оставаться исчерпывающим union-типом (`BotErrorCode`), а не произвольным `string`.
 *   Это гарантирует, что при добавлении нового кода ошибки TypeScript потребует обновить политику.
 * - Edge-cases:
 *   - Validation/policy/permission/parsing ошибки считаются не ретраебельными (требуют изменения данных/конфигурации).
 *   - Channel/webhook/integration ошибки, связанные с сетью/инфраструктурой (timeouts, rate limits), по умолчанию
 *     помечены как ретраебельные и могут переопределяться через `mergeBotRetryPolicies`.
 */

import type { RetryPolicy } from '@livai/core/resilience';
import { createRetryPolicy, getRetryable, mergeRetryPolicies } from '@livai/core/resilience';

import type { BotErrorCode } from '../types/bots.js';

/* ============================================================================
 * 🔐 BOT RETRY POLICY
 * ========================================================================== */

export type BotRetryKey = BotErrorCode;

/**
 * Default retry-политика для BotErrorCode.
 *
 * @remarks
 * Значения подобраны консервативно:
 * - validation/policy/permission/parsing ошибки считаются не ретраебельными (требуют исправления данных/конфигурации);
 * - channel/webhook/integration ошибки, связанные с сетью/инфраструктурой, могут быть ретраебельны;
 * - policy-level rate limits обрабатываются как non-retryable на стороне rule-engine.
 * Политика может быть откалибрована позже, но уже является полной и детерминированной.
 */
const RawBotRetryPolicy = {
  // Validation
  BOT_NAME_INVALID: false,
  BOT_NAME_TOO_SHORT: false,
  BOT_NAME_TOO_LONG: false,
  BOT_NAME_DUPLICATE: false,
  BOT_INSTRUCTION_EMPTY: false,
  BOT_INSTRUCTION_TOO_LONG: false,
  BOT_SETTINGS_INVALID: false,
  BOT_TEMPLATE_NOT_FOUND: false,
  BOT_VERSION_INVALID: false,
  BOT_MULTI_AGENT_SCHEMA_INVALID: false,
  BOT_PROMPT_INVALID: false,
  BOT_WORKSPACE_ID_INVALID: false,

  // Policy
  BOT_POLICY_ACTION_DENIED: false,
  BOT_POLICY_MODE_INVALID: false,
  BOT_POLICY_ROLE_INSUFFICIENT: false,
  BOT_POLICY_ARCHIVED: false,
  BOT_POLICY_SYSTEM_BOT_RESTRICTED: false,

  // Permission
  BOT_PERMISSION_DENIED: false,
  BOT_PERMISSION_READ_DENIED: false,
  BOT_PERMISSION_WRITE_DENIED: false,
  BOT_PERMISSION_EXECUTE_DENIED: false,
  BOT_PERMISSION_DELETE_DENIED: false,
  BOT_WORKSPACE_ACCESS_DENIED: false,

  // Channel
  BOT_CHANNEL_NOT_FOUND: false,
  BOT_CHANNEL_INVALID: false,
  BOT_CHANNEL_DISABLED: false,
  BOT_CHANNEL_CONNECTION_FAILED: true,
  BOT_CHANNEL_RATE_LIMIT_EXCEEDED: true,

  // Webhook
  BOT_WEBHOOK_URL_INVALID: false,
  BOT_WEBHOOK_TIMEOUT: true,
  BOT_WEBHOOK_FAILED: true,
  BOT_WEBHOOK_RETRY_EXCEEDED: false,
  BOT_WEBHOOK_SIGNATURE_INVALID: false,
  BOT_WEBHOOK_RATE_LIMIT_EXCEEDED: true,

  // Parsing
  BOT_PARSING_INSTRUCTION_INVALID: false,
  BOT_PARSING_SETTINGS_INVALID: false,
  BOT_PARSING_MULTI_AGENT_INVALID: false,
  BOT_PARSING_PROMPT_INVALID: false,
  BOT_PARSING_JSON_INVALID: false,

  // Integration
  BOT_INTEGRATION_NOT_FOUND: false,
  BOT_INTEGRATION_INVALID: false,
  BOT_INTEGRATION_AUTH_FAILED: false,
  BOT_INTEGRATION_TIMEOUT: true,
  BOT_INTEGRATION_RATE_LIMIT_EXCEEDED: true,
  BOT_INTEGRATION_QUOTA_EXCEEDED: false,
} as const satisfies RetryPolicy<BotRetryKey>;

export const BotRetryPolicy: RetryPolicy<BotRetryKey> = createRetryPolicy<BotRetryKey>(
  RawBotRetryPolicy,
);

/** Type-safe helper для получения retryability по коду ошибки бота. */
export const getBotRetryable = (code: BotRetryKey): boolean =>
  getRetryable<BotRetryKey>(BotRetryPolicy, code);

/** Helper для мержинга Bot retry-политик (base + override) без дублирования. */
export const mergeBotRetryPolicies = (
  base: RetryPolicy<BotRetryKey>,
  override: Partial<RetryPolicy<BotRetryKey>>,
): RetryPolicy<BotRetryKey> => mergeRetryPolicies<BotRetryKey>(base, override);
