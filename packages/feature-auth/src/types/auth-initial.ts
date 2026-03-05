/**
 * @file packages/feature-auth/src/types/auth-initial.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Initial States
 * ============================================================================
 * Единый источник истины для начальных состояний аутентификации.
 * Используется для атомарного reset через batchUpdate в logout и других cleanup операциях.
 * Архитектурные решения:
 * - Immutable: константы с объектами используют Object.freeze, примитивы (null) возвращаются через pure функцию-фабрику
 * - Type-safe: соответствуют типам из types/auth.ts
 * - Канонические значения: избегаем дублирования в разных местах
 * - Не зависит от store или effects (чистые константы/функции)
 * Инварианты:
 * - ❌ Нет бизнес-логики
 * - ✅ Только константы и pure функции
 * - ✅ Единый источник истины для reset
 */

import type { AuthState, SecurityState, SessionState } from './auth.js';
import type { ReadonlyDeep } from './auth-risk.js';

/* ============================================================================
 * 🎯 CANONICAL INITIAL STATES
 * ============================================================================
 */

/**
 * Начальное состояние аутентификации.
 * @note Единый источник истины для reset операций.
 */
export const initialAuthState: Readonly<AuthState> = Object.freeze({
  status: 'unauthenticated',
});

/**
 * Начальное состояние сессии.
 * @note Возвращает null (отсутствие активной сессии)
 * @note Фабрика используется для соблюдения линтера по изоляции контекста
 */
export function createInitialSessionState(): ReadonlyDeep<SessionState | null> {
  return null;
}

/**
 * Начальное состояние безопасности.
 * @note Единый источник истины для reset операций.
 */
export const initialSecurityState: Readonly<SecurityState> = Object.freeze({
  status: 'secure',
});
