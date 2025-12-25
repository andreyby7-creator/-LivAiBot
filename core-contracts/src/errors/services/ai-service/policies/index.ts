/**
 * @file index.ts - Экспорт политик AI service
 *
 * Специализированные политики для обработки ошибок и восстановления.
 * Включает стратегии fallback, retry, circuit breaker.
 */

// ==================== MODEL FALLBACK POLICY ====================

export type {
  ModelAlternative,
  ModelFallbackPolicyContext,
  ModelFallbackPolicyError,
  ModelFallbackPolicyResult,
  ModelSelectionConstraints,
  UserContext,
} from './modelFallbackPolicy.js';

export {
  canUseAsFallback,
  createModelFallbackPolicyError,
  getModelFallbackPriority,
  isModelFallbackPolicyError,
  selectFallbackModel,
} from './modelFallbackPolicy.js';

export type {
  IModelAlternativesService,
  ModelAlternativeChain,
  ModelAlternativeOption,
  RetryStrategy,
  TokenRetryPolicyContext,
  TokenRetryPolicyError,
  TokenRetryPolicyResult,
  UserQuotaContext,
} from './tokenRetryPolicy.js';

export type { ILogger as TokenRetryLogger } from './tokenRetryPolicy.js';

export { TokenAlternativeReason, TokenType } from './tokenRetryPolicy.js';

export {
  canRetryWithTokens,
  createTokenRetryPolicyError,
  evaluateTokenRetryPolicy,
  getOptimalRetryDelay,
  isTokenRetryPolicyError,
  shouldRetryOnTokenExhaustion,
} from './tokenRetryPolicy.js';

// ==================== CIRCUIT BREAKER POLICY ====================

export type {
  CircuitBreakerConfig,
  CircuitBreakerContext,
  CircuitBreakerError,
  CircuitBreakerResult,
  CircuitBreakerStateData,
} from './apiCircuitBreakerPolicy.js';

export { CircuitBreakerState, CircuitBreakerTrigger } from './apiCircuitBreakerPolicy.js';

export type { ILogger } from './apiCircuitBreakerPolicy.js';

export {
  createCircuitBreakerError,
  isCircuitBreakerError,
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from './apiCircuitBreakerPolicy.js';
