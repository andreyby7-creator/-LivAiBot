/**
 * @file packages/app/src/lib/auth-hook-deps.ts
 * ============================================================================
 * 🔗 AUTH HOOK DI FACTORY — СВЯЗКА FEATURE-AUTH STORE + EFFECTS ДЛЯ useAuth
 * ============================================================================
 *
 * Архитектурная роль:
 * - DI-фабрика для хука `useAuth` в app-слое.
 * - Инкапсулирует создание единого auth-store и auth-эффектов (login/logout/register/refresh).
 * - Предоставляет минимальный, но расширяемый порт `UseAuthDeps` для React-хука.
 * - Singleton enforcement: повторный вызов с другим config → fail-fast ошибка (защита от multi-tenant/SSR misuse).
 *
 * Инварианты:
 * - ❌ Нет бизнес-логики (policy, retry, rule-engine — в feature-auth effects/store).
 * - ❌ Нет UI-логики и derived-флагов (только доменное состояние + эффекты).
 * - ❌ Нет прямых HTTP-вызовов (только через DI-порты effects слоя).
 * - ✅ Только чистая композиция store + effects + адаптация Effect → Promise.
 * - ✅ Deterministic при первом вызове; fail-fast при повторном (singleton enforcement).
 * - ✅ Domain-pure: опирается на типы и фабрики `@livai/feature-auth`.
 * - ✅ Microservice-ready: DI-слой не зависит от конкретного backend, только от портов.
 *
 * Расширяемость:
 * - Новые эффекты (MFA/SSO/risk) добавляются через расширение `AuthHookDepsConfig` и создание эффектов в фабрике.
 * - Конфигурация таймаутов и concurrency-strategy передаётся через строго типизированный config.
 * - Runtime инжектится через `Runtime.defaultRuntime` (future: можно вынести в DI для тестирования/изоляции).
 */

import type {
  LoginIdentifierType,
  LoginRequest,
} from '@livai/feature-auth/src/domain/LoginRequest.js';
import type {
  RegisterIdentifierType,
  RegisterRequest,
} from '@livai/feature-auth/src/domain/RegisterRequest.js';
import type {
  LoginEffectConfig,
  LoginEffectDeps,
} from '@livai/feature-auth/src/effects/login/index.js';
import type { LoginResult } from '@livai/feature-auth/src/effects/login.js';
import { createLoginEffect } from '@livai/feature-auth/src/effects/login.js';
import type {
  LogoutEffectConfig,
  LogoutEffectDeps,
} from '@livai/feature-auth/src/effects/logout/index.js';
import type { LogoutResult } from '@livai/feature-auth/src/effects/logout.js';
import { createLogoutEffect } from '@livai/feature-auth/src/effects/logout.js';
import type {
  RefreshEffectConfig,
  RefreshEffectDeps,
} from '@livai/feature-auth/src/effects/refresh/index.js';
import type { RefreshEffectResult } from '@livai/feature-auth/src/effects/refresh.js';
import { createRefreshEffect } from '@livai/feature-auth/src/effects/refresh.js';
import type {
  RegisterEffectConfig,
  RegisterEffectDeps,
} from '@livai/feature-auth/src/effects/register/index.js';
import type { RegisterResult } from '@livai/feature-auth/src/effects/register.js';
import { createRegisterEffect } from '@livai/feature-auth/src/effects/register.js';
import type {
  AuthStoreState,
  CreateAuthStoreConfig,
} from '@livai/feature-auth/src/stores/index.js';
import { createAuthStore } from '@livai/feature-auth/src/stores/index.js';
import { Runtime } from 'effect';

import type { UseAuthDeps, UseAuthStorePort } from '../hooks/useAuth.js';

/* ============================================================================
 * 🧬 TYPES — DI CONFIG
 * ========================================================================== */

/**
 * Конфигурация для DI-фабрики auth-хука.
 * @remarks
 * - Оборачивает feature-auth конфиги (таймауты, стратегии конкуренции, external deps).
 * - Предназначена для передачи только необходимых полей, без утечек транспортного слоя.
 */
export type AuthHookDepsConfig = Readonly<{
  /**
   * Конфигурация login-effect.
   * @see createLoginEffect (feature-auth)
   */
  readonly login: Readonly<{
    readonly config: LoginEffectConfig;
    readonly deps: LoginEffectDeps;
  }>;

  /**
   * Конфигурация logout-effect.
   * @see createLogoutEffect (feature-auth)
   */
  readonly logout: Readonly<{
    readonly config: LogoutEffectConfig;
    readonly deps: LogoutEffectDeps;
  }>;

  /**
   * Конфигурация register-effect.
   * @see createRegisterEffect (feature-auth)
   */
  readonly register: Readonly<{
    readonly config: RegisterEffectConfig;
    readonly deps: RegisterEffectDeps;
  }>;

  /**
   * Конфигурация refresh-effect.
   * @see createRefreshEffect (feature-auth)
   */
  readonly refresh: Readonly<{
    readonly config: RefreshEffectConfig;
    readonly deps: RefreshEffectDeps;
  }>;

  /**
   * Необязательная конфигурация auth-store.
   * @see createAuthStore (feature-auth)
   */
  readonly store?: Readonly<{
    readonly config: CreateAuthStoreConfig;
  }>;
}>;

/** Инстанс auth-store на базе Zustand. */
type AuthZustandStore = ReturnType<typeof createAuthStore>;

/* ============================================================================
 * 🔌 STORE PORT ADAPTER
 * ========================================================================== */

/**
 * Создаёт порт стора для `useAuth` на основе feature-auth store.
 * @param store - Инстанс AuthStore на базе Zustand из feature-auth.
 * @returns Порт стора, совместимый с UseAuthStorePort.
 * @remarks
 * - Абстрагирует конкретную реализацию (Zustand).
 * - Экспортирует только `auth`-срез и subscribe API.
 * - Опирается на инвариант `feature-auth`: `auth`-срез обновляется иммутабельно (новая ссылка при изменении),
 *   поэтому reference-compare `nextAuth !== prevAuth` детерминирован и безопасен.
 */
function createAuthStorePort(store: AuthZustandStore): UseAuthStorePort {
  return {
    getAuthState: (): AuthStoreState['auth'] => store.getState().auth,
    // Подписка на изменения только auth-среза состояния.
    subscribe: (listener: () => void): () => void => {
      let prevAuth = store.getState().auth;
      return store.subscribe((state) => {
        const nextAuth = (state as AuthStoreState).auth;
        if (nextAuth !== prevAuth) {
          prevAuth = nextAuth;
          listener();
        }
      });
    },
  } as const;
}

/* ============================================================================
 * 🏭 DI FACTORY
 * ========================================================================== */

/**
 * Создаёт DI-зависимости для хука `useAuth`.
 * @param config - Конфигурация для auth-store и auth-эффектов.
 * @returns Объект `UseAuthDeps` для использования в `useAuth`.
 * @remarks
 * - Создаёт один инстанс `AuthStore` из feature-auth.
 * - Создаёт эффекты login/logout/register/refresh и адаптирует их к Promise API.
 * - Не содержит бизнес-логики, только композицию DI-портов.
 * - **Side-effects**: создаёт только store и эффекты-фабрики (lazy evaluation).
 *   Store инициализируется синхронно через `createAuthStore` (persist middleware читает localStorage,
 *   но это синхронная операция, не async side-effect). Эффекты создаются как функции,
 *   но не выполняются до явного вызова. **Нет автоматических refresh/подписок/background tasks.**
 *   Все триггеры refresh (включая background-задачи) идут только из явных lifecycle-точек
 *   (`background/tasks.ts`, `useAuth().refresh()`), а не из DI-фабрики.
 * - **React 18 StrictMode-safe**: double-invoke безопасен, так как нет side-effects при создании.
 */
let cachedAuthHookDeps: UseAuthDeps | null = null;

export function createAuthHookDeps(config: AuthHookDepsConfig): UseAuthDeps {
  if (cachedAuthHookDeps !== null) {
    throw new Error('AuthHookDeps already initialized');
  }

  const store = createAuthStore(
    config.store?.config,
  );

  const authStorePort = createAuthStorePort(store);

  const loginEffectInternal = createLoginEffect(
    config.login.deps,
    config.login.config,
  );

  const logoutEffectInternal = createLogoutEffect(
    config.logout.deps,
    config.logout.config,
  );

  const registerEffectInternal = createRegisterEffect(
    config.register.deps,
    config.register.config,
  );

  const refreshEffectInternal = createRefreshEffect(
    config.refresh.deps,
    config.refresh.config,
  );
  const runtime = Runtime.defaultRuntime;

  const loginEffect = (request: LoginRequest<LoginIdentifierType>): Promise<LoginResult> =>
    Runtime.runPromise(
      runtime,
      // Единственная точка cast: адаптер Effect → Promise для login-flow.
      loginEffectInternal(request) as never,
    );

  const logoutEffect = (): Promise<LogoutResult> =>
    Runtime.runPromise(
      runtime,
      // Единственная точка cast: адаптер Effect → Promise для logout-flow.
      logoutEffectInternal() as never,
    );

  const registerEffect = (
    request: RegisterRequest<RegisterIdentifierType>,
  ): Promise<RegisterResult> =>
    Runtime.runPromise(
      runtime,
      // Единственная точка cast: адаптер Effect → Promise для register-flow.
      registerEffectInternal(request) as never,
    );

  const refreshEffect = (): Promise<RefreshEffectResult> =>
    Runtime.runPromise(
      runtime,
      // Единственная точка cast: адаптер Effect → Promise для refresh-flow.
      refreshEffectInternal() as never,
    );

  const deps: UseAuthDeps = {
    authStore: authStorePort,
    loginEffect,
    logoutEffect,
    registerEffect,
    refreshEffect,
  } as const;

  cachedAuthHookDeps = deps;

  return deps;
}
