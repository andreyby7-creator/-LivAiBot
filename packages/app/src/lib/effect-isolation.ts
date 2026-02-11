/**
 * @file packages/app/src/lib/effect-isolation.ts
 * ============================================================================
 * 🛡️ EFFECT ISOLATION — ИЗОЛЯЦИЯ ОШИБОК И ПРЕДОТВРАЩЕНИЕ CASCADING FAILURES
 * ============================================================================
 *
 * Минимальный, чистый boundary-модуль для изоляции ошибок и предотвращения
 * cascading failures в multi-agent orchestration.
 *
 * Архитектурная роль:
 * - Изолирует ошибки через try/catch boundary
 * - Предотвращает cascading failures
 * - Обеспечивает типобезопасную обработку через Result<T, E>
 * - Безопасность для multi-agent orchestration
 *
 * Принципы:
 * - Zero business logic
 * - Zero telemetry (telemetry → observability layer)
 * - Zero orchestration (orchestration → orchestrator)
 * - Zero error mapping (error mapping → error-mapping layer)
 * - Zero fallback logic (fallback → business logic layer)
 * - Детерминированное поведение
 * - Полная изоляция ошибок
 */

import type { Effect, Result } from './effect-utils.js';
import { fail, ok } from './effect-utils.js';

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/**
 * Ошибка изоляции эффекта.
 * Типизированная boundary error для идентификации изолированных ошибок.
 */
export class IsolationError extends Error {
  /** Исходная ошибка, которая была изолирована */
  readonly originalError: unknown;

  /** Опциональный тег для идентификации изоляции в логах и телеметрии */
  readonly tag?: string | undefined;

  constructor(originalError: unknown, tag?: string | undefined) {
    const errorMessage = originalError instanceof Error
      ? originalError.message
      : String(originalError);
    const normalizedTag = String(tag ?? '');
    const message = normalizedTag !== ''
      ? `Effect isolation error (tag: ${normalizedTag}): ${errorMessage}`
      : `Effect isolation error: ${errorMessage}`;
    super(message);
    this.name = 'IsolationError';
    this.originalError = originalError;
    this.tag = normalizedTag !== '' ? normalizedTag : undefined;

    // Сохраняем stack trace исходной ошибки, если она была Error
    if (
      originalError instanceof Error && originalError.stack != null && originalError.stack !== ''
    ) {
      this.stack = `IsolationError: ${this.message}\n${originalError.stack}`;
    }
  }
}

/**
 * Опции для изоляции эффекта.
 */
export type IsolationOptions = {
  /** Опциональный тег для идентификации изоляции в логах и телеметрии */
  readonly tag?: string | undefined;
};

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/**
 * Type guard для проверки, является ли ошибка IsolationError.
 * Используется для orchestration и обработки изолированных ошибок.
 */
export function isIsolationError(error: unknown): error is IsolationError {
  return error instanceof IsolationError;
}

/* ============================================================================
 * 🎯 ОСНОВНОЙ API
 * ========================================================================== */

/**
 * Выполняет эффект в изолированном контексте, предотвращая cascading failures.
 *
 * Все ошибки изолируются и возвращаются как Result<T, IsolationError>,
 * что обеспечивает типобезопасную обработку без исключений.
 *
 * @param effect - Эффект для выполнения
 * @param options - Опции изоляции (опционально)
 * @returns Result с успешным значением или IsolationError
 *
 * @example
 * ```ts
 * // Базовое использование
 * const result = await runIsolated(async () => {
 *   return await riskyOperation();
 * }, { tag: 'user-fetch' });
 *
 * if (isOk(result)) {
 *   console.log('Success:', result.value);
 * } else {
 *   console.error('Isolated error:', result.error);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Chaining нескольких runIsolated для предотвращения cascading failures
 * // Если первый эффект падает, второй всё равно выполнится
 * const step1 = await runIsolated(async () => {
 *   return await fetchUserData();
 * }, { tag: 'step1' });
 *
 * const step2 = await runIsolated(async () => {
 *   return await fetchUserPreferences();
 * }, { tag: 'step2' });
 *
 * // Ошибка в step1 не влияет на step2 - это предотвращает cascading failure
 * // Оба результата можно обработать независимо
 * if (isOk(step1)) {
 *   console.log('User data:', step1.value);
 * }
 * if (isOk(step2)) {
 *   console.log('Preferences:', step2.value);
 * }
 * ```
 */
export async function runIsolated<T>(
  effect: Effect<T>,
  options?: IsolationOptions,
): Promise<Result<T, IsolationError>> {
  // В development режиме проверяем тип effect для раннего обнаружения programmer errors
  if (process.env['NODE_ENV'] === 'development') {
    if (typeof effect !== 'function') {
      throw new TypeError(
        `[effect-isolation] runIsolated: effect must be a function, got ${typeof effect}`,
      );
    }
  }

  const { tag } = options ?? {};
  const normalizedTag = String(tag ?? '');

  try {
    const value = await effect();
    return ok(value);
  } catch (error: unknown) {
    // Изолируем любую ошибку в IsolationError
    // Это предотвращает cascading failures и обеспечивает типобезопасность
    const isolationError = new IsolationError(
      error,
      normalizedTag !== '' ? normalizedTag : undefined,
    );
    return fail(isolationError);
  }
}
