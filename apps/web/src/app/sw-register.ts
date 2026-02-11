/**
 * @file apps/web/src/app/sw-register.ts
 * ============================================================================
 * 🔧 REGISTRATION SERVICE WORKER
 * ============================================================================
 *
 * Регистрация SW в браузере с feature flag и graceful degradation
 * - Логирование статуса
 * - Автоматическая перезагрузка при обновлении с уведомлением пользователя
 * - Поддержка PWA best practices
 * - Поддержка production, staging и preprod окружений
 */

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type ServiceWorkerRegistration = globalThis.ServiceWorkerRegistration;
type ServiceWorker = globalThis.ServiceWorker;

/** Service Worker с явной типизацией состояния */
type ServiceWorkerWithState = ServiceWorker & {
  readonly state: ServiceWorkerState;
};

/* ============================================================================
 * ⚙️ RUNTIME CONFIGURATION
 * ========================================================================== */

/** Дефолтная задержка для production окружения (в миллисекундах) */
const DEFAULT_RELOAD_DELAY_PRODUCTION_MS = 3000;

/** Дефолтная задержка для development/staging окружений (в миллисекундах) */
const DEFAULT_RELOAD_DELAY_DEV_MS = 2000;

/** Runtime конфигурация SW: может быть изменена через window.__SW_CONFIG__, localStorage или NEXT_PUBLIC_SW_RELOAD_DELAY_MS */
type ServiceWorkerConfig = Readonly<{
  reloadDelayMs: number;
}>;

/** Глобальный объект для runtime конфигурации SW (window.__SW_CONFIG__) */
declare global {
  var __SW_CONFIG__: Partial<ServiceWorkerConfig> | undefined;
}

/** Парсит значение задержки из строки или числа, возвращает валидное число или null */
function parseReloadDelay(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/** Получает дефолтную задержку в зависимости от окружения */
function getDefaultReloadDelayMs(): number {
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  return isProduction ? DEFAULT_RELOAD_DELAY_PRODUCTION_MS : DEFAULT_RELOAD_DELAY_DEV_MS;
}

/** Получает конфигурацию из window.__SW_CONFIG__ */
function getWindowConfig(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const windowConfig = window.__SW_CONFIG__;
  return parseReloadDelay(windowConfig?.reloadDelayMs);
}

/** Получает конфигурацию из localStorage */
function getLocalStorageConfig(): number | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem('sw.reloadDelayMs');
    return stored !== null ? parseReloadDelay(stored) : null;
  } catch {
    // localStorage недоступен (например, в приватном режиме)
    return null;
  }
}

/** Получает конфигурацию из env переменной */
function getEnvConfig(): number | null {
  const envDelay = process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];
  return parseReloadDelay(envDelay);
}

/**
 * Получает конфигурацию Service Worker с приоритетом:
 * 1. window.__SW_CONFIG__ (runtime, самый высокий приоритет)
 * 2. localStorage (runtime, персистентный)
 * 3. NEXT_PUBLIC_SW_RELOAD_DELAY_MS (build-time)
 * 4. Дефолтные значения по окружению
 */
function getServiceWorkerConfig(): ServiceWorkerConfig {
  // 1. Проверяем window.__SW_CONFIG__ (runtime, самый высокий приоритет)
  const windowDelay = getWindowConfig();
  if (windowDelay !== null) {
    return { reloadDelayMs: windowDelay };
  }

  // 2. Проверяем localStorage (runtime, персистентный)
  const localStorageDelay = getLocalStorageConfig();
  if (localStorageDelay !== null) {
    return { reloadDelayMs: localStorageDelay };
  }

  // 3. Проверяем env переменную (build-time)
  const envDelay = getEnvConfig();
  if (envDelay !== null) {
    return { reloadDelayMs: envDelay };
  }

  // 4. Дефолтные значения
  return { reloadDelayMs: getDefaultReloadDelayMs() };
}

/** Задержка перед перезагрузкой при обновлении SW (мс). Использует runtime конфигурацию без перекомпиляции */
function getReloadDelayMs(): number {
  return getServiceWorkerConfig().reloadDelayMs;
}

/** Проверяет возможность использования SW. Разрешает в production, staging и preprod окружениях */
function isServiceWorkerSupported(): boolean {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  // Разрешаем SW в production, staging и preprod окружениях
  const nodeEnv = process.env.NODE_ENV;
  const appEnv = process.env['NEXT_PUBLIC_APP_ENV'];

  const isProductionEnv = nodeEnv === 'production';
  const isStagingEnv = appEnv === 'staging' || appEnv === 'preprod';

  return isProductionEnv || isStagingEnv;
}

/**
 * Показывает уведомление пользователю перед перезагрузкой страницы
 * Улучшает UX по сравнению с мгновенной перезагрузкой
 *
 * @todo PRODUCTION: Интегрировать toast notification system из @livai/app
 * Вместо console.log использовать toast.show() для визуального уведомления пользователя
 * Пример: toast.show({ message: 'Доступно обновление...', variant: 'info', duration: getReloadDelayMs() })
 */
function notifyUserBeforeReload(): void {
  const message =
    'Доступно обновление приложения. Страница будет перезагружена через несколько секунд...';

  // eslint-disable-next-line no-console
  console.log(`[SW] ${message}`);

  // TODO: Заменить на toast notification в production
  // import { toast } from '@livai/app';
  // toast.show({ message, variant: 'info', duration: getReloadDelayMs() });
}

/* ============================================================================
 * 📝 REGISTRATION
 * ========================================================================== */

/** Регистрация Service Worker */
export async function registerServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration: ServiceWorkerRegistration = await navigator.serviceWorker.register(
      '/sw.js',
      {
        scope: '/',
      },
    );

    // eslint-disable-next-line no-console
    console.log('[SW] Зарегистрирован:', registration.scope);

    // Обработка обновления SW
    // Используем const для создания обработчиков без мутации объекта
    const handleUpdateFound = (): void => {
      const newWorker: ServiceWorkerWithState | null = registration.installing as
        | ServiceWorkerWithState
        | null;
      if (!newWorker) {
        return;
      }

      const handleStateChange = (): void => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Новая версия установлена - уведомляем пользователя и перезагружаем
            notifyUserBeforeReload();

            // Даем пользователю время увидеть уведомление перед перезагрузкой
            const reloadDelay = getReloadDelayMs();
            setTimeout(() => {
              window.location.reload();
            }, reloadDelay);
          } else {
            // Первая установка - контент кеширован
            // eslint-disable-next-line no-console
            console.log('[SW] Контент кеширован для оффлайн использования');
          }
        }
      };

      newWorker.onstatechange = handleStateChange;
    };

    registration.onupdatefound = handleUpdateFound;
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[SW] Ошибка регистрации:', error);
  }
}

/* ============================================================================
 * 🗑️ UNREGISTER
 * ========================================================================== */

/** Удаление Service Worker (emergency) */
export async function unregisterServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registrations: readonly ServiceWorkerRegistration[] = await navigator.serviceWorker
      .getRegistrations();
    await Promise.all(registrations.map((reg: ServiceWorkerRegistration) => reg.unregister()));
    // eslint-disable-next-line no-console
    console.log('[SW] Service Worker удалён');
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[SW] Ошибка при удалении Service Worker:', error);
  }
}
