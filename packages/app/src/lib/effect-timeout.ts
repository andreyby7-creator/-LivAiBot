/**
 * @file packages/app/src/lib/effect-timeout.ts
 * ============================================================================
 * ⏱️ EFFECT TIMEOUT — ДЕТЕРМИНИСТИЧЕСКИЙ TIMEOUT ДЛЯ ЭФФЕКТОВ
 * ============================================================================
 *
 * Минимальный, чистый boundary-модуль для применения deterministic timeout
 * к Effect с корректной Abort-propagation.
 *
 * Архитектурная роль:
 * - Применяет timeout к Effect
 * - Бросает TimeoutError при превышении
 * - Корректно propagates AbortSignal
 * - Расширяет EffectContext метаданными (timeoutMs, source)
 *
 * Принципы:
 * - Zero business logic
 * - Zero telemetry (telemetry → observability layer)
 * - Zero orchestration (orchestration → orchestrator)
 * - Безопасная отмена без утечек ресурсов
 * - Детерминированное поведение
 *
 * ⚠️ Важно: Расширение метаданными EffectContext (timeoutMs, source)
 * делается в `effect-timeout.ts`, НЕ в `effect-utils.ts` — чтобы сохранить
 * domain-agnostic принцип и соблюсти SRP.
 */

import type { Effect, EffectContext } from './effect-utils.js';

/* ============================================================================
 * 🔢 КОНСТАНТЫ
 * ========================================================================== */

const DEFAULT_MIN_TIMEOUT_MS = 100;
const DEFAULT_MAX_TIMEOUT_MS = 300_000; // 5 минут

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/**
 * Конфигурация timeout для Effect.
 */
export type TimeoutOptions = {
  /** Timeout в миллисекундах */
  readonly timeoutMs: number;

  /** Опциональный тег для идентификации timeout в логах и телеметрии */
  readonly tag?: string | undefined;
};

/**
 * Расширенный EffectContext с метаданными timeout.
 * Расширение метаданными делается в effect-timeout.ts для соблюдения SRP.
 */
export type TimeoutEffectContext = EffectContext & {
  /** Timeout в миллисекундах, применённый к эффекту */
  readonly timeoutMs?: number | undefined;

  /** Источник timeout для трассировки и идентификации timeout в логах и телеметрии */
  readonly source?: string | undefined;
};

/**
 * Ошибка превышения времени ожидания.
 * Типизированная boundary error с метаданными timeout.
 */
export class TimeoutError extends Error {
  /** Timeout в миллисекундах, который был превышен */
  readonly timeoutMs: number;

  /** Опциональный тег timeout */
  readonly tag?: string | undefined;

  constructor(timeoutMs: number, tag?: string | undefined) {
    const message = tag != null
      ? `Effect execution timeout: ${timeoutMs}ms (tag: ${tag})`
      : `Effect execution timeout: ${timeoutMs}ms`;
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.tag = tag;
  }
}

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/**
 * Type guard для проверки, является ли ошибка TimeoutError.
 * Используется для orchestration и обработки timeout ошибок.
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Валидирует timeout в миллисекундах с проверкой min/max bounds.
 * Production-hardening для защиты от некорректных значений.
 */
export function validateTimeoutMs(
  timeoutMs: number,
  minMs: number = DEFAULT_MIN_TIMEOUT_MS,
  maxMs: number = DEFAULT_MAX_TIMEOUT_MS,
): number {
  if (timeoutMs < minMs) {
    // Логируем предупреждение только в development для дебага, без telemetry
    // В test окружении не логируем, чтобы не засорять вывод тестов
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.warn(
        `[effect-timeout] Timeout ${timeoutMs}ms is less than minimum ${minMs}ms, using ${minMs}ms`,
      );
    }
    return minMs;
  }
  if (timeoutMs > maxMs) {
    // Логируем предупреждение только в development для дебага, без telemetry
    // В test окружении не логируем, чтобы не засорять вывод тестов
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.warn(
        `[effect-timeout] Timeout ${timeoutMs}ms exceeds maximum ${maxMs}ms, using ${maxMs}ms`,
      );
    }
    return maxMs;
  }
  return timeoutMs;
}

/* ============================================================================
 * 🎯 ОСНОВНАЯ ФУНКЦИЯ
 * ========================================================================== */

/**
 * Оборачивает Effect в deterministic timeout с корректной Abort-propagation.
 *
 * Обеспечивает:
 * - 🔌 AbortController для безопасной отмены
 * - 🛡️ Безопасный cancel без утечек ресурсов
 * - ⏱️ Deterministic timeout — предсказуемое поведение
 * - 🔒 Abort propagation — корректная передача AbortSignal
 *
 * @param effect - Effect для оборачивания в timeout
 * @param options - Конфигурация timeout (timeoutMs, tag)
 * @returns Effect с применённым timeout
 */
export function withTimeout<T>(
  effect: Effect<T>,
  options: TimeoutOptions,
): Effect<T> {
  const { timeoutMs, tag } = options;
  const validatedTimeoutMs = validateTimeoutMs(timeoutMs);

  return async (signal?: AbortSignal): Promise<T> => {
    // Создаём AbortController для timeout
    const timeoutController = new AbortController();
    const timeoutSignal = timeoutController.signal;

    // Объединяем внешний signal и timeout signal
    const combinedSignal = signal != null
      ? combineAbortSignals([signal, timeoutSignal])
      : timeoutSignal;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      // Устанавливаем timeout
      timeoutId = setTimeout((): void => {
        timeoutController.abort();
      }, validatedTimeoutMs);

      // Выполняем effect с объединённым signal
      return await effect(combinedSignal);
    } catch (error: unknown) {
      // Проверяем, был ли это timeout (проверяем aborted после catch)
      if (timeoutSignal.aborted) {
        throw new TimeoutError(validatedTimeoutMs, tag);
      }
      // Пробрасываем другие ошибки
      throw error;
    } finally {
      // Очищаем timeout для предотвращения утечек
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  };
}

/**
 * Объединяет несколько AbortSignal в один.
 * Если любой из сигналов aborted, объединённый сигнал также aborted.
 * Использует { once: true } для автоматической очистки listeners.
 */
function combineAbortSignals(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const combinedSignal = controller.signal;

  // Если любой сигнал уже aborted, сразу abort
  if (signals.some((s) => s.aborted)) {
    controller.abort();
    return combinedSignal;
  }

  // Добавляем listeners для каждого сигнала с { once: true } для автоматической очистки
  signals.forEach((signal) => {
    const handler = (): void => {
      controller.abort();
    };
    signal.addEventListener('abort', handler, { once: true });
  });

  return combinedSignal;
}

/**
 * Создаёт расширенный EffectContext с метаданными timeout.
 * Расширение метаданными делается в effect-timeout.ts для соблюдения SRP.
 *
 * @param baseContext - Базовый контекст эффекта (опционально)
 * @param timeoutMs - Timeout в миллисекундах, применённый к эффекту
 * @param source - Источник timeout для трассировки и идентификации timeout в логах и телеметрии (опционально)
 * @returns Расширенный контекст с метаданными timeout
 */
export function createTimeoutContext(
  baseContext: EffectContext | undefined,
  timeoutMs: number,
  source?: string | undefined,
): TimeoutEffectContext {
  return {
    ...baseContext,
    timeoutMs,
    ...(source != null && { source }),
  };
}
