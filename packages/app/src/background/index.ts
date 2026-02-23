/**
 * @file packages/app/src/background — Background Tasks & Scheduler
 *
 * Публичный API пакета background.
 * Экспортирует все публичные компоненты, типы и утилиты для фоновых задач и планировщика.
 */

/* ============================================================================
 * ⏰ SCHEDULER — ПЛАНИРОВЩИК ЗАДАЧ
 * ========================================================================== */

/**
 * Scheduler: адаптивный планировщик задач с поддержкой приоритетов и телеметрии.
 * Включает persistent binary heap priority queue, cancellable tasks, adaptive concurrency,
 * retry с exponential backoff, dead-letter queue и graceful shutdown.
 *
 * @public
 */
export {
  type BackgroundTask,
  ENV,
  getGlobalScheduler,
  MeldablePriorityQueue,
  type PriorityType,
  type QueueItem,
  Scheduler,
  scheduler,
  type SchedulerDI,
  type TaskFn,
} from './scheduler.js';

/* ============================================================================
 * 🛠️ TASKS — ФОНОВЫЕ ЗАДАЧИ
 * ========================================================================== */

/**
 * Background Tasks: унифицированные фоновые задачи через глобальный Scheduler.
 * Включает periodic задачи (cache refresh/sync, auth refresh) и event-driven задачи.
 * Поддерживает retry/DLQ логику, cancellable через AbortSignal и graceful shutdown.
 *
 * @public
 */
export {
  backgroundTasks,
  type BackgroundTasksDI,
  createTasks,
  initBackgroundTasks,
  PermanentError,
  startBackgroundTasks,
  stopBackgroundTasks,
  type TaskEffect,
  TaskError,
  TransientError,
} from './tasks.js';
