/**
 * @file packages/core/src/access-control/auth-guard.react.tsx
 * ============================================================================
 * 🛡️ AUTH GUARD — React Parts
 * ============================================================================
 *
 * React-специфичная обёртка над ядром access-control/auth-guard.
 * Client-only модуль (`'use client'`): контекст и hooks для интеграции с React.
 * Ядро авторизации (`auth-guard.ts`) остаётся полностью независимым от React.
 */

'use client';

import React, { createContext, useContext, useRef } from 'react';

import type { Action, AuthDecision, AuthGuardContextCore, Resource } from './auth-guard.js';
import { checkAccess } from './auth-guard.js';

/**
 * Расширенный React-контекст авторизации.
 * Содержит минимальный core-контекст + поля для observability и токенов.
 * @remarks
 * - accessToken/refreshToken могут использоваться bridge-слоями (feature-auth, api-client)
 *   для построения AuthGuardContext поверх текущего auth state.
 */
export interface AuthGuardContext extends AuthGuardContextCore {
  readonly requestId: string;
  readonly traceId?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly sessionId?: string;
  /** Access token, прокидывается только через доверенный bridge-слой (не логировать, не кешировать в localStorage). */
  readonly accessToken?: string;
  /** Refresh token, прокидывается только через доверенный bridge-слой (не логировать, не кешировать в localStorage). */
  readonly refreshToken?: string;
}

export const AuthGuardReactContext = createContext<AuthGuardContext | null>(null);

export const AuthGuardProvider: React.FC<{
  readonly children: React.ReactNode;
  readonly value: AuthGuardContext;
}> = ({ children, value }) => {
  return React.createElement(AuthGuardReactContext.Provider, { value }, children);
};

export function useAuthGuardContext(): AuthGuardContext {
  const context = useContext(AuthGuardReactContext);

  if (context === null) {
    // eslint-disable-next-line fp/no-throw -- React hooks standard pattern for missing context
    throw new Error('useAuthGuardContext must be used within an AuthGuardProvider');
  }

  return context;
}

/** React-friendly helper для проверки доступа на основе текущего контекста. */
export function useCheckAccess(
  action: Action,
  resource: Resource,
): AuthDecision {
  const context = useAuthGuardContext();

  return checkAccess(action, resource, context);
}

/**
 * Строит детерминированный ключ решения для memoization.
 * @internal
 */
function makeDecisionKey(
  action: Action,
  resource: Resource,
  context: AuthGuardContext,
): string {
  return `${context.requestId}:${action}:${resource.type}:${resource.id ?? ''}`;
}

/**
 * Memoized‑вариант проверки доступа для hot‑path сценариев.
 * Кеширует решения **только** в рамках жизненного цикла конкретного компонента
 * по ключу (requestId + action + resource).
 * @important Кеш не является глобальным:
 * - каждый компонент, вызывающий hook, имеет свой собственный локальный кеш;
 * - при размонтировании компонента кеш полностью сбрасывается;
 * - для кросс‑компонентного кеша/SSR следует использовать более высокий слой (feature‑auth, data‑layer).
 * @performance Использует useRef вместо useState для кеша, чтобы избежать ререндеров при частых вызовах.
 * Кеш остаётся иммутабельным благодаря spread-операциям при обновлении.
 * @param action Действие, для которого проверяется доступ.
 * @param resource Ресурс, к которому запрашивается доступ.
 * @param options Дополнительные опции, например, observability‑callback.
 */
export function useMemoizedCheckAccess(
  action: Action,
  resource: Resource,
  options?: {
    readonly onDecision?: (decision: AuthDecision) => void;
  },
): AuthDecision {
  const context = useAuthGuardContext();
  const cacheRef = useRef<Readonly<Record<string, AuthDecision>>>({});

  const key = makeDecisionKey(action, resource, context);
  const cached = cacheRef.current[key];
  if (cached !== undefined) {
    options?.onDecision?.(cached);
    return cached;
  }

  const decision = checkAccess(action, resource, context);
  options?.onDecision?.(decision);

  // Иммутабельное обновление кеша: создаём новый объект и дописываем текущее решение по ключу.
  // useRef не вызывает ререндеры, что критично для hot-path hook'ов с частыми вызовами.
  // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- useRef.current intentionally mutable for performance (hot-path optimization)
  cacheRef.current = { ...cacheRef.current, [key]: decision };

  return decision;
}
