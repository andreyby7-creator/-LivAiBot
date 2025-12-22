/**
 * @file JsonSerializer.ts - JSON сериализатор для BaseError
 *
 * Преобразует BaseError в JSON формат с полной поддержкой метаданных.
 * Чистая функция, без side effects, metadata preservation.
 */

import { asPlainObject, toSerializableObject } from '../../base/BaseError.js';

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
 * Конфигурация JSON сериализатора
 */
export type JsonSerializerConfig = {
  /** Включать полную информацию о метаданных */
  readonly includeMetadata: boolean;
  /** Включать цепочку причин */
  readonly includeCauseChain: boolean;
  /** Уровень детализации (basic | detailed | full) */
  readonly detailLevel: 'basic' | 'detailed' | 'full';
};

/**
 * Результат JSON сериализации
 */
export type JsonSerializationResult = {
  /** Сериализованная ошибка */
  readonly error: Record<string, unknown>;
  /** Метаданные сериализации */
  readonly metadata: {
    readonly serializer: 'json';
    readonly version: string;
    readonly timestamp: string;
    readonly config: JsonSerializerConfig;
  };
};

/**
 * Версия сериализатора для обратной совместимости
 */
const SERIALIZER_VERSION = '1.0.0';

/**
 * Дефолтная конфигурация JSON сериализатора
 */
const DEFAULT_CONFIG: JsonSerializerConfig = {
  includeMetadata: true,
  includeCauseChain: true,
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
 * Создает JSON сериализатор с кастомной конфигурацией
 * @param config - конфигурация сериализатора
 * @returns функция сериализации
 */
export function createJsonSerializer(
  config: Partial<JsonSerializerConfig> = {},
): (error: BaseError) => JsonSerializationResult {
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    detailLevel: config.detailLevel != null
      ? validateDetailLevel(config.detailLevel)
      : DEFAULT_CONFIG.detailLevel,
  };

  return (error: BaseError): JsonSerializationResult => {
    // Выбираем метод преобразования в зависимости от уровня детализации
    let errorObject: Record<string, unknown>;

    switch (finalConfig.detailLevel) {
      case 'basic':
        errorObject = asPlainObject(error);
        break;
      case 'detailed':
        // 'detailed' включает базовую информацию + sanitization через toSerializableObject()
        // (без sensitive данных как пароли, токены и т.д.)
      case 'full':
        // FUTURE: 'full' зарезервирован для будущих расширений
        // Может включать дополнительные поля как:
        // - stack traces (если разрешено конфигом)
        // - debug info с дополнительными метаданными
        // - extended error context с runtime информацией
        // - performance metrics и tracing data
        // Пока эквивалентен 'detailed'
        errorObject = toSerializableObject(error);
        break;
      default:
        errorObject = toSerializableObject(error);
    }

    // Удаляем causeChain если не нужно
    if (!finalConfig.includeCauseChain) {
      errorObject = Object.fromEntries(
        Object.entries(errorObject).filter(([key]) => key !== 'causeChain'),
      );
    }

    // Удаляем метаданные если не нужно
    if (!finalConfig.includeMetadata) {
      errorObject = Object.fromEntries(
        Object.entries(errorObject).filter(([key]) => key !== 'metadata'),
      );
    }

    // В full режиме добавляем causeMetadata для унификации с другими сериализаторами
    if (
      finalConfig.detailLevel === 'full'
      && finalConfig.includeCauseChain
      && 'causeChain' in errorObject
    ) {
      const causeChain = errorObject['causeChain'] as BaseErrorPlainObject[];
      if (Array.isArray(causeChain)) {
        // Создаем новый объект без модификации существующего (immutable)
        errorObject = {
          ...errorObject,
          causeChain: causeChain.map((cause) => ({
            ...cause,
            // Добавляем causeMetadata для унификации с GraphQL/gRPC сериализаторами
            causeMetadata: cause.metadata,
          })),
        };
      }
    }

    return {
      error: errorObject,
      metadata: {
        serializer: 'json',
        version: SERIALIZER_VERSION,
        timestamp: new Date().toISOString(),
        config: finalConfig,
      },
    };
  };
}

/**
 * Сериализует BaseError в JSON с дефолтной конфигурацией
 * @param error - ошибка для сериализации
 * @returns результат сериализации
 */
export function serializeToJson(error: BaseError): JsonSerializationResult {
  const serializer = createJsonSerializer();
  return serializer(error);
}

/**
 * Сериализует BaseError в JSON строку
 * @param error - ошибка для сериализации
 * @param pretty - форматировать с отступами
 * @returns JSON строка
 */
const PRETTY_PRINT_INDENT = 2;

export function serializeToJsonString(error: BaseError, pretty: boolean = false): string {
  const result = serializeToJson(error);
  return JSON.stringify(result, null, pretty ? PRETTY_PRINT_INDENT : 0);
}

/**
 * Десериализует JSON строку обратно в объект
 * @param jsonString - JSON строка
 * @returns десериализованный объект или null при ошибке
 */
export function deserializeFromJsonString(jsonString: string): JsonSerializationResult | null {
  try {
    const parsed = JSON.parse(jsonString) as unknown;

    // Валидация структуры результата
    const parsedRecord = parsed as Record<string, unknown>;

    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'error' in parsedRecord
      && 'metadata' in parsedRecord
    ) {
      const metadata = parsedRecord['metadata'];
      const error = parsedRecord['error'];

      if (
        typeof metadata === 'object'
        && metadata !== null
        && 'serializer' in metadata
        && (metadata as Record<string, unknown>)['serializer'] === 'json'
        && typeof error === 'object'
        && error !== null
        && !Array.isArray(error)
      ) {
        return parsed as JsonSerializationResult;
      }
    }

    // Структура не соответствует ожидаемой
    return null;
  } catch {
    // Ошибка парсинга JSON
    return null;
  }
}
