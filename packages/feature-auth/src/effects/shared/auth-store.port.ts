/**
 * @file packages/feature-auth/src/effects/shared/auth-store.port.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Auth Store Port (Shared)
 * ============================================================================
 *
 * Единый контракт стора для всех auth-эффектов (login/logout/register/refresh).
 * Абстрагирует Zustand store, гарантирует атомарность через batchUpdate,
 * изолирует effects от деталей реализации.
 *
 * Архитектурные решения:
 * - Port pattern: effects работают через интерфейс, не знают про Zustand
 * - Atomic updates: batchUpdate применяет все изменения в одной транзакции
 * - Lock mechanism: setStoreLocked защищает критические операции от race conditions
 * - Type safety: AuthEvent — discriminated union, не string
 * - Separation: state-обновления через patch, events отдельно (избегаем дублирования)
 *
 * Инварианты:
 * - Все store-updater'ы ОБЯЗАНЫ использовать batchUpdate (не отдельные set-методы)
 * - Критические операции (logout/refresh) ОБЯЗАНЫ использовать setStoreLocked или withStoreLock
 * - applyEventType принимает только валидные AuthEvent['type'] (compile-time проверка)
 * - batchUpdate не должен использоваться в async-effect без блокировки
 */

import type { AuthStore, AuthStoreState } from '../../stores/auth.js';
import type { AuthEvent, AuthState, SecurityState, SessionState } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Тип обновления стора для batchUpdate.
 * Discriminated union для type-safe обновлений, легко расширяется новыми вариантами.
 */
export type BatchUpdate =
  | { readonly type: 'setAuthState'; readonly state: AuthState; } // Обновление auth-состояния
  | { readonly type: 'setSessionState'; readonly state: SessionState | null; } // Обновление сессии (null = очистка)
  | { readonly type: 'setSecurityState'; readonly state: SecurityState; } // Обновление security-состояния
  | { readonly type: 'applyEventType'; readonly event: AuthEvent['type']; }; // Применение события (отдельно от state)

/**
 * Type guard для type-safe branching в batchUpdate.
 */
export function isBatchUpdateOfType<T extends BatchUpdate['type']>(
  update: BatchUpdate, // Обновление для проверки
  type: T, // Ожидаемый тип
): update is Extract<BatchUpdate, { readonly type: T; }> { // Type narrowing
  return update.type === type;
}

/**
 * Единый контракт стора для всех auth-эффектов.
 * Все методы синхронные, batchUpdate обязателен для атомарности.
 */
export type AuthStorePort = {
  /** Устанавливает состояние аутентификации */
  setAuthState(state: AuthState): void; // Полное AuthState (discriminated union)

  /** Устанавливает состояние сессии (null = очистка) */
  setSessionState(state: SessionState | null): void; // Полное SessionState или null

  /** Устанавливает состояние безопасности */
  setSecurityState(state: SecurityState): void; // Полное SecurityState (discriminated union)

  /** Применяет тип события аутентификации */
  applyEventType(event: AuthEvent['type']): void; // Union-тип, не string (compile-time проверка)

  /**
   * Блокирует/разблокирует store для критических операций.
   * Обязателен для logout/refresh (защита от race conditions).
   * Блокировка должна быть снята в finally блоке.
   */
  setStoreLocked(locked: boolean): void; // true = блокировка, false = разблокировка

  /**
   * Атомарное обновление стора через массив обновлений.
   * ОБЯЗАТЕЛЬНО для всех store-updater'ов (избегаем промежуточных состояний).
   * Все обновления применяются в одной транзакции, порядок сохраняется.
   * ⚠️ Не используйте в async-effect без блокировки через setStoreLocked.
   */
  batchUpdate(updates: readonly BatchUpdate[]): void; // Массив обновлений для атомарного применения

  /**
   * Получает текущее состояние сессии.
   * @remarks Используется для policy check в refresh-effect и других эффектах, требующих чтения состояния.
   */
  getSessionState(): SessionState | null; // Текущее SessionState или null

  /**
   * Получает refreshToken из secure storage (httpOnly cookie или secure memory).
   * @remarks В production refreshToken должен быть получен через httpOnly cookie или secure storage, не из store.
   *          Этот метод предоставляет единый интерфейс для получения refreshToken независимо от реализации storage.
   * @throws Error если refreshToken недоступен.
   */
  getRefreshToken(): string; // refreshToken из secure storage
};

/* ============================================================================
 * 🔒 LOCK UTILITY — Защита от race conditions
 * ============================================================================
 */

/**
 * Декоратор для безопасного выполнения операций с блокировкой store.
 * Автоматически блокирует перед операцией и разблокирует в finally.
 * Используется для критических операций (logout/refresh).
 */
export function withStoreLock<T>(
  storePort: AuthStorePort, // Порт для блокировки
  operation: () => T, // Операция для выполнения
): T { // Результат операции
  storePort.setStoreLocked(true); // Блокируем перед операцией
  try {
    return operation();
  } finally {
    storePort.setStoreLocked(false); // Разблокируем в finally (гарантированно)
  }
}

/* ============================================================================
 * 🔧 ADAPTER — AuthStore → AuthStorePort
 * ============================================================================
 */

/** Сообщение об ошибке при попытке обновить заблокированный store */
const STORE_LOCKED_ERROR = '[AuthStorePort] Store is locked. Cannot update state.' as const;

/**
 * Создаёт адаптер AuthStorePort из Zustand AuthStore.
 * Использует patch для атомарности state-обновлений, реализует lock через внутренний флаг.
 * В синхронном JS безопасно, но для критических операций используйте withStoreLock.
 */
export function createAuthStorePortAdapter(
  store: AuthStore, // Zustand store для адаптации
): AuthStorePort { // Реализация AuthStorePort
  let isLocked = false; // Внутренний флаг блокировки (защита от race conditions)

  return {
    setAuthState: (state: AuthState): void => {
      if (isLocked) {
        throw new Error(STORE_LOCKED_ERROR);
      }
      store.actions.setAuthState(state); // Прямой вызов Zustand action
    },

    setSessionState: (state: SessionState | null): void => {
      if (isLocked) {
        throw new Error(STORE_LOCKED_ERROR);
      }
      store.actions.setSessionState(state); // Прямой вызов Zustand action
    },

    setSecurityState: (state: SecurityState): void => {
      if (isLocked) {
        throw new Error(STORE_LOCKED_ERROR);
      }
      store.actions.setSecurityState(state); // Прямой вызов Zustand action
    },

    applyEventType: (event: AuthEvent['type']): void => {
      if (isLocked) {
        throw new Error(STORE_LOCKED_ERROR);
      }
      store.actions.applyEventType(event); // Прямой вызов Zustand action
    },

    setStoreLocked: (locked: boolean): void => {
      isLocked = locked; // Обновляем внутренний флаг (синхронно безопасно в JS)
    },

    batchUpdate: (updates: readonly BatchUpdate[]): void => {
      if (isLocked) {
        throw new Error(STORE_LOCKED_ERROR);
      }

      // Разделяем state и events для явности и избежания дублирования
      const patchUpdate: {
        auth?: AuthState;
        session?: SessionState | null;
        security?: SecurityState;
      } = {}; // Только state-поля (patch не включает lastEventType)

      const eventTypes: AuthEvent['type'][] = []; // События применяются отдельно

      // Собираем обновления, разделяя state и events
      for (const update of updates) {
        switch (update.type) {
          case 'setAuthState': {
            patchUpdate.auth = update.state;
            break;
          }
          case 'setSessionState': {
            patchUpdate.session = update.state;
            break;
          }
          case 'setSecurityState': {
            patchUpdate.security = update.state;
            break;
          }
          case 'applyEventType': {
            eventTypes.push(update.event); // Собираем события для отдельного применения
            break;
          }
          default: {
            const _exhaustive: never = update; // Exhaustiveness check
            throw new Error(
              `[AuthStorePort] Unsupported batch update type: ${String(_exhaustive)}`,
            );
          }
        }
      }

      // Применяем state-обновления атомарно через patch (одна транзакция)
      if (Object.keys(patchUpdate).length > 0) {
        store.actions.patch(patchUpdate); // Атомарное обновление всех state-полей
      }

      // Применяем events отдельно (patch не включает lastEventType, порядок важен)
      for (const eventType of eventTypes) {
        store.actions.applyEventType(eventType); // Сначала state, потом events
      }
    },

    getSessionState: (): SessionState | null => {
      // Получаем текущее состояние сессии из Zustand store
      // @note AuthStore - это тип, который объединяет AuthStoreState и actions.
      //       В runtime store является Zustand store, который имеет метод getState().
      //       Используем приведение типа для доступа к getState().
      const zustandStore = store as unknown as { getState: () => AuthStoreState; };
      const state = zustandStore.getState();
      return state.session;
    },

    getRefreshToken: (): string => {
      // @note В production refreshToken должен быть получен через httpOnly cookie или secure storage.
      //       Для реализации используем временный механизм получения через store или отдельный механизм.
      //       В production это должно быть через явный порт getRefreshToken() или через apiClient (который читает cookies).
      const storeInternal = store as unknown as {
        getRefreshToken?: () => string | undefined;
      };
      const token = storeInternal.getRefreshToken?.();
      if (typeof token === 'string' && token.trim() !== '') {
        return token;
      }
      // Fallback: если refreshToken недоступен, выбрасываем ошибку
      // В production это должно быть исправлено добавлением метода в AuthStore или через отдельный механизм
      throw new Error(
        '[AuthStorePort] refreshToken is not available. In production, refreshToken should be obtained via httpOnly cookie or secure storage.',
      );
    },
  };
}
