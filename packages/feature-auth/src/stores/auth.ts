/**
 * @file packages/feature-auth/src/stores/auth.ts
 * ============================================================================
 * 🧠 FEATURE-AUTH STORE — ЧИСТОЕ СОСТОЯНИЕ АУТЕНТИФИКАЦИИ (ZUSTAND)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единственный источник правды для состояния аутентификации в feature-auth
 * - Чистое состояние без side-effects (effects вынесены в effects/)
 * - Микросервисно-нейтральный, vendor-agnostic
 * - SSR-safe, устойчивый к масштабированию
 *
 * Принцип: store = state + sync transitions, без domain orchestration/effects
 *
 * Гарантии:
 * - ❌ Нет async / side-effects
 * - ❌ Нет бизнес-логики
 * - ✅ Чёткие контракты типов
 * - ✅ Инфраструктура вынесена за пределы store
 * - ✅ Полная иммутабельность через readonly типы
 * - ✅ Versioning для миграций
 * - ✅ Persistence с безопасным merge
 *
 * Использование:
 * - Effects (login.ts, logout.ts, refresh.ts) обновляют store через actions
 * - Hooks (useAuth.ts) инкапсулируют store + effects для React
 * - UI компоненты используют hooks, не store напрямую
 * - Store создаётся через factory (createAuthStore) для тестирования и SSR
 *
 * @warning Store = чистое состояние + синхронные transitions. НЕ добавляйте side-effects,
 * бизнес-логику, async операции или доменные модели. См. @contract в конце файла.
 */

import type { ReadonlyDeep } from 'type-fest';
import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import type { PersistOptions } from 'zustand/middleware';

import type {
  AuthEvent,
  AuthState,
  MfaState,
  OAuthState,
  PasswordRecoveryState,
  SecurityState,
  SessionState,
  VerificationState,
} from '../types/auth.js';

/* ============================================================================
 * 🧩 ТИПЫ СОСТОЯНИЯ
 * ============================================================================
 */

/** Версия store для миграций persistence */
export const authStoreVersion = 1 as const;

/**
 * Генерирует имя store для persistence с поддержкой подсистем.
 * @param subsystem - опциональное имя подсистемы (например, 'oauth', 'sso', 'main')
 * @returns имя store для localStorage
 */
function getStoreName(subsystem: string = 'main'): string {
  return `@livai/feature-auth/store:${subsystem}`;
}

/** Имя store для основной auth подсистемы */
const STORE_NAME = getStoreName('main');

/** Чистое состояние auth store (без методов). Все поля readonly для гарантии иммутабельности. */
export type AuthStoreState = Readonly<{
  /** Версия store для миграций */
  readonly version: number;

  /** Основное состояние аутентификации */
  readonly auth: AuthState;

  /** Состояние MFA (Multi-Factor Authentication) */
  readonly mfa: MfaState;

  /** Состояние OAuth аутентификации */
  readonly oauth: OAuthState;

  /** Состояние безопасности (risk assessment, blocking) */
  readonly security: SecurityState;

  /** Состояние сессии (active/expired/revoked) */
  readonly session: SessionState | null;

  /** Состояние восстановления пароля */
  readonly passwordRecovery: PasswordRecoveryState;

  /** Состояние верификации (email/phone) */
  readonly verification: VerificationState;

  /** Легкий runtime-маркер последнего события (без полного journal) */
  readonly lastEventType?: AuthEvent['type'];
}>;

/**
 * Тип для полей, которые можно обновлять через patch.
 * Автоматически исключает runtime-only поля (version, lastEventType).
 */
export type PatchableAuthStoreState = Omit<AuthStoreState, 'version' | 'lastEventType'>;

/* ============================================================================
 * 🎛️ ACTIONS
 * ============================================================================
 */

/**
 * Синхронные действия над состоянием. Не содержат side-effects.
 * Все actions принимают полные объекты состояния для discriminated unions.
 */
export type AuthStoreActions = Readonly<{
  /** Устанавливает основное состояние аутентификации (полное состояние AuthState, discriminated union, readonly). */
  readonly setAuthState: (authState: Readonly<AuthState>) => void;

  /** Устанавливает состояние MFA (полное состояние MfaState, discriminated union, readonly). */
  readonly setMfaState: (mfaState: Readonly<MfaState>) => void;

  /** Устанавливает состояние OAuth (полное состояние OAuthState, discriminated union, readonly). */
  readonly setOAuthState: (oauthState: Readonly<OAuthState>) => void;

  /** Устанавливает состояние безопасности (полное состояние SecurityState, discriminated union, readonly). */
  readonly setSecurityState: (securityState: Readonly<SecurityState>) => void;

  /** Устанавливает состояние сессии (SessionState или null, readonly). */
  readonly setSessionState: (sessionState: Readonly<SessionState | null>) => void;

  /** Устанавливает состояние восстановления пароля (полное состояние PasswordRecoveryState, discriminated union, readonly). */
  readonly setPasswordRecoveryState: (
    passwordRecoveryState: Readonly<PasswordRecoveryState>,
  ) => void;

  /** Устанавливает состояние верификации (полное состояние VerificationState, discriminated union, readonly). */
  readonly setVerificationState: (verificationState: Readonly<VerificationState>) => void;

  /**
   * Минимальный event-entrypoint (без replay/journal внутри store).
   * Устанавливает тип последнего события для легкого отслеживания.
   * @param eventType - тип события AuthEvent (readonly)
   */
  readonly applyEventType: (eventType: Readonly<AuthEvent['type']>) => void;

  /**
   * Атомарное обновление нескольких полей состояния.
   * @param next - частичное обновление состояния (readonly для гарантии иммутабельности)
   * @warning Discriminated unions (auth, mfa, oauth, security, session, passwordRecovery, verification) должны обновляться полностью, не частично. TypeScript требует все обязательные поля для выбранного status. Для обновления unions используйте set* методы (setAuthState, setMfaState и т.д.).
   */
  readonly patch: (next: ReadonlyDeep<Partial<PatchableAuthStoreState>>) => void;

  /** Сбрасывает состояние к начальным значениям. Используется при logout и очистке состояния. */
  readonly reset: () => void;
}>;

/* ============================================================================
 * 🧱 ПОЛНЫЙ КОНТРАКТ STORE
 * ============================================================================
 */

/** Полный контракт auth store. Сочетает состояние и actions в единый интерфейс. */
export type AuthStore = AuthStoreState & {
  readonly actions: AuthStoreActions;
};

/* ============================================================================
 * 🏗️ НАЧАЛЬНОЕ СОСТОЯНИЕ
 * ============================================================================
 */

/** Создаёт начальное состояние auth store. Все состояния в "idle" или "unauthenticated" статусе. */
export function createInitialAuthStoreState(): AuthStoreState {
  return {
    version: authStoreVersion,
    auth: { status: 'unauthenticated' },
    mfa: { status: 'not_setup' },
    oauth: { status: 'idle' },
    security: { status: 'secure' },
    session: null,
    passwordRecovery: { status: 'idle' },
    verification: { status: 'idle' },
  };
}

/* ============================================================================
 * ✅ INVARIANT GATE (lean)
 * ============================================================================
 */

/** Правило 1: Session должен быть null, если auth не authenticated */
export function fixSession(state: ReadonlyDeep<AuthStoreState>): ReadonlyDeep<SessionState | null> {
  return state.auth.status !== 'authenticated' && state.session !== null
    ? null
    : state.session;
}

/** Правило 2: Authenticated состояние должно иметь active session */
export function fixAuthForSession(
  state: ReadonlyDeep<AuthStoreState>,
  session: ReadonlyDeep<SessionState | null>,
): ReadonlyDeep<AuthState> | undefined {
  return state.auth.status === 'authenticated' && session?.status !== 'active'
    ? ((): ReadonlyDeep<AuthState> => {
      // Явное сужение типа: при status === 'authenticated' user гарантированно существует
      const userId = state.auth.user.id;
      return {
        status: 'session_expired' as const,
        ...(userId ? { userId } : {}),
        error: {
          kind: 'session_expired' as const,
          message: 'Сессия отсутствует или истекла.',
        },
      } as ReadonlyDeep<AuthState>;
    })()
    : undefined;
}

/**
 * Правило 3: MFA transient состояния сбрасываются при authenticated/error, постоянные состояния сохраняются.
 * @architecture MFA имеет два типа состояний:
 * - Transient (challenged, verified, failed) — только во время аутентификации
 * - Persistent (setup_complete, setup_in_progress, recovery_required, recovery_in_progress) — сохраняются после authenticated
 * @decision Архитектурное решение: MFA — это только transient state для процесса аутентификации.
 * После успешной аутентификации (authenticated) или ошибки (error, например, при security.blocked)
 * transient состояния (verified, challenged, failed) сбрасываются, так как заблокированный/ошибочный аккаунт
 * не должен быть в MFA flow.
 * Если MFA был настроен, это должно управляться бизнес-логикой в effects (например, через отдельное поле в user profile),
 * а не через mfa.status === 'setup_complete' в store, так как store содержит только состояние процесса аутентификации.
 * @note Если в будущем потребуется сохранять setup_complete после authenticated, это потребует изменения архитектуры.
 */
export function fixMfa(state: ReadonlyDeep<AuthStoreState>): ReadonlyDeep<MfaState> | undefined {
  // Transient состояния MFA (только во время аутентификации)
  const isMfaTransient = state.mfa.status === 'challenged'
    || state.mfa.status === 'verified'
    || state.mfa.status === 'failed';
  // Сбрасываем transient состояния при authenticated (они больше не нужны после успешной аутентификации)
  // Также сбрасываем при error (например, после security.blocked), так как заблокированный аккаунт не должен быть в MFA flow
  const shouldResetTransient =
    (state.auth.status === 'authenticated' || state.auth.status === 'error') && isMfaTransient;
  // При unauthenticated сбрасываем все состояния MFA в not_setup
  const shouldBeNotSetup = state.auth.status === 'unauthenticated'
    && state.mfa.status !== 'not_setup';

  return shouldResetTransient || shouldBeNotSetup
    ? { status: 'not_setup' as const }
    : undefined;
}

/** Правило 4: OAuth должен быть idle при authenticated/unauthenticated, не активен вне OAuth flow */
export function fixOAuth(
  state: ReadonlyDeep<AuthStoreState>,
): ReadonlyDeep<OAuthState> | undefined {
  const isOAuthActive = state.oauth.status === 'initiating'
    || state.oauth.status === 'redirecting'
    || state.oauth.status === 'processing';
  const isOAuthFlow = state.auth.status === 'authenticating' && state.auth.operation === 'oauth';
  const shouldBeIdle =
    (state.auth.status === 'authenticated' || state.auth.status === 'unauthenticated')
    && isOAuthActive
    && !isOAuthFlow;

  return shouldBeIdle
    ? { status: 'idle' as const }
    : undefined;
}

/** Правило 5: Security blocked должен сбрасывать auth и session */
export function fixSecurity(
  state: ReadonlyDeep<AuthStoreState>,
): ReadonlyDeep<{ auth: AuthState; session: SessionState | null; }> | undefined {
  return state.security.status === 'blocked' && state.auth.status !== 'unauthenticated'
    ? {
      auth: {
        status: 'error' as const,
        error: {
          kind: 'account_locked' as const,
          message: state.security.reason || 'Аккаунт заблокирован.',
        },
      },
      session: null,
    }
    : undefined;
}

/** Правило 6: PasswordRecovery должен быть idle при authenticated */
export function fixPasswordRecovery(
  state: ReadonlyDeep<AuthStoreState>,
): ReadonlyDeep<PasswordRecoveryState> | undefined {
  return state.auth.status === 'authenticated' && state.passwordRecovery.status !== 'idle'
    ? { status: 'idle' as const }
    : undefined;
}

/** Правило 7: Verification должен быть idle при authenticated/unauthenticated */
export function fixVerification(
  state: ReadonlyDeep<AuthStoreState>,
): ReadonlyDeep<VerificationState> | undefined {
  const isVerificationActive = state.verification.status !== 'idle';
  const shouldBeIdle =
    (state.auth.status === 'authenticated' || state.auth.status === 'unauthenticated')
    && isVerificationActive;

  return shouldBeIdle
    ? { status: 'idle' as const }
    : undefined;
}

/**
 * Применяет фиксы security, session и auth каскадно (шаги 1-3).
 * @priority Приоритет фиксов (от высшего к низшему):
 * 1. fixSecurity (security.blocked) — максимальный приоритет, перекрывает все остальные
 * 2. fixSession — зависит от auth, но не перекрывает security
 * 3. fixAuthForSession — зависит от session, но не перекрывает security
 * @note Если security.blocked === true, то auth всегда становится 'error', и fixAuthForSession не сработает
 * (проверяет auth.status === 'authenticated', а после fixSecurity это уже 'error').
 */
function applyCoreFixes(state: ReadonlyDeep<AuthStoreState>): ReadonlyDeep<AuthStoreState> {
  // Шаг 1: Security имеет максимальный приоритет (блокировка аккаунта критичнее сессии)
  const fixedSecurity = fixSecurity(state);
  const stateAfterSecurity = fixedSecurity !== undefined
    ? { ...state, auth: fixedSecurity.auth, session: fixedSecurity.session }
    : state;

  // Шаг 2: Session фикс (применяется к состоянию после security)
  const fixedSession = fixSession(stateAfterSecurity);
  const stateAfterSession = fixedSession !== stateAfterSecurity.session
    ? { ...stateAfterSecurity, session: fixedSession }
    : stateAfterSecurity;

  // Шаг 3: Auth фикс для session (применяется к состоянию после session)
  // Если security.blocked, то auth уже 'error', и этот фикс не сработает (проверяет 'authenticated')
  const fixedAuth = fixAuthForSession(stateAfterSession, fixedSession);
  return fixedAuth !== undefined
    ? { ...stateAfterSession, auth: fixedAuth }
    : stateAfterSession;
}

/** Применяет фиксы подсистем, зависящих от auth (шаг 4). */
function applyDependentFixes(state: ReadonlyDeep<AuthStoreState>): ReadonlyDeep<AuthStoreState> {
  const fixedMfa = fixMfa(state);
  const fixedOAuth = fixOAuth(state);
  const fixedPasswordRecovery = fixPasswordRecovery(state);
  const fixedVerification = fixVerification(state);

  const hasChanges = fixedMfa !== undefined
    || fixedOAuth !== undefined
    || fixedPasswordRecovery !== undefined
    || fixedVerification !== undefined;

  return hasChanges
    ? ({
      ...state,
      ...(fixedMfa !== undefined ? { mfa: fixedMfa } : {}),
      ...(fixedOAuth !== undefined ? { oauth: fixedOAuth } : {}),
      ...(fixedPasswordRecovery !== undefined ? { passwordRecovery: fixedPasswordRecovery } : {}),
      ...(fixedVerification !== undefined ? { verification: fixedVerification } : {}),
    } as ReadonlyDeep<AuthStoreState>)
    : state;
}

/**
 * Расширенный invariant gate с каскадным применением фиксов.
 * Проверяет все критичные правила для всех подсистем без "лечения" бизнес-логики.
 * Фиксы применяются каскадно: каждый следующий использует уже исправленное состояние.
 *
 * @priority Порядок применения (от высшего к низшему):
 * 1. Security (fixSecurity) — максимальный приоритет, перекрывает все остальные
 * 2. Session (fixSession) — зависит от auth, но не перекрывает security
 * 3. Auth для session (fixAuthForSession) — зависит от session, но не перекрывает security
 * 4. Зависимые подсистемы (fixMfa, fixOAuth, fixPasswordRecovery, fixVerification) — зависят от auth
 *
 * @note Если security.blocked === true, то auth всегда становится 'error', и остальные фиксы,
 * которые проверяют auth.status === 'authenticated', не сработают.
 *
 * @param state - текущее состояние
 * @returns исправленное состояние или исходное, если инварианты соблюдены
 */
export function enforceInvariants(
  state: ReadonlyDeep<AuthStoreState>,
): ReadonlyDeep<AuthStoreState> {
  const stateAfterCore = applyCoreFixes(state);
  const stateAfterDependent = applyDependentFixes(stateAfterCore);

  return stateAfterDependent !== state
    ? stateAfterDependent
    : state;
}

/* ============================================================================
 * 🏪 STORE FACTORY
 * ============================================================================
 */

/** Тип для persisted state (без runtime полей) */
type PersistedAuthStoreState = Readonly<
  Pick<
    AuthStoreState,
    | 'version'
    | 'auth'
    | 'mfa'
    | 'oauth'
    | 'security'
    | 'session'
    | 'passwordRecovery'
    | 'verification'
  >
>;

/**
 * Создаёт Zustand store для состояния аутентификации.
 *
 * Factory pattern позволяет:
 * - Создавать несколько инстансов для тестирования
 * - Изолировать состояние для SSR
 * - Настраивать persistence опционально
 *
 * ВАЖНО:
 * - set(...) используется только в merge-режиме (Zustand автоматически создаёт новые объекты)
 * - Все обновления через actions для гарантии иммутабельности
 * - Discriminated unions обновляются полной заменой (нельзя частично обновить union)
 * - Effects (login.ts, logout.ts, refresh.ts) используют actions для обновления
 *
 * @returns UseBoundStore для использования в React hooks
 */
export function createAuthStore(): UseBoundStore<StoreApi<AuthStore>> {
  return create<AuthStore>()(
    persist(
      subscribeWithSelector((set) => ({
        ...createInitialAuthStoreState(),

        actions: {
          // Zustand set() возвращает значение, которое не используется - это известная особенность API Zustand
          setAuthState: (next: ReadonlyDeep<AuthState>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, auth: next }));
          },

          setMfaState: (next: Readonly<MfaState>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, mfa: next }));
          },

          setOAuthState: (next: Readonly<OAuthState>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, oauth: next }));
          },

          setSecurityState: (next: Readonly<SecurityState>): void => {
            set((state: ReadonlyDeep<AuthStore>) =>
              enforceInvariants({ ...state, security: next })
            );
          },

          setSessionState: (next: ReadonlyDeep<SessionState | null>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, session: next }));
          },

          setPasswordRecoveryState: (next: Readonly<PasswordRecoveryState>): void => {
            set((state: ReadonlyDeep<AuthStore>) =>
              enforceInvariants({ ...state, passwordRecovery: next })
            );
          },

          setVerificationState: (next: Readonly<VerificationState>): void => {
            set((state: ReadonlyDeep<AuthStore>) =>
              enforceInvariants({ ...state, verification: next })
            );
          },

          applyEventType: (eventType: Readonly<AuthEvent['type']>): void => {
            set({ lastEventType: eventType });
          },

          patch: (next: ReadonlyDeep<Partial<PatchableAuthStoreState>>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, ...next }));
            return undefined;
          },

          reset: (): void => {
            set(createInitialAuthStoreState());
            return undefined;
          },
        },
      })),
      {
        name: STORE_NAME,
        version: authStoreVersion,
        // SSR-safe: используем localStorage только на клиенте (typeof window !== 'undefined')
        // На сервере создаем noop storage для безопасной работы persist middleware
        storage: createJSONStorage(() =>
          typeof window !== 'undefined'
            ? localStorage
            : {
              getItem: (): string | null => null,
              setItem: (): void => {},
              removeItem: (): void => {},
            }
        ),
        partialize: (state: Readonly<AuthStoreState>): PersistedAuthStoreState => ({
          // ✅ Персистентные поля (сохраняются в localStorage)
          version: state.version,
          auth: state.auth,
          mfa: state.mfa,
          oauth: state.oauth,
          security: state.security,
          session: state.session,
          passwordRecovery: state.passwordRecovery,
          verification: state.verification,
          // ❌ Runtime-only поля НЕ сохраняются:
          // - lastEventType (легкий маркер, не нужен после перезагрузки)
          // - любые будущие debug flags, временные состояния и т.д.
        }),
        merge: (persisted: unknown, current: Readonly<AuthStore>): Readonly<AuthStore> => {
          const isValidPersisted =
            persisted !== null && persisted !== undefined && typeof persisted === 'object'
              ? (persisted as PersistedAuthStoreState)
              : null;

          // Миграция: если версия изменилась, сбрасываем состояние
          const mergedState = isValidPersisted === null
            ? current
            : isValidPersisted.version !== authStoreVersion
            ? createInitialAuthStoreState()
            : {
              ...current,
              ...isValidPersisted,
              // lastEventType всегда runtime-only (не включаем в merge)
            };

          // Применяем enforceInvariants для защиты от неконсистентного состояния (поврежденный localStorage, старая версия)
          const fixedState = enforceInvariants(mergedState);

          return {
            ...fixedState,
            actions: current.actions,
          };
        },
      } satisfies PersistOptions<AuthStore, PersistedAuthStoreState>,
    ),
  );
}

/* ============================================================================
 * 🎯 СЕЛЕКТОРЫ (чистые функции)
 * ============================================================================
 */

/**
 * Базовые селекторы состояния.
 * Чистые функции для типобезопасного доступа к полям state.
 * Экспортируются отдельно для избежания ошибок @livai/rag/context-leakage.
 */

/** Получить состояние аутентификации */
export function getAuth(store: Readonly<AuthStoreState>): Readonly<AuthState> {
  return store.auth;
}

/** Получить состояние MFA */
export function getMfa(store: Readonly<AuthStoreState>): Readonly<MfaState> {
  return store.mfa;
}

/** Получить состояние OAuth */
export function getOAuth(store: Readonly<AuthStoreState>): Readonly<OAuthState> {
  return store.oauth;
}

/** Получить состояние безопасности */
export function getSecurity(store: Readonly<AuthStoreState>): Readonly<SecurityState> {
  return store.security;
}

/** Получить состояние сессии */
export function getSession(store: Readonly<AuthStoreState>): Readonly<SessionState | null> {
  return store.session;
}

/** Получить состояние восстановления пароля */
export function getPasswordRecovery(
  store: Readonly<AuthStoreState>,
): Readonly<PasswordRecoveryState> {
  return store.passwordRecovery;
}

/** Получить состояние верификации */
export function getVerification(store: Readonly<AuthStoreState>): Readonly<VerificationState> {
  return store.verification;
}

/** Получить actions */
export function getAuthStoreActions(store: Readonly<AuthStore>): Readonly<AuthStoreActions> {
  return store.actions;
}

/**
 * Производные селекторы (derived state).
 * Чистые функции для вычисляемых значений на основе базового состояния.
 * Экспортируются отдельно для избежания ошибок @livai/rag/context-leakage.
 */

/** Пользователь аутентифицирован. */
export function isAuthenticated(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'authenticated';
}

/** Процесс аутентификации в процессе. */
export function isAuthenticating(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'authenticating';
}

/** Есть ошибка аутентификации. */
export function hasAuthError(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'error';
}

/** Требуется вторичная верификация (MFA/email/phone). */
export function needsVerification(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'pending_secondary_verification';
}

/** Сессия истекла, требуется refresh. */
export function isSessionExpired(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'session_expired';
}

/** Можно обновить токен (authenticated или session_expired). */
export function canRefresh(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'authenticated' || store.auth.status === 'session_expired';
}

/** Требуется MFA. */
export function needsMfa(store: Readonly<AuthStoreState>): boolean {
  return (
    store.mfa.status === 'challenged'
    || store.mfa.status === 'recovery_required'
    || store.auth.status === 'pending_secondary_verification'
  );
}

/** Высокий уровень риска безопасности. */
export function isHighRisk(store: Readonly<AuthStoreState>): boolean {
  return (
    store.security.status === 'blocked'
    || (store.security.status === 'risk_detected'
      && (store.security.riskLevel === 'high' || store.security.riskLevel === 'critical'))
  );
}

/** Сессия активна и валидна. */
export function isSessionValid(store: Readonly<AuthStoreState>): boolean {
  return store.session?.status === 'active' && store.auth.status === 'authenticated';
}

/** Пользователь имеет требуемое разрешение. */
export function hasPermission(store: Readonly<AuthStoreState>, permission: string): boolean {
  return (
    store.auth.status === 'authenticated'
    && Array.isArray(store.auth.permissions)
    && store.auth.permissions.includes(permission)
  );
}

/* ============================================================================
 * 📦 GROUPED API
 * ============================================================================
 */

/** Тип для grouped API селекторов. */
type AuthSelectorsGroup = {
  readonly auth: typeof getAuth;
  readonly mfa: typeof getMfa;
  readonly oauth: typeof getOAuth;
  readonly security: typeof getSecurity;
  readonly session: typeof getSession;
  readonly passwordRecovery: typeof getPasswordRecovery;
  readonly verification: typeof getVerification;
  readonly actions: typeof getAuthStoreActions;
  readonly isAuthenticated: typeof isAuthenticated;
  readonly isAuthenticating: typeof isAuthenticating;
  readonly hasAuthError: typeof hasAuthError;
  readonly needsVerification: typeof needsVerification;
  readonly isSessionExpired: typeof isSessionExpired;
  readonly canRefresh: typeof canRefresh;
  readonly needsMfa: typeof needsMfa;
  readonly isHighRisk: typeof isHighRisk;
  readonly isSessionValid: typeof isSessionValid;
  readonly hasPermission: typeof hasPermission;
};

/**
 * Grouped API через функцию-фабрику (runtime object, FP-совместимо).
 * Создаёт объект с группировкой селекторов при вызове, не хранит глобальный контекст.
 * Используется для удобства в UI, когда нужен grouped API.
 */
export function createAuthSelectors(): AuthSelectorsGroup {
  return {
    auth: getAuth,
    mfa: getMfa,
    oauth: getOAuth,
    security: getSecurity,
    session: getSession,
    passwordRecovery: getPasswordRecovery,
    verification: getVerification,
    actions: getAuthStoreActions,

    isAuthenticated,
    isAuthenticating,
    hasAuthError,
    needsVerification,
    isSessionExpired,
    canRefresh,
    needsMfa,
    isHighRisk,
    isSessionValid,
    hasPermission,
  } satisfies AuthSelectorsGroup;
}

/* ============================================================================
 * 🏛️ ARCHITECTURAL CONTRACT — НЕОБХОДИМЫЕ ИНВАРИАНТЫ
 * ============================================================================
 *
 * @contract
 *
 * ЧТО МОЖНО КЛАСТЬ В STORE:
 * - Состояние аутентификации (AuthState, MfaState, OAuthState, etc.)
 * - UI-состояние связанное с auth (но не бизнес-данные)
 * - Синхронные, детерминированные данные
 *
 * RUNTIME-ONLY ПОЛЯ (не сохраняются в persistence):
 * - lastEventType — легкий маркер последнего события для отладки/логирования
 * - любые будущие debug flags, временные состояния, UI-метаданные
 * Эти поля существуют только в памяти и сбрасываются при перезагрузке страницы.
 *
 * ЧТО НЕЛЬЗЯ КЛАСТЬ В STORE:
 * - Бизнес-логика и правила валидации
 * - API-ключи и sensitive данные напрямую (только через типизированные DTO)
 * - Async операции и side-effects (в effects/)
 * - Компьютед свойства (кроме селекторов)
 * - Доменные модели напрямую (только через типизированные состояния)
 * - Event journal (для этого отдельный слой, если нужен)
 *
 * ОБНОВЛЕНИЕ СОСТОЯНИЯ:
 * - Всегда через actions (setAuthState, setMfaState, etc.)
 * - Discriminated unions обновляются полной заменой (нельзя частично обновить)
 * - Zustand автоматически создаёт новые объекты при set({ ... })
 * - Readonly типы гарантируют иммутабельность на уровне TypeScript
 * - Invariant gate автоматически исправляет критичные нарушения
 *
 * PERSISTENCE:
 * - Сохраняются только персистентные поля (без runtime-маркеров)
 * - Миграции через version и merge функцию
 * - Actions никогда не сохраняются (runtime-only)
 */
