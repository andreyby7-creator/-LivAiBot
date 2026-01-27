/**
 * @file apps/web/src/app/sw-register.ts
 * ============================================================================
 * 🔧 REGISTRATION SERVICE WORKER
 * ============================================================================
 *
 * Регистрация SW в браузере с feature flag и graceful degradation
 * - Логирование статуса
 * - Автоматическая перезагрузка при обновлении
 * - Поддержка PWA best practices
 */

/**
 * Проверяет возможность использования SW
 */
function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator && process.env.NODE_ENV === 'production';
}

/**
 * Регистрация Service Worker
 */
export async function registerServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // eslint-disable-next-line no-console
    console.log('[SW] Зарегистрирован:', registration.scope);

    // Обновление SW
    // eslint-disable-next-line functional/immutable-data
    registration.onupdatefound = (): void => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      // eslint-disable-next-line functional/immutable-data
      newWorker.onstatechange = (): void => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // eslint-disable-next-line no-console
            console.log('[SW] Новая версия установлена, перезагрузка страницы...');
            window.location.reload();
          } else {
            // eslint-disable-next-line no-console
            console.log('[SW] Контент кеширован для оффлайн использования');
          }
        }
      };
    };
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[SW] Ошибка регистрации:', error);
  }
}

/**
 * Удаление Service Worker (emergency)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((reg) => reg.unregister()));
  // eslint-disable-next-line no-console
  console.log('[SW] Service Worker удалён');
}
