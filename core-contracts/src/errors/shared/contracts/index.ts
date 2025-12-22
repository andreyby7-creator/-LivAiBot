/**
 * @file index.ts - Экспорт всех контрактов shared слоя
 *
 * Предоставляет единый entry point для всех внутренних контрактов shared слоя.
 * Упрощает миграцию к services/contracts layer и устраняет implicit agreements.
 */

// Re-export Either для удобства использования с контрактами
export { Either } from 'effect';

// ==================== CONTRACT VALIDATION ====================

/**
 * Типы для валидации контрактов. Используются в Either для явной
 * обработки ошибок валидации в фабриках.
 */
export type { ContractValidationError, ErrorDetails } from './HttpErrorContract.js';
export { isContractValidationError } from './HttpErrorContract.js';

// ==================== HTTP CONTRACTS ====================

/**
 * Контракты для HTTP ошибок. Гарантируют консистентность структуры
 * HTTP ответов с ошибками между всеми компонентами shared слоя.
 */
export type { HttpErrorContract, HttpErrorContractType } from './HttpErrorContract.js';

export {
  createHttpErrorContract,
  getHttpErrorCode,
  getHttpErrorDetails,
  getHttpErrorMessage,
  isHttpErrorContract,
} from './HttpErrorContract.js';

// ==================== GRPC CONTRACTS ====================

/**
 * Контракты для gRPC ошибок. Гарантируют консистентность структуры
 * gRPC ответов с ошибками между всеми компонентами shared слоя.
 */
export type { GrpcErrorContract, GrpcErrorContractType } from './GrpcErrorContract.js';

export {
  createGrpcErrorContract,
  getGrpcCorrelationId,
  getGrpcErrorCode,
  getGrpcErrorDetails,
  GRPC_STATUS_CODES,
  isGrpcErrorContract,
} from './GrpcErrorContract.js';

// ==================== INTERNAL DTO ====================

/**
 * DTO для внутренних ошибок. Гарантируют консистентность структуры
 * ошибок при передаче между внутренними компонентами shared слоя.
 */
export type {
  ExecutionContext,
  InternalErrorDTO,
  InternalErrorDTOType,
} from './InternalErrorDTO.js';

export {
  createInternalErrorDTO,
  getInternalCorrelationId,
  getInternalErrorCategory,
  getInternalErrorChain,
  getInternalErrorCode,
  getInternalErrorComponent,
  hasInternalErrorCause,
  isInternalErrorDTO,
} from './InternalErrorDTO.js';
