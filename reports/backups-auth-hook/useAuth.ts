/**
 * @file packages/feature-auth/src/hooks/useAuth.ts
 * ============================================================================
 * 🪝 FEATURE-AUTH — React hook `useAuth`
 * ============================================================================
 * Архитектурная роль:
 * - Тонкий React‑фасад над auth‑store и auth‑эффектами (login/logout/register/refresh)
 * - UI‑агностичная бизнес‑логика остаётся в effects/store, hook только адаптер
 * - SSR‑safe подписка на store через useSyncExternalStore
 *
 * Инварианты:
 * - ❌ Нет бизнес‑логики (policy, retry, refresh‑триггеры — в эффектах/session‑manager)
 * - ❌ Нет concurrency/queue/idempotency (это ответственность эффектов)
 * - ❌ Нет кэширования промисов/side‑effects внутри hook
 * - ✅ Только чтение состояния из store + делегирование в эффекты
 * - ✅ DI через UseAuthDeps, без глобалов
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { LoginIdentifierType, LoginRequest } from '../domain/LoginRequest.js';
import type { RegisterIdentifierType, RegisterRequest } from '../domain/RegisterRequest.js';
import type { LoginResult } from '../effects/login.js';
import type { LogoutResult } from '../effects/logout.js';
import type { RefreshEffectResult } from '../effects/refresh.js';
import type { RegisterResult } from '../effects/register.js';
import type { AuthState } from '../types/auth.js';

/**
 * Минимальный порт стора для `useAuth`.
 * @remarks
 * - Абстрагирует конкретную реализацию стора (Zustand/Redux и т.д.)
 * - Используется только для подписки и чтения `AuthState`
 */
export type UseAuthStorePort = Readonly<{
  /** Текущее состояние аутентификации. */
  readonly getAuthState: () => AuthState;

  /**
   * Подписка на изменения auth‑состояния.
   * Возвращает функцию отписки.
   */
  readonly subscribe: (listener: () => void) => () => void;
}>;

/**
 * DI‑зависимости hook'а `useAuth`.
 * @remarks
 * - Все эффекты передаются через DI (композер/feature‑factory адаптирует Effect → Promise)
 * - Hook не знает о деталях orchestrator'ов, только о публичном контракте результатов
 */
export type UseAuthDeps = Readonly<{
  /** Порт стора аутентификации для чтения состояния и подписки. */
  readonly authStore: UseAuthStorePort;

  /** Login‑effect: orchestration login‑flow. */
  readonly loginEffect: (
    request: LoginRequest<LoginIdentifierType>,
  ) => Promise<LoginResult>;

  /** Logout‑effect: orchestration logout‑flow. */
  readonly logoutEffect: () => Promise<LogoutResult>;

  /** Register‑effect: orchestration register‑flow. */
  readonly registerEffect: (
    request: RegisterRequest<RegisterIdentifierType>,
  ) => Promise<RegisterResult>;

  /** Refresh‑effect: orchestration refresh‑flow. */
  readonly refreshEffect: () => Promise<RefreshEffectResult>;
}>;

/**
 * Публичный результат `useAuth`.
 * @remarks
 * - Содержит только состояние и методы эффектов
 * - Не добавляет бизнес‑логики поверх effect‑слоя
 */
export type UseAuthResult = Readonly<{
  /** Полное декларативное состояние аутентификации. */
  readonly authState: AuthState;

  /** Выполняет login‑flow через DI‑эффект. */
  readonly login: (
    request: LoginRequest<LoginIdentifierType>,
  ) => Promise<LoginResult>;

  /** Выполняет logout‑flow через DI‑эффект. */
  readonly logout: () => Promise<LogoutResult>;

  /** Выполняет register‑flow через DI‑эффект. */
  readonly register: (
    request: RegisterRequest<RegisterIdentifierType>,
  ) => Promise<RegisterResult>;

  /** Выполняет refresh‑flow через DI‑эффект. */
  readonly refresh: () => Promise<RefreshEffectResult>;
}>;

/**
 * React‑hook `useAuth` — тонкий фасад над auth‑store и auth‑эффектами.
 * @param deps DI‑зависимости хука (store + эффекты)
 * @returns Текущее состояние аутентификации и методы для login/logout/register/refresh.
 */
export function useAuth(deps: UseAuthDeps): UseAuthResult {
  const {
    authStore,
    loginEffect,
    logoutEffect,
    registerEffect,
    refreshEffect,
  } = deps;

  // Подписка на AuthState через useSyncExternalStore — SSR‑safe контракт React 18.
  const authState = useSyncExternalStore(
    authStore.subscribe,
    authStore.getAuthState,
    authStore.getAuthState,
  );

  const login = useCallback(
    (request: LoginRequest<LoginIdentifierType>) => loginEffect(request),
    [loginEffect],
  );

  const logout = useCallback(
    () => logoutEffect(),
    [logoutEffect],
  );

  const register = useCallback(
    (request: RegisterRequest<RegisterIdentifierType>) => registerEffect(request),
    [registerEffect],
  );

  const refresh = useCallback(
    () => refreshEffect(),
    [refreshEffect],
  );

  // Стабильный объект результата для оптимизации ререндеров компонентов.
  return useMemo(
    () => ({
      authState,
      login,
      logout,
      register,
      refresh,
    }),
    [authState, login, logout, register, refresh],
  );
}
