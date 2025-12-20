/**
 * @file ErrorStrategyBase.ts - Базовые стратегии обработки ошибок
 */

import { Effect } from 'effect';

import { RETRY } from './ErrorStrategyTypes.js';

import type { ErrorStrategy } from './ErrorStrategyTypes.js';

// ==================== BASE STRATEGIES ====================

/** Базовая стратегия - логирование и возврат ошибки */
export const LOG_AND_RETURN_STRATEGY: ErrorStrategy<unknown> = {
  name: 'log_and_return',
  description: 'Логирование ошибки и возврат без обработки',
  priority: 1,
  execute: (error: unknown) =>
    Effect.succeed({
      success: false,
      error: error as Error,
      strategy: 'log_and_return',
      shouldRetry: false,
    }),
};

/** Базовая стратегия - игнорирование ошибки */
export const IGNORE_STRATEGY: ErrorStrategy<unknown> = {
  name: 'ignore',
  description: 'Игнорирование ошибки без обработки',
  priority: 0,
  execute: () => Effect.succeed({ success: true, data: null, strategy: 'ignore' }),
};

/** Базовая стратегия - повтор попытки */
export const RETRY_STRATEGY: ErrorStrategy<unknown> = {
  name: 'retry',
  description: 'Повтор попытки с exponential backoff',
  priority: 3,
  execute: (error: unknown, context?: Record<string, unknown>) =>
    Effect.succeed({
      success: false,
      error: error as Error,
      strategy: 'retry',
      shouldRetry: ((context?.['attemptCount'] ?? 0) as number) < RETRY.DEFAULT_MAX,
    }),
};

/** Базовая стратегия - возврат дефолтного значения */
export const FALLBACK_STRATEGY: ErrorStrategy<unknown> = {
  name: 'fallback',
  description: 'Возврат дефолтного значения при ошибке',
  priority: 2,
  execute: (_error, context) =>
    Effect.succeed({
      success: true,
      data: context?.['defaultValue'] ?? null,
      strategy: 'fallback',
    }),
};

/** Базовая стратегия - генерация алерта */
export const ALERT_STRATEGY: ErrorStrategy<unknown> = {
  name: 'alert',
  description: 'Генерация алерта для мониторинга',
  priority: 4,
  execute: () =>
    Effect.succeed({
      success: false,
      error: new Error('Alert triggered'),
      strategy: 'alert',
      shouldRetry: false,
    }),
};
