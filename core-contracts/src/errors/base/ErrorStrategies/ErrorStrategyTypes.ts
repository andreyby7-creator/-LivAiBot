/**
 * @file ErrorStrategyTypes.ts - Типы и константы для стратегий обработки ошибок
 */

import type { Effect } from 'effect';

import type { LivAiErrorCode } from '../ErrorCode.js';

// Реэкспортируем тип для использования в других модулях
export type { LivAiErrorCode };

// ==================== КОНСТАНТЫ ====================

/** Конфигурация повторов */
export const RETRY = {
  DEFAULT_MAX: 3,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 5,
} as const;

/** Пороги alert */
export const ALERT_THRESHOLDS = {
  LOW: 2,
  MEDIUM: 3,
  DEFAULT: 5,
} as const;

/** Конфигурация circuit breaker */
export const CIRCUIT_BREAKER = {
  DEFAULT_THRESHOLD: 10,
  RECOVERY_TIMEOUT_MS: 60000,
} as const;

// ==================== ТИПЫ СТРАТЕГИЙ ====================

/** Результат выполнения стратегии */
export type StrategyResult =
  | { success: true; data: unknown; strategy: string; }
  | { success: false; error: Error; strategy: string; shouldRetry: boolean; };

/** Базовая стратегия обработки ошибок */
export type ErrorStrategy<E = unknown> = {
  readonly name: string;
  readonly description: string;
  readonly priority: number;
  readonly applicableCodes?: readonly LivAiErrorCode[];
  readonly execute: (
    error: E,
    context?: Record<string, unknown>,
  ) => Effect.Effect<StrategyResult, unknown, unknown>;
};

/** Модификатор стратегии */
export type StrategyModifier<E> = (
  strategy: ErrorStrategy<E>,
) => ErrorStrategy<E>;

/** Конфигурация стратегии */
export type StrategyConfig = {
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly circuitBreakerThreshold: number;
  readonly alertThreshold: number;
  readonly fallbackEnabled: boolean;
};

/** Группа кодов ошибок по префиксу */
export type ErrorCodeGroup = {
  readonly prefix: string;
  readonly description: string;
  readonly codes: readonly LivAiErrorCode[];
  readonly strategy: ErrorStrategy;
};
