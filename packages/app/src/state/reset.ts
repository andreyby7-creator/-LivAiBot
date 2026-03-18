/**
 * @file packages/app/src/state/reset.ts
 * ============================================================================
 * 🔴 GLOBAL STATE RESET — СБРОС СОСТОЯНИЯ ПРИ LOGOUT
 * ============================================================================
 *
 * Архитектурная роль:
 * - Централизованная точка сброса UI-состояния приложения
 * - Реакция на доменно-нейтральные app-события (logout, force-reset, etc.)
 * - Изолирован от auth / api / react
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ❌ Нет async / side-effects
 * - ❌ Нет зависимостей от UI
 * - ✅ Реактивность через events
 * - ✅ SSR-safe
 * - ✅ Микросервисно-нейтральный дизайн
 *
 * Использование:
 * - Импортируется и инициализируется в bootstrap-слое приложения
 * - Возвращает cleanup-функцию
 */

import { AppLifecycleEvent, appLifecycleEvents } from '../events/app-lifecycle-events.js';
import { getAppStoreActions } from './store.js';
import { setStoreLocked } from './store-utils.js';

/** Dev-only visibility/guardrails. */
const IS_DEV = process.env['NODE_ENV'] !== 'production';

/* ========================================================================== */
/* 🧠 ARCHITECTURAL IDEA
/* ========================================================================== */

/**
 * reset.ts — это boundary между:
 * - доменными событиями (logout, session-expired, force-reset)
 * - и UI состоянием (zustand store)
 * Он НЕ знает:
 * - кто инициировал logout
 * - почему он произошёл
 * - был ли это user action или server-side invalidation
 * Он ЗНАЕТ только:
 * 👉 "приложению нужно вернуться в безопасное baseline-состояние"
 */

/* ========================================================================== */
/* 🎯 RESET CONTRACTS
/* ========================================================================== */

export type AppResetReason =
  | 'logout'
  | 'session-expired'
  | 'force-reset';

/** Mapping внутренних причин reset к lifecycle событиям. */
const RESET_REASON_TO_EVENT: Record<AppResetReason, AppLifecycleEvent> = {
  'logout': AppLifecycleEvent.USER_LOGOUT,
  'session-expired': AppLifecycleEvent.APP_RESET,
  'force-reset': AppLifecycleEvent.APP_RESET,
};

/**
 * Политика сброса состояния приложения.
 * - 'full': Полный сброс всего UI state (формы, кэши, флаги)
 * - 'soft': Минимальный сброс только runtime-состояний (формы, временные флаги)
 */
export type AppResetPolicy = 'full' | 'soft';

/* ========================================================================== */
/* 🔴 RESET HANDLER
/* ========================================================================== */

/**
 * Выполняет сброс UI-состояния приложения.
 * @param reason - причина сброса (сигнал, не логика)
 * @param policy - политика сброса (по умолчанию 'full')
 * @note
 * soft reset — сброс только ephemeral runtime state, сохраняет persistent state/flags
 * @note
 * Store блокируется перед reset и разблокируется после для предотвращения
 * обновлений во время процесса сброса состояния.
 * @note
 * Ограничение: lock — это локальный guardrail для слоёв, которые обновляют store через
 * `safeSet` (см. `store-utils`). Любые прямые `setState`/обходные обновления вне этого
 * boundary могут обойти блокировку — это осознанный контракт архитектуры.
 */
function resetAppState(
  reason: AppResetReason,
  policy: AppResetPolicy = 'full',
): void {
  // Блокируем store перед reset для предотвращения обновлений во время сброса
  setStoreLocked(true);

  try {
    const { reset, resetSoft } = getAppStoreActions();

    if (policy === 'full') {
      reset(); // полный сброс UI state
    } else if (typeof resetSoft === 'function') {
      // soft-reset: минимальный сброс runtime state
      resetSoft();
    } else {
      // fallback на full reset, если soft не реализован
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          '[reset] soft reset requested, but resetSoft is not implemented; falling back to full reset',
          { reason },
        );
      }
      reset();
    }

    // Отправляем lifecycle событие
    const lifecycleEvent = RESET_REASON_TO_EVENT[reason];
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.warn('[reset] app state reset', { reason, policy, lifecycleEvent });
    }
    appLifecycleEvents.emit(lifecycleEvent);
  } finally {
    // Разблокируем store после reset (гарантируется даже при ошибке)
    setStoreLocked(false);
  }
}

/* ========================================================================== */
/* 🌐 EVENT REGISTRATION
/* ========================================================================== */

let isRegistered = false;

/**
 * Регистрирует глобальные обработчики reset-состояния.
 * @returns cleanup-функция для teardown
 */
export function registerAppStateReset(): () => void {
  if (isRegistered) {
    return () => undefined;
  }

  isRegistered = true;

  const unsubscribeUserLogout: () => void = appLifecycleEvents.on(
    AppLifecycleEvent.USER_LOGOUT,
    () => {
      resetAppState('logout', 'full');
    },
  );

  const unsubscribeAppReset: () => void = appLifecycleEvents.on(AppLifecycleEvent.APP_RESET, () => {
    resetAppState('force-reset', 'soft');
  });

  return (): void => {
    isRegistered = false;

    unsubscribeUserLogout();
    unsubscribeAppReset();
  };
}

/**
 * Сбрасывает состояние регистрации для тестирования.
 * Только для использования в тестах!
 * @internal
 */
export function __resetAppStateResetRegistration(): void {
  isRegistered = false;
}

/* ============================================================================
 * 🏛️ ARCHITECTURAL CONTRACT
 * ============================================================================
 *
 * ЧТО МОЖНО:
 * - Реагировать на app-level события
 * - Вызывать публичные actions store
 * - Определять reset-контракты и политики
 * - Делать teardown подписок
 *
 * ЧТО НЕЛЬЗЯ:
 * - Импортировать auth / api / services
 * - Делать async операции
 * - Хранить бизнес-логику
 * - Ветвить логику по reset reason
 * - Модифицировать store напрямую
 */
