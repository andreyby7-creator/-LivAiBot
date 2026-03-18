/**
 * @file packages/app/src/state — Application State
 * Публичный API пакета state.
 * Экспортирует все публичные типы, утилиты и селекторы для управления состоянием приложения.
 */

/* ============================================================================
 * 🗄️ STORE — ГЛАВНОЕ ХРАНИЛИЩЕ
 * ========================================================================== */

/**
 * Store: главное хранилище состояния приложения на базе Zustand.
 * @public
 */
export {
  type AppStore,
  type AppStoreActions,
  appStoreDerivedSelectors,
  appStoreSelectors,
  type AppStoreState,
  type AppUser,
  createInitialState,
  getAppStoreActions,
  getAppStoreState,
  getCurrentTime,
  getInitialOnlineStatus,
  type PersistedAppState,
  registerNetworkStatusListener,
  setAppStoreState,
  storeMerge,
  storePartialize,
  type ThemeMode,
  useAppStore,
  type UserStatus,
} from './store.js';

/* ============================================================================
 * 🛠️ STORE UTILS — УТИЛИТЫ ХРАНИЛИЩА
 * ========================================================================== */

/**
 * Store Utils: утилиты для безопасной работы с хранилищем.
 * @public
 */
export { isStoreLocked, safeSet, type SafeSetOptions, setStoreLocked } from './store-utils.js';

/* ============================================================================
 * 🔄 RESET — СБРОС СОСТОЯНИЯ
 * ========================================================================== */

/**
 * Reset: утилиты для сброса состояния приложения.
 * @public
 */
export {
  __resetAppStateResetRegistration,
  type AppResetPolicy,
  type AppResetReason,
  registerAppStateReset,
} from './reset.js';

/* ============================================================================
 * 🔄 QUERY CLIENT — QUERY CLIENT
 * ========================================================================== */

/**
 * Query Client: конфигурация React Query клиента.
 * @public
 */
export {
  type AppQueryClientOptions,
  createQueryClient,
  extractHttpStatus,
  logQueryError,
  queryClient,
  shouldRetryRequest,
  toSafeJson,
} from './query/query-client.js';
