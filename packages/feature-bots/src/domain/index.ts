/**
 * @file packages/feature-bots/src/domain — Domain Types
 * Публичный API доменных типов feature-bots.
 */

/* ============================================================================
 * 🤖 BOTS DOMAIN — ДОМЕННЫЕ ТИПЫ БОТОВ
 * ========================================================================== */

/**
 * Bot Retry Policy: централизованная retry-политика для ошибок ботов.
 * @public
 */
export {
  type BotRetryKey,
  BotRetryPolicy,
  getBotRetryable,
  mergeBotRetryPolicies,
} from './BotRetry.js';
