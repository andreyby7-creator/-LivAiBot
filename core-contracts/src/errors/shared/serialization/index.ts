/**
 * @file index.ts - Экспорт всех сериализаторов shared слоя
 *
 * Предоставляет единый entry point для всех сериализаторов BaseError.
 * Унифицированные сериализаторы с поддержкой detailLevel, causeMetadata и stack traces.
 * Чистые функции с полным metadata preservation и type safety.
 */

// ==================== JSON SERIALIZER ====================

/**
 * JSON сериализатор для BaseError. Преобразует ошибки в JSON формат
 * с полной поддержкой метаданных, causeMetadata в full режиме и настраиваемой детализацией.
 * Поддерживает round-trip сериализацию с валидацией.
 */
export type { JsonSerializationResult, JsonSerializerConfig } from './JsonSerializer.js';

export {
  createJsonSerializer,
  deserializeFromJsonString,
  serializeToJson,
  serializeToJsonString,
} from './JsonSerializer.js';

// ==================== GRPC SERIALIZER ====================

/**
 * gRPC сериализатор для BaseError. Преобразует ошибки в gRPC-совместимый формат
 * с маппингом severity на gRPC статус коды, protobuf any деталями и stack traces в DebugInfo.
 * Поддерживает кастомные severity mappings и causeMetadata в full режиме.
 */
export type {
  GrpcDeserializationResult,
  GrpcSerializationResult,
  GrpcSerializerConfig,
} from './GrpcSerializer.js';

export {
  createGrpcSerializer,
  deserializeFromGrpcString,
  GRPC_STATUS_CODES,
  serializeToGrpc,
  serializeToGrpcString,
} from './GrpcSerializer.js';

// ==================== GRAPHQL SERIALIZER ====================

/**
 * GraphQL сериализатор для BaseError. Преобразует ошибки в GraphQL-совместимый формат
 * с extensions, locations и path для GraphQL error responses.
 * Поддерживает кастомные severity mappings, location/path generators и causeMetadata в full режиме.
 */
export type {
  BaseErrorPlainObject,
  GraphqlError,
  GraphqlSerializationResult,
  GraphqlSerializerConfig,
} from './GraphqlSerializer.js';

export {
  createGraphqlSerializer,
  deserializeFromGraphqlString,
  serializeToGraphql,
  serializeToGraphqlString,
} from './GraphqlSerializer.js';
