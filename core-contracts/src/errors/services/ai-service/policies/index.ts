/**
 * @file index.ts - Экспорт политик AI service
 *
 * Специализированные политики для обработки ошибок и восстановления.
 * Включает стратегии fallback, retry, circuit breaker.
 */

// ==================== MODEL FALLBACK POLICY ====================

export type {
  ModelFallbackPolicyContext,
  ModelAlternative,
  ModelSelectionConstraints,
  UserContext,
  ModelFallbackPolicyResult,
  ModelFallbackPolicyError,
} from './modelFallbackPolicy.js';

export {
  selectFallbackModel,
  createModelFallbackPolicyError,
  isModelFallbackPolicyError,
  getModelFallbackPriority,
  canUseAsFallback,
} from './modelFallbackPolicy.js';

export type {
  TokenRetryPolicyContext,
  UserQuotaContext,
  TokenRetryPolicyResult,
  RetryStrategy,
  TokenRetryPolicyError,
  IModelAlternativesService,
  ModelAlternativeChain,
  ModelAlternativeOption,
} from './tokenRetryPolicy.js';

export type { ILogger as TokenRetryLogger } from './tokenRetryPolicy.js';

export {
  TokenType,
  TokenAlternativeReason,
} from './tokenRetryPolicy.js';

export {
  shouldRetryOnTokenExhaustion,
  evaluateTokenRetryPolicy,
  createTokenRetryPolicyError,
  isTokenRetryPolicyError,
  getOptimalRetryDelay,
  canRetryWithTokens,
} from './tokenRetryPolicy.js';

// ==================== CIRCUIT BREAKER POLICY ====================

export type {
  CircuitBreakerContext,
  CircuitBreakerConfig,
  CircuitBreakerResult,
  CircuitBreakerStateData,
  CircuitBreakerError,
} from './apiCircuitBreakerPolicy.js';

export {
  CircuitBreakerState,
  CircuitBreakerTrigger,
} from './apiCircuitBreakerPolicy.js';

export type { ILogger } from './apiCircuitBreakerPolicy.js';

export {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
  createCircuitBreakerError,
  isCircuitBreakerError,
} from './apiCircuitBreakerPolicy.js';
