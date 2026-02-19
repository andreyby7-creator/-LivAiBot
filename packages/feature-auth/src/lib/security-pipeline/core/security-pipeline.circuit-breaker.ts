/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.circuit-breaker.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Circuit Breaker / SLA Isolation)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Circuit breaker для внешнего risk provider
 * - Cooldown и error budget для защиты от cascade failures
 * - Причина изменения: external service reliability / SLA management
 *
 * Принципы:
 * - ✅ Fail-fast — быстрое обнаружение проблем
 * - ✅ Auto-recovery — автоматическое восстановление
 * - ✅ Error budget — контроль ошибок в рамках SLA
 * - ✅ Isolation — изоляция внешнего сервиса от основного flow
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Состояние circuit breaker
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Конфигурация circuit breaker
 */
export type CircuitBreakerConfig = {
  /** Порог ошибок для открытия circuit (процент) */
  readonly failureThreshold: number; // 0-100
  /** Минимальное количество запросов для оценки */
  readonly minRequests: number;
  /** Время в открытом состоянии (cooldown) в миллисекундах */
  readonly openDurationMs: number;
  /** Время для half-open состояния в миллисекундах */
  readonly halfOpenDurationMs: number;
  /** Timeout для запросов в миллисекундах */
  readonly requestTimeoutMs: number;
  /** Error budget (максимальное количество ошибок за период) */
  readonly errorBudget: number;
  /** Период для error budget в миллисекундах */
  readonly errorBudgetWindowMs: number;
};

/**
 * Состояние circuit breaker с метриками
 */
export type CircuitBreakerStateWithMetrics = {
  /** Текущее состояние */
  readonly state: CircuitBreakerState;
  /** Количество успешных запросов */
  readonly successCount: number;
  /** Количество неуспешных запросов */
  readonly failureCount: number;
  /** Timestamp последнего изменения состояния */
  readonly lastStateChange: number;
  /** Количество ошибок в текущем error budget окне */
  readonly errorsInWindow: number;
  /** Timestamp начала текущего error budget окна */
  readonly errorBudgetWindowStart: number;
};

/**
 * Результат проверки circuit breaker
 */
export type CircuitBreakerResult = {
  /** Можно ли выполнить запрос */
  readonly allowRequest: boolean;
  /** Причина блокировки (если запрос заблокирован) */
  readonly blockReason?: string;
  /** Текущее состояние */
  readonly state: CircuitBreakerState;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтная конфигурация circuit breaker */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Constant for default circuit breaker config
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 50.0, // 50% ошибок → открыть circuit
  minRequests: 10, // Минимум 10 запросов для оценки
  openDurationMs: 60_000, // 1 минута в открытом состоянии
  halfOpenDurationMs: 30_000, // 30 секунд в half-open
  requestTimeoutMs: 5_000, // 5 секунд timeout
  errorBudget: 100, // Максимум 100 ошибок за период
  errorBudgetWindowMs: 300_000, // 5 минут окно для error budget
};

/* ============================================================================
 * 🎯 CIRCUIT BREAKER FUNCTIONS
 * ============================================================================
 */

/**
 * Проверяет, можно ли выполнить запрос через circuit breaker
 */
export function checkCircuitBreaker(
  currentState: CircuitBreakerStateWithMetrics,
  config: CircuitBreakerConfig,
): CircuitBreakerResult {
  const now = Date.now();

  // Проверяем error budget
  if (currentState.errorsInWindow >= config.errorBudget) {
    return {
      allowRequest: false,
      blockReason: `Error budget exceeded: ${currentState.errorsInWindow}/${config.errorBudget}`,
      state: 'open',
    };
  }

  // Проверяем состояние circuit breaker
  switch (currentState.state) {
    case 'closed': {
      // Circuit закрыт - разрешаем запросы
      return {
        allowRequest: true,
        state: 'closed',
      };
    }

    case 'open': {
      // Circuit открыт - проверяем, прошло ли время cooldown
      const timeSinceOpen = now - currentState.lastStateChange;
      if (timeSinceOpen >= config.openDurationMs) {
        // Переходим в half-open
        return {
          allowRequest: true,
          state: 'half-open',
        };
      }

      return {
        allowRequest: false,
        blockReason: `Circuit breaker is open (cooldown: ${
          config.openDurationMs - timeSinceOpen
        }ms remaining)`,
        state: 'open',
      };
    }

    case 'half-open': {
      // Circuit в half-open - разрешаем ограниченное количество запросов
      const timeSinceHalfOpen = now - currentState.lastStateChange;
      if (timeSinceHalfOpen >= config.halfOpenDurationMs) {
        // Если прошло время half-open без успешных запросов, возвращаемся в open
        return {
          allowRequest: false,
          blockReason: 'Half-open duration expired without success',
          state: 'open',
        };
      }

      return {
        allowRequest: true,
        state: 'half-open',
      };
    }

    default: {
      // Неизвестное состояние - блокируем для безопасности
      return {
        allowRequest: false,
        blockReason: 'Unknown circuit breaker state',
        state: 'open',
      };
    }
  }
}

/**
 * Обновляет error budget окно
 */
function updateErrorBudgetWindow(
  currentState: CircuitBreakerStateWithMetrics,
  config: CircuitBreakerConfig,
  now: number,
): { errorsInWindow: number; errorBudgetWindowStart: number; } {
  let errorsInWindow = currentState.errorsInWindow;
  let errorBudgetWindowStart = currentState.errorBudgetWindowStart;

  // Если окно истекло, сбрасываем счетчик
  if (now - errorBudgetWindowStart >= config.errorBudgetWindowMs) {
    errorsInWindow = 0;
    errorBudgetWindowStart = now;
  }

  return { errorsInWindow, errorBudgetWindowStart };
}

/**
 * Определяет новое состояние circuit breaker на основе результата запроса
 */
function determineNewState(
  currentState: CircuitBreakerState,
  success: boolean,
  successCount: number,
  failureCount: number,
  config: CircuitBreakerConfig,
  now: number,
): { state: CircuitBreakerState; lastStateChange: number; resetCounters: boolean; } {
  const totalRequests = successCount + failureCount;
  const failureRate = totalRequests > 0 ? (failureCount / totalRequests) * 100 : 0;

  switch (currentState) {
    case 'closed': {
      // Проверяем, нужно ли открыть circuit
      if (
        totalRequests >= config.minRequests
        && failureRate >= config.failureThreshold
      ) {
        return { state: 'open', lastStateChange: now, resetCounters: false };
      }
      return { state: 'closed', lastStateChange: now, resetCounters: false };
    }

    case 'half-open': {
      if (success) {
        // Успешный запрос в half-open → закрываем circuit и сбрасываем счетчики
        return { state: 'closed', lastStateChange: now, resetCounters: true };
      }
      // Неуспешный запрос в half-open → открываем circuit
      return { state: 'open', lastStateChange: now, resetCounters: false };
    }

    case 'open': {
      // В открытом состоянии не обновляем счетчики
      return { state: 'open', lastStateChange: now, resetCounters: false };
    }

    default: {
      return { state: 'open', lastStateChange: now, resetCounters: false };
    }
  }
}

/**
 * Обновляет состояние circuit breaker после запроса
 */
export function updateCircuitBreakerState(
  currentState: CircuitBreakerStateWithMetrics,
  success: boolean,
  config: CircuitBreakerConfig,
): CircuitBreakerStateWithMetrics {
  const now = Date.now();

  // Обновляем error budget окно
  const { errorsInWindow, errorBudgetWindowStart } = updateErrorBudgetWindow(
    currentState,
    config,
    now,
  );

  // Обновляем счетчики
  const newSuccessCount = success ? currentState.successCount + 1 : currentState.successCount;
  const newFailureCount = success ? currentState.failureCount : currentState.failureCount + 1;

  // Обновляем error budget
  const updatedErrorsInWindow = !success ? errorsInWindow + 1 : errorsInWindow;

  // Определяем новое состояние
  const { state: newState, lastStateChange, resetCounters } = determineNewState(
    currentState.state,
    success,
    newSuccessCount,
    newFailureCount,
    config,
    now,
  );

  // Если нужно сбросить счетчики (успешное восстановление из half-open)
  if (resetCounters) {
    return {
      state: 'closed',
      successCount: 0,
      failureCount: 0,
      lastStateChange,
      errorsInWindow: updatedErrorsInWindow,
      errorBudgetWindowStart,
    };
  }

  return {
    state: newState,
    successCount: newSuccessCount,
    failureCount: newFailureCount,
    lastStateChange,
    errorsInWindow: updatedErrorsInWindow,
    errorBudgetWindowStart,
  };
}

/**
 * Создает начальное состояние circuit breaker
 */
export function createInitialCircuitBreakerState(): CircuitBreakerStateWithMetrics {
  const now = Date.now();
  return {
    state: 'closed',
    successCount: 0,
    failureCount: 0,
    lastStateChange: now,
    errorsInWindow: 0,
    errorBudgetWindowStart: now,
  };
}
