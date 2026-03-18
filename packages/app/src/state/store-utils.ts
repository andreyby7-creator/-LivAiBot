/**
 * @file packages/app/src/state/store-utils.ts
 * ============================================================================
 * 🛡️ STORE UTILS — БЕЗОПАСНЫЕ ОБНОВЛЕНИЯ STORE С ЗАЩИТОЙ ОТ RACE CONDITIONS
 * ============================================================================
 *
 * Минимальный boundary-модуль для безопасных обновлений Zustand store.
 * Архитектурная роль:
 * - Последовательные обновления через очередь (атомарный `setState`)
 * - Глобальная блокировка обновлений на время logout (security guardrail)
 *
 * Принципы:
 * - Zero business logic
 * - Zero telemetry (telemetry → observability layer)
 * - Zero state validation (state validation → validation layer)
 * - Zero state transformation (state transformation → business logic layer)
 * - Zero store initialization (store initialization → store layer)
 * - Детерминированное поведение (один порядок применения обновлений)
 *
 * Контракт:
 * - `safeSet()` применяет обновления последовательно в рамках одного JS event-loop.
 * - Если появится async middleware/transport для `setState`, эту реализацию нужно пересмотреть.
 */

import type { AppStore, AppStoreState } from './store.js';
import { getAppStoreState, setAppStoreState } from './store.js';

/* ============================================================================
 * 🔢 КОНСТАНТЫ
 * ========================================================================== */

/**
 * Флаг блокировки store при logout.
 * Устанавливается в true при начале logout процесса.
 */
let isStoreLockedFlag = false;

/** Dev-only guardrails без влияния на prod-перфоманс/поведение. */
const IS_DEV = process.env['NODE_ENV'] !== 'production';

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/** Конфигурация для безопасного обновления store. */
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

  // После logout запрещаем любые обновления (грубый security guardrail).
  if (currentState.userStatus === 'anonymous') {
    return false;
  }

  return true;
}

/* ============================================================================
 * 🔒 UPDATE QUEUE (SEQUENTIAL APPLY)
 * ========================================================================== */

/** Тип операции обновления store. */
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
/** Индекс "головы" очереди: заменяет `shift()` (O(n)) на O(1) инкремент. */
let updateQueueHead = 0;

/** Флаг, указывающий, обрабатывается ли очередь в данный момент. */
let isProcessingQueue = false;

/**
 * Формирует единое сообщение об отказе обновления (для исключения дублирования строк).
 */
function createBlockedUpdateMessage(
  phase: 'precheck' | 'post-queue',
  label: string | undefined,
): string {
  const base = phase === 'precheck'
    ? 'Store update blocked'
    : 'Store update blocked after queue';

  return label != null
    ? `${base} (label: ${label}): store is locked or user is not authenticated`
    : `${base}: store is locked or user is not authenticated`;
}

function logBlockedUpdate(label: string | undefined): void {
  const errorMessage = createBlockedUpdateMessage('post-queue', label);
  // В development режиме логируем предупреждение
  if (IS_DEV) {
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
  const newState = getAppStoreState();
  const snapshot = IS_DEV
    ? Object.freeze({ ...newState })
    : newState;
  try {
    // ⚠️ Контракт: callback НЕ должен мутировать store и не должен вызывать `safeSet/setState`
    // (иначе возможна рекурсия, неожиданный порядок применения и трудноотслеживаемые эффекты).
    onUpdate(snapshot);
  } catch (error: unknown) {
    // Игнорируем ошибки в callback, чтобы не нарушать основной flow обновления
    // В development режиме логируем предупреждение
    if (IS_DEV) {
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
  const currentState = getAppStoreState();
  if (!canUpdateStore(currentState)) {
    logBlockedUpdate(label);
    return false;
  }

  // Атомарное обновление через Zustand setState
  // Zustand гарантирует атомарность обновления
  // @note Контракт: setState синхронен (см. описание файла).
  setAppStoreState(partialState);

  // Вызываем callback после успешного обновления для observability
  // Это позволяет внешнему слою отслеживать изменения без нарушения SRP
  if (onUpdate !== undefined) {
    invokeUpdateCallback(onUpdate);
  }

  return true;
}

/**
 * Обрабатывает очередь операций обновления store последовательно.
 * Гарантирует, что обработка очереди не реентерабельна.
 */
function processUpdateQueue(): void {
  // Если очередь уже обрабатывается, ничего не делаем
  if (isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;

  try {
    // Обрабатываем все операции в очереди последовательно
    while (updateQueueHead < updateQueue.length) {
      const operation = updateQueue[updateQueueHead];
      updateQueueHead += 1;

      if (operation === undefined) {
        break;
      }

      processUpdateOperation(operation);
    }
    // Компактим массив, чтобы не накапливать "хвост" после многих операций.
    if (updateQueueHead > 0) {
      updateQueue.splice(0, updateQueueHead);
      updateQueueHead = 0;
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
 *
 * Гарантии:
 * - Обновления применяются последовательно (queue) и атомарно (Zustand `setState`)
 * - Обновления запрещены при logout/anonymous (guardrail)
 * @param partialState - частичное состояние для обновления (merge с текущим состоянием)
 * @param options - опции обновления (опционально)
 * @throws {Error} Если store заблокирован или пользователь не аутентифицирован
 *
 * @example
 * ```ts
 * // Базовое использование: частичное обновление AppStoreState
 * safeSet({ userStatus: 'loading' }, { label: 'user-status-loading' });
 * ```
 */
export function safeSet(
  partialState: Partial<AppStoreState>,
  options?: SafeSetOptions,
): void {
  const { label, onUpdate } = options ?? {};

  // Синхронная проверка блокировки для раннего обнаружения проблем
  const currentState = getAppStoreState();

  if (!canUpdateStore(currentState)) {
    throw new Error(createBlockedUpdateMessage('precheck', label));
  }

  // Добавляем операцию в очередь и сразу синхронно прогоняем обработчик.
  updateQueue.push({ partialState, label, onUpdate });

  processUpdateQueue();
}
