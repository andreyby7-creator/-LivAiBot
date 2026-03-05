/**
 * @file packages/app/src/providers/QueryClientProvider.tsx
 * ============================================================================
 * 🧩 QUERY CLIENT PROVIDER — SHELL УРОВЕНЬ REACT QUERY
 * ============================================================================
 * Назначение:
 * - Единая точка инициализации QueryClient для приложения
 * - SSR-safe поведение (no-op на сервере)
 * - Микросервисная нейтральность и переиспользуемость
 * Принципы:
 * - Инициализация client-only ресурсов только на клиенте
 * - Чистая композиция провайдеров без бизнес-логики
 * - Детерминированная конфигурация через createQueryClient
 */

'use client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider as ReactQueryProvider } from '@tanstack/react-query';
import type { JSX, PropsWithChildren } from 'react';
import { memo, useRef, useState } from 'react';

import type { AppQueryClientOptions } from '../state/query/query-client.js';
import { createQueryClient } from '../state/query/query-client.js';
import type { ComponentState } from '../types/ui-contracts.js';

/** Алиас для состояния компонентов в контексте query client provider */
export type QueryComponentState<T = unknown> = ComponentState<T>;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Props QueryClientProvider. */
export type AppQueryClientProviderProps = Readonly<
  PropsWithChildren<{
    /** Готовый QueryClient (например, из tests или внешнего bootstrap). */
    readonly client?: QueryClient;
    /** Опции создания QueryClient (игнорируются если client передан). */
    readonly options?: AppQueryClientOptions;
    /** Включить/выключить провайдер (SSR-safe no-op). */
    readonly enabled?: boolean;
  }>
>;

/* ============================================================================
 * 🎯 PROVIDER
 * ========================================================================== */

function AppQueryClientProviderComponent({
  children,
  client,
  options,
  enabled = true,
}: AppQueryClientProviderProps): JSX.Element {
  const isClientRef = useRef(typeof window !== 'undefined');

  // client > options > disabled
  const [queryClient] = useState<QueryClient | null>(() => {
    if (!enabled || !isClientRef.current) return null;
    return client ?? createQueryClient(options);
  });

  const shouldRenderProvider = enabled && isClientRef.current && queryClient !== null;
  if (!shouldRenderProvider) return children as JSX.Element;

  return (
    <ReactQueryProvider client={queryClient}>
      {children}
    </ReactQueryProvider>
  );
}

export const AppQueryClientProvider = memo(AppQueryClientProviderComponent);
