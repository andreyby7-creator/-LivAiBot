/**
 * @file packages/core/src/effect/effect-isolation.ts
 * ============================================================================
 * 🛡️ EFFECT ISOLATION — ИЗОЛЯЦИЯ ОШИБОК И ПРЕДОТВРАЩЕНИЕ CASCADING FAILURES
 * ============================================================================
 *
 * Минимальный, чистый boundary-модуль для изоляции ошибок (исключений) эффекта
 * и снижения риска cascading failures в orchestration.
 * Архитектурная роль:
 * - Изолирует ошибки через try/catch boundary → возвращает Result вместо throw
 * - Помогает предотвращать cascading failures при корректной обработке Result на уровне orchestrator
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
 * - Изоляция runtime-ошибок эффекта (programmer errors в dev могут бросаться для раннего фейла)
 * - Не является sandbox для side-effects: изоляция здесь — про error boundary, а не про запрет мутаций
 */

import type { Effect, Result } from './effect-utils.js';
import { fail, ok } from './effect-utils.js';

/* eslint-disable functional/no-classes, fp/no-mutation, functional/no-this-expressions, fp/no-throw */
// В этом модуле допустимы классы/мутации/this/throw, потому что:
// - `IsolationError extends Error` нужен для корректного stack trace и `instanceof` (type-safe detection).
// - мутации `this.*` неизбежны в конструкторе Error-класса.
// - `throw TypeError` в dev — сознательный fail-fast для programmer errors (не для runtime ошибок эффекта).

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
export interface IsolationOptions {
  /** Опциональный тег для идентификации изоляции в логах и телеметрии */
  readonly tag?: string | undefined;
}

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
 * Все ошибки изолируются и возвращаются как Result<T, IsolationError>,
 * что обеспечивает типобезопасную обработку без исключений.
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
 * if (isOk(result)) {
 *   console.log('Success:', result.value);
 * } else {
 *   console.error('Isolated error:', result.error);
 * }
 * ```
 */
export async function runIsolated<T>(
  effect: Effect<T>,
  options?: IsolationOptions,
): Promise<Result<T, IsolationError>> {
  // В development режиме проверяем тип effect для раннего обнаружения programmer errors
  if (process.env['NODE_ENV'] === 'development' && typeof effect !== 'function') {
    throw new TypeError(
      `[effect-isolation] runIsolated: effect must be a function, got ${typeof effect}`,
    );
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

/* eslint-enable functional/no-classes, fp/no-mutation, functional/no-this-expressions, fp/no-throw */
