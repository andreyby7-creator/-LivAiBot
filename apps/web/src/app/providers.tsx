/**
 * @file apps/web/src/app/providers.tsx
 * ============================================================================
 * 🟥 APP PROVIDERS — ПРОВАЙДЕРЫ ПРИЛОЖЕНИЯ
 * ============================================================================
 * Единственная точка композиции всех провайдеров для Next.js App Router.
 * Является клиентским компонентом-оберткой над AppProviders из @livai/app.
 * Ответственность:
 * - Композиция всех клиентских провайдеров приложения (QueryClient, Toast, Telemetry и др.)
 * - SSR-safe инициализация клиентских провайдеров
 * - Интеграция с Next.js App Router и next-intl (работает внутри IntlProvider)
 * - Готовность к микросервисной архитектуре (легко расширяется)
 * Не содержит:
 * - Бизнес-логики
 * - Доменных зависимостей
 * - Прямых импортов из ui-core (только через @livai/app)
 */

'use client';

import { errorFireAndForget } from '@livai/app/lib/telemetry-runtime.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { memo, useMemo, useState } from 'react';
import type { JSX, PropsWithChildren, ReactNode } from 'react';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ============================================================================ */

export type ProvidersProps = Readonly<PropsWithChildren<{ readonly children?: ReactNode; }>>;

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const STALE_TIME_MINUTES = 1;
const GC_TIME_MINUTES = 5;
const DEFAULT_RETRY_COUNT = 1;

/** Feature flag для включения/выключения логирования ошибок QueryClient. */
function shouldLogQueryErrors(): boolean {
  if (typeof window === 'undefined') return false;
  const envValue = process.env['NEXT_PUBLIC_QUERY_LOG_ERRORS'];
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }
  return process.env['NODE_ENV'] === 'production';
}

/** Логирует ошибку QueryClient для observability. */
function logQueryError(context: 'query' | 'mutation', error: unknown): void {
  if (!shouldLogQueryErrors()) {
    return;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorType = error instanceof Error ? error.constructor.name : typeof error;

  // Используем errorFireAndForget из @livai/app напрямую
  // Функция безопасна: проверяет инициализацию telemetry внутри себя
  errorFireAndForget(`${context.charAt(0).toUpperCase() + context.slice(1)} error`, {
    error: errorMessage,
    errorType,
  });
}

/** Создает конфигурацию QueryClient с обработкой ошибок для observability. */
function createQueryClientConfig(): {
  readonly defaultOptions: {
    readonly queries: {
      readonly staleTime: number;
      readonly gcTime: number;
      readonly retry: number;
      readonly refetchOnWindowFocus: boolean;
      readonly refetchOnReconnect: boolean;
      readonly onError: (error: unknown) => void;
    };
    readonly mutations: {
      readonly retry: boolean;
      readonly onError: (error: unknown) => void;
    };
  };
} {
  return {
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
        gcTime: GC_TIME_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
        retry: DEFAULT_RETRY_COUNT,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        onError: (error: unknown): void => {
          logQueryError('query', error);
        },
      },
      mutations: {
        retry: false,
        onError: (error: unknown): void => {
          logQueryError('mutation', error);
        },
      },
    },
  } as const;
}

/* ============================================================================
 * 🎯 PROVIDERS COMPONENT
 * ============================================================================ */

type ProviderComponent<
  TProps extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> = Readonly<
  | {
    readonly type: 'query-client';
    readonly client: QueryClient;
  }
  | {
    readonly type: 'standard';
    readonly component: (props: Readonly<PropsWithChildren<TProps>>) => JSX.Element;
    readonly props?: TProps;
  }
>;

/** Создает список провайдеров в порядке композиции. */
function createProvidersList(queryClient: QueryClient): readonly ProviderComponent[] {
  return [
    {
      type: 'query-client',
      client: queryClient,
    },
    // TODO: Добавить ToastProvider когда будет создан в @livai/app
    // {
    //   type: 'standard',
    //   component: ToastProvider,
    // },
    // TODO: Добавить TelemetryProvider когда будет создан в @livai/app
    // {
    //   type: 'standard',
    //   component: TelemetryProvider,
    // },
    // TODO: Добавить FeatureFlagsProvider когда будет создан в @livai/app
    // {
    //   type: 'standard',
    //   component: FeatureFlagsProvider,
    // },
  ] as const;
}

function ProvidersComponent({ children }: ProvidersProps): JSX.Element {
  const queryClient = useState(() => {
    // ⚠️ ВАЖНО: Любой новый провайдер, который создает client-only ресурсы
    // (например, ToastProvider, WebSocketProvider и т.д.), ДОЛЖЕН проверять
    // typeof window !== 'undefined' перед созданием своих ресурсов.
    // Это критично для SSR safety и предотвращения ошибок гидратации.
    if (typeof window === 'undefined') {
      throw new Error(
        'QueryClient should not be created on the server. Providers component must be client-side only.',
      );
    }
    return new QueryClient(createQueryClientConfig());
  })[0];

  const providersComposition = useMemo(() => {
    const providersList = createProvidersList(queryClient);
    return providersList.reduceRight<JSX.Element>(
      (acc, provider) => {
        if (provider.type === 'query-client') {
          return (
            <QueryClientProvider client={provider.client} key='provider-query-client'>
              {acc}
            </QueryClientProvider>
          );
        }
        const ProviderComponent = provider.component;
        const providerKey = `provider-standard-${provider.component.name}`;
        return (
          <ProviderComponent key={providerKey} {...(provider.props ?? {})}>
            {acc}
          </ProviderComponent>
        );
      },
      children as JSX.Element,
    );
  }, [queryClient, children]);

  return providersComposition;
}

export const Providers = memo(ProvidersComponent);

/* ============================================================================
 * 📝 БУДУЩАЯ ИНТЕГРАЦИЯ С AppProviders
 * ============================================================================
 *
 * Когда AppProviders будет создан в @livai/app, этот файл будет обновлен:
 *
 * ```tsx
 * import { AppProviders } from '@livai/app';
 *
 * function ProvidersComponent({ children }: ProvidersProps): JSX.Element {
 *   return (
 *     <AppProviders>
 *       {children}
 *     </AppProviders>
 *   );
 * }
 * ```
 *
 * Это обеспечит:
 * - Единую точку композиции всех провайдеров
 * - Переиспользование логики между платформами (web, mobile, pwa)
 * - Централизованное управление конфигурацией провайдеров
 * ============================================================================
 */
