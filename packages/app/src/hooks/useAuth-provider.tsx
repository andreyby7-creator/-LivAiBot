/**
 * @file packages/app/src/hooks/useAuth-provider.tsx
 * ============================================================================
 * 🔐 AUTH HOOK PROVIDER — CONTEXT-ОБЁРТКА ДЛЯ useAuth
 * ============================================================================
 *
 * Архитектурная роль:
 * - React Context-обёртка для DI-версии `useAuth(deps)`.
 * - Инкапсулирует создание DI-зависимостей через `createAuthHookDeps(config)`.
 * - Предоставляет упрощённый API: `useAuth()` без параметров для UI-компонентов.
 *
 * Инварианты:
 * - ❌ Нет бизнес-логики (только композиция DI + Context).
 * - ❌ Нет пересоздания deps при ререндерах (`useMemo([])` гарантирует одно создание).
 * - ✅ Deterministic: deps создаются один раз при монтировании провайдера.
 * - ✅ Domain-pure: опирается на типы и фабрики из `auth-hook-deps.ts`.
 * - ✅ SSR-safe: Context инициализируется корректно на сервере и клиенте.
 * - ✅ StrictMode-safe: `createAuthHookDeps` не имеет side-effects кроме создания store.
 *   Store создаётся синхронно без автоматических refresh/подписок/background tasks.
 *
 * Тестирование:
 * - AuthHookProvider — чисто композиционный компонент, покрытие unit-тестом пропущено.
 * - Основная логика протестирована через useAuth DI-хук и auth-hook-deps.
 * - Транзитивные импорты ломают unit-тесты из-за ограничений Vite при разрешении модулей.
 *
 * Использование:
 * ```tsx
 * <AuthHookProvider config={authConfig}>
 *   <App />
 * </AuthHookProvider>
 *
 * // В компонентах:
 * const { authState, login, logout } = useAuth();
 * ```
 */

'use client';

import type { JSX, PropsWithChildren } from 'react';
import React, { memo, useMemo, useRef } from 'react';

import type { AuthHookDepsConfig } from '../lib/auth-hook-deps.js';
import { createAuthHookDeps } from '../lib/auth-hook-deps.js';
import type { UseAuthDeps, UseAuthResult } from './useAuth.js';
import { useAuth as useAuthDI } from './useAuth.js';

/* ============================================================================
 * 🧩 CONTEXT
 * ========================================================================== */

/**
 * Context для DI-зависимостей `useAuth`.
 * @remarks
 * - `null` означает, что хук используется вне `AuthHookProvider` (ошибка).
 * - Строгая типизация гарантирует, что deps всегда полные (не частично заполненные).
 */
const AuthHookContext = React.createContext<UseAuthDeps | null>(null);

AuthHookContext.displayName = 'AuthHookContext';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/**
 * Props для `AuthHookProvider`.
 * @remarks
 * - `config` передаётся в `createAuthHookDeps` для создания DI-зависимостей.
 * - Конфигурация должна содержать все необходимые deps для эффектов (API-клиент, session manager и т.п.).
 */
export type AuthHookProviderProps = Readonly<
  PropsWithChildren<{
    /** Конфигурация для создания DI-зависимостей auth-хука. */
    readonly config: AuthHookDepsConfig;
  }>
>;

/* ============================================================================
 * 🎯 PROVIDER
 * ========================================================================== */

/**
 * Провайдер для DI-зависимостей `useAuth`.
 * @param props - Свойства провайдера, содержащие `config` и `children`.
 * @returns React-элемент с провайдером контекста.
 * @remarks
 * - Создаёт DI-зависимости один раз при монтировании через `useMemo([])`.
 * - Гарантирует, что store и эффекты не пересоздаются при ререндерах.
 * - Singleton enforcement: `createAuthHookDeps` выбрасывает ошибку при повторном вызове.
 * - **Важно**: `config` должен быть стабильным (не изменяться после передачи в провайдер).
 *   Изменения `config` игнорируются из-за пустого массива зависимостей `useMemo([])`.
 *   В dev-режиме проверяется identity config через `useRef` для раннего обнаружения ошибок.
 * - **React 18 StrictMode**: `createAuthHookDeps` не имеет side-effects кроме создания store.
 *   Store создаётся синхронно без автоматических refresh/подписок, поэтому double-invoke безопасен.
 */
function AuthHookProviderComponent({
  children,
  config,
}: AuthHookProviderProps): JSX.Element {
  // Dev-assert: проверка стабильности config через identity check.
  // В production это no-op, но в dev помогает выявить ошибки на раннем этапе.
  const configRef = useRef(config);
  if (process.env['NODE_ENV'] !== 'production') {
    if (configRef.current !== config) {
      throw new Error(
        'AuthHookProvider config must be stable. Config identity changed between renders. '
          + 'Ensure config is created once and passed as a stable reference.',
      );
    }
  }

  // Создаём DI-зависимости один раз при монтировании провайдера.
  // Пустой массив зависимостей гарантирует, что deps не пересоздаются при ререндерах.
  // **Архитектурное решение**: config должен быть стабильным на уровне приложения.
  // Если требуется per-request конфигурация (SSR), нужно использовать другой подход.
  // **StrictMode safety**: `createAuthHookDeps` создаёт только store и эффекты без side-effects.
  // Store инициализируется синхронно (persist middleware читает localStorage, но это не async side-effect).
  // Эффекты создаются как фабрики, но не выполняются до явного вызова (lazy evaluation).
  const deps = useMemo<UseAuthDeps>(
    () => createAuthHookDeps(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return React.createElement(AuthHookContext.Provider, { value: deps, children });
}

export const AuthHookProvider = Object.assign(memo(AuthHookProviderComponent), {
  displayName: 'AuthHookProvider',
});

/* ============================================================================
 * 🪝 HOOK (PUBLIC API)
 * ========================================================================== */

/**
 * React-хук `useAuth` без параметров — публичный API для UI-компонентов.
 * @returns Текущее состояние аутентификации и методы для login/logout/register/refresh.
 * @throws {Error} Если хук используется вне `AuthHookProvider`.
 * @remarks
 * - Упрощённый API: не требует передачи `deps` вручную.
 * - Берёт DI-зависимости из контекста, созданного в `AuthHookProvider`.
 * - Делегирует выполнение в DI-версию `useAuth(deps)` из `useAuth.ts`.
 * - SSR-safe: корректно работает на сервере и клиенте.
 */
export function useAuth(): UseAuthResult {
  const deps = React.useContext(AuthHookContext);

  if (deps === null) {
    throw new Error(
      'useAuth must be used within AuthHookProvider. Wrap your app with <AuthHookProvider config={...}>',
    );
  }

  return useAuthDI(deps);
}
