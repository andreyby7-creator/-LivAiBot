/**
 * @file packages/feature-auth/src/effects — Effects
 * Публичный API пакета effects.
 * Экспортирует все публичные эффекты для feature-auth.
 */

/* ============================================================================
 * 🔐 SHARED EFFECTS — ОБЩИЕ УТИЛИТЫ ДЛЯ ВСЕХ ЭФФЕКТОВ
 * ========================================================================== */

/**
 * Shared Effects: общие утилиты для всех auth-эффектов.
 * @public
 */
export * from './shared/index.js';

/* ============================================================================
 * 🔐 REGISTER EFFECTS — ЭФФЕКТЫ ДЛЯ РЕГИСТРАЦИИ
 * ========================================================================== */

/**
 * Register Effects: все эффекты для register-flow.
 * @public
 */
export * from './register/index.js';

/* ============================================================================
 * 🔐 LOGIN EFFECTS — ЭФФЕКТЫ ДЛЯ ВХОДА
 * ========================================================================== */

/**
 * Login Effects: все эффекты для login-flow.
 * @public
 */
export * from './login/index.js';

/**
 * Публичный алиас для RiskSignals adapter-уровня.
 * Использует единый источник истины из types/auth-risk.ts (ClassificationSignals).
 * @public
 */
export type { RiskSignals as AdapterRiskSignals } from '../types/auth-risk.js';

/* ============================================================================
 * 🔄 REFRESH EFFECTS — ОБНОВЛЕНИЕ СЕССИИ
 * ========================================================================== */

/**
 * Refresh Effects: все эффекты для refresh-flow.
 * @public
 */
export * from './refresh/index.js';

/* ============================================================================
 * 🔐 LOGOUT EFFECTS — ЭФФЕКТЫ ДЛЯ ВЫХОДА
 * ========================================================================== */

/**
 * Logout Effects: все эффекты для logout-flow.
 * @public
 */
export * from './logout/index.js';

/* ============================================================================
 * 🎯 REGISTER EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR REGISTER-FLOW
 * ========================================================================== */

/**
 * Register Effect: тонкий orchestrator для register-flow.
 * Реализует полную последовательность шагов:
 * - validate-input (domain RegisterRequest)
 * - enrich-metadata (через buildLoginMetadata с operation: 'register')
 * - API-call (/v1/auth/register) с strict Zod-валидацией
 * - domain mapping
 * - update-store (через register-store-updater)
 * - audit logging
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map
 * - Fail-closed: при частично успешном ответе — reject, не применяем токены
 * - Не пересчитывает security (security-pipeline опционален, по плану без него)
 * - Не читает store
 * - Не делает fallback при частичном успехе
 * @public
 */
export { createRegisterEffect, type RegisterResult } from './register.js';

/* ============================================================================
 * 🎯 LOGIN EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR LOGIN-FLOW
 * ========================================================================== */

/**
 * Login Effect: тонкий orchestrator для login-flow.
 * Реализует полную последовательность шагов:
 * - validate-input (strict Zod validation)
 * - security-pipeline (через SecurityPipelinePort)
 * - enrich-metadata
 * - двухфазный API-call (/v1/auth/login + /v1/auth/me)
 * - domain mapping
 * - update-store (через login-store-updater)
 * - audit logging
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map
 * - Fail-closed: без успешного /me → login не считается успешным
 * @public
 */
export { createLoginEffect, type LoginResult } from './login.js';

/* ============================================================================
 * 🔄 REFRESH EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR REFRESH-FLOW
 * ========================================================================== */

/**
 * Refresh Effect: тонкий orchestrator для refresh-flow.
 * Реализует полную последовательность шагов:
 * - policy-check через SessionManagerPort (noop / refresh / invalidate)
 * - чтение refreshToken из store + validateRefreshTokenFormat
 * - API-call (/v1/auth/refresh + /v1/auth/me) через performRefreshApiCalls
 * - domain mapping (mapRefreshResponseToDomain)
 * - update-store (через refresh-store-updater)
 * - audit logging (refresh-audit.mapper)
 * - concurrency control (ignore / serialize)
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map
 * - Fail-closed: при частичном успехе /me или неконсистентных данных → error/invalidated
 * @public
 */
export { createRefreshEffect, type RefreshEffectResult } from './refresh.js';

/* ============================================================================
 * 🎯 LOGOUT EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR LOGOUT-FLOW
 * ========================================================================== */

/**
 * Logout Effect: тонкий orchestrator для logout-flow.
 * Реализует полную последовательность шагов:
 * - lock store → reset store → unlock store (атомарно)
 * - (remote mode) revoke API параллельно после unlock (best-effort, не блокирует logout)
 * - audit logging через LogoutAuditLoggerPort
 * - concurrency control (ignore / cancel_previous / serialize)
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map (только для remote mode)
 * - Fail-closed: не вводит fallback-значения, не читает текущее состояние store
 * - Remote logout: reset store всегда, revoke API best-effort (не блокирует logout)
 * - Idempotency: reset уже выполненного состояния является no-op (через batchUpdate)
 * @public
 */
export { createLogoutEffect, type LogoutResult } from './logout.js';
