/**
 * @file GraphqlSerializer.ts - GraphQL сериализатор для BaseError
 *
 * Преобразует BaseError в GraphQL-совместимый формат с полной поддержкой метаданных.
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
 * Конфигурация GraphQL сериализатора
 */
export type GraphqlSerializerConfig = {
  /** Включать полную информацию о метаданных */
  readonly includeMetadata: boolean;
  /** Включать цепочку причин */
  readonly includeCauseChain: boolean;
  /** Преобразовывать в GraphQL error extensions */
  readonly includeExtensions: boolean;
  /** Кастомный маппинг severity на GraphQL error codes */
  readonly severityMapping?: Partial<Record<string, string>>;
  /** Функция для генерации locations (для GraphQL интеграции) */
  readonly locationGenerator?: (error: BaseErrorPlainObject) => GraphqlError['locations'];
  /** Функция для генерации path (для GraphQL интеграции) */
  readonly pathGenerator?: (error: BaseErrorPlainObject) => GraphqlError['path'];
  /** Уровень детализации сериализации */
  readonly detailLevel: 'basic' | 'detailed' | 'full';
};

/**
 * GraphQL ошибка (стандартный формат)
 */
export type GraphqlError = {
  /** Сообщение ошибки */
  readonly message: string;
  /** Расположение в GraphQL запросе (опционально) */
  readonly locations?:
    | readonly {
      readonly line: number;
      readonly column: number;
    }[]
    | undefined;
  /** Путь в GraphQL запросе (опционально) */
  readonly path?: readonly (string | number)[] | undefined;
  /** Расширения с дополнительной информацией */
  readonly extensions?: Record<string, unknown> | undefined;
};

/**
 * Результат GraphQL сериализации
 */
export type GraphqlSerializationResult = {
  /** GraphQL ошибки */
  readonly errors: readonly GraphqlError[];
  /** Метаданные сериализации */
  readonly metadata: {
    readonly serializer: 'graphql';
    readonly version: string;
    readonly timestamp: string;
    readonly config: GraphqlSerializerConfig;
  };
};

/**
 * Версия GraphQL сериализатора для обратной совместимости
 */
const GRAPHQL_SERIALIZER_VERSION = '1.0.0';

/**
 * Дефолтная конфигурация GraphQL сериализатора
 */
const DEFAULT_CONFIG: GraphqlSerializerConfig = {
  includeMetadata: true,
  includeCauseChain: true,
  includeExtensions: true,
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
 * Преобразует severity в GraphQL error code
 * @param severity - уровень серьезности ошибки
 * @param customMapping - кастомный маппинг severity на GraphQL codes
 * @returns GraphQL error code
 */
function mapSeverityToGraphqlCode(
  severity: string,
  customMapping?: Partial<Record<string, string>>,
): string {
  // Используем кастомный маппинг если предоставлен
  const customCode = customMapping?.[severity];
  if (customCode != null && customCode !== '') {
    return customCode;
  }

  // Дефолтный маппинг с более детальной градацией
  switch (severity) {
    case 'low':
      return 'BAD_USER_INPUT';
    case 'medium':
      return 'FORBIDDEN'; // Различаем medium как авторизационные проблемы
    case 'high':
      return 'INTERNAL_ERROR';
    case 'critical':
      return 'SERVICE_UNAVAILABLE'; // Критические ошибки как недоступность сервиса
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Создает GraphQL сериализатор с кастомной конфигурацией
 * @param config - конфигурация сериализатора
 * @returns функция сериализации
 */
export function createGraphqlSerializer(
  config: Partial<GraphqlSerializerConfig> = {},
): (error: BaseError) => GraphqlSerializationResult {
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    detailLevel: config.detailLevel != null
      ? validateDetailLevel(config.detailLevel)
      : DEFAULT_CONFIG.detailLevel,
  };
  const severityMapping = finalConfig.severityMapping;
  const locationGenerator = finalConfig.locationGenerator;
  const pathGenerator = finalConfig.pathGenerator;

  return (error: BaseError): GraphqlSerializationResult => {
    const plainObject = asPlainObject(error) as BaseErrorPlainObject;

    // Контролируем уровень детализации
    const includeCauseChain = finalConfig.includeCauseChain && finalConfig.detailLevel !== 'basic';
    const includeFullMetadata = finalConfig.includeMetadata && finalConfig.detailLevel === 'full';

    // Основная ошибка
    const mainError: GraphqlError = {
      message: error.message,
      locations: locationGenerator ? locationGenerator(plainObject) : undefined,
      path: pathGenerator ? pathGenerator(plainObject) : undefined,
      extensions: finalConfig.includeExtensions
        ? {
          code: mapSeverityToGraphqlCode(error.severity, severityMapping),
          errorCode: error.code,
          category: error.category,
          origin: error.origin,
          timestamp: error.timestamp,
          ...(includeFullMetadata && plainObject['metadata'] != null
            ? {
              metadata: plainObject['metadata'],
            }
            : {}),
        }
        : undefined,
    };

    // Добавляем ошибки из cause chain
    const causeErrors: GraphqlError[] =
      includeCauseChain && plainObject.causeChain != null && plainObject.causeChain.length > 0
        ? plainObject.causeChain.map((cause: BaseErrorPlainObject): GraphqlError => ({
          message: `Caused by: ${cause.message}`,
          extensions: finalConfig.includeExtensions
            ? {
              code: mapSeverityToGraphqlCode(cause.severity, severityMapping),
              errorCode: cause.code,
              category: cause.category,
              origin: cause.origin,
              timestamp: cause.timestamp,
              isCause: true,
              // В full режиме добавляем дополнительные метаданные для cause chain
              ...(includeFullMetadata && cause.metadata != null
                ? {
                  causeMetadata: cause.metadata,
                }
                : {}),
            }
            : undefined,
        }))
        : [];

    const errors: GraphqlError[] = [mainError, ...causeErrors];

    return {
      errors,
      metadata: {
        serializer: 'graphql',
        version: GRAPHQL_SERIALIZER_VERSION,
        timestamp: new Date().toISOString(),
        config: finalConfig,
      },
    };
  };
}

/**
 * Сериализует BaseError в GraphQL формат с дефолтной конфигурацией
 * @param error - ошибка для сериализации
 * @returns результат сериализации
 */
export function serializeToGraphql(error: BaseError): GraphqlSerializationResult {
  const serializer = createGraphqlSerializer();
  return serializer(error);
}

/**
 * Сериализует BaseError в GraphQL JSON строку
 * @param error - ошибка для сериализации
 * @param pretty - форматировать с отступами
 * @returns JSON строка в GraphQL формате
 */
export function serializeToGraphqlString(error: BaseError, pretty: boolean = false): string {
  const result = serializeToGraphql(error);
  const indent = pretty ? 2 : 0;
  return JSON.stringify(result, null, indent);
}

/**
 * Десериализует GraphQL JSON строку обратно в объект
 * @param jsonString - JSON строка
 * @returns десериализованный объект или null при ошибке
 */
export function deserializeFromGraphqlString(
  jsonString: string,
): GraphqlSerializationResult | null {
  try {
    const parsed = JSON.parse(jsonString) as unknown;

    // Валидация структуры результата
    const parsedRecord = parsed as Record<string, unknown>;
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'errors' in parsedRecord
      && 'metadata' in parsedRecord
    ) {
      const metadata = parsedRecord['metadata'];
      if (
        Array.isArray(parsedRecord['errors'])
        && typeof metadata === 'object'
        && metadata !== null
        && 'serializer' in metadata
        && (metadata as Record<string, unknown>)['serializer'] === 'graphql'
      ) {
        return parsed as GraphqlSerializationResult;
      }
    }

    // Структура не соответствует ожидаемой
    return null;
  } catch {
    // Ошибка парсинга JSON
    return null;
  }
}
