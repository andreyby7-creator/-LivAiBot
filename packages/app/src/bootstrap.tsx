/**
 * @file packages/app/src/bootstrap.ts
 * ============================================================================
 * 🚀 BOOTSTRAP — ИНИЦИАЛИЗАЦИЯ КЛИЕНТСКОГО ПРИЛОЖЕНИЯ
 * ============================================================================
 * Назначение:
 * - Чистая точка старта приложения
 * - Безопасные side effects (Service Worker, prefetch) с защитой ошибок
 * - Единый рендер через AppProviders
 * Принципы:
 * - Client-only (не SSR)
 * - Детализированная валидация окружения
 * - Никаких доменных зависимостей
 * - Модульная и тестируемая архитектура
 * Будущие улучшения:
 * - retry/metrics: эмитить события с retryCount или duration
 * - generic BootstrapContext для DI при расширении
 */

import { StrictMode } from 'react';
import type { JSX } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { AppProviders } from './providers/AppProviders.js';
import type { AppProvidersProps } from './providers/AppProviders.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type BootstrapEvent =
  | { readonly type: 'init:start'; }
  | { readonly type: 'init:done'; }
  | { readonly type: 'validate:start'; }
  | { readonly type: 'validate:done'; }
  | { readonly type: 'prefetch:start'; }
  | { readonly type: 'prefetch:done'; }
  | { readonly type: 'serviceWorker:start'; }
  | { readonly type: 'serviceWorker:done'; }
  | { readonly type: 'render:start'; }
  | { readonly type: 'render:done'; }
  | { readonly type: 'unmount:start'; }
  | { readonly type: 'unmount:done'; }
  | { readonly type: 'error'; readonly error: unknown; readonly scope: string; };

export type BootstrapEventHandler = (event: BootstrapEvent) => void;

export type BootstrapOptions = Readonly<{
  /** DOM-элемент, куда монтируется приложение */
  readonly element: HTMLElement;
  /** Корневой компонент приложения */
  readonly app: JSX.Element;
  /** Пропсы AppProviders */
  readonly providers: AppProvidersProps;
  /** Опциональная функция валидации окружения */
  readonly validateEnvironment?: () => void | Promise<void>;
  /** Опциональный prefetch критических ресурсов */
  readonly prefetch?: () => void | Promise<void>;
  /** Опции регистрации Service Worker */
  readonly serviceWorker?: Readonly<{
    readonly enabled?: boolean;
    readonly scriptUrl?: string;
    readonly scope?: string;
    readonly onRegistered?: (registration: ServiceWorkerRegistration) => void;
    readonly onError?: (error: unknown) => void;
  }>;
  /** Универсальный обработчик ошибок bootstrap */
  readonly onError?: (error: unknown) => void;
  /** Подписчики событий bootstrap lifecycle */
  readonly onEvent?: readonly BootstrapEventHandler[];
  /** Внешний обработчик ошибок для event bus */
  readonly onEventError?: (error: unknown) => void;
}>;

export type BootstrapResult = Readonly<{
  readonly root: Root;
  /** Размонтирует корневой React tree */
  readonly unmount: () => void;
  /** Перерисовывает дерево с новым app */
  readonly rerender: (app: JSX.Element) => void;
}>;

/* ============================================================================
 * 🧰 UTILS
 * ========================================================================== */

const DEFAULT_SW_URL = '/service-worker.js';

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Эмитирует событие bootstrap lifecycle с безопасной обработкой ошибок */
function emitEvent(
  handlers: readonly BootstrapEventHandler[] | undefined,
  event: BootstrapEvent,
  onError?: (error: unknown) => void,
): void {
  if (handlers == null || handlers.length === 0) return;
  handlers.forEach((handler) => {
    try {
      handler(event);
    } catch (error) {
      onError?.(error);
      if (process.env['NODE_ENV'] === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Bootstrap event handler failed:', error);
      }
    }
  });
}

/**
 * Безопасно выполняет синхронную или асинхронную задачу
 * @async
 */
async function safeExecute(
  label: string,
  fn: (() => void | Promise<void>) | undefined,
  onError?: (error: unknown) => void,
  onEvent?: readonly BootstrapEventHandler[],
  throwOnError = false,
): Promise<void> {
  if (!fn) return;
  try {
    await fn();
  } catch (error) {
    onError?.(error);
    emitEvent(onEvent, { type: 'error', error, scope: `safeExecute:${label}` }, onError);
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.warn(`Bootstrap step failed: ${label}`, error);
    }
    if (throwOnError) throw error;
  }
}

/** Обёртка для рендера AppProviders с React.StrictMode */
function renderWithProviders(
  root: Root,
  app: JSX.Element,
  providers: Readonly<AppProvidersProps>,
): void {
  const content = (
    <AppProviders {...providers}>
      {app}
    </AppProviders>
  );
  root.render(
    process.env['NODE_ENV'] === 'development' ? <StrictMode>{content}</StrictMode> : content,
  );
}

/** Регистрация Service Worker в отдельной модульной функции */
async function registerServiceWorker(
  swConfig: NonNullable<BootstrapOptions['serviceWorker']>,
  onEvent?: readonly BootstrapEventHandler[],
  onError?: (error: unknown) => void,
): Promise<void> {
  emitEvent(onEvent, { type: 'serviceWorker:start' }, onError);
  if (!('serviceWorker' in navigator) || typeof navigator.serviceWorker.register !== 'function') {
    return;
  }

  const scriptUrl = swConfig.scriptUrl ?? DEFAULT_SW_URL;

  try {
    const registrationOptions: RegistrationOptions = typeof swConfig.scope === 'string'
      ? { scope: swConfig.scope }
      : {};
    const registration = await navigator.serviceWorker.register(scriptUrl, registrationOptions);
    swConfig.onRegistered?.(registration);

    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.log('SW registered', registration);
    }
  } catch (error) {
    swConfig.onError?.(error);
    onError?.(error);
    emitEvent(onEvent, { type: 'error', error, scope: 'serviceWorker' }, onError);
  }

  emitEvent(onEvent, { type: 'serviceWorker:done' }, onError);
}

/* ============================================================================
 * 🎯 BOOTSTRAP
 * ========================================================================== */

/**
 * Инициализирует клиентское приложение
 * Возвращает helpers для тестов и HMR
 */
export async function bootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  if (!isBrowserEnvironment()) {
    throw new Error('bootstrap() must be called in a browser environment.');
  }

  if (!(options.element instanceof HTMLElement)) {
    throw new Error('bootstrap(): element must be a valid HTMLElement.');
  }

  const { onEvent, onEventError, onError, validateEnvironment, prefetch, serviceWorker } = options;
  const handleError = onEventError ?? onError;

  emitEvent(onEvent, { type: 'init:start' }, handleError);

  /** 1️⃣ Критическая валидация */
  await safeExecute('validateEnvironment', validateEnvironment, onError, onEvent, true);
  emitEvent(onEvent, { type: 'validate:done' }, handleError);

  /** 2️⃣ Параллельные side-effects: prefetch + serviceWorker */
  const prefetchTask = async (): Promise<void> => {
    emitEvent(onEvent, { type: 'prefetch:start' }, handleError);
    await safeExecute('prefetch', prefetch, onError, onEvent);
    emitEvent(onEvent, { type: 'prefetch:done' }, handleError);
  };

  const serviceWorkerTask = serviceWorker?.enabled === true
    ? (): Promise<void> => registerServiceWorker(serviceWorker, onEvent, handleError)
    : async (): Promise<void> => {};

  await Promise.allSettled([prefetchTask(), serviceWorkerTask()]);

  /** 3️⃣ Рендер */
  emitEvent(onEvent, { type: 'render:start' }, handleError);
  const root = createRoot(options.element);
  renderWithProviders(root, options.app, options.providers);
  emitEvent(onEvent, { type: 'render:done' }, handleError);

  emitEvent(onEvent, { type: 'init:done' }, handleError);

  /** Возвращаем helpers для тестов и HMR */
  return {
    root,
    unmount: (): void => {
      emitEvent(onEvent, { type: 'unmount:start' }, handleError);
      root.unmount();
      emitEvent(onEvent, { type: 'unmount:done' }, handleError);
    },
    rerender: (app: JSX.Element): void => {
      emitEvent(onEvent, { type: 'render:start' }, handleError);
      renderWithProviders(root, app, options.providers);
      emitEvent(onEvent, { type: 'render:done' }, handleError);
    },
  };
}
