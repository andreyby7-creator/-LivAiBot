/**
 * @file billing-service serialization module
 *
 * Предоставляет унифицированный интерфейс для сериализации ошибок и результатов платежей
 * в HTTP и gRPC форматы с поддержкой кастомизации и observability.
 */

// ==================== PAYMENT ERROR SERIALIZATION ====================

export {
  createPaymentErrorSerializer,
  serializePaymentErrorGrpc,
  serializePaymentErrorHttp,
} from './PaymentErrorSerializer.js';

// ==================== PAYMENT RESULT SERIALIZATION ====================

export {
  createPaymentResultSerializer,
  serializePaymentResultGrpc,
  serializePaymentResultHttp,
} from './PaymentResultSerializer.js';

// ==================== JSON SERIALIZATION ====================

export {
  serializeGrpcToJsonString,
  serializeGrpcWithMetadataToJsonString,
  serializeHttpToJsonString,
  serializeHttpWithMetadataToJsonString,
} from './PaymentErrorSerializer.js';

export {
  serializeGrpcResultToJsonString,
  serializeGrpcResultWithMetadataToJsonString,
  serializeHttpResultToJsonString,
  serializeHttpResultWithMetadataToJsonString,
} from './PaymentResultSerializer.js';

// ==================== TYPES ====================

export type {
  BaseErrorPlainObject,
  GrpcPaymentSerializationResult,
  HttpPaymentSerializationResult,
  PaymentError,
  PaymentErrorDetails,
  PaymentErrorSerializationOutcome,
  PaymentErrorSerializerConfig,
  PaymentErrorSerializerRequestConfig,
  PaymentGrpcDetailsFormatter,
  PaymentResult,
  PaymentSuccess,
} from './PaymentErrorSerializer.js';

export type {
  GrpcPaymentResultSerializationResult,
  HttpPaymentResultSerializationResult,
  PaymentResultSerializationOutcome,
  PaymentResultSerializerConfig,
  PaymentResultSerializerRequestConfig,
} from './PaymentResultSerializer.js';

// ==================== CONSTANTS ====================

export { PAYMENT_GRPC_STATUS, PAYMENT_HTTP_STATUS } from './PaymentErrorSerializer.js';
export {
  PAYMENT_RESULT_GRPC_STATUS,
  PAYMENT_RESULT_HTTP_STATUS,
} from './PaymentResultSerializer.js';
