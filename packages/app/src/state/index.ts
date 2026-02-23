/**
 * @file packages/app/src/state — Application State
 *
 * Публичный API пакета state.
 * Экспортирует все публичные типы, утилиты и селекторы для управления состоянием приложения.
 */

/* ============================================================================
 * 🗄️ STORE — ГЛАВНОЕ ХРАНИЛИЩЕ
 * ========================================================================== */

/**
 * Store: главное хранилище состояния приложения на базе Zustand.
 *
 * @public
 */
export {
  useAppStore,
  getCurrentTime,
  getInitialOnlineStatus,
  createInitialState,
  registerNetworkStatusListener,
  storePartialize,
  storeMerge,
  appStoreSelectors,
  appStoreDerivedSelectors,
  type ThemeMode,
  type UserStatus,
  type AppUser,
  type AuthState,
  type AppStoreState,
  type AppStoreActions,
  type AppStore,
} from './store.js';

/* ============================================================================
 * 🛠️ STORE UTILS — УТИЛИТЫ ХРАНИЛИЩА
 * ========================================================================== */

/**
 * Store Utils: утилиты для безопасной работы с хранилищем.
 *
 * @public
 */
export {
  safeSet,
  isStoreLocked,
  setStoreLocked,
  type SafeSetOptions,
} from './store-utils.js';

/* ============================================================================
 * 🔄 RESET — СБРОС СОСТОЯНИЯ
 * ========================================================================== */

/**
 * Reset: утилиты для сброса состояния приложения.
 *
 * @public
 */
export {
  registerAppStateReset,
  __resetAppStateResetRegistration,
  type AppResetReason,
  type AppResetPolicy,
} from './reset.js';

/* ============================================================================
 * 🔄 QUERY CLIENT — QUERY CLIENT
 * ========================================================================== */

/**
 * Query Client: конфигурация React Query клиента.
 *
 * @public
 */
export {
  createQueryClient,
  queryClient,
  extractHttpStatus,
  logQueryError,
  shouldRetryRequest,
  toSafeJson,
  type AppQueryClientOptions,
} from './query/query-client.js';
