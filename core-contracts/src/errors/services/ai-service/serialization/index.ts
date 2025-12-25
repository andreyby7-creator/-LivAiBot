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
  AIResponseSerializationOutcome,
  AIResponseSerializerConfig,
  AIResponseSerializerRequestConfig,
  GrpcAISerializationResult,
  GrpcDetailsFormatter,
  HttpAISerializationResult,
} from './AIResponseSerializer.js';

// ==================== DOMAIN TYPES ====================

export type {
  AIResponse,
  AIResponseError,
  AIResponseSuccess,
  AIUsage,
  BaseErrorPlainObject,
} from './AIResponseSerializer.js';

// ==================== CONSTANTS ====================

export { GRPC_STATUS, HTTP_STATUS } from './AIResponseSerializer.js';
