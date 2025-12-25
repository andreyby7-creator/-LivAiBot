/**
 * @file apiCircuitBreakerPolicy.ts
 * Circuit breaker для защиты Yandex AI API от каскадных сбоев
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/* ========================== CONSTANTS ========================== */

/** Дефолтные параметры circuit breaker */
const CIRCUIT_BREAKER_DEFAULTS = {
  failureThreshold: 5,
  recoveryTimeoutMs: 60_000,
  successThreshold: 3,
  maxTestRequests: 10,
  ttlMs: 3_600_000,
} as const;

/* ========================== ENUMS ========================== */

/** Состояния circuit breaker */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/** Причины переходов состояния */
export enum CircuitBreakerTrigger {
  FAILURE_THRESHOLD = 'failure_threshold',
  RECOVERY_TIMEOUT = 'recovery_timeout',
  MANUAL = 'manual',
}

/** Тип перехода */
enum TransitionType {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

/* ========================== TYPES ========================== */

/** Конфигурация circuit breaker */
export type CircuitBreakerConfig = {
  readonly failureThreshold?: number;
  readonly recoveryTimeoutMs?: number;
  readonly successThreshold?: number;
  readonly maxTestRequests?: number;
  readonly ttlMs?: number;
};

/** Контекст проверки */
export type CircuitBreakerContext = {
  readonly type: 'circuit_breaker_policy';
  readonly serviceId: string;
  readonly currentTime: number;
  readonly config?: CircuitBreakerConfig;
  readonly logger?: ILogger;
};

/** Состояние circuit breaker */
export type CircuitBreakerStateData = {
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly successCount: number;
  readonly testRequestCount: number;
  readonly lastFailureTime?: number;
  readonly lastUpdateTime: number;
  readonly lastTrigger?: CircuitBreakerTrigger;
};

/** Результат проверки */
export type CircuitBreakerResult = {
  readonly shouldAllow: boolean;
  readonly state: CircuitBreakerState;
  readonly nextRetryTime?: number;
  readonly failureCount: number;
  readonly successCount: number;
  readonly testRequestCount: number;
  readonly reason?: string;
  readonly recommendations?: readonly string[];
  readonly lastTrigger?: CircuitBreakerTrigger | undefined;
};

/** Логгер */
export type ILogger = {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
};

/** Ошибка circuit breaker */
export type CircuitBreakerError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly severity: typeof ERROR_SEVERITY.MEDIUM | typeof ERROR_SEVERITY.HIGH;
  readonly type: 'circuit_breaker_error';
  readonly code: ErrorCode;
  readonly context: CircuitBreakerContext;
  readonly result: CircuitBreakerResult;
  readonly message: string;
  readonly timestamp: string;
  readonly stack?: string | undefined;
}, 'CircuitBreakerError'>;

/* ========================== STORAGE ========================== */

/** Интерфейс хранилища состояний */
type CircuitBreakerStorage = {
  get(serviceId: string): CircuitBreakerStateData | undefined;
  set(serviceId: string, state: CircuitBreakerStateData): void;
  delete(serviceId: string): void;
};

/** In-memory storage с иммутабельностью */
const createInMemoryCircuitBreakerStorage = (): CircuitBreakerStorage => {
  let state: Record<string, CircuitBreakerStateData> = {};

  return {
    get(serviceId: string): CircuitBreakerStateData | undefined {
      if (!Object.hasOwn(state, serviceId)) return undefined;
      const keys = Object.keys(state);
      if (!keys.includes(serviceId)) return undefined;
      const value = Reflect.get(state, serviceId) as CircuitBreakerStateData | undefined;
      return value ? { ...value } : undefined;
    },

    set(serviceId: string, stateData: CircuitBreakerStateData): void {
      state = { ...state, [serviceId]: { ...stateData } };
    },

    delete(serviceId: string): void {
      const { [serviceId]: deletedItem, ...rest } = state;
      // deletedItem is intentionally unused - we just want to remove it
      void deletedItem;
      state = rest;
    },
  };
};

/* ========================== MANAGER ========================== */

type CircuitBreakerServices = {
  readonly storage: CircuitBreakerStorage;
  readonly logger: ILogger;
  readonly onTransition?: (
    from: CircuitBreakerState,
    to: CircuitBreakerState,
    trigger?: CircuitBreakerTrigger,
  ) => void;
};

/** Менеджер circuit breaker */
class CircuitBreakerManager {
  constructor(private readonly services: CircuitBreakerServices) {}

  /** Получает актуальное состояние с учетом TTL */
  private getState(
    serviceId: string,
    config: CircuitBreakerConfig,
    now: number,
  ): CircuitBreakerStateData {
    const ttl = config.ttlMs ?? CIRCUIT_BREAKER_DEFAULTS.ttlMs;
    const stored = this.services.storage.get(serviceId);

    if (!stored || now - stored.lastUpdateTime > ttl) {
      const fresh: CircuitBreakerStateData = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        testRequestCount: 0,
        lastUpdateTime: now,
      };
      this.services.storage.set(serviceId, fresh);
      return fresh;
    }

    return stored;
  }

  /** Выполняет переход состояния */
  private transition(
    serviceId: string,
    type: TransitionType,
    config: CircuitBreakerConfig,
    logger: ILogger,
  ): void {
    const now = Date.now();
    const state = this.getState(serviceId, config, now);

    const failureThreshold = config.failureThreshold ?? CIRCUIT_BREAKER_DEFAULTS.failureThreshold;
    const successThreshold = config.successThreshold ?? CIRCUIT_BREAKER_DEFAULTS.successThreshold;

    let next: CircuitBreakerStateData = state;

    if (type === TransitionType.SUCCESS) {
      if (state.state === CircuitBreakerState.HALF_OPEN) {
        const successCount = state.successCount + 1;
        next = successCount >= successThreshold
          ? {
            state: CircuitBreakerState.CLOSED,
            failureCount: 0,
            successCount: 0,
            testRequestCount: 0,
            lastUpdateTime: now,
            lastTrigger: CircuitBreakerTrigger.RECOVERY_TIMEOUT,
          }
          : { ...state, successCount, lastUpdateTime: now };
      } else if (state.failureCount > 0) {
        next = { ...state, failureCount: 0, lastUpdateTime: now };
      }
    } else {
      const failureCount = state.failureCount + 1;

      if (
        state.state === CircuitBreakerState.CLOSED
        && failureCount >= failureThreshold
      ) {
        next = {
          ...state,
          state: CircuitBreakerState.OPEN,
          failureCount,
          lastFailureTime: now,
          lastUpdateTime: now,
          lastTrigger: CircuitBreakerTrigger.FAILURE_THRESHOLD,
        };
      } else if (state.state === CircuitBreakerState.HALF_OPEN) {
        next = {
          ...state,
          state: CircuitBreakerState.OPEN,
          failureCount,
          successCount: 0,
          testRequestCount: 0,
          lastFailureTime: now,
          lastUpdateTime: now,
          lastTrigger: CircuitBreakerTrigger.FAILURE_THRESHOLD,
        };
      } else {
        next = { ...state, failureCount, lastUpdateTime: now };
      }
    }

    this.services.storage.set(serviceId, next);

    // Observability callback
    this.services.onTransition?.(state.state, next.state, next.lastTrigger);

    const log = logger;
    const transitionLog = { serviceId, from: state.state, to: next.state };

    // Выбираем уровень логирования в зависимости от типа перехода
    if (state.state === CircuitBreakerState.CLOSED && next.state === CircuitBreakerState.OPEN) {
      log.error('Circuit breaker transition: service failure detected', transitionLog);
    } else if (
      (state.state === CircuitBreakerState.OPEN && next.state === CircuitBreakerState.HALF_OPEN)
      || (state.state === CircuitBreakerState.HALF_OPEN && next.state === CircuitBreakerState.OPEN)
    ) {
      log.warn('Circuit breaker transition: recovery attempt', transitionLog);
    } else if (
      state.state === CircuitBreakerState.HALF_OPEN && next.state === CircuitBreakerState.CLOSED
    ) {
      log.info('Circuit breaker transition: service recovered successfully', transitionLog);
    } else {
      log.info('Circuit breaker transition', transitionLog);
    }
  }

  /** Проверяет, разрешён ли запрос */
  public shouldAllow(context: CircuitBreakerContext): CircuitBreakerResult {
    const { serviceId, currentTime, config = {}, logger = this.services.logger } = context;
    const state = this.getState(serviceId, config, currentTime);
    const recoveryTimeout = config.recoveryTimeoutMs ?? CIRCUIT_BREAKER_DEFAULTS.recoveryTimeoutMs;
    const maxTests = config.maxTestRequests ?? CIRCUIT_BREAKER_DEFAULTS.maxTestRequests;

    if (state.state === CircuitBreakerState.OPEN) {
      const retryAt = (state.lastFailureTime ?? 0) + recoveryTimeout;
      if (currentTime >= retryAt) {
        this.services.storage.set(serviceId, {
          ...state,
          state: CircuitBreakerState.HALF_OPEN,
          successCount: 0,
          testRequestCount: 0,
          lastUpdateTime: currentTime,
          lastTrigger: CircuitBreakerTrigger.RECOVERY_TIMEOUT,
        });
        return {
          shouldAllow: true,
          state: CircuitBreakerState.HALF_OPEN,
          failureCount: state.failureCount,
          successCount: state.successCount,
          testRequestCount: state.testRequestCount,
          lastTrigger: CircuitBreakerTrigger.RECOVERY_TIMEOUT,
        };
      }
      return {
        shouldAllow: false,
        state: CircuitBreakerState.OPEN,
        nextRetryTime: retryAt,
        failureCount: state.failureCount,
        successCount: state.successCount,
        testRequestCount: state.testRequestCount,
        lastTrigger: state.lastTrigger,
        reason: 'Circuit breaker is OPEN due to service failures',
        recommendations: [
          `Wait until ${new Date(retryAt).toISOString()} for automatic recovery`,
          'Consider checking service health',
          'Monitor failure patterns for this service',
        ],
      };
    }

    if (state.state === CircuitBreakerState.HALF_OPEN) {
      if (state.testRequestCount >= maxTests) {
        // Ограничение политики: превышен лимит тестовых запросов, не сбой сервиса
        // Используем тип перехода FAILURE для возврата в состояние OPEN
        this.transition(serviceId, TransitionType.FAILURE, config, logger);
        return {
          shouldAllow: false,
          state: CircuitBreakerState.OPEN,
          failureCount: state.failureCount,
          successCount: state.successCount,
          testRequestCount: state.testRequestCount,
          lastTrigger: state.lastTrigger,
          reason: 'Circuit breaker is OPEN: maximum test requests exceeded during HALF_OPEN state',
          recommendations: [
            'Circuit breaker will remain OPEN until recovery timeout',
            'Service may still be experiencing issues',
            'Consider implementing additional health checks',
          ],
        };
      }
      this.services.storage.set(serviceId, {
        ...state,
        testRequestCount: state.testRequestCount + 1,
        lastUpdateTime: currentTime,
      });
      return {
        shouldAllow: true,
        state: CircuitBreakerState.HALF_OPEN,
        failureCount: state.failureCount,
        successCount: state.successCount,
        testRequestCount: state.testRequestCount + 1,
        lastTrigger: state.lastTrigger,
      };
    }

    return {
      shouldAllow: true,
      state: CircuitBreakerState.CLOSED,
      failureCount: state.failureCount,
      successCount: state.successCount,
      testRequestCount: state.testRequestCount,
      lastTrigger: state.lastTrigger,
      reason: 'Circuit breaker is CLOSED: service is operating normally',
    };
  }

  public recordSuccess(serviceId: string, config: CircuitBreakerConfig, logger?: ILogger): void {
    this.transition(serviceId, TransitionType.SUCCESS, config, logger ?? this.services.logger);
  }

  public recordFailure(serviceId: string, config: CircuitBreakerConfig, logger?: ILogger): void {
    this.transition(serviceId, TransitionType.FAILURE, config, logger ?? this.services.logger);
  }
}

/* ========================== SINGLETON ========================== */

const manager = new CircuitBreakerManager({
  storage: createInMemoryCircuitBreakerStorage(),
  logger: console,
});

/* ========================== PUBLIC API ========================== */

export const shouldAllowRequest = (context: CircuitBreakerContext): CircuitBreakerResult =>
  manager.shouldAllow(context);

export const recordSuccess = (
  serviceId: string,
  config: CircuitBreakerConfig = {},
  logger?: ILogger,
): void => {
  manager.recordSuccess(serviceId, config, logger);
};

export const recordFailure = (
  serviceId: string,
  config: CircuitBreakerConfig = {},
  logger?: ILogger,
): void => {
  manager.recordFailure(serviceId, config, logger);
};

/** Создаёт ошибку circuit breaker */
export function createCircuitBreakerError(
  code: ErrorCode,
  context: CircuitBreakerContext,
  result: CircuitBreakerResult,
  message: string,
): CircuitBreakerError {
  // Эскалируем severity при исчерпании всех попыток
  const severity = result.reason === 'max_attempts_reached'
    ? ERROR_SEVERITY.HIGH
    : ERROR_SEVERITY.MEDIUM;

  return {
    _tag: 'CircuitBreakerError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.SERVICE,
    severity,
    type: 'circuit_breaker_error',
    code,
    message,
    context,
    result,
    timestamp: new Date().toISOString(),
    stack: new Error().stack ?? undefined,
  };
}

/** Type guard для circuit breaker ошибки */
export function isCircuitBreakerError(error: unknown): error is CircuitBreakerError {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'CircuitBreakerError'
  );
}
