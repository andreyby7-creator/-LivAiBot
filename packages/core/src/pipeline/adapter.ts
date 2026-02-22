/**
 * @file packages/core/src/pipeline/adapter.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Runtime Adapters)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Адаптеры между различными async runtime'ами и pipeline execution engine
 * - Абстракция над cancellation механизмами (AbortSignal, Effect library cancellation)
 * - Причина изменения: transport / framework / runtime abstraction
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, BRANDED ERROR TYPES, CONSTANTS, HELPERS (utility + event emission), ADAPTERS, API
 * - ✅ Deterministic: pure functions, injectable dependencies (nowProvider) для тестирования, единый startTime для всех событий
 * - ✅ Domain-pure: generic по типам результата и runtime (T, TRuntime), без привязки к domain-специфичным типам
 * - ✅ Extensible: strategy pattern для различных runtime адаптеров (AdapterConfig) без изменения core логики
 * - ✅ Strict typing: generic типы для всех компонентов, branded error classes (CancellationError, AdapterTimeoutError)
 * - ✅ Microservice-ready: stateless, injectable dependencies для тестирования, без скрытого coupling
 * - ✅ Scalable: поддержка множественных runtime адаптеров, event hooks (AdapterEventHandler) для мониторинга
 * - ✅ Cancellation-first: поддержка AbortSignal и cooperative cancellation для всех runtime'ов, CancellablePromise<T> для cleanup
 */

/* ============================================================================
 * 1. TYPES — ADAPTER MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Тип события адаптации runtime эффекта
 * @public
 */
export type AdapterEventType =
  | 'start'
  | 'complete'
  | 'cancel'
  | 'error';

/**
 * Универсальный async эффект (стандартный интерфейс для pipeline)
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @public
 */
export type PipelineEffect<T> = (
  signal?: AbortSignal, // AbortSignal для cancellation (опционально)
) => Promise<T>;

/**
 * Адаптер runtime'а в PipelineEffect
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @template TRuntime - Тип исходного runtime эффекта (generic, runtime-agnostic)
 * @public
 */
export type RuntimeAdapter<T, TRuntime> = (
  runtimeEffect: TRuntime, // Исходный эффект из runtime'а
  signal?: AbortSignal, // AbortSignal для cancellation (опционально)
) => Promise<T>;

/**
 * Фабрика адаптера runtime'а
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @template TRuntime - Тип исходного runtime эффекта (generic, runtime-agnostic)
 * @public
 */
export type RuntimeAdapterFactory<T, TRuntime> = (
  runtimeEffect: TRuntime, // Исходный эффект из runtime'а
) => PipelineEffect<T>;

/**
 * Конфигурация адаптера runtime'а
 * @template TRuntime - Тип исходного runtime эффекта (generic, runtime-agnostic)
 * @public
 */
export type AdapterConfig<TRuntime> = Readonly<{
  /** Функция выполнения runtime эффекта (injectable для тестирования) */
  runRuntime: (effect: TRuntime) => Promise<unknown>;
  /** Функция проверки cancellation (опционально, для cooperative cancellation) */
  checkCancellation?: (effect: TRuntime, signal?: AbortSignal) => boolean;
  /** Функция отмены runtime эффекта (опционально, для cooperative cancellation) */
  cancelRuntime?: (effect: TRuntime) => void;
}>;

/**
 * Результат адаптации runtime эффекта
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @public
 */
export type AdapterResult<T> = Readonly<{
  /** Результат выполнения эффекта */
  value: T;
  /** Флаг отмены выполнения */
  cancelled: boolean;
}>;

/**
 * Отменяемый Promise с функцией очистки
 * @template T - Тип результата Promise (generic, domain-agnostic)
 * @public
 */
export type CancellablePromise<T> = Readonly<{
  /** Promise для ожидания результата */
  promise: Promise<T>;
  /** Функция очистки ресурсов (удаление listeners, отмена таймаутов) */
  cleanup: () => void;
}>;

/**
 * Событие адаптации runtime эффекта
 * @public
 */
export type AdapterEvent = Readonly<{
  /** Тип события */
  type: AdapterEventType;
  /** Timestamp события */
  timestamp: number;
  /** Дополнительные метаданные (опционально) */
  metadata?: Readonly<Record<string, unknown>>;
}>;

/**
 * Callback для событий адаптации
 * @public
 */
export type AdapterEventHandler = (event: AdapterEvent) => void;

/* ============================================================================
 * 2. BRANDED ERROR TYPES — TYPE-SAFE ERROR SEMANTICS
 * ============================================================================
 */

/**
 * Ошибка отмены выполнения эффекта
 * @public
 */
// eslint-disable-next-line functional/no-classes -- Branded error class для type-safe error semantics
export class CancellationError extends Error {
  readonly _tag = 'CancellationError' as const;

  constructor(message: string = DEFAULT_CANCELLATION_MESSAGE) {
    super(message);
    // eslint-disable-next-line fp/no-mutation, functional/no-this-expressions -- Необходимо для Error class
    this.name = 'CancellationError';
  }
}

/**
 * Ошибка таймаута выполнения эффекта (adapter-specific)
 * @public
 */
// eslint-disable-next-line functional/no-classes -- Branded error class для type-safe error semantics
export class AdapterTimeoutError extends Error {
  readonly _tag = 'AdapterTimeoutError' as const;

  constructor(message: string = DEFAULT_TIMEOUT_MESSAGE) {
    super(message);
    // eslint-disable-next-line fp/no-mutation, functional/no-this-expressions -- Необходимо для Error class
    this.name = 'AdapterTimeoutError';
  }
}

/**
 * Проверяет, является ли ошибка CancellationError
 * @public
 */
export function isCancellationError(error: unknown): error is CancellationError {
  return error instanceof CancellationError;
}

/**
 * Проверяет, является ли ошибка AdapterTimeoutError
 * @public
 */
export function isAdapterTimeoutError(error: unknown): error is AdapterTimeoutError {
  return error instanceof AdapterTimeoutError;
}

/* ============================================================================
 * 3. CONSTANTS — DEFAULT CONFIGURATION
 * ============================================================================
 */

/** Дефолтное сообщение об ошибке при отмене выполнения */
export const DEFAULT_CANCELLATION_MESSAGE = 'Effect execution cancelled';

/** Дефолтное сообщение об ошибке при таймауте */
export const DEFAULT_TIMEOUT_MESSAGE = 'Effect execution timeout';

/* ============================================================================
 * 4. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Проверяет, отменен ли AbortSignal
 * @public
 */
export function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

/**
 * Создает Promise, который отклоняется при отмене AbortSignal
 * @note Listener автоматически удаляется при resolve/reject для предотвращения memory leak
 * @public
 */
export function createAbortPromise(
  signal?: AbortSignal,
  message: string = DEFAULT_CANCELLATION_MESSAGE,
): CancellablePromise<never> {
  if (!signal) {
    const neverResolves = new Promise<never>(() => {
      // Никогда не резолвится, если signal не передан
    });
    const cleanup = (): void => {};
    return { promise: neverResolves, cleanup };
  }

  const createPromiseWithCleanup = (): CancellablePromise<never> => {
    // Используем объект для хранения handler, чтобы cleanup мог получить к нему доступ
    const handlerState: { handler: (() => void) | null; } = { handler: null };

    const promise = new Promise<never>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new CancellationError(message));
        return;
      }

      const handler = (): void => {
        reject(new CancellationError(message));
      };

      // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- Мутация необходима для работы cleanup функции
      handlerState.handler = handler;
      signal.addEventListener('abort', handler, { once: true });
    });

    const cleanup = (): void => {
      if (handlerState.handler) {
        signal.removeEventListener('abort', handlerState.handler);
      }
    };

    return { promise, cleanup };
  };

  return createPromiseWithCleanup();
}

/**
 * Создает Promise с таймаутом
 * @public
 */
export function createTimeoutPromise(
  timeoutMs: number,
  message: string = DEFAULT_TIMEOUT_MESSAGE,
): CancellablePromise<never> {
  const createPromiseWithCleanup = (): CancellablePromise<never> => {
    // Используем объект для хранения timeoutId, чтобы cleanup мог получить к нему доступ
    const timeoutState: { id: ReturnType<typeof setTimeout> | null; } = { id: null };

    const promise = new Promise<never>((_resolve, reject) => {
      // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- Мутация необходима для работы cleanup функции
      timeoutState.id = setTimeout(() => {
        reject(new AdapterTimeoutError(message));
      }, timeoutMs);
    });

    const cleanup = (): void => {
      if (timeoutState.id !== null) {
        clearTimeout(timeoutState.id);
      }
    };

    return { promise, cleanup };
  };

  return createPromiseWithCleanup();
}

/* ============================================================================
 * 5. HELPERS — EVENT EMISSION (DRY для событий)
 * ============================================================================
 */

/**
 * Отправляет событие адаптера (внутренний helper для устранения дублирования)
 * @note Использует startTime для всех событий для deterministic testing (все события имеют одинаковый timestamp = время старта)
 */
function emit(
  onEvent: AdapterEventHandler | undefined,
  type: AdapterEventType,
  timestamp: number,
  metadata?: Readonly<Record<string, unknown>>,
): void {
  if (onEvent) {
    onEvent({
      type,
      timestamp,
      ...(metadata ? { metadata } : {}),
    });
  }
}

/* ============================================================================
 * 6. ADAPTERS — RUNTIME ADAPTERS (Extensible Strategy Pattern)
 * ============================================================================
 */

/**
 * Создает generic адаптер runtime'а в PipelineEffect
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @template TRuntime - Тип исходного runtime эффекта (generic, runtime-agnostic)
 * @public
 */
/** Проверяет cancellation перед выполнением (внутренний helper для снижения cognitive complexity) */
function checkCancellationBeforeExecution<T>(
  signal: AbortSignal | undefined,
  onEvent: AdapterEventHandler | undefined,
  now: number,
): T | null {
  if (isAborted(signal)) {
    emit(onEvent, 'cancel', now, { reason: 'aborted_before_execution' });
    // eslint-disable-next-line fp/no-throw -- Cancellation требует прерывания выполнения
    throw new CancellationError();
  }
  return null;
}

/**
 * Проверяет cooperative cancellation (внутренний helper для снижения cognitive complexity)
 * @note Проверка выполняется только до запуска runtime эффекта.
 *       После старта cancellation обрабатывается только через AbortSignal.
 */
function checkCooperativeCancellation<T, TRuntime>(
  runtimeEffect: TRuntime,
  signal: AbortSignal | undefined,
  config: AdapterConfig<TRuntime>,
  onEvent: AdapterEventHandler | undefined,
  now: number,
): T | null {
  const shouldCancel = config.checkCancellation?.(runtimeEffect, signal);
  if (shouldCancel === true) {
    emit(onEvent, 'cancel', now, { reason: 'cooperative_cancellation' });
    config.cancelRuntime?.(runtimeEffect);
    // eslint-disable-next-line fp/no-throw -- Cancellation требует прерывания выполнения
    throw new CancellationError();
  }
  return null;
}

/**
 * Выполняет runtime эффект с обработкой ошибок (внутренний helper для снижения cognitive complexity)
 * @note Автоматически очищает listeners для предотвращения memory leak
 * @note Использует startTime для всех событий для deterministic testing (все события имеют одинаковый timestamp = время старта)
 */
async function executeRuntimeEffect<T>(
  runtimePromise: Promise<T>,
  abortPromise: CancellablePromise<never>,
  onEvent: AdapterEventHandler | undefined,
  startTime: number, // Timestamp старта для deterministic testing
): Promise<T> {
  try {
    const result = await Promise.race([runtimePromise, abortPromise.promise]);

    emit(onEvent, 'complete', startTime);

    return result;
  } catch (error: unknown) {
    emit(onEvent, 'error', startTime, {
      error: error instanceof Error ? error.message : String(error),
    });

    // Если ошибка связана с отменой, пробрасываем как есть
    if (isCancellationError(error)) {
      // eslint-disable-next-line fp/no-throw -- Cancellation требует прерывания выполнения
      throw error;
    }

    // Пробрасываем исходную ошибку
    // eslint-disable-next-line fp/no-throw -- Ошибка выполнения требует проброса
    throw error;
  } finally {
    // Очищаем listeners для предотвращения memory leak
    abortPromise.cleanup();
  }
}

export function createRuntimeAdapter<T, TRuntime>(
  config: AdapterConfig<TRuntime>, // Конфигурация адаптера
  onEvent?: AdapterEventHandler, // Callback для событий адаптации (опционально, для мониторинга)
  nowProvider: () => number = Date.now, // Функция получения текущего времени (injectable для тестирования)
): RuntimeAdapterFactory<T, TRuntime> { // Фабрика адаптера runtime'а
  return (runtimeEffect: TRuntime): PipelineEffect<T> => {
    return async (signal?: AbortSignal): Promise<T> => {
      const startTime = nowProvider();

      // Проверяем cancellation перед выполнением
      checkCancellationBeforeExecution(signal, onEvent, startTime);

      // Проверяем cooperative cancellation (если поддерживается runtime'ом)
      // @note Проверка выполняется только до запуска runtime эффекта.
      //       После старта cancellation обрабатывается только через AbortSignal.
      checkCooperativeCancellation(runtimeEffect, signal, config, onEvent, startTime);

      // Отправляем событие начала выполнения
      emit(onEvent, 'start', startTime);

      // Выполняем runtime эффект
      const runtimePromise = config.runRuntime(runtimeEffect) as Promise<T>;
      const { promise: abortPromise, cleanup: abortCleanup } = createAbortPromise(signal);

      return executeRuntimeEffect(
        runtimePromise,
        { promise: abortPromise, cleanup: abortCleanup },
        onEvent,
        startTime,
      );
    };
  };
}

/**
 * Создает адаптер с таймаутом
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @note При таймауте effectPromise продолжает выполняться в фоне (логический timeout).
 *       Для фактической cancellation передайте cancelEffect.
 * @public
 */
/**
 * Выполняет эффект с таймаутом (внутренний helper для снижения cognitive complexity)
 * @note Автоматически очищает listeners для предотвращения memory leak
 * @note Использует startTime для всех событий для deterministic testing (все события имеют одинаковый timestamp = время старта)
 */
async function executeWithTimeout<T>(
  effectPromise: Promise<T>,
  timeoutPromise: CancellablePromise<never>,
  abortPromise: CancellablePromise<never>,
  onEvent: AdapterEventHandler | undefined,
  startTime: number,
  timeoutMs: number,
  cancelEffect: (() => void) | undefined,
): Promise<T> {
  try {
    const result = await Promise.race([
      effectPromise,
      timeoutPromise.promise,
      abortPromise.promise,
    ]);

    emit(onEvent, 'complete', startTime);

    return result;
  } catch (error: unknown) {
    if (isAdapterTimeoutError(error) && cancelEffect) {
      cancelEffect();
    }

    emit(onEvent, 'error', startTime, {
      error: error instanceof Error ? error.message : String(error),
      timeout: timeoutMs,
    });

    // eslint-disable-next-line fp/no-throw -- Ошибка выполнения требует проброса
    throw error;
  } finally {
    timeoutPromise.cleanup();
    abortPromise.cleanup();
  }
}

export function withTimeout<T>(
  effect: PipelineEffect<T>, // Pipeline эффект для обертки
  timeoutMs: number, // Таймаут в миллисекундах
  onEvent?: AdapterEventHandler, // Callback для событий адаптации (опционально, для мониторинга)
  nowProvider: () => number = Date.now, // Функция получения текущего времени (injectable для тестирования)
  cancelEffect?: () => void, // Функция отмены эффекта при таймауте (опционально, для фактической cancellation)
): PipelineEffect<T> { // Pipeline эффект с таймаутом
  return async (signal?: AbortSignal): Promise<T> => {
    const startTime = nowProvider();

    checkCancellationBeforeExecution(signal, onEvent, startTime);

    if (onEvent) {
      onEvent({
        type: 'start',
        timestamp: startTime,
      });
    }

    const timeoutPromise = createTimeoutPromise(timeoutMs);
    const abortPromise = createAbortPromise(signal);
    const effectPromise = effect(signal);

    return executeWithTimeout(
      effectPromise,
      timeoutPromise,
      abortPromise,
      onEvent,
      startTime,
      timeoutMs,
      cancelEffect,
    );
  };
}

/* ============================================================================
 * 7. API — PUBLIC FUNCTIONS
 * ============================================================================
 */

/**
 * Адаптирует Effect library эффект в PipelineEffect
 * @template T - Тип результата эффекта (generic, domain-agnostic)
 * @public
 */
export function adaptEffectLibrary<T>(
  effectLibEffect: unknown, // Effect из библиотеки effect (типизирован как unknown для generic)
  runtime: {
    runPromise: (effect: unknown) => Promise<T>; // Runtime для выполнения Effect library эффекта
  }, // Runtime для выполнения Effect library эффекта (injectable для тестирования)
  onEvent?: AdapterEventHandler, // Callback для событий адаптации (опционально, для мониторинга)
  nowProvider: () => number = Date.now, // Функция получения текущего времени (injectable для тестирования)
): PipelineEffect<T> { // Pipeline эффект
  const config: AdapterConfig<unknown> = {
    runRuntime: (effect: unknown) => runtime.runPromise(effect),
  };

  const adapterFactory = createRuntimeAdapter<T, unknown>(config, onEvent, nowProvider);
  return adapterFactory(effectLibEffect);
}
