/**
 * @file packages/feature-bots/src/types/bot-lifecycle.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Семантика жизненного цикла ботов (атомарные контракты)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Микро-контракты жизненного цикла, общие для `bots.ts`, `bot-commands.ts`, `bot-events.ts`
 * - Единый source-of-truth для lifecycle/enforcement причин (устраняет drift контрактов)
 * - Без зависимостей на store/effects/transport (domain-pure)
 *
 * Принципы:
 * - ✅ SRP: только lifecycle-semantics
 * - ✅ Deterministic: строгие union-типы
 * - ✅ Extensible: добавление причины не ломает существующие consumers
 * - ✅ Microservice-ready: сериализуемые коды без привязки к runtime
 *
 * ⚠️ Архитектурное правило:
 * Этот модуль должен оставаться dependency-free.
 * Не импортируйте сюда state, commands, events или инфраструктуру.
 */

/* ============================================================================
 * ⏸️ PAUSE REASONS
 * ========================================================================== */

/**
 * Причина паузы бота (reversible operational state).
 * Пауза не означает enforcement — это управляемое операционное состояние.
 */
export type BotPauseReason =
  | 'manual'
  | 'rate_limit'
  | 'integration_error'
  | 'quota_exceeded';

/* ============================================================================
 * ⛔ ENFORCEMENT REASONS
 * ========================================================================== */

/**
 * Причина enforcement-ограничения бота.
 * Эти причины отражают триггеры enforcement (policy/security/billing) и могут приводить к suspend.
 */
export type BotEnforcementReason =
  | 'policy_violation'
  | 'security_risk'
  | 'billing_issue';

/* ============================================================================
 * 🔁 LIFECYCLE REASONS (Union)
 * ========================================================================== */

/** Объединённый тип причин (удобен для events/audit/analytics/rule-engine). */
export type BotLifecycleReason = BotPauseReason | BotEnforcementReason;
