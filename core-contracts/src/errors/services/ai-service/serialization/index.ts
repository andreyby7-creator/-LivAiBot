/**
 * @file AI Response Serialization Module
 *
 * Предоставляет унифицированный интерфейс для сериализации ответов AI API
 * в HTTP и gRPC форматы с поддержкой кастомизации и observability.
 */

// ==================== MAIN EXPORTS ====================

export {
  createAIResponseSerializer,
  serializeAIResponseGrpc,
  serializeAIResponseHttp,
} from './AIResponseSerializer.js';

export { createAIResultSerializer, serializeAIResult } from './AIResultSerializer.js';

// ==================== JSON SERIALIZATION ====================

export {
  serializeGrpcToJsonString,
  serializeGrpcWithMetadataToJsonString,
  serializeHttpToJsonString,
  serializeHttpWithMetadataToJsonString,
} from './AIResponseSerializer.js';

// ==================== TYPES ====================

export type {
  AIErrorDetails,
  AIResponse,
  AIResponseError,
  AIResponseSerializationOutcome,
  AIResponseSerializerConfig,
  AIResponseSerializerRequestConfig,
  AIResponseSuccess,
  AIUsage,
  BaseErrorPlainObject,
  GrpcAISerializationResult,
  GrpcDetailsFormatter,
  HttpAISerializationResult,
} from './AIResponseSerializer.js';

export type {
  AIResult,
  AIResultSerializationOutcome,
  AIResultSerializerConfig,
  ConfidenceScore,
  ModelMetadata,
  SerializedAIResult,
  TokenUsageStats,
} from './AIResultSerializer.js';

// ==================== CONSTANTS ====================

export { GRPC_STATUS, HTTP_STATUS } from './AIResponseSerializer.js';
