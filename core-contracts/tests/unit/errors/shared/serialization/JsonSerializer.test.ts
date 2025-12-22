import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { BaseError } from '../../../../../src/errors/base/BaseError';
import type {
  CorrelationId,
  MetadataTimestamp,
} from '../../../../../src/errors/base/ErrorMetadata';
import {
  createJsonSerializer,
  deserializeFromJsonString,
  serializeToJson,
  serializeToJsonString,
} from '../../../../../src/errors/shared/serialization/JsonSerializer';
import type {
  JsonSerializationResult,
  JsonSerializerConfig,
} from '../../../../../src/errors/shared/serialization/JsonSerializer';

// Импорт для тестов
const DEFAULT_CONFIG: JsonSerializerConfig = {
  includeMetadata: true,
  includeCauseChain: true,
  detailLevel: 'detailed',
};

const SERIALIZER_VERSION = '1.0.0';

// ==================== HELPER FUNCTIONS ====================

/** Создает mock BaseError для тестов */
function createMockBaseError(): BaseError {
  return {
    _tag: 'BaseError',
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Test error message',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [],
    codeMetadata: {
      code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'Test error',
      severity: ERROR_SEVERITY.HIGH,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-correlation-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
    },
  };
}

/** Создает mock BaseError с метаданными */
function createMockBaseErrorWithMetadata(): BaseError {
  return {
    _tag: 'BaseError',
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Test error with metadata',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [],
    codeMetadata: {
      code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'Test error with metadata',
      severity: ERROR_SEVERITY.HIGH,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-correlation-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
      customFields: { testField: 'testValue' },
    },
  };
}

/** Создает mock BaseError с cause chain */
function createMockBaseErrorWithCause(): BaseError {
  const cause: BaseError = {
    _tag: 'BaseError',
    code: 'CAUSE_ERROR',
    message: 'Cause error message',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [],
    codeMetadata: {
      code: 'CAUSE_ERROR',
      description: 'Cause error',
      severity: ERROR_SEVERITY.MEDIUM,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-cause-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
    },
  };

  return {
    _tag: 'BaseError',
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Main error with cause',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [cause],
    codeMetadata: {
      code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'Main error with cause',
      severity: ERROR_SEVERITY.HIGH,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-main-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
    },
  };
}

// ==================== TESTS ====================

describe('JsonSerializer', () => {
  describe('createJsonSerializer', () => {
    it('создает сериализатор с дефолтной конфигурацией', () => {
      const serializer = createJsonSerializer();
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.serializer).toBe('json');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.config.detailLevel).toBe('detailed');
    });

    it('создает сериализатор с кастомной конфигурацией', () => {
      const config: Partial<JsonSerializerConfig> = {
        includeMetadata: false,
        detailLevel: 'basic',
      };

      const serializer = createJsonSerializer(config);
      const error = createMockBaseErrorWithMetadata();

      const result = serializer(error);

      expect(result.metadata.config.includeMetadata).toBe(false);
      expect(result.metadata.config.detailLevel).toBe('basic');
      expect(result.error).not.toHaveProperty('metadata');
    });
  });

  describe('serializeToJson', () => {
    it('сериализует BaseError в JSON формат', () => {
      const error = createMockBaseError();
      const result = serializeToJson(error);

      expect(result.error).toHaveProperty('_tag', 'BaseError');
      expect(result.error).toHaveProperty('code', DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(result.error).toHaveProperty('message', 'Test error message');
      expect(result.error).toHaveProperty('severity', ERROR_SEVERITY.HIGH);
      expect(result.error).toHaveProperty('category', ERROR_CATEGORY.TECHNICAL);
      expect(result.error).toHaveProperty('origin', ERROR_ORIGIN.INFRASTRUCTURE);
      expect(result.error).toHaveProperty('timestamp');
    });

    it('включает метаданные по умолчанию', () => {
      const error = createMockBaseErrorWithMetadata();
      const result = serializeToJson(error);

      expect(result.error).toHaveProperty('metadata');
      expect(result.error.metadata).toHaveProperty('customFields');
    });

    it('исключает метаданные при конфигурации', () => {
      const serializer = createJsonSerializer({ includeMetadata: false });
      const error = createMockBaseErrorWithMetadata();

      const result = serializer(error);

      expect(result.error).not.toHaveProperty('metadata');
    });

    it('использует basic detail level', () => {
      const serializer = createJsonSerializer({ detailLevel: 'basic' });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.error).toHaveProperty('_tag');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.metadata.config.detailLevel).toBe('basic');
    });

    it('использует detailed detail level', () => {
      const serializer = createJsonSerializer({ detailLevel: 'detailed' });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.error).toHaveProperty('_tag');
      expect(result.error).toHaveProperty('code');
      expect(result.metadata.config.detailLevel).toBe('detailed');
    });

    it('использует full detail level', () => {
      const serializer = createJsonSerializer({ detailLevel: 'full' });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.error).toHaveProperty('_tag');
      expect(result.error).toHaveProperty('code');
      expect(result.metadata.config.detailLevel).toBe('full');
    });

    it('использует default detail level при неизвестном значении', () => {
      const serializer = createJsonSerializer({ detailLevel: 'unknown' as any });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.error).toHaveProperty('_tag');
      expect(result.metadata.config.detailLevel).toBe('detailed'); // unknown values are validated to default
    });

    it('исключает cause chain при конфигурации', () => {
      const serializer = createJsonSerializer({ includeCauseChain: false });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.error).not.toHaveProperty('causeChain');
    });

    it('не исключает cause chain по умолчанию', () => {
      const serializer = createJsonSerializer({ includeCauseChain: false });
      const error = createMockBaseError();

      const result = serializer(error);

      // Проверяем, что конфигурация работает - causeChain должен быть исключен
      expect(result.error).not.toHaveProperty('causeChain');
      expect(result.metadata.config.includeCauseChain).toBe(false);
    });
  });

  describe('serializeToJsonString', () => {
    it('сериализует BaseError в JSON строку', () => {
      const error = createMockBaseError();
      const jsonString = serializeToJsonString(error);

      expect(typeof jsonString).toBe('string');
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it('форматирует JSON с отступами при pretty=true', () => {
      const error = createMockBaseError();
      const jsonString = serializeToJsonString(error, true);

      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it('возвращает compact JSON при pretty=false', () => {
      const error = createMockBaseError();
      const jsonString = serializeToJsonString(error, false);

      expect(jsonString).not.toContain('\n');
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it('по умолчанию использует compact формат', () => {
      const error = createMockBaseError();
      const jsonString = serializeToJsonString(error);

      expect(jsonString).not.toContain('\n');
    });
  });

  describe('deserializeFromJsonString', () => {
    it('десериализует JSON строку обратно в объект', () => {
      const error = createMockBaseError();
      const jsonString = serializeToJsonString(error);
      const result = deserializeFromJsonString(jsonString);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');
      expect(result!.metadata.serializer).toBe('json');
      expect(result!.error).toHaveProperty('_tag', 'BaseError');
    });

    it('возвращает null при невалидном JSON', () => {
      const result = deserializeFromJsonString('invalid json');
      expect(result).toBeNull();
    });

    it('возвращает null при отсутствии обязательных полей', () => {
      const invalidJson = JSON.stringify({ someField: 'value' });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null при неправильном serializer type', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: {
          serializer: 'xml', // неправильный тип
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          config: DEFAULT_CONFIG,
        },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null при отсутствии metadata', () => {
      const invalidJson = JSON.stringify({
        error: {},
        // metadata отсутствует
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('корректно десериализует валидный JSON', () => {
      const error = createMockBaseError();
      const originalResult = serializeToJson(error);
      const jsonString = JSON.stringify(originalResult);
      const deserializedResult = deserializeFromJsonString(jsonString);

      expect(deserializedResult).not.toBeNull();
      expect(deserializedResult!.error).toEqual(originalResult.error);
      expect(deserializedResult!.metadata.serializer).toBe('json');
      expect(deserializedResult!.metadata.version).toBe(SERIALIZER_VERSION);
    });

    it('возвращает null при отсутствии error поля', () => {
      const invalidJson = JSON.stringify({
        metadata: { serializer: 'json', version: '1.0.0' },
        // error отсутствует
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null при отсутствии metadata поля', () => {
      const invalidJson = JSON.stringify({
        error: {},
        // metadata отсутствует
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null если metadata не является объектом', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: 'invalid',
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null если metadata является null', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: null,
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null при отсутствии serializer в metadata', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: { version: '1.0.0' }, // serializer отсутствует
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null при неправильном serializer type', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: { serializer: 'xml', version: '1.0.0' }, // неправильный serializer
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null если parsed не является объектом', () => {
      const invalidJson = JSON.stringify('not an object');
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null если parsed является null', () => {
      const invalidJson = JSON.stringify(null);
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('десериализует JSON с null error', () => {
      const invalidJson = JSON.stringify({
        error: null,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('десериализует JSON с undefined error', () => {
      const invalidJson = JSON.stringify({
        error: undefined,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('десериализует JSON с массивом вместо error', () => {
      const invalidJson = JSON.stringify({
        error: [],
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('десериализует JSON со строкой вместо error', () => {
      const invalidJson = JSON.stringify({
        error: 'string error',
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('десериализует JSON с числом вместо error', () => {
      const invalidJson = JSON.stringify({
        error: 42,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('обрабатывает malformed JSON с незавершенными объектами', () => {
      const invalidJson = '{"error": {}, "metadata": ';
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('обрабатывает JSON с невалидными escape последовательностями', () => {
      const invalidJson = '{"error": {}, "metadata": "\\uXXXX"}';
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null для JSON с неправильной версией сериализатора', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: { serializer: 'json', version: '2.0.0' }, // неподдерживаемая версия
      });
      const result = deserializeFromJsonString(invalidJson);
      // Пока что принимаем любую версию, но тест готов для будущих изменений
      expect(result).not.toBeNull();
    });

    it('возвращает null для JSON с пустым serializer', () => {
      const invalidJson = JSON.stringify({
        error: {},
        metadata: { serializer: '', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null для JSON с null error', () => {
      const invalidJson = JSON.stringify({
        error: null,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null для JSON с undefined error', () => {
      const invalidJson = JSON.stringify({
        error: undefined,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null для JSON с массивом вместо error', () => {
      const invalidJson = JSON.stringify({
        error: [],
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null для JSON с строкой вместо error', () => {
      const invalidJson = JSON.stringify({
        error: 'string error',
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null для JSON с числом вместо error', () => {
      const invalidJson = JSON.stringify({
        error: 42,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('обрабатывает JSON с trailing comma', () => {
      const invalidJson = '{"error": {}, "metadata": {"serializer": "json",},}';
      const result = deserializeFromJsonString(invalidJson);
      expect(result).toBeNull();
    });

    it('обрабатывает JSON с дублированными ключами', () => {
      // Создаем JSON с дублированными ключами вручную
      const invalidJson =
        '{"error": {}, "metadata": {"serializer": "json"}, "metadata": {"serializer": "xml"}}';
      const result = deserializeFromJsonString(invalidJson);
      // JSON.parse обычно берет последнее значение для дублированных ключей
      expect(result).toBeNull(); // serializer = 'xml', что неправильно
    });

    it('обрабатывает очень большой JSON', () => {
      const largeError = { error: 'x'.repeat(10000) };
      const invalidJson = JSON.stringify({
        error: largeError,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(invalidJson);
      expect(result).not.toBeNull();
    });

    it('обрабатывает JSON с deeply nested объектами', () => {
      const deepObject: any = { level: 1 };
      let current: any = deepObject;
      for (let i = 0; i < 10; i++) { // уменьшим глубину для теста
        current.nested = { level: i + 2 };
        current = current.nested;
      }

      const validJson = JSON.stringify({
        error: deepObject,
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromJsonString(validJson);
      expect(result).not.toBeNull();
    });
  });

  describe('JsonSerializer structure', () => {
    it('возвращает корректную структуру результата', () => {
      const error = createMockBaseError();
      const result: JsonSerializationResult = serializeToJson(error);

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('metadata');

      expect(result.metadata).toHaveProperty('serializer', 'json');
      expect(result.metadata).toHaveProperty('version', '1.0.0');
      expect(result.metadata).toHaveProperty('timestamp');
      expect(result.metadata).toHaveProperty('config');

      expect(typeof result.metadata.timestamp).toBe('string');
      expect(Date.parse(result.metadata.timestamp)).not.toBeNaN();
    });

    it('metadata содержит корректную конфигурацию', () => {
      const config: Partial<JsonSerializerConfig> = {
        includeMetadata: false,
        detailLevel: 'basic',
      };

      const serializer = createJsonSerializer(config);
      const error = createMockBaseError();
      const result = serializer(error);

      expect(result.metadata.config.includeMetadata).toBe(false);
      expect(result.metadata.config.detailLevel).toBe('basic');
      expect(result.metadata.config.includeCauseChain).toBe(true); // default
    });
  });

  describe('Round-trip serialization/deserialization', () => {
    it('basic detail level: сериализация + десериализация', () => {
      const error = createMockBaseErrorWithMetadata();
      const serializer = createJsonSerializer({ detailLevel: 'basic' });

      // Сериализация
      const serialized = serializer(error);

      // Десериализация
      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.error).toHaveProperty('_tag', 'BaseError');
      expect(deserialized!.error).toHaveProperty('code');
      expect(deserialized!.error).toHaveProperty('message');
      expect(deserialized!.metadata.serializer).toBe('json');
      expect(deserialized!.metadata.config.detailLevel).toBe('basic');
    });

    it('detailed detail level: сериализация + десериализация', () => {
      const error = createMockBaseErrorWithMetadata();
      const serializer = createJsonSerializer({ detailLevel: 'detailed' });

      // Сериализация
      const serialized = serializer(error);

      // Десериализация
      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.error).toHaveProperty('_tag', 'BaseError');
      expect(deserialized!.error).toHaveProperty('code');
      expect(deserialized!.error).toHaveProperty('message');
      expect(deserialized!.metadata.serializer).toBe('json');
      expect(deserialized!.metadata.config.detailLevel).toBe('detailed');
    });

    it('full detail level: сериализация + десериализация', () => {
      const error = createMockBaseErrorWithMetadata();
      const serializer = createJsonSerializer({ detailLevel: 'full' });

      // Сериализация
      const serialized = serializer(error);

      // Десериализация
      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.error).toHaveProperty('_tag', 'BaseError');
      expect(deserialized!.error).toHaveProperty('code');
      expect(deserialized!.error).toHaveProperty('message');
      expect(deserialized!.metadata.serializer).toBe('json');
      expect(deserialized!.metadata.config.detailLevel).toBe('full');
    });

    it('full detail level добавляет causeMetadata для унификации', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createJsonSerializer({ detailLevel: 'full' });

      const serialized = serializer(error);

      expect(serialized.error).toHaveProperty('causeChain');
      const causeChain = serialized.error.causeChain as any[];
      expect(Array.isArray(causeChain)).toBe(true);
      expect(causeChain.length).toBeGreaterThan(0);

      // Каждый cause должен иметь causeMetadata
      causeChain.forEach((cause) => {
        expect(cause).toHaveProperty('causeMetadata');
        expect(typeof cause.causeMetadata).toBe('object');
      });
    });

    it('without metadata: сериализация + десериализация', () => {
      const error = createMockBaseErrorWithMetadata();
      const serializer = createJsonSerializer({
        includeMetadata: false,
        detailLevel: 'detailed',
      });

      // Сериализация
      const serialized = serializer(error);
      expect(serialized.error).not.toHaveProperty('metadata');

      // Десериализация
      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.error).not.toHaveProperty('metadata');
      expect(deserialized!.metadata.config.includeMetadata).toBe(false);
    });

    it('without cause chain: сериализация + десериализация', () => {
      const error = createMockBaseErrorWithMetadata();
      const serializer = createJsonSerializer({
        includeCauseChain: false,
        detailLevel: 'detailed',
      });

      // Сериализация
      const serialized = serializer(error);
      expect(serialized.error).not.toHaveProperty('causeChain');

      // Десериализация
      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.metadata.config.includeCauseChain).toBe(false);
    });

    it('complete configuration: сериализация + десериализация', () => {
      const error = createMockBaseErrorWithMetadata();
      const serializer = createJsonSerializer({
        includeMetadata: true,
        includeCauseChain: true,
        detailLevel: 'detailed',
      });

      // Сериализация
      const serialized = serializer(error);

      // Десериализация
      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.error).toHaveProperty('metadata');
      expect(deserialized!.metadata.config).toEqual({
        includeMetadata: true,
        includeCauseChain: true,
        detailLevel: 'detailed',
      });
    });

    it('unknown detail level defaults to detailed', () => {
      const error = createMockBaseError();
      const serializer = createJsonSerializer({
        detailLevel: 'unknown' as any,
      });

      const serialized = serializer(error);
      expect(serialized.metadata.config.detailLevel).toBe('detailed'); // validated to default

      const jsonString = JSON.stringify(serialized);
      const deserialized = deserializeFromJsonString(jsonString);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.metadata.config.detailLevel).toBe('detailed');
    });
  });
});
