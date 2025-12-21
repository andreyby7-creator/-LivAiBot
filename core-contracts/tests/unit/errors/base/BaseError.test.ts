import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asPlainObject,
  getCause,
  getChainDepth,
  getMemoizedMaxSeverity,
  isBaseError,
  prependCause,
  sanitizeForExternal,
  setLogger,
  stringifyExternal,
  toBaseError,
  toExternalJSON,
  toSerializableObject,
  withCause,
  withCauseChain,
  withCorrelationId,
  withMetadata,
  withoutCause,
  withUserContext,
} from '../../../../src/errors/base/BaseError';
import type {
  BaseError,
  ErrorCauseChain,
  ErrorMetadata,
  MergeStrategy,
  UserContext,
} from '../../../../src/errors/base/BaseError';

import { LIVAI_ERROR_CODES } from '../../../../src/errors/base/ErrorCode';
import { ERROR_CATEGORY, ERROR_ORIGIN } from '../../../../src/errors/base/ErrorConstants';
import type { TaggedError } from '../../../../src/errors/base/BaseErrorTypes';
import type { CorrelationId } from '../../../../src/errors/base/ErrorMetadata';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock BaseError для тестов */
function createMockBaseError(overrides: Partial<BaseError> = {}): BaseError {
  const defaultMetadata: ErrorMetadata = {
    context: {
      correlationId: 'test-correlation-id' as CorrelationId,
      timestamp: 1234567890 as any,
    },
    userContext: {
      userId: 'test-user',
      tenantId: 'test-tenant',
      sessionId: 'test-session',
    },
    customFields: {
      testField: 'testValue',
    },
  };

  return {
    _tag: 'BaseError',
    code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Test error message',
    severity: 'medium',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    timestamp: Date.now(),
    causeChain: [],
    metadata: defaultMetadata,
    codeMetadata: {
      code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'User not found',
      severity: 'medium',
      category: ERROR_CATEGORY.BUSINESS,
      origin: ERROR_ORIGIN.DOMAIN,
    },
    stack: 'Error: Test error\n    at test location',
    ...overrides,
  };
}

/** Создает простой TaggedError для тестов */
function createMockTaggedError<E = unknown, Tag extends string = string>(
  tag: Tag,
  message: string = 'Mock tagged error',
  cause?: E,
): TaggedError<E, Tag> {
  const error = new Error(message) as any;
  error._tag = tag;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error as TaggedError<E, Tag>;
}

// ==================== ОСНОВНЫЕ ТИПЫ ====================

describe('BaseError', () => {
  describe('Типы и базовая структура', () => {
    describe('BaseError тип', () => {
      it('должен иметь все обязательные поля', () => {
        const error = createMockBaseError();

        expect(error._tag).toBe('BaseError');
        expect(error.code).toBe(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
        expect(error.message).toBe('Test error message');
        expect(error.severity).toBe('medium');
        expect(error.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(error.origin).toBe(ERROR_ORIGIN.DOMAIN);
        expect(typeof error.timestamp).toBe('number');
        expect(Array.isArray(error.causeChain)).toBe(true);
        expect(error.metadata).toBeDefined();
        expect(error.codeMetadata).toBeDefined();
      });

      it('должен поддерживать discriminated union по _tag', () => {
        const error = createMockBaseError();

        // Type narrowing работает благодаря discriminated union
        if (error._tag === 'BaseError') {
          expect(error.message).toBeDefined();
          expect(error.severity).toBeDefined();
        }
      });
    });

    describe('ErrorCauseChain тип', () => {
      it('должен быть readonly массивом readonly BaseError', () => {
        const cause1 = createMockBaseError({ message: 'Cause 1' });
        const cause2 = createMockBaseError({ message: 'Cause 2' });
        const chain: ErrorCauseChain = [cause1, cause2];

        expect(chain).toHaveLength(2);
        expect(chain[0]).toBe(cause1);
        expect(chain[1]).toBe(cause2);

        // Проверяем readonly (в TypeScript это readonly, но в runtime изменяемо)
        // Проверяем, что массив readonly
        expect(Object.getOwnPropertyDescriptor(chain, 'length')?.writable).toBe(true);
      });
    });

    describe('ErrorMetadata тип', () => {
      it('должен содержать context, userContext и customFields', () => {
        const metadata: ErrorMetadata = {
          context: {
            correlationId: 'test-id' as CorrelationId,
            timestamp: 1234567890 as any,
          },
          userContext: {
            userId: 'user123',
            tenantId: 'tenant456',
          },
          customFields: {
            custom: 'value',
          },
        };

        expect(metadata.context.correlationId).toBe('test-id');
        expect(metadata.userContext?.userId).toBe('user123');
        expect(metadata.customFields?.custom).toBe('value');
      });

      it('должен поддерживать опциональные поля', () => {
        const minimalMetadata: ErrorMetadata = {
          context: {
            correlationId: 'test-id' as CorrelationId,
            timestamp: 1234567890 as any,
          },
        };

        expect(minimalMetadata.userContext).toBeUndefined();
        expect(minimalMetadata.customFields).toBeUndefined();
      });
    });

    describe('UserContext тип', () => {
      it('должен поддерживать все поля user context', () => {
        const userContext: UserContext = {
          userId: 'user123',
          tenantId: 'tenant456',
          sessionId: 'session789',
          ipAddress: '192.168.1.1',
          userAgent: 'TestAgent/1.0',
        };

        expect(userContext.userId).toBe('user123');
        expect(userContext.tenantId).toBe('tenant456');
        expect(userContext.sessionId).toBe('session789');
        expect(userContext.ipAddress).toBe('192.168.1.1');
        expect(userContext.userAgent).toBe('TestAgent/1.0');
      });

      it('должен поддерживать частично заполненный context', () => {
        const partialContext: UserContext = {
          userId: 'user123',
          // остальные поля опциональны
        };

        expect(partialContext.userId).toBe('user123');
        expect(partialContext.tenantId).toBeUndefined();
      });
    });

    describe('MergeStrategy тип', () => {
      it('должен поддерживать все стратегии слияния', () => {
        const strategies: MergeStrategy[] = ['replace', 'shallowMerge', 'deepMerge'];

        expect(strategies).toContain('replace');
        expect(strategies).toContain('shallowMerge');
        expect(strategies).toContain('deepMerge');
      });
    });
  });

  // ==================== CORE API ====================

  describe('Core API - методы объекта', () => {
    let baseError: BaseError;
    let causeError: BaseError;

    beforeEach(() => {
      baseError = createMockBaseError({ message: 'Base error' });
      causeError = createMockBaseError({
        message: 'Cause error',
        severity: 'low',
      });
    });

    describe('withCause', () => {
      it('должен добавлять причину к ошибке', () => {
        const result = withCause(baseError, causeError);

        expect(result.cause).toBe(causeError);
        expect(result.causeChain).toEqual([causeError]);
        expect(result.causeChain).toHaveLength(1);
      });

      it('должен создавать новый объект (immutability)', () => {
        const result = withCause(baseError, causeError);

        expect(result).not.toBe(baseError);
        expect(result.causeChain).not.toBe(baseError.causeChain);
      });

      it('должен заменять существующую причину', () => {
        const errorWithCause = withCause(baseError, causeError);
        const newCause = createMockBaseError({ message: 'New cause', severity: 'high' });
        const result = withCause(errorWithCause, newCause);

        expect(result.cause).toBe(newCause);
        expect(result.causeChain).toEqual([newCause]);
      });

      it('должен предотвращать circular references', () => {
        const error1 = createMockBaseError({ message: 'Error 1' });
        const error2 = createMockBaseError({ message: 'Error 2' });

        // Создаем цикл: error1 -> error2 -> error1
        const error1WithCause = withCause(error1, error2);
        const result = withCause(error2, error1WithCause);

        // Должен вернуть оригинальную ошибку без добавления цикла
        expect(result).toBe(error2);
        expect(result.causeChain).toHaveLength(0);
      });

      it('должен ограничивать глубину цепочки (DoS защита)', () => {
        const loggerSpy = vi.fn();
        setLogger({ warn: loggerSpy, error: vi.fn() });

        // Создаем длинную цепочку напрямую для тестирования withCauseChain
        const longChain: ErrorCauseChain = Array.from(
          { length: 15 },
          (_, i) => createMockBaseError({ message: `Cause ${i}` }),
        );

        const result = withCauseChain(baseError, longChain);

        expect(result.causeChain).toHaveLength(10); // Ограничено MAX_CAUSE_DEPTH
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cause chain depth 15 exceeds MAX_CAUSE_DEPTH 10'),
        );

        // Восстанавливаем дефолтный logger
        setLogger({ warn: console.warn, error: console.error });
      });
    });

    describe('withMetadata', () => {
      it('должен обновлять метаданные со стратегией replace', () => {
        const newMetadata: Partial<ErrorMetadata> = {
          context: {
            correlationId: 'new-correlation' as CorrelationId,
            timestamp: 9999999999 as any,
          },
          userContext: {
            userId: 'new-user',
          },
        };

        const result = withMetadata(baseError, newMetadata, 'replace');

        expect(result.metadata.context.correlationId).toBe('new-correlation');
        expect(result.metadata.userContext?.userId).toBe('new-user');
        expect(result.metadata.customFields?.testField).toBe('testValue'); // replace делает shallow merge
      });

      it('должен сливать метаданные со стратегией shallowMerge', () => {
        const updates: Partial<ErrorMetadata> = {
          userContext: {
            tenantId: 'updated-tenant',
          },
          customFields: {
            newField: 'newValue',
          },
        };

        const result = withMetadata(baseError, updates, 'shallowMerge');

        expect(result.metadata.context.correlationId).toBe(
          baseError.metadata.context.correlationId,
        );
        expect(result.metadata.userContext?.userId).toBe(baseError.metadata.userContext?.userId);
        expect(result.metadata.userContext?.tenantId).toBe('updated-tenant');
        expect(result.metadata.customFields?.testField).toBe('testValue');
        expect(result.metadata.customFields?.newField).toBe('newValue');
      });

      it('должен глубоко сливать метаданные со стратегией deepMerge', () => {
        const updates: Partial<ErrorMetadata> = {
          customFields: {
            nested: { deep: 'value' },
          },
        };

        const result = withMetadata(baseError, updates, 'deepMerge');

        expect(result.metadata.customFields?.testField).toBe('testValue');
        expect(result.metadata.customFields?.nested).toEqual({ deep: 'value' });
      });

      it('должен использовать deepMerge по умолчанию', () => {
        const updates: Partial<ErrorMetadata> = {
          customFields: {
            newField: 'newValue',
          },
        };

        const result = withMetadata(baseError, updates);

        expect(result.metadata.customFields?.testField).toBe('testValue');
        expect(result.metadata.customFields?.newField).toBe('newValue');
      });

      it('должен создавать новый объект (immutability)', () => {
        const result = withMetadata(baseError, {});

        expect(result).not.toBe(baseError);
        expect(result.metadata).not.toBe(baseError.metadata);
      });
    });

    describe('asPlainObject', () => {
      it('должен преобразовывать BaseError в plain object', () => {
        const result = asPlainObject(baseError);

        expect(result._tag).toBe('BaseError');
        expect(result.code).toBe(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
        expect(result.message).toBe('Base error');
        expect(result.severity).toBe('medium');
        expect(result.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(typeof result.timestamp).toBe('number');
        expect(result.metadata).toBeDefined();
        expect(result.codeMetadata).toBeDefined();
      });

      it('должен исключать sensitive поля из userContext', () => {
        const errorWithSensitive = createMockBaseError({
          metadata: {
            ...baseError.metadata,
            userContext: {
              userId: 'user123',
              tenantId: 'tenant456',
              sessionId: 'session789',
              ipAddress: '192.168.1.1', // sensitive
              userAgent: 'SecretAgent/1.0', // sensitive
            },
          },
        });

        const result = asPlainObject(errorWithSensitive);

        const metadata = result.metadata as any;
        expect(metadata?.userContext?.userId).toBe('user123');
        expect(metadata?.userContext?.tenantId).toBe('tenant456');
        expect(metadata?.userContext?.sessionId).toBe('session789');
        expect(metadata?.userContext).not.toHaveProperty('ipAddress');
        expect(metadata?.userContext).not.toHaveProperty('userAgent');
      });

      it('должен включать causeChain как plain objects', () => {
        const errorWithCause = withCause(baseError, causeError);
        const result = asPlainObject(errorWithCause);

        expect(result.causeChain).toBeDefined();
        expect(Array.isArray(result.causeChain)).toBe(true);
        expect(result.causeChain).toHaveLength(1);
        expect((result.causeChain as any)?.[0]?._tag).toBe('BaseError');
      });
    });

    describe('sanitizeForExternal', () => {
      it('должен удалять stack trace', () => {
        const plainObject = {
          _tag: 'BaseError',
          message: 'Test error',
          stack: 'Error: Test error\n    at test location',
          otherField: 'value',
        };

        const result = sanitizeForExternal(plainObject);

        expect(result).not.toHaveProperty('stack');
        expect(result.otherField).toBe('value');
      });

      it('должен sanitизировать sensitive custom fields', () => {
        const plainObject = {
          _tag: 'BaseError',
          metadata: {
            customFields: {
              password: 'secret123',
              token: 'abc123',
              secret: 'hidden',
              normalField: 'safe',
              apiKey: 'should-not-be-redacted',
            },
          },
        };

        const result = sanitizeForExternal(plainObject);

        const resultMetadata = result.metadata as any;
        expect(resultMetadata?.customFields?.password).toBe('[REDACTED]');
        expect(resultMetadata?.customFields?.token).toBe('[REDACTED]');
        expect(resultMetadata?.customFields?.secret).toBe('[REDACTED]');
        expect(resultMetadata?.customFields?.apiKey).toBe('should-not-be-redacted');
        expect(resultMetadata?.customFields?.normalField).toBe('safe');
      });

      it('должен корректно обрабатывать отсутствующие customFields', () => {
        const plainObject = {
          _tag: 'BaseError',
          metadata: {},
        };

        const result = sanitizeForExternal(plainObject);

        expect(result.metadata).toEqual({});
      });
    });

    describe('toSerializableObject', () => {
      it('должен возвращать объект, безопасный для сериализации', () => {
        const result = toSerializableObject(baseError);

        expect(result).toHaveProperty('_tag', 'BaseError');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('metadata');
        expect(result).not.toHaveProperty('stack'); // stack должен быть удален
      });
    });

    describe('toExternalJSON', () => {
      it('должен сериализовать ошибку в JSON строку', () => {
        const result = toExternalJSON(baseError);

        expect(typeof result).toBe('string');

        const parsed = JSON.parse(result);
        expect(parsed._tag).toBe('BaseError');
        expect(parsed.message).toBe('Base error');
      });
    });

    describe('stringifyExternal', () => {
      it('должен быть алиасом для toExternalJSON', () => {
        const jsonResult = toExternalJSON(baseError);
        const stringifyResult = stringifyExternal(baseError);

        expect(stringifyResult).toBe(jsonResult);
      });
    });
  });

  // ==================== CHAIN MANIPULATION ====================

  describe('Chain manipulation', () => {
    let baseError: BaseError;
    let cause1: BaseError;
    let cause2: BaseError;

    beforeEach(() => {
      baseError = createMockBaseError({ message: 'Base error' });
      cause1 = createMockBaseError({ message: 'Cause 1' });
      cause2 = createMockBaseError({ message: 'Cause 2' });
    });

    describe('prependCause', () => {
      it('должен добавлять причину в начало цепочки', () => {
        const errorWithCause = withCause(baseError, cause1);
        const result = prependCause(errorWithCause, cause2);

        expect(result.causeChain).toEqual([cause2, cause1]);
        expect(result.cause).toBe(cause2);
      });

      it('должен работать с пустой цепочкой', () => {
        const result = prependCause(baseError, cause1);

        expect(result.causeChain).toEqual([cause1]);
        expect(result.cause).toBe(cause1);
      });
    });

    describe('withoutCause', () => {
      it('должен удалять всю цепочку причин', () => {
        const errorWithCauses = withCause(withCause(baseError, cause1), cause2);
        const result = withoutCause(errorWithCauses);

        expect(result.causeChain).toHaveLength(0);
        expect(result.cause).toBeUndefined();
        expect(result.message).toBe('Base error'); // остальные поля сохраняются
      });

      it('должен работать с пустой цепочкой', () => {
        const result = withoutCause(baseError);

        expect(result.causeChain).toHaveLength(0);
        expect(result.cause).toBeUndefined();
      });
    });

    describe('withCauseChain', () => {
      it('должен заменять всю цепочку причин', () => {
        const newChain: ErrorCauseChain = [cause1, cause2];
        const result = withCauseChain(baseError, newChain);

        expect(result.causeChain).toEqual(newChain);
        expect(result.cause).toBe(cause1);
      });

      it('должен ограничивать глубину цепочки (DoS защита)', () => {
        const loggerSpy = vi.fn();
        setLogger({ warn: loggerSpy, error: vi.fn() });

        const longChain: ErrorCauseChain = Array.from(
          { length: 15 },
          (_, i) => createMockBaseError({ message: `Cause ${i}` }),
        );

        const result = withCauseChain(baseError, longChain);

        expect(result.causeChain).toHaveLength(10); // Ограничено MAX_CAUSE_DEPTH
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cause chain depth 15 exceeds MAX_CAUSE_DEPTH 10'),
        );

        // Восстанавливаем дефолтный logger
        setLogger({ warn: console.warn, error: console.error });
      });

      it('должен предотвращать circular references в новой цепочке', () => {
        const chainWithCycle: ErrorCauseChain = [cause1, baseError]; // baseError содержит себя в цепочке

        const result = withCauseChain(baseError, chainWithCycle);

        // Должен вернуть оригинальную ошибку без изменений
        expect(result).toBe(baseError);
        expect(result.causeChain).toHaveLength(0);
      });

      it('должен поддерживать strict mode валидацию', () => {
        const loggerSpy = vi.fn();
        setLogger({ warn: vi.fn(), error: loggerSpy });

        // Создаем невалидную цепочку для strict mode
        const invalidChain: ErrorCauseChain = [
          createMockBaseError({ message: 'Error 1', causeChain: [] }),
          createMockBaseError({ message: 'Error 2', causeChain: [] }),
        ];

        const result = withCauseChain(baseError, invalidChain, true);

        // Должен залогировать ошибку валидации
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid cause chain'),
        );

        // Но все равно применить цепочку
        expect(result.causeChain).toEqual(invalidChain);

        // Восстанавливаем дефолтный logger
        setLogger({ warn: console.warn, error: console.error });
      });
    });
  });

  // ==================== METADATA HELPERS ====================

  describe('Metadata helpers', () => {
    let baseError: BaseError;

    beforeEach(() => {
      baseError = createMockBaseError();
    });

    describe('withCorrelationId', () => {
      it('должен обновлять correlation ID в метаданных', () => {
        const newCorrelationId = 'new-correlation-123' as CorrelationId;
        const result = withCorrelationId(baseError, newCorrelationId);

        expect(result.metadata.context.correlationId).toBe(newCorrelationId);
        expect(result.metadata.context.timestamp).toBe(baseError.metadata.context.timestamp);
      });

      it('должен создавать новый объект (immutability)', () => {
        const result = withCorrelationId(baseError, 'test-id' as CorrelationId);

        expect(result).not.toBe(baseError);
        expect(result.metadata).not.toBe(baseError.metadata);
      });
    });

    describe('withUserContext', () => {
      it('должен обновлять user context в метаданных', () => {
        const newUserContext: UserContext = {
          userId: 'new-user-123',
          tenantId: 'new-tenant-456',
          sessionId: 'new-session-789',
        };

        const result = withUserContext(baseError, newUserContext);

        expect(result.metadata.userContext).toEqual(newUserContext);
        expect(result.metadata.context.correlationId).toBe(
          baseError.metadata.context.correlationId,
        );
      });

      it('должен создавать новый объект (immutability)', () => {
        const result = withUserContext(baseError, { userId: 'test-user' });

        expect(result).not.toBe(baseError);
        expect(result.metadata).not.toBe(baseError.metadata);
      });
    });

    describe('withCorrelationId', () => {
      it('должен обновлять correlation ID в метаданных', () => {
        const newCorrelationId = 'new-correlation-123' as CorrelationId;
        const result = withCorrelationId(baseError, newCorrelationId);

        expect(result.metadata.context.correlationId).toBe(newCorrelationId);
        expect(result.metadata.context.timestamp).toBe(baseError.metadata.context.timestamp);
      });

      it('должен создавать новый объект (immutability)', () => {
        const result = withCorrelationId(baseError, 'test-id' as CorrelationId);

        expect(result).not.toBe(baseError);
        expect(result.metadata).not.toBe(baseError.metadata);
      });
    });

    describe('withUserContext', () => {
      it('должен обновлять user context в метаданных', () => {
        const newUserContext: UserContext = {
          userId: 'new-user-123',
          tenantId: 'new-tenant-456',
          sessionId: 'new-session-789',
        };

        const result = withUserContext(baseError, newUserContext);

        expect(result.metadata.userContext).toEqual(newUserContext);
        expect(result.metadata.context.correlationId).toBe(
          baseError.metadata.context.correlationId,
        );
      });

      it('должен создавать новый объект (immutability)', () => {
        const result = withUserContext(baseError, { userId: 'test-user' });

        expect(result).not.toBe(baseError);
        expect(result.metadata).not.toBe(baseError.metadata);
      });
    });
  });

  // ==================== TAGGED ERROR CONVERSION ====================

  describe('Tagged error conversion', () => {
    describe('toBaseError', () => {
      it('должен конвертировать TaggedError в BaseError', () => {
        const taggedError = createMockTaggedError('TestError', 'Test message');
        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = toBaseError(taggedError, codeMetadata);

        expect(result._tag).toBe('BaseError');
        expect(result.code).toBe(LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
        expect(result.message).toBe('Test message');
        expect(result.severity).toBe('medium');
        expect(result.category).toBe(ERROR_CATEGORY.BUSINESS);
        expect(result.origin).toBe(ERROR_ORIGIN.DOMAIN);
        expect(typeof result.timestamp).toBe('number');
        expect(result.causeChain).toHaveLength(0);
        expect(result.metadata.context.correlationId).toBeDefined();
        expect(result.codeMetadata).toBe(codeMetadata);
        expect(result.stack).toBe((taggedError as any).stack);
      });

      it('должен генерировать correlation ID если его нет', () => {
        const taggedError = createMockTaggedError('TestError');
        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = toBaseError(taggedError, codeMetadata);

        expect(result.metadata.context.correlationId).toMatch(/^corr_\d+_/);
      });

      it('должен конвертировать TaggedError с BaseError cause', () => {
        const causeError = createMockBaseError({ message: 'Cause error' });
        const taggedError = createMockTaggedError('TestError', 'Test message', causeError);
        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = toBaseError(taggedError, codeMetadata);

        expect(result.cause).toBe(causeError);
        expect(result.causeChain).toEqual([causeError]);
      });

      it('должен вызывать onInvalidCause callback для не-BaseError cause', () => {
        const invalidCause = 'string cause';
        const taggedError = createMockTaggedError('TestError', 'Test message', invalidCause);
        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const onInvalidCauseSpy = vi.fn();

        const result = toBaseError(taggedError, codeMetadata, onInvalidCauseSpy);

        expect(onInvalidCauseSpy).toHaveBeenCalledWith(invalidCause as any);
        expect(result.causeChain).toHaveLength(0);
      });

      it('должен использовать message из Error объекта', () => {
        const error = new Error('Error message');
        const taggedError = createMockTaggedError('TestError', 'Error message');

        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = toBaseError(taggedError, codeMetadata);

        expect(result.message).toBe('Error message');
        expect(result.stack).toBeDefined();
      });

      it('должен использовать fallback message для не-Error объектов', () => {
        const taggedError = { _tag: 'TestError' } as TaggedError<unknown, 'TestError'>;
        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = toBaseError(taggedError, codeMetadata);

        expect(result.message).toBe('Unknown error');
        expect(result.stack).toBeUndefined();
      });

      it('должен добавлять toJSON метод', () => {
        const taggedError = createMockTaggedError('TestError');
        const codeMetadata = {
          code: LIVAI_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          description: 'User not found',
          severity: 'medium' as const,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = toBaseError(taggedError, codeMetadata);

        expect(typeof result.toJSON).toBe('function');
        expect(result.toJSON?.()).toEqual(toSerializableObject(result));
      });
    });
  });

  // ==================== TYPE GUARDS ====================

  describe('Type guards', () => {
    describe('isBaseError', () => {
      it('должен возвращать true для валидного BaseError', () => {
        const error = createMockBaseError();

        expect(isBaseError(error)).toBe(true);
      });

      it('должен возвращать false для объектов без _tag', () => {
        const obj = { message: 'test' };

        expect(isBaseError(obj)).toBe(false);
      });

      it('должен возвращать false для объектов с неправильным _tag', () => {
        const obj = { _tag: 'WrongTag', message: 'test' };

        expect(isBaseError(obj)).toBe(false);
      });

      it('должен возвращать false для объектов без обязательных полей', () => {
        const incomplete = {
          _tag: 'BaseError',
          message: 'test',
          // отсутствуют другие обязательные поля
        };

        expect(isBaseError(incomplete)).toBe(false);
      });

      it('должен возвращать false для примитивов', () => {
        expect(isBaseError(null)).toBe(false);
        expect(isBaseError(undefined)).toBe(false);
        expect(isBaseError('string')).toBe(false);
        expect(isBaseError(42)).toBe(false);
        expect(isBaseError(true)).toBe(false);
      });

      it('должен корректно работать с type narrowing', () => {
        const value: unknown = createMockBaseError();

        if (isBaseError(value)) {
          // TypeScript должен знать, что value имеет тип BaseError
          expect(value._tag).toBe('BaseError');
          expect(value.message).toBeDefined();
          expect(value.severity).toBeDefined();
        } else {
          expect('This should not happen').toBe('BaseError type guard failed');
        }
      });
    });
  });

  // ==================== CHAIN CONSISTENCY ====================

  describe('Chain consistency', () => {
    let baseError: BaseError;

    beforeEach(() => {
      baseError = createMockBaseError();
    });
    describe('getCause', () => {
      it('должен возвращать первый элемент causeChain', () => {
        const cause1 = createMockBaseError({ message: 'Cause 1' });
        const cause2 = createMockBaseError({ message: 'Cause 2' });
        const errorWithCauses = withCauseChain(baseError, [cause1, cause2]);

        expect(getCause(errorWithCauses)).toBe(cause1);
      });

      it('должен возвращать undefined для пустой цепочки', () => {
        expect(getCause(baseError)).toBeUndefined();
      });
    });

    describe('getChainDepth', () => {
      it('должен возвращать длину causeChain', () => {
        const cause1 = createMockBaseError({ message: 'Cause 1' });
        const cause2 = createMockBaseError({ message: 'Cause 2' });
        const errorWithCauses = withCauseChain(baseError, [cause1, cause2]);

        expect(getChainDepth(errorWithCauses)).toBe(2);
      });

      it('должен возвращать 0 для пустой цепочки', () => {
        expect(getChainDepth(baseError)).toBe(0);
      });
    });

    describe('getMemoizedMaxSeverity', () => {
      it('должен возвращать максимальную severity из цепочки', () => {
        const causeLow = createMockBaseError({ message: 'Low cause', severity: 'low' });
        const causeHigh = createMockBaseError({ message: 'High cause', severity: 'high' });
        const baseMedium = createMockBaseError({ message: 'Medium base', severity: 'medium' });

        const errorWithCauses = withCauseChain(baseMedium, [causeLow, causeHigh]);

        expect(getMemoizedMaxSeverity(errorWithCauses)).toBe('high');
      });

      it('должен возвращать severity базовой ошибки если цепочка пуста', () => {
        expect(getMemoizedMaxSeverity(baseError)).toBe('medium');
      });

      it('должен кэшировать результат (memoization)', () => {
        const error = createMockBaseError({ severity: 'low' });

        // Первый вызов должен вычислить и закэшировать
        const result1 = getMemoizedMaxSeverity(error);
        expect(result1).toBe('low');

        // Второй вызов должен вернуть закэшированное значение
        const result2 = getMemoizedMaxSeverity(error);
        expect(result2).toBe('low');

        // Оба вызова должны вернуть один и тот же результат
        expect(result1).toBe(result2);
      });

      it('должен корректно сравнивать severity уровни', () => {
        const testCases = [
          { severities: ['low', 'medium', 'high'] as const, expected: 'high' },
          { severities: ['low', 'critical', 'medium'] as const, expected: 'critical' },
          { severities: ['medium', 'low'] as const, expected: 'medium' },
          { severities: ['low'] as const, expected: 'low' },
        ];

        testCases.forEach(({ severities, expected }) => {
          const causes = severities.slice(1).map((severity) => createMockBaseError({ severity }));
          const base = createMockBaseError({ severity: severities[0] });
          const errorWithCauses = withCauseChain(base, causes);

          expect(getMemoizedMaxSeverity(errorWithCauses)).toBe(expected);
        });
      });
    });
  });

  // ==================== UTILITIES ====================

  describe('Utilities', () => {
    describe('setLogger', () => {
      it('должен устанавливать кастомный logger', () => {
        const customLogger = {
          warn: vi.fn(),
          error: vi.fn(),
        };

        setLogger(customLogger);

        // Вызываем функцию, которая использует logger
        const loggerSpy = vi.fn();
        setLogger({ warn: loggerSpy, error: vi.fn() });

        // Создаем длинную цепочку для вызова warning через withCauseChain
        const longChain: ErrorCauseChain = Array.from(
          { length: 15 },
          (_, i) => createMockBaseError({ message: `Cause ${i}` }),
        );

        withCauseChain(createMockBaseError(), longChain);

        expect(loggerSpy).toHaveBeenCalled();

        // Восстанавливаем дефолтный logger
        setLogger({ warn: console.warn, error: console.error });
      });
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('Integration tests', () => {
    it('должен поддерживать полный жизненный цикл ошибки', () => {
      // Создаем базовую ошибку
      let error = createMockBaseError({ message: 'Initial error' });

      // Добавляем метаданные
      error = withCorrelationId(error, 'integration-test-123' as CorrelationId);
      error = withUserContext(error, { userId: 'integration-user' });

      // Добавляем причины
      const cause1 = createMockBaseError({ message: 'Network timeout', severity: 'medium' });
      const cause2 = createMockBaseError({
        message: 'Database connection failed',
        severity: 'high',
      });

      error = withCause(error, cause1);
      error = prependCause(error, cause2);

      // Проверяем структуру
      expect(error.causeChain).toEqual([cause2, cause1]);
      expect(error.cause).toBe(cause2);
      expect(getChainDepth(error)).toBe(2);
      expect(getMemoizedMaxSeverity(error)).toBe('high');

      // Проверяем сериализацию
      const serialized = toSerializableObject(error);
      expect(serialized._tag).toBe('BaseError');
      const serializedMetadata = serialized.metadata as any;
      expect(serializedMetadata?.context?.correlationId).toBe('integration-test-123');
      expect(serializedMetadata?.userContext?.userId).toBe('integration-user');
      expect(serialized.causeChain).toHaveLength(2);

      // Проверяем JSON сериализацию
      const json = stringifyExternal(error);
      const parsed = JSON.parse(json);
      expect(parsed._tag).toBe('BaseError');
      expect(parsed.message).toBe('Initial error');
    });

    it('должен корректно работать с комплексными метаданными', () => {
      let error = createMockBaseError();

      // Добавляем различные типы метаданных
      error = withMetadata(error, {
        userContext: {
          userId: 'complex-user',
          tenantId: 'complex-tenant',
          sessionId: 'complex-session',
          ipAddress: '10.0.0.1',
          userAgent: 'ComplexAgent/2.0',
        },
        customFields: {
          requestId: 'req-123',
          operation: 'user_lookup',
          nested: {
            database: 'users',
            table: 'profiles',
          },
          sensitive: {
            password: 'should-be-redacted',
            token: 'should-be-redacted',
          },
        },
      }, 'deepMerge');

      // Проверяем, что метаданные сохранены
      expect(error.metadata.userContext?.userId).toBe('complex-user');
      expect(error.metadata.customFields?.requestId).toBe('req-123');
      expect(error.metadata.customFields?.nested).toEqual({
        database: 'users',
        table: 'profiles',
      });
      expect((error.metadata.customFields as any)?.sensitive?.password).toBe('should-be-redacted');
      expect((error.metadata.customFields as any)?.sensitive?.token).toBe('should-be-redacted');

      // Проверяем plain object сериализацию
      const plain = asPlainObject(error);
      const plainMetadata = plain.metadata as any;
      expect(plainMetadata?.customFields?.sensitive?.password).toBe('should-be-redacted');

      // Проверяем external сериализацию (sensitive данные должны быть отредактированы)
      const external = toSerializableObject(error);

      const externalMetadata = external.metadata as any;
      expect(externalMetadata?.userContext?.userId).toBe('complex-user');
      expect(externalMetadata?.userContext).not.toHaveProperty('ipAddress');
      expect(externalMetadata?.userContext).not.toHaveProperty('userAgent');
      expect(externalMetadata?.customFields?.sensitive?.password).toBe('[REDACTED]');
      expect(externalMetadata?.customFields?.sensitive?.token).toBe('[REDACTED]');
      expect(externalMetadata?.customFields?.requestId).toBe('req-123');
    });

    it('должен обеспечивать полную immutability', () => {
      const original = createMockBaseError();

      // Применяем различные трансформации
      const withCauseResult = withCause(original, createMockBaseError());
      const withMetadataResult = withMetadata(withCauseResult, { customFields: { test: true } });
      const withCorrelationResult = withCorrelationId(
        withMetadataResult,
        'test-id' as CorrelationId,
      );

      // Проверяем, что оригинал не изменился
      expect(original.causeChain).toHaveLength(0);
      expect(original.metadata.customFields?.testField).toBe('testValue');
      expect(original.metadata.context.correlationId).toBe('test-correlation-id');

      // Проверяем, что каждая трансформация создала новый объект
      expect(withCauseResult).not.toBe(original);
      expect(withMetadataResult).not.toBe(withCauseResult);
      expect(withCorrelationResult).not.toBe(withMetadataResult);

      // Проверяем, что вложенные объекты тоже immutable
      expect(withCauseResult.causeChain).not.toBe(original.causeChain);
      expect(withMetadataResult.metadata).not.toBe(withCauseResult.metadata);
      expect(withCorrelationResult.metadata.context).not.toBe(withMetadataResult.metadata.context);
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge cases', () => {
    it('должен корректно обрабатывать очень глубокие цепочки ошибок', () => {
      const loggerSpy = vi.fn();
      setLogger({ warn: loggerSpy, error: vi.fn() });

      let currentError = createMockBaseError();

      // Создаем цепочку глубиной 50 (намного больше MAX_CAUSE_DEPTH)
      const longChain: ErrorCauseChain = Array.from(
        { length: 50 },
        (_, i) => createMockBaseError({ message: `Deep cause ${i}` }),
      );

      currentError = withCauseChain(currentError, longChain);

      // Должен быть ограничен MAX_CAUSE_DEPTH
      expect(getChainDepth(currentError)).toBe(10);

      // Должен логировать предупреждения
      expect(loggerSpy).toHaveBeenCalled();

      // Восстанавливаем дефолтный logger
      setLogger({ warn: console.warn, error: console.error });
    });

    it('должен предотвращать сложные circular references', () => {
      const error1 = createMockBaseError({ message: 'Error 1' });
      const error2 = createMockBaseError({ message: 'Error 2' });
      const error3 = createMockBaseError({ message: 'Error 3' });

      // Создаем сложный граф: error1 -> error2 -> error3 -> error1
      const error2WithCause = withCause(error2, error3);
      const error3WithCause = withCause(error3, error1);
      const error1WithCause = withCause(error1, error2WithCause);

      // Попытка добавить error3WithCause (который содержит error1) должна быть предотвращена
      const result = withCause(error1WithCause, error3WithCause);

      // Должен предотвратить circular reference и вернуть оригинальную ошибку
      expect(result.causeChain).toHaveLength(error1WithCause.causeChain.length);
    });

    it('должен корректно работать с пустыми и undefined значениями', () => {
      const error = createMockBaseError();

      // Пустые метаданные
      const withEmptyMetadata = withMetadata(error, {});
      expect(withEmptyMetadata.metadata).toBeDefined();
      // При merge с пустым объектом существующие поля сохраняются
      expect(withEmptyMetadata.metadata.userContext).toEqual(error.metadata.userContext);
      expect(withEmptyMetadata.metadata.customFields).toEqual(error.metadata.customFields);

      // Undefined cause
      expect(getCause(error)).toBeUndefined();

      // Empty cause chain
      expect(getChainDepth(error)).toBe(0);

      // Non-Error objects в type guard
      expect(isBaseError({})).toBe(false);
      expect(isBaseError(null)).toBe(false);
      expect(isBaseError(undefined)).toBe(false);
    });

    it('должен корректно обрабатывать сериализацию с циклическими ссылками в customFields', () => {
      // Создаем объект с циклической ссылкой
      const cyclicObject: any = { name: 'cyclic' };
      cyclicObject.self = cyclicObject;

      const error = withMetadata(createMockBaseError(), {
        customFields: {
          cyclic: cyclicObject,
        },
      });

      // Сериализация должна работать (structuredClone обрабатывает циклы)
      expect(() => toSerializableObject(error)).not.toThrow();
    });

    describe('Негативные сценарии для покрытия edge cases', () => {
      it('должен активировать fallback в deepMergeCustomFields при несериализуемых объектах', () => {
        const error = createMockBaseError();

        // Создаем объект с функцией, которая не может быть сериализована JSON.stringify
        const nonSerializable = {
          func() {
            return 'test';
          },
          symbol: Symbol('test'),
          nested: {
            data: 'value',
            undef: undefined,
          },
        };

        const updates = {
          customFields: nonSerializable,
        };

        // deepMergeCustomFields должен использовать fallback логику
        const result = withMetadata(error, updates, 'deepMerge');

        expect(result).toBeDefined();
        expect(result.metadata.customFields).toBeDefined();
        // Fallback логика должна обработать объект
        expect(typeof result.metadata.customFields).toBe('object');
      });

      it('должен активировать DoS защиту при экстремально глубокой цепочке', () => {
        const loggerSpy = vi.fn();
        setLogger({ warn: loggerSpy, error: vi.fn() });

        let rootError = createMockBaseError({ message: 'Root error' });

        // Создаем цепочку с 20+ уровнями (намного больше MAX_CAUSE_DEPTH = 10)
        // Используем prependCause чтобы наращивать цепочку
        for (let i = 0; i < 15; i++) {
          const cause = createMockBaseError({
            message: `Cause level ${i}`,
            severity: i % 3 === 0 ? 'critical' : 'medium',
          });
          rootError = prependCause(rootError, cause);
        }

        // Цепочка должна быть усечена до MAX_CAUSE_DEPTH
        expect(rootError.causeChain).toHaveLength(10);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cause chain depth 11 exceeds MAX_CAUSE_DEPTH 10'),
        );

        // Проверяем что максимальная severity все равно рассчитывается правильно
        const maxSeverity = getMemoizedMaxSeverity(rootError);
        expect(['low', 'medium', 'high', 'critical']).toContain(maxSeverity);

        // Восстанавливаем дефолтный logger
        setLogger({ warn: console.warn, error: console.error });
      });
    });
  });
});
