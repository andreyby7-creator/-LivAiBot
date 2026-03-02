/**
 * @file packages/feature-auth/src/effects — Effects
 *
 * Публичный API пакета effects.
 * Экспортирует все публичные эффекты для feature-auth.
 */

/* ============================================================================
 * 🔐 SHARED EFFECTS — ОБЩИЕ УТИЛИТЫ ДЛЯ ВСЕХ ЭФФЕКТОВ
 * ========================================================================== */

/**
 * Shared Effects: общие утилиты для всех auth-эффектов.
 *
 * @public
 */
export * from './shared/index.js';

/* ============================================================================
 * 🔐 LOGIN EFFECTS — ЭФФЕКТЫ ДЛЯ ВХОДА
 * ========================================================================== */

/**
 * Login Effects: все эффекты для login-flow.
 *
 * @public
 */
export * from './login/index.js';

/**
 * Публичный алиас для RiskSignals adapter-уровня.
 * Использует единый источник истины из types/auth-risk.ts (ClassificationSignals).
 *
 * @public
 */
export type { RiskSignals as AdapterRiskSignals } from '../types/auth-risk.js';

/* ============================================================================
 * 🔐 LOGOUT EFFECTS — ЭФФЕКТЫ ДЛЯ ВЫХОДА
 * ========================================================================== */

/**
 * Logout Effects: все эффекты для logout-flow.
 *
 * @public
 */
export * from './logout/index.js';

/* ============================================================================
 * 🎯 LOGOUT EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR LOGOUT-FLOW
 * ========================================================================== */

/**
 * Logout Effect: тонкий orchestrator для logout-flow.
 *
 * Реализует полную последовательность шагов:
 * - lock store → reset store → unlock store (атомарно)
 * - (remote mode) revoke API параллельно после unlock (best-effort, не блокирует logout)
 * - audit logging через LogoutAuditLoggerPort
 * - concurrency control (ignore / cancel_previous / serialize)
 *
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map (только для remote mode)
 * - Fail-closed: не вводит fallback-значения, не читает текущее состояние store
 * - Remote logout: reset store всегда, revoke API best-effort (не блокирует logout)
 * - Idempotency: reset уже выполненного состояния является no-op (через batchUpdate)
 *
 * @public
 */
export { createLogoutEffect, type LogoutResult } from './logout.js';

/* ============================================================================
 * 🎯 LOGIN EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR LOGIN-FLOW
 * ========================================================================== */

/**
 * Login Effect: тонкий orchestrator для login-flow.
 *
 * Реализует полную последовательность шагов:
 * - validate-input (strict Zod validation)
 * - security-pipeline (через SecurityPipelinePort)
 * - enrich-metadata
 * - двухфазный API-call (/v1/auth/login + /v1/auth/me)
 * - domain mapping
 * - update-store (через login-store-updater)
 * - audit logging
 *
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map
 * - Fail-closed: без успешного /me → login не считается успешным
 *
 * @public
 */
export { createLoginEffect, type LoginResult } from './login.js';
