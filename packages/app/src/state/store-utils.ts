/**
 * @file packages/app/src/state/store-utils.ts
 * ============================================================================
 * 🛡️ STORE UTILS — БЕЗОПАСНЫЕ ОБНОВЛЕНИЯ STORE С ЗАЩИТОЙ ОТ RACE CONDITIONS
 * ============================================================================
 * Минимальный, чистый boundary-модуль для безопасных обновлений store
 * с защитой от race conditions.
 * Архитектурная роль:
 * - Thread-safe обновления через atomic операции (локальный lock)
 * - Блокировка update при logout — безопасность
 * - Atomic updates — все обновления атомарны, исключают race conditions полностью
 * Принципы:
 * - Zero business logic
 * - Zero telemetry (telemetry → observability layer)
 * - Zero state validation (state validation → validation layer)
 * - Zero state transformation (state transformation → business logic layer)
 * - Zero store initialization (store initialization → store layer)
 * - Детерминированное поведение
 * - Полная thread-safety
 * ⚠️ Важно: Atomic операции
 * - safeSet должен быть atomic: локальный lock предотвращает параллельные обновления
 * - Atomic merge — обновление состояния происходит атомарно
 * - Thread-safe — безопасно для concurrent обновлений
 */

import type { AppStore, AppStoreState } from './store.js';
import { useAppStore } from './store.js';

/* ============================================================================
 * 🔢 КОНСТАНТЫ
 * ========================================================================== */

/**
 * Флаг блокировки store при logout.
 * Устанавливается в true при начале logout процесса.
 */
let isStoreLockedFlag = false;

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/**
 * Конфигурация для безопасного обновления store.
 */
export type SafeSetOptions = {
  /** Опциональный тег для идентификации обновления в логах и телеметрии */
  readonly label?: string | undefined;

  /**
   * Опциональный callback, вызываемый после успешного обновления store.
   * Позволяет внешнему слою observability отслеживать изменения без нарушения SRP.
   * @param newState - новое состояние store после обновления
   */
  readonly onUpdate?: ((newState: AppStoreState) => void) | undefined;
};

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/**
 * Проверяет, заблокирован ли store (например, при logout).
 * Store блокируется для предотвращения обновлений во время процесса logout.
 * @returns true, если store заблокирован, иначе false
 */
export function isStoreLocked(): boolean {
  return isStoreLockedFlag;
}

/**
 * Устанавливает флаг блокировки store.
 * Используется для блокировки обновлений во время logout.
 * @param locked - флаг блокировки
 * @internal
 * Эта функция должна вызываться только из logout flow.
 */
export function setStoreLocked(locked: boolean): void {
  isStoreLockedFlag = locked;
}

/**
 * Проверяет, можно ли обновлять store в текущий момент.
 * Store нельзя обновлять, если:
 * - Store заблокирован (isStoreLockedFlag === true)
 * - Пользователь не аутентифицирован (userStatus === 'anonymous')
 * @param currentState - текущее состояние store
 * @returns true, если можно обновлять store, иначе false
 */
function canUpdateStore(currentState: AppStore): boolean {
  // Если store заблокирован, нельзя обновлять
  if (isStoreLockedFlag) {
    return false;
  }

  // Если пользователь не аутентифицирован, нельзя обновлять auth-связанное состояние
  // Это защита от обновлений после logout
  if (currentState.userStatus === 'anonymous') {
    return false;
  }

  return true;
}

/* ============================================================================
 * 🔒 LOCK MECHANISM
 * ========================================================================== */

/**
 * Тип операции обновления store.
 */
type UpdateOperation = {
  readonly partialState: Partial<AppStoreState>;
  readonly label?: string | undefined;
  readonly onUpdate?: ((newState: AppStoreState) => void) | undefined;
};

/**
 * Очередь операций обновления store.
 * Используется для последовательной обработки обновлений и предотвращения race conditions.
 */
const updateQueue: UpdateOperation[] = [];

/**
 * Флаг, указывающий, обрабатывается ли очередь в данный момент.
 */
let isProcessingQueue = false;

/**
 * Логирует предупреждение о блокировке обновления store.
 * @param label - опциональный тег операции
 */
function logBlockedUpdate(label: string | undefined): void {
  const errorMessage = label != null
    ? `Store update blocked after queue (label: ${label}): store is locked or user is not authenticated`
    : 'Store update blocked after queue: store is locked or user is not authenticated';
  // В development режиме логируем предупреждение
  if (process.env['NODE_ENV'] === 'development') {
    // eslint-disable-next-line no-console
    console.warn(`[store-utils] ${errorMessage}`);
  }
}

/**
 * Вызывает callback после успешного обновления store.
 * Игнорирует ошибки в callback, чтобы не нарушать основной flow обновления.
 * @param onUpdate - callback для вызова
 */
function invokeUpdateCallback(onUpdate: (newState: AppStoreState) => void): void {
  const newState = useAppStore.getState();
  try {
    onUpdate(newState);
  } catch (error: unknown) {
    // Игнорируем ошибки в callback, чтобы не нарушать основной flow обновления
    // В development режиме логируем предупреждение
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[store-utils] Error in onUpdate callback:', error);
    }
  }
}

/**
 * Обрабатывает одну операцию обновления store.
 * @param operation - операция для обработки
 * @returns true, если операция была успешно обработана, иначе false
 */
function processUpdateOperation(operation: UpdateOperation): boolean {
  const { partialState, label, onUpdate } = operation;

  // Повторная проверка после получения из очереди (double-check pattern)
  const currentState = useAppStore.getState();
  if (!canUpdateStore(currentState)) {
    logBlockedUpdate(label);
    return false;
  }

  // Атомарное обновление через Zustand setState
  // Zustand гарантирует атомарность обновления
  useAppStore.setState(partialState);

  // Вызываем callback после успешного обновления для observability
  // Это позволяет внешнему слою отслеживать изменения без нарушения SRP
  if (onUpdate !== undefined) {
    invokeUpdateCallback(onUpdate);
  }

  return true;
}

/**
 * Обрабатывает очередь операций обновления store последовательно.
 * Гарантирует, что только одна операция обновления выполняется одновременно.
 * Это обеспечивает thread-safety и atomic операции.
 */
function processUpdateQueue(): void {
  // Если очередь уже обрабатывается, ничего не делаем
  if (isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;

  try {
    // Обрабатываем все операции в очереди последовательно
    while (updateQueue.length > 0) {
      const operation = updateQueue.shift();
      if (operation === undefined) {
        break;
      }

      processUpdateOperation(operation);
    }
  } finally {
    isProcessingQueue = false;
  }
}

/* ============================================================================
 * 🎯 ОСНОВНАЯ ФУНКЦИЯ
 * ========================================================================== */

/**
 * Безопасно обновляет store с защитой от race conditions и блокировкой при logout.
 * Обеспечивает:
 * - 🛡️ Защита от race conditions — thread-safe обновления через atomic операции (локальный lock)
 * - 🚫 Блокировка update при logout — безопасность
 * - 🔒 Atomic updates — все обновления атомарны, исключают race conditions полностью
 * @param partialState - частичное состояние для обновления (merge с текущим состоянием)
 * @param options - опции обновления (опционально)
 * @throws {Error} Если store заблокирован или пользователь не аутентифицирован
 *
 * @example
 * ```ts
 * // Базовое использование
 * safeSet({ user: newUser }, { label: 'user-update' });
 * // Обновление auth токенов
 * safeSet({
 *   auth: {
 *     accessToken: 'token',
 *     refreshToken: 'refresh',
 *     expiresAt: Date.now() + 3600000,
 *   },
 * }, { label: 'auth-tokens-update' });
 * // С callback для observability
 * safeSet(
 *   { user: newUser },
 *   {
 *     label: 'user-update',
 *     onUpdate: (newState) => {
 *       // Логирование, телеметрия и т.д. в observability layer
 *       telemetry.log('user-updated', { userId: newState.user?.id });
 *     },
 *   },
 * );
 * ```
 */
export function safeSet(
  partialState: Partial<AppStoreState>,
  options?: SafeSetOptions,
): void {
  const { label, onUpdate } = options ?? {};

  // Синхронная проверка блокировки для раннего обнаружения проблем
  const currentState = useAppStore.getState();

  if (!canUpdateStore(currentState)) {
    const errorMessage = label != null
      ? `Store update blocked (label: ${label}): store is locked or user is not authenticated`
      : 'Store update blocked: store is locked or user is not authenticated';
    throw new Error(errorMessage);
  }

  // Добавляем операцию в очередь для последовательной обработки
  // Это обеспечивает thread-safety и предотвращает race conditions
  updateQueue.push({ partialState, label, onUpdate });

  // Запускаем обработку очереди синхронно
  // Это гарантирует, что операции выполняются последовательно
  processUpdateQueue();
}
