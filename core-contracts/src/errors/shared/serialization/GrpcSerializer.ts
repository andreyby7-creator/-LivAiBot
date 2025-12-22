/**
 * @file GrpcSerializer.ts - gRPC сериализатор для BaseError
 *
 * Преобразует BaseError в gRPC-совместимый формат с полной поддержкой метаданных.
 * Чистая функция, без side effects, metadata preservation.
 */

import { asPlainObject } from '../../base/BaseError.js';

import type { BaseError } from '../../base/BaseError.js';

/**
 * Тип для plain object представления BaseError
 * Обеспечивает строгую типизацию для сериализаторов
 */
export type BaseErrorPlainObject = {
  readonly _tag: string;
  readonly code: string;
  readonly message: string;
  readonly severity: string;
  readonly category: string;
  readonly origin: string;
  readonly timestamp: number;
  readonly codeMetadata: {
    readonly code: string;
    readonly description: string;
    readonly severity: string;
    readonly category: string;
  };
  readonly metadata?: {
    readonly context: {
      readonly correlationId: string;
      readonly timestamp: number;
    };
    readonly customFields?: Record<string, unknown>;
  };
  readonly causeChain?: readonly BaseErrorPlainObject[];
};

/**
 * Конфигурация gRPC сериализатора
 */
export type GrpcSerializerConfig = {
  /** Включать полную информацию о метаданных */
  readonly includeMetadata: boolean;
  /** Включать цепочку причин */
  readonly includeCauseChain: boolean;
  /** Преобразовывать коды в gRPC status codes */
  readonly mapToGrpcCodes: boolean;
  /** Уровень детализации сериализации */
  readonly detailLevel: 'basic' | 'detailed' | 'full';
  /** Кастомная функция маппинга severity в gRPC коды */
  readonly severityMapping?: (severity: string) => number;
};

/**
 * gRPC статус коды (стандартные)
 */
export const GRPC_STATUS_CODES = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
} as const;

/**
 * Результат gRPC сериализации
 */
export type GrpcSerializationResult = {
  /** gRPC статус код */
  readonly code: number;
  /** Сообщение ошибки */
  readonly message: string;
  /** Детали ошибки (protobuf any) */
  readonly details: Record<string, unknown>[];
  /** Метаданные сериализации */
  readonly metadata: {
    readonly serializer: 'grpc';
    readonly version: string;
    readonly timestamp: string;
    readonly config: GrpcSerializerConfig;
  };
};

/**
 * Дефолтная конфигурация gRPC сериализатора
 */
const DEFAULT_CONFIG: GrpcSerializerConfig = {
  includeMetadata: true,
  includeCauseChain: true,
  mapToGrpcCodes: true,
  detailLevel: 'detailed',
} as const;

/**
 * Валидирует detailLevel конфигурацию
 * @param detailLevel - уровень детализации
 * @returns валидный detailLevel или дефолтный
 */
function validateDetailLevel(detailLevel: unknown): 'basic' | 'detailed' | 'full' {
  if (
    typeof detailLevel === 'string'
    && (detailLevel === 'basic' || detailLevel === 'detailed' || detailLevel === 'full')
  ) {
    return detailLevel;
  }
  return 'detailed'; // fallback to default
}

/**
 * Преобразует severity в gRPC статус код
 * @param severity - уровень серьезности ошибки
 * @param customMapping - кастомная функция маппинга
 * @returns gRPC статус код
 */
function mapSeverityToGrpcCode(
  severity: string,
  customMapping?: (severity: string) => number,
): number {
  if (customMapping) {
    return customMapping(severity);
  }

  switch (severity) {
    case 'low':
    case 'medium':
      return GRPC_STATUS_CODES.INVALID_ARGUMENT;
    case 'high':
      return GRPC_STATUS_CODES.INTERNAL;
    case 'critical':
      return GRPC_STATUS_CODES.UNAVAILABLE;
    default:
      return GRPC_STATUS_CODES.UNKNOWN;
  }
}

/**
 * Создает gRPC сериализатор с кастомной конфигурацией
 * @param config - конфигурация сериализатора
 * @returns функция сериализации
 */
export function createGrpcSerializer(
  config: Partial<GrpcSerializerConfig> = {},
): (error: BaseError) => GrpcSerializationResult {
  // Валидируем detailLevel перед объединением
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    detailLevel: config.detailLevel != null
      ? validateDetailLevel(config.detailLevel)
      : DEFAULT_CONFIG.detailLevel,
  };

  return (error: BaseError): GrpcSerializationResult => {
    const plainObject = asPlainObject(error) as BaseErrorPlainObject;

    // Контролируем уровень детализации
    const includeCauseChain = finalConfig.includeCauseChain && finalConfig.detailLevel !== 'basic';
    const includeFullMetadata = finalConfig.includeMetadata && finalConfig.detailLevel === 'full';

    // Определяем gRPC код
    const code = finalConfig.mapToGrpcCodes
      ? mapSeverityToGrpcCode(error.severity, finalConfig.severityMapping)
      : GRPC_STATUS_CODES.INTERNAL;

    // Добавляем метаданные если нужно
    const metadataDetails: Record<string, unknown>[] =
      includeFullMetadata && plainObject.metadata != null
        ? [{
          '@type': 'type.googleapis.com/google.rpc.DebugInfo',
          stack_entries: error.stack != null && error.stack !== ''
            ? error.stack.split('\n').slice(1)
            : [], // Стек трейсы для debug целей
          detail: JSON.stringify(plainObject.metadata),
        }]
        : [];

    // Добавляем cause chain если нужно
    const causeDetails: Record<string, unknown>[] =
      includeCauseChain && plainObject.causeChain != null && plainObject.causeChain.length > 0
        ? plainObject.causeChain.map((cause: BaseErrorPlainObject, index: number) => ({
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: `cause_${index}`,
          domain: 'livaibot.errors.chain',
          metadata: {
            code: cause.code,
            message: cause.message,
            severity: cause.severity,
            // В full режиме добавляем дополнительные метаданные для cause chain
            ...(includeFullMetadata && cause.metadata != null
              ? {
                causeMetadata: cause.metadata,
              }
              : {}),
          },
        }))
        : [];

    // Формируем детали ошибки в формате protobuf any
    const details: Record<string, unknown>[] = [
      {
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason: error.code,
        domain: 'livaibot.errors',
        metadata: {
          category: error.category,
          origin: error.origin,
          timestamp: error.timestamp,
        },
      },
      ...metadataDetails,
      ...causeDetails,
    ];

    return {
      code,
      message: error.message,
      details,
      metadata: {
        serializer: 'grpc',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: finalConfig,
      },
    };
  };
}

/**
 * Результат десериализации gRPC формата
 */
export type GrpcDeserializationResult = GrpcSerializationResult | null;

/**
 * Десериализует gRPC JSON строку обратно в объект
 * @param grpcString - JSON строка в gRPC формате
 * @returns результат десериализации или null при ошибке
 */
export function deserializeFromGrpcString(grpcString: string): GrpcDeserializationResult {
  try {
    const parsed = JSON.parse(grpcString) as unknown;

    // Проверяем базовую структуру
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'code' in parsed
      && 'message' in parsed
      && 'details' in parsed
      && 'metadata' in parsed
    ) {
      const parsedRecord = parsed as Record<string, unknown>;

      // Проверяем типы полей
      if (
        typeof parsedRecord['code'] === 'number'
        && typeof parsedRecord['message'] === 'string'
        && Array.isArray(parsedRecord['details'])
        && typeof parsedRecord['metadata'] === 'object'
        && parsedRecord['metadata'] !== null
      ) {
        const metadata = parsedRecord['metadata'] as Record<string, unknown>;

        // Проверяем метаданные сериализации
        if (
          'serializer' in metadata
          && 'version' in metadata
          && 'timestamp' in metadata
          && 'config' in metadata
          && metadata['serializer'] === 'grpc'
        ) {
          return parsed as GrpcSerializationResult;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Сериализует BaseError в gRPC формат с дефолтной конфигурацией
 * @param error - ошибка для сериализации
 * @returns результат сериализации
 */
export function serializeToGrpc(error: BaseError): GrpcSerializationResult {
  const serializer = createGrpcSerializer();
  return serializer(error);
}

/**
 * Сериализует BaseError в gRPC JSON строку
 * @param error - ошибка для сериализации
 * @param pretty - форматировать с отступами
 * @returns JSON строка в gRPC формате
 */
export function serializeToGrpcString(error: BaseError, pretty: boolean = false): string {
  const result = serializeToGrpc(error);
  const indent = pretty ? 2 : 0;
  return JSON.stringify(result, null, indent);
}
