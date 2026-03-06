/**
 * @file packages/core/src/effect/effect-timeout.ts
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
 * - Расширяет EffectContext метаданными (timeoutMs, timeoutSource)
 *
 * Принципы:
 * - Zero business logic
 * - Zero telemetry (telemetry → observability layer)
 * - Zero orchestration (orchestration → orchestrator)
 * - Безопасная отмена без утечек ресурсов
 * - Детерминированное поведение
 * ⚠️ Важно: Расширение метаданными EffectContext (timeoutMs, timeoutSource)
 * делается в `effect-timeout.ts`, НЕ в `effect-utils.ts` — чтобы сохранить
 * domain-agnostic принцип и соблюсти SRP.
 */

import type { Effect, EffectContext } from './effect-utils.js';
import { combineAbortSignals } from './effect-utils.js';

/* eslint-disable functional/no-classes, functional/no-this-expressions, fp/no-mutation, functional/immutable-data, fp/no-throw */
// В этом модуле допустимы классы и ограниченные мутации/throw: нужна корректная семантика boundary-errors (stack trace/instanceof),
// детерминированный таймаут (explicit state для защиты от race) и корректная propagation cancellation через AbortSignal.

/* ============================================================================
 * 🔢 КОНСТАНТЫ
 * ========================================================================== */

const DEFAULT_MIN_TIMEOUT_MS = 100;
const DEFAULT_MAX_TIMEOUT_MS = 300_000; // 5 минут

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/** Конфигурация timeout для Effect. */
export interface TimeoutOptions {
  /** Timeout в миллисекундах */
  readonly timeoutMs: number;

  /** Опциональный тег для идентификации timeout в логах и телеметрии */
  readonly tag?: string | undefined;
}

/**
 * Расширенный EffectContext с метаданными timeout.
 * Расширение метаданными делается в effect-timeout.ts для соблюдения SRP.
 */
// Расширение EffectContext для domain-специфичных эффектов с таймаутом
export type TimeoutEffectContext = EffectContext & {
  /** Timeout в миллисекундах, применённый к эффекту */
  readonly timeoutMs?: number | undefined;

  /** Источник timeout для трассировки и идентификации timeout в логах и телеметрии */
  readonly timeoutSource?: string | undefined;
};

/**
 * Ошибка превышения времени ожидания.
 * Типизированная boundary error с метаданными timeout.
 */
export class TimeoutError extends Error {
  /** Discriminator для rule-engines и type-safe detection */
  readonly kind = 'TimeoutError' as const;

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
function validateTimeoutMs(
  timeoutMs: number,
  minMs: number = DEFAULT_MIN_TIMEOUT_MS,
  maxMs: number = DEFAULT_MAX_TIMEOUT_MS,
): number {
  return Math.min(Math.max(timeoutMs, minMs), maxMs);
}

/* ============================================================================
 * 🎯 ОСНОВНАЯ ФУНКЦИЯ
 * ========================================================================== */

/**
 * Оборачивает `Effect<T>` в deterministic timeout с корректной Abort-propagation.
 * Возвращаемый эффект принимает `signal?: AbortSignal`, который объединяется с внутренним `timeoutSignal`.
 * @param effect - Эффект для оборачивания (поддерживает `AbortSignal`)
 * @param options - `timeoutMs` (мс), опционально `tag` (для идентификации и сообщения `TimeoutError`)
 * @returns Effect с timeout
 */
export function withTimeout<T>(
  effect: Effect<T>,
  options: TimeoutOptions,
): Effect<T> {
  const { timeoutMs, tag } = options;
  const validatedTimeoutMs = validateTimeoutMs(timeoutMs);

  return async (signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted === true) {
      // Standard web AbortError shape (привычно для fetch/AbortController)
      throw new DOMException('Aborted', 'AbortError');
    }

    // Создаём AbortController для timeout
    const timeoutController = new AbortController();
    const timeoutSignal = timeoutController.signal;

    // Объединяем внешний signal и timeout signal
    const combinedSignal = signal != null
      ? combineAbortSignals([signal, timeoutSignal])
      : timeoutSignal;

    const timeoutState: { didTimeout: boolean; completed: boolean; } = {
      didTimeout: false,
      completed: false,
    };
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout((): void => {
      if (timeoutState.completed) {
        return;
      }
      timeoutState.didTimeout = true;
      timeoutController.abort();
    }, validatedTimeoutMs);

    try {
      // Выполняем effect с объединённым signal
      return await effect(combinedSignal);
    } catch (error: unknown) {
      // Timeout определяется через явное состояние, а не через aborted флаг (исключает race)
      if (timeoutState.didTimeout) {
        throw new TimeoutError(validatedTimeoutMs, tag);
      }
      // Пробрасываем другие ошибки
      throw error;
    } finally {
      timeoutState.completed = true;
      // Очищаем timeout для предотвращения утечек
      clearTimeout(timeoutId);
    }
  };
}

/* eslint-enable functional/no-classes, functional/no-this-expressions, fp/no-mutation, functional/immutable-data, fp/no-throw */

/**
 * Создаёт расширенный EffectContext с метаданными timeout.
 * Расширение метаданными делается в effect-timeout.ts для соблюдения SRP.
 * @param baseContext - Базовый контекст эффекта (опционально)
 * @param timeoutMs - Timeout в миллисекундах, применённый к эффекту
 * @param timeoutSource - Источник timeout для трассировки и идентификации timeout в логах и телеметрии (опционально)
 * @returns Расширенный контекст с метаданными timeout
 */
export function createTimeoutContext(
  baseContext: EffectContext | undefined,
  timeoutMs: number,
  timeoutSource?: string | undefined,
): TimeoutEffectContext {
  return {
    ...baseContext,
    timeoutMs,
    ...(timeoutSource != null && { timeoutSource }),
  };
}
