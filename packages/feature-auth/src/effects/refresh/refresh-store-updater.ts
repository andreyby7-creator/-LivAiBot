/**
 * @file packages/feature-auth/src/effects/refresh/refresh-store-updater.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Refresh Store Updater
 * ============================================================================
 * Назначение файла:
 * - Единственная точка применения результата refresh-flow к auth/session/security состояниям стора
 * - Атомарное обновление через batchUpdate, без чтения текущего состояния store
 * - Явный мост между refresh-effect и store, без бизнес-логики и policy-решений
 * Гарантии уровня файла:
 * - ❌ Не читает текущее состояние store (не использует getState или подобные методы)
 * - ❌ Не пересчитывает security/risk (решения принимает session-manager/policy-engine)
 * - ❌ Не вводит fallback-значения для security (использует initialSecurityState только при invalidate)
 * - ✅ Обновляет только через порт `AuthStorePort` (никаких прямых обращений к конкретной реализации стора)
 * - ✅ Все обновления выполняются атомарно через `batchUpdate` (избегаем промежуточных состояний)
 * - ✅ При успехе re-use текущего SecurityState за счёт отсутствия его изменения в batchUpdate
 * - ✅ При invalidate выполняет полный reset через канонические initial states (как в logout-store-updater)
 */

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { MeResponse } from '../../domain/MeResponse.js';
import type { TokenPair } from '../../domain/TokenPair.js';
import type { AuthState } from '../../types/auth.js';
import {
  createInitialSessionState,
  initialAuthState,
  initialSecurityState,
} from '../../types/auth-initial.js';
import type { AuthStorePort, BatchUpdate } from '../shared/auth-store.port.js';
import { buildSessionState } from '../shared/session-state.builder.js';
import type { RefreshInvalidationReason } from './refresh-effect.types.js';

/* ============================================================================
 * 🔧 INTERNAL HELPERS — AUTH STATE MAPPING
 * ========================================================================== */

/**
 * Строит AuthState для успешно обновлённой сессии на основе MeResponse.
 * @remarks
 * - Использует MeResponse как источник истины (user / roles / permissions / features / context).
 * - Permissions конвертируются в frozen ReadonlySet для защиты от мутаций.
 * - Session копируется из MeResponse при наличии (me.session опционален).
 */
function buildAuthenticatedAuthState(me: MeResponse): AuthState {
  return {
    status: 'authenticated' as const,
    user: me.user,
    ...(me.session !== undefined ? { session: me.session } : {}),
    roles: me.roles,
    permissions: Object.freeze(new Set(me.permissions)) as ReadonlySet<string>,
    ...(me.features !== undefined ? { features: me.features } : {}),
    ...(me.context !== undefined ? { context: me.context } : {}),
  };
}

/* ============================================================================
 * 🔧 FACTORY — INVALIDATION RESET ACTIONS
 * ========================================================================== */

/**
 * Строит набор действий для атомарного reset auth/session/security состояний при invalidate.
 * @remarks
 * - Полный reset аналогичен logout, но с отдельным audit-событием `session_revoked`.
 * - Реализовано через фабрику, чтобы при добавлении новых state-slices не дублировать логику.
 */
function buildRefreshInvalidateActions(): readonly BatchUpdate[] {
  return [
    { type: 'setAuthState', state: initialAuthState },
    { type: 'setSessionState', state: createInitialSessionState() },
    { type: 'setSecurityState', state: initialSecurityState },
    { type: 'applyEventType', event: 'session_revoked' },
  ] as const;
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ========================================================================== */

/**
 * Обновляет auth/session состояние на основе результата успешного refresh-flow.
 * Инварианты:
 * - Использует валидированные TokenPair и MeResponse (domain-результат refresh-api.mapper.ts).
 * - Не читает текущее состояние store, только применяет новое (pure sink над портом стора).
 * - SecurityState re-use: не изменяет SecurityState, оставляя текущее значение нетронутым.
 * - Атомарное обновление через `batchUpdate` гарантирует отсутствие промежуточных состояний.
 * - DeviceInfo default: если deviceInfo не передан, использует канонический default (domain purity).
 *
 * @param store - порт стора аутентификации, через который применяются все изменения
 * @param tokenPair - валидированная пара токенов из refresh-flow
 * @param me - валидированный MeResponse, согласованный с токенами
 * @param deviceInfo - информация об устройстве для построения SessionState (опционально, используется default если не передан)
 */
export function updateRefreshState(
  store: AuthStorePort,
  tokenPair: TokenPair,
  me: MeResponse,
  deviceInfo?: DeviceInfo | undefined,
): void {
  // Domain purity: default DeviceInfo создается в store-updater, а не в orchestrator
  const finalDeviceInfo: DeviceInfo = deviceInfo ?? {
    deviceId: '',
    deviceType: 'unknown',
  };
  // Явно замораживаем AuthState перед отправкой в store на случай, если реализация стора не делает copy-on-write.
  const newAuthState = Object.freeze(buildAuthenticatedAuthState(me)) as AuthState;

  const newSessionState = buildSessionState({
    deviceInfo: finalDeviceInfo,
    tokenPair,
    meSession: me.session,
  });

  const updates: readonly BatchUpdate[] = [
    { type: 'setAuthState', state: newAuthState },
    { type: 'setSessionState', state: newSessionState },
    { type: 'applyEventType', event: 'token_refreshed' },
  ];

  store.batchUpdate(updates);
}

/**
 * Применяет invalidate для текущей сессии после решения session-manager/policy-engine.
 * Инварианты:
 * - Полный reset всех состояний (auth/session/security) через канонические initial states.
 * - Не читает текущее состояние store, только применяет reset (pure sink).
 * - Атомарное обновление через `batchUpdate` исключает промежуточные состояния.
 *
 * @param store - порт стора аутентификации
 * @param reason - типизированная причина invalidate.
 * @remarks
 *   Зарезервировано для будущего использования в audit/telemetry-слое (например, для выбора типа audit-события
 *   или дополнительного контекста). На уровне store-updater параметр не используется намеренно, чтобы сохранить
 *   чистоту и детерминизм обновления стора.
 */
export function applyRefreshInvalidate(
  store: AuthStorePort,
  reason: RefreshInvalidationReason,
): void {
  // Параметр reason зарезервирован для audit/telemetry слоя и не используется на уровне store-updater.
  if (reason === 'unknown') {
    // Явный no-op для сохранения параметра и предотвращения линтер-предупреждений.
  }

  store.batchUpdate(buildRefreshInvalidateActions());
}
