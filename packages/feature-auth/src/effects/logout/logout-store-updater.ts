/**
 * @file packages/feature-auth/src/effects/logout/logout-store-updater.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Logout Store Updater
 * ============================================================================
 * Назначение файла:
 * - Единственная точка reset всех состояний аутентификации (auth/session/security) при logout
 * - Атомарный сброс через batchUpdate с использованием канонических initial states
 * - Явный мост между logout-effect и store, без бизнес-логики
 * Гарантии уровня файла:
 * - ❌ Не читает текущее состояние store (не использует getState или подобные методы)
 * - ❌ Не использует fallback-значения (использует только канонические initial states из `types/auth-initial.ts`)
 * - ❌ Не содержит бизнес-логики (только применение reset через порт)
 * - ✅ Обновляет только через порт `AuthStorePort` (никаких прямых обращений к конкретной реализации стора)
 * - ✅ Все обновления выполняются атомарно через `batchUpdate` (избегаем промежуточных состояний)
 * - ✅ Использует канонические initial states из `types/auth-initial.ts` (единый источник истины для reset)
 */

import {
  createInitialSessionState,
  initialAuthState,
  initialSecurityState,
} from '../../types/auth-initial.js';
import type { AuthStorePort, BatchUpdate } from '../shared/auth-store.port.js';

/* ============================================================================
 * 🔧 CONSTANTS — LOGOUT RESET ACTIONS
 * ========================================================================== */

/**
 * Набор действий для атомарного reset auth/session/security состояний при logout.
 * @note Выделен в константу, чтобы централизованно расширять reset-логику без изменения функции.
 */
const logoutResetActions: readonly BatchUpdate[] = [
  { type: 'setAuthState', state: initialAuthState },
  { type: 'setSessionState', state: createInitialSessionState() },
  { type: 'setSecurityState', state: initialSecurityState },
  { type: 'applyEventType', event: 'user_logged_out' },
] as const;

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

/**
 * Применяет атомарный reset всех состояний аутентификации при logout.
 * Инварианты:
 * - Использует канонические initial states из `types/auth-initial.ts` (единый источник истины)
 * - Не читает текущее состояние store, только применяет reset (pure sink над портом стора)
 * - Не содержит fallback-логики: все значения берутся из канонических initial states
 * - Атомарное обновление через `batchUpdate` гарантирует отсутствие промежуточных состояний
 *
 * @example
 * ```ts
 * applyLogoutReset(authStore, { reason: 'user_initiated', context: { source: 'profile_menu' } });
 * // Все состояния сброшены атомарно: auth → unauthenticated, session → null, security → secure
 * ```
 */
export function applyLogoutReset(
  store: AuthStorePort, // Порт стора аутентификации, через который применяются все изменения
  context?: Readonly<{
    reason?: string;
    data?: unknown;
  }>, // Опциональный контекст для audit/telemetry (зарезервирован для будущего использования)
): void {
  // Параметр зарезервирован для будущего использования
  if (context === undefined) {
    // Параметр опционален
  }

  // Атомарное обновление через batchUpdate
  // Все состояния сбрасываются одновременно, избегая промежуточных состояний
  store.batchUpdate(logoutResetActions);
}
