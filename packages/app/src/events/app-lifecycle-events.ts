/**
 * @file packages/app/src/events/app-lifecycle-events.ts
 * =============================================================================
 * 📡 APP LIFECYCLE EVENTS
 * =============================================================================
 *
 * App-level lifecycle event hub.
 *
 * Назначение:
 * — Рассылка простых lifecycle-событий приложения
 * — Без payload
 * — Без domain-логики
 * — Без knowledge о typed / business events
 *
 * Используется для:
 * — bootstrap / teardown
 * — logout / reset
 * — background tasks
 * — scheduler
 *
 * ❗ НЕ использовать для domain / business событий
 * ❗ НЕ добавлять payload
 *
 * Архитектурные принципы:
 * — Minimal API
 * — Error isolation
 * — Explicit lifecycle
 * — Infra-agnostic
 * — Predictable behavior
 *
 * @example
 * // Подписка на событие
 * const unsubscribe = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, () => {
 *   console.log('Bootstrap complete');
 * });
 *
 * // Одноразовая подписка
 * appLifecycleEvents.once(AppLifecycleEvent.USER_LOGOUT, () => {
 *   console.log('User logged out');
 * });
 *
 * // Отправка события
 * appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
 */

import type { VoidFn } from '../types/common.js';

/* ============================================================================
 * 🧭 LIFECYCLE EVENT TYPES
 * ============================================================================
 */

/**
 * Все lifecycle-события приложения.
 *
 * ❗ Добавлять новые события ТОЛЬКО если:
 * — событие глобальное
 * — не относится к бизнес-домену
 * — не требует payload
 */
export enum AppLifecycleEvent {
  /** Приложение стартует (bootstrap) */
  APP_BOOTSTRAP = 'app:bootstrap',

  /** Приложение полностью инициализировано */
  APP_READY = 'app:ready',

  /** Начало остановки приложения */
  APP_TEARDOWN = 'app:teardown',

  /** Пользователь выходит из системы */
  USER_LOGOUT = 'user:logout',

  /** Глобальный reset состояния приложения */
  APP_RESET = 'app:reset',

  /** Ошибка в lifecycle handler'е */
  APP_LIFECYCLE_HANDLER_ERROR = 'app:lifecycle-handler-error',
}

/* ============================================================================
 * 🔌 INTERNAL TYPES
 * ============================================================================
 */

/** Handler lifecycle-события */
type LifecycleHandler = VoidFn;

/** Unsubscribe-функция */
export type UnsubscribeFn = VoidFn;

/* ============================================================================
 * 🧱 LIFECYCLE EVENT BUS
 * ============================================================================
 */

/**
 * Простой, устойчивый event hub для lifecycle-событий.
 *
 * Особенности:
 * — Error isolation (ошибка одного handler не ломает остальных)
 * — Deterministic unsubscribe
 * — Без payload → минимальный surface API
 *
 * ❗ Намеренно НЕ:
 * — async
 * — typed payload
 * — wildcard events
 */
class AppLifecycleEventBus {
  /** Registry обработчиков */
  private readonly handlers = new Map<AppLifecycleEvent, Set<LifecycleHandler>>();

  /**
   * Подписка на lifecycle-событие.
   *
   * @param event lifecycle-событие
   * @param handler callback без аргументов
   * @returns функция отписки
   */
  on(event: AppLifecycleEvent, handler: LifecycleHandler): UnsubscribeFn {
    let bucket = this.handlers.get(event);

    if (!bucket) {
      bucket = new Set();
      this.handlers.set(event, bucket);
    }

    bucket.add(handler);

    return () => {
      bucket.delete(handler);

      if (bucket.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Одноразовая подписка.
   *
   * Handler будет вызван ровно один раз и автоматически удалён.
   */
  once(event: AppLifecycleEvent, handler: LifecycleHandler): UnsubscribeFn {
    const unsubscribe = this.on(event, () => {
      unsubscribe();
      handler();
    });

    return unsubscribe;
  }

  /**
   * Эмиссия lifecycle-события.
   *
   * ❗ Никогда не бросает исключения наружу.
   * Ошибки handler'ов изолированы.
   */
  emit(event: AppLifecycleEvent): void {
    const bucket = this.handlers.get(event);
    if (!bucket || bucket.size === 0) {
      if (process.env['NODE_ENV'] === 'development') {
        // eslint-disable-next-line no-console
        console.warn(`[lifecycle] emitted event with no subscribers: ${event}`);
      }
      return;
    }

    // defensive copy — защита от мутаций во время emit
    [...bucket].forEach((handler) => {
      try {
        handler();
      } catch {
        // ❗ сознательно глотаем ошибку
        // lifecycle события не должны ломать приложение
        // логирование — задача observability слоя
      }
    });
  }

  /**
   * Полная очистка всех подписок.
   *
   * Используется при teardown / тестировании.
   * Гарантированно очищает все вложенные Set объекты.
   */
  clear(): void {
    // Очищаем все вложенные Set объекты для предотвращения утечек памяти
    this.handlers.forEach((set) => {
      set.clear();
    });
    // Очищаем саму Map
    this.handlers.clear();
  }
}

/* ============================================================================
 * 🌍 GLOBAL INSTANCE
 * ============================================================================
 */

/**
 * Глобальный lifecycle event hub приложения.
 *
 * Singleton по архитектуре:
 * — единый источник lifecycle-событий
 * — доступен всем слоям приложения
 */
export const appLifecycleEvents = new AppLifecycleEventBus();

// Deep freeze в dev-mode для защиты API от мутаций (включая методы)
if (process.env['NODE_ENV'] === 'development') {
  const deepFreeze = (obj: unknown): void => {
    if (obj != null && typeof obj === 'object') {
      Object.freeze(obj);
      Object.getOwnPropertyNames(obj).forEach((prop) => {
        const value = (obj as Record<string, unknown>)[prop];
        if (value != null && typeof value === 'object' && !Object.isFrozen(value)) {
          deepFreeze(value);
        }
      });
    }
  };
  deepFreeze(appLifecycleEvents);
}

/* ============================================================================
 * 🧠 ARCHITECTURAL NOTES
 * ============================================================================
 *
 * ✔ Почему enum, а не string literals?
 *   — централизованный контракт
 *   — auto-complete
 *   — контроль роста API
 *
 * ✔ Почему без payload?
 *   — lifecycle ≠ domain
 *   — payload → coupling
 *
 * ✔ Почему не async?
 *   — lifecycle события — сигналы, не workflow
 *
 * ✔ Где логирование?
 *   — observability слой (Sentry / logger / tracing)
 */
