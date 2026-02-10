/**
 * @file packages/app/src/lib/app-lifecycle.ts
 * ============================================================================
 * 📡 APP LIFECYCLE — BOOTSTRAP / TEARDOWN
 * ============================================================================
 *
 * Архитектурная роль:
 * - Централизованный контроль bootstrap / teardown приложения
 * - Управление lifecycle событий через event hub
 * - Инициализация background tasks
 *
 * Orchestrator жизненного цикла приложения:
 * - Инициализирует background tasks и подписки на lifecycle события.
 * - Не хранит state, не реализует бизнес-логику.
 * - Чисто bootstrap / teardown, reusable и микросервисно-нейтральный.
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ❌ Нет зависимостей от UI / domain
 * - ✅ Идемпотентность
 * - ✅ Error isolation
 * - ✅ Staged / future-proof
 * - ✅ SSR-safe / microservice-agnostic
 *
 * @example
 * await appLifecycle.bootstrap();
 * appLifecycle.onLifecycle('BOOTSTRAP', () => console.log('App bootstrapped'));
 * await appLifecycle.teardown();
 */

import { startBackgroundTasks, stopBackgroundTasks } from '../background/tasks.js';
import { AppLifecycleEvent, appLifecycleEvents } from '../events/app-lifecycle-events.js';
import type { VoidFn } from '../types/common.js';

/**
 * @internal Stub для observability layer
 * В production заменить на реальную функцию логирования ошибок
 */
const observability = {
  captureError: (error: unknown, context?: Record<string, unknown>): void => {
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.error('[app-lifecycle] observability stub:', error, context);
    }
    // TODO: Подключить реальный observability layer
  },
};

/* ============================================================================
 * 🧭 LIFECYCLE TYPES
 * ============================================================================
 */

/**
 * Lifecycle stages для bootstrap/teardown.
 * Стадии выполняются в строгом порядке: infra → tasks → features (bootstrap)
 * или features → tasks → infra (teardown).
 *
 * infra: инфраструктурный слой (сети, конфигурация)
 * tasks: фоновые задачи и планировщик
 * features: пользовательские возможности и UI
 */
export type LifecycleStage = 'infra' | 'tasks' | 'features';

// Возможные lifecycle события для подписки сторонними модулями
export type LifecycleHookEvent = 'BOOTSTRAP' | 'TEARDOWN';

// Подписка на lifecycle событие
export type LifecycleHookHandler = VoidFn;

/* ============================================================================
 * 🧱 INTERNAL STATE
 * ============================================================================
 */

let isBootstrapped = false;
let isTornDown = false;
const lifecycleHooks = new Map<LifecycleHookEvent, Set<LifecycleHookHandler>>();

/* ============================================================================
 * 🔴 HELPER FUNCTIONS
 * ============================================================================
 */

// Безопасный вызов обработчика с изоляцией ошибок
function safeCall(handler: VoidFn): void {
  try {
    handler();
  } catch (error) {
    // 🔹 Интеграция с observability layer
    observability.captureError(error, { context: 'app-lifecycle-handler' });

    // Отправляем специальное событие для ошибок хэндлеров
    appLifecycleEvents.emit(AppLifecycleEvent.APP_LIFECYCLE_HANDLER_ERROR);
  }
}

// Вызов всех зарегистрированных hook-обработчиков
function emitHooks(event: LifecycleHookEvent): void {
  const handlers = lifecycleHooks.get(event);
  if (!handlers) return;
  [...handlers].forEach(safeCall);
}

/* ============================================================================
 * 🌐 PUBLIC API
 * ============================================================================
 */

export const appLifecycle = {
  /**
   * Async bootstrap приложения.
   * - Стадии: infra → tasks → features (выполняются последовательно)
   * - Идемпотентный
   * @param targetOrStages Стадия или массив стадий (выполнение по порядку передачи).
   */
  async bootstrap(targetOrStages: LifecycleStage | LifecycleStage[] = 'features'): Promise<void> {
    if (isBootstrapped) return;

    let stagesToExecute: LifecycleStage[];

    if (Array.isArray(targetOrStages)) {
      // Явный массив стадий для полного контроля
      stagesToExecute = targetOrStages;
    } else {
      // Стандартный порядок до targetStage
      const allStages: LifecycleStage[] = ['infra', 'tasks', 'features'];
      const targetIndex = allStages.indexOf(targetOrStages);
      stagesToExecute = allStages.slice(0, targetIndex + 1);
    }

    for (const stage of stagesToExecute) {
      switch (stage) {
        case 'infra':
          // здесь future dev может добавить init infra layer
          break;
        case 'tasks':
          await startBackgroundTasks(); // async-safe
          break;
        case 'features':
          // future feature-level init
          break;
      }
    }

    // Финализация только при выполнении features stage
    if (stagesToExecute.includes('features')) {
      isBootstrapped = true;
      emitHooks('BOOTSTRAP');
      appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    }
  },

  /**
   * Async teardown приложения.
   * - Стадии выполняются в обратном порядке: features → tasks → infra
   * - Идемпотентный
   * - Отмена фоновых задач
   * @param targetOrStages Стадия или массив стадий (выполнение по порядку передачи).
   */
  async teardown(targetOrStages: LifecycleStage | LifecycleStage[] = 'features'): Promise<void> {
    if (isTornDown) return;

    let stagesToExecute: LifecycleStage[];

    if (Array.isArray(targetOrStages)) {
      // Явный массив стадий для полного контроля
      stagesToExecute = targetOrStages;
    } else if (targetOrStages === 'features') {
      // По умолчанию выполняем полный teardown всех стадий
      stagesToExecute = ['features', 'tasks', 'infra'];
    } else {
      // Частичный teardown до указанной стадии включительно
      const allStages: LifecycleStage[] = ['features', 'tasks', 'infra'];
      const targetIndex = allStages.indexOf(targetOrStages);
      stagesToExecute = allStages.slice(0, targetIndex + 1);
    }

    for (const stage of stagesToExecute) {
      switch (stage) {
        case 'features':
          // feature-level cleanup
          break;
        case 'tasks':
          await stopBackgroundTasks();
          break;
        case 'infra':
          // future infra teardown
          break;
      }
    }

    // Финализация только при выполнении features stage
    if (stagesToExecute.includes('features')) {
      isTornDown = true;
      emitHooks('TEARDOWN');
      appLifecycleEvents.emit(AppLifecycleEvent.APP_TEARDOWN);
    }
  },

  /**
   * Подписка на lifecycle событие
   * @param event 'BOOTSTRAP' | 'TEARDOWN'
   * @param handler callback
   * @returns функция отписки
   */
  onLifecycle(event: LifecycleHookEvent, handler: LifecycleHookHandler): VoidFn {
    let bucket = lifecycleHooks.get(event);
    if (!bucket) {
      bucket = new Set();
      // eslint-disable-next-line functional/immutable-data
      lifecycleHooks.set(event, bucket);
    }

    const wasAlreadySubscribed = bucket.has(handler);
    // eslint-disable-next-line functional/immutable-data
    bucket.add(handler);

    // Логирование повторной подписки в dev-mode
    if (process.env['NODE_ENV'] === 'development' && wasAlreadySubscribed) {
      // eslint-disable-next-line no-console
      console.warn(`[app-lifecycle] Handler уже подписан на событие ${event}`);
    }

    return () => {
      // eslint-disable-next-line functional/immutable-data
      bucket.delete(handler);
      if (bucket.size === 0) {
        // eslint-disable-next-line functional/immutable-data
        lifecycleHooks.delete(event);
      }
    };
  },

  // Полный reset lifecycle internal state (только для тестов / SSR)
  resetInternalState(): void {
    isBootstrapped = false;
    isTornDown = false;
    // eslint-disable-next-line functional/immutable-data
    lifecycleHooks.clear();
  },
};
