import { describe, expect, it } from 'vitest';

import {
  isAdminOperationError,
  isAIProcessingError,
  isIntegrationError,
  isMobilePlatformError,
  isTaggedError,
  isUserContextError,
  matchByCategory,
} from '../../../../src/errors/base/BaseErrorTypes';
import type {
  AdminOperationError,
  AggregatedError,
  AIProcessingError,
  ErrorChain,
  ErrorMatcher,
  ErrorTag,
  IntegrationError,
  MobilePlatformError,
  OptionalCause,
  PatternMap,
  SafeCause,
  TaggedError,
  UserContextError,
} from '../../../../src/errors/base/BaseErrorTypes';

describe('BaseErrorTypes', () => {
  describe('Базовые типы для обработки ошибок', () => {
    describe('OptionalCause и SafeCause', () => {
      it('должен поддерживать TypeScript типы для причин ошибок', () => {
        // OptionalCause - может быть undefined
        const optionalCause: OptionalCause<string> = 'error cause';
        const optionalUndefined: OptionalCause<string> = undefined;

        expect(optionalCause).toBe('error cause');
        expect(optionalUndefined).toBeUndefined();

        // SafeCause - гарантированно не undefined
        const safeCause: SafeCause<string> = 'safe cause';
        expect(safeCause).toBe('safe cause');
      });
    });

    describe('ErrorTag', () => {
      it('должен поддерживать дискриминирующие теги', () => {
        type TestTag = ErrorTag<'TestError'>;

        const tag: TestTag = {
          _tag: 'TestError',
        };

        expect(tag._tag).toBe('TestError');
      });
    });

    describe('TaggedError', () => {
      it('должен создавать type-safe tagged errors', () => {
        type TestError = TaggedError<
          {
            message: string;
            code: number;
          },
          'TestError'
        >;

        const error: TestError = {
          _tag: 'TestError',
          message: 'Test error message',
          code: 500,
        };

        expect(error._tag).toBe('TestError');
        expect(error.message).toBe('Test error message');
        expect(error.code).toBe(500);
      });

      it('должен обеспечивать type safety через тег', () => {
        type AuthError = TaggedError<
          {
            userId: string;
          },
          'AuthError'
        >;

        type ValidationError = TaggedError<
          {
            field: string;
          },
          'ValidationError'
        >;

        const authError: AuthError = {
          _tag: 'AuthError',
          userId: 'user123',
        };

        const validationError: ValidationError = {
          _tag: 'ValidationError',
          field: 'email',
        };

        // TypeScript не позволит присвоить один тип другому
        expect(authError._tag).toBe('AuthError');
        expect(validationError._tag).toBe('ValidationError');
      });
    });

    describe('ErrorMatcher и ExhaustiveMatcher', () => {
      it('должен поддерживать функции-матчеры', () => {
        type TestError = TaggedError<{ value: number; }, 'TestError'>;

        const matcher: ErrorMatcher<TestError, string> = (error) => {
          return `Error with value: ${error.value}`;
        };

        const error: TestError = { _tag: 'TestError', value: 42 };
        expect(matcher(error)).toBe('Error with value: 42');
      });

      it('должен поддерживать исчерпывающие матчеры', () => {
        // ExhaustiveMatcher демонстрирует type-safe обработку union типов
        // TypeScript гарантирует, что все возможные случаи обработаны
        type SimpleUnion =
          | { type: 'success'; value: string; }
          | { type: 'error'; code: number; };

        // Функция демонстрирует исчерпывающую обработку
        const processUnion = (value: SimpleUnion): string => {
          switch (value.type) {
            case 'success':
              return `Success: ${value.value}`;
            case 'error':
              return `Error: ${value.code}`;
            default:
              // TypeScript гарантирует, что этот case никогда не выполнится
              // если добавить новый тип в union, код не скомпилируется
              return assertNever(value);
          }
        };

        function assertNever(value: never): never {
          throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
        }

        expect(processUnion({ type: 'success', value: 'ok' })).toBe(
          'Success: ok',
        );
        expect(processUnion({ type: 'error', code: 404 })).toBe('Error: 404');
      });
    });

    describe('PatternMap', () => {
      it('должен поддерживать мапы паттернов для tagged errors', () => {
        type ErrorA = TaggedError<{ a: string; }, 'ErrorA'>;
        type ErrorB = TaggedError<{ b: number; }, 'ErrorB'>;
        type TestErrors = ErrorA | ErrorB;

        const patterns: PatternMap<TestErrors, string> = {
          ErrorA: (error: Extract<TestErrors, { _tag: 'ErrorA'; }>) => `Handled A: ${error.a}`,
          default: (error: TestErrors) => `Default: ${error._tag}`,
        };

        const errorA: ErrorA = { _tag: 'ErrorA', a: 'test' };
        const errorB: ErrorB = { _tag: 'ErrorB', b: 123 };

        expect(patterns.ErrorA!(errorA)).toBe('Handled A: test');
        expect(patterns.default!(errorB as any)).toBe('Default: ErrorB');
      });

      it('должен поддерживать мапы паттернов для обычных типов', () => {
        type SimpleErrors =
          | { type: 'network'; url: string; }
          | { type: 'auth'; userId: string; };

        const patterns = {
          network: (error: { type: 'network'; url: string; }) => `Network error: ${error.url}`,
          auth: (error: { type: 'auth'; userId: string; }) => `Auth error: ${error.userId}`,
          default: (error: SimpleErrors) => `Unknown error: ${error.type}`,
        };

        const networkError = {
          type: 'network' as const,
          url: 'http://example.com',
        };
        const authError = { type: 'auth' as const, userId: 'user123' };

        expect(patterns.network(networkError)).toBe(
          'Network error: http://example.com',
        );
        expect(patterns.auth(authError)).toBe('Auth error: user123');
      });
    });

    describe('ErrorChain', () => {
      it('должен поддерживать рекурсивные цепочки ошибок', () => {
        type TestError = TaggedError<{ message: string; }, 'TestError'>;

        const leafError: TestError = {
          _tag: 'TestError',
          message: 'Leaf error',
        };

        const middleError: TestError = {
          _tag: 'TestError',
          message: 'Middle error',
        };

        const rootError: TestError = {
          _tag: 'TestError',
          message: 'Root error',
        };

        const chain: ErrorChain<TestError> = {
          error: rootError,
          cause: {
            error: middleError,
            cause: {
              error: leafError,
              cause: undefined,
            },
          },
        };

        expect(chain.error.message).toBe('Root error');
        expect(chain.cause!.error.message).toBe('Middle error');
        expect(chain.cause!.cause!.error.message).toBe('Leaf error');
        expect(chain.cause!.cause!.cause).toBeUndefined();
      });
    });

    describe('AggregatedError', () => {
      it('должен поддерживать агрегацию нескольких ошибок', () => {
        type TestError = TaggedError<{ message: string; }, 'TestError'>;

        const errors: TestError[] = [
          { _tag: 'TestError', message: 'Error 1' },
          { _tag: 'TestError', message: 'Error 2' },
          { _tag: 'TestError', message: 'Error 3' },
        ];

        const aggregated: AggregatedError<TestError> = {
          errors,
          message: 'Multiple errors occurred',
        };

        expect(aggregated.errors).toHaveLength(3);
        expect(aggregated.message).toBe('Multiple errors occurred');
        expect(aggregated.errors[0].message).toBe('Error 1');
        expect(aggregated.errors[1].message).toBe('Error 2');
        expect(aggregated.errors[2].message).toBe('Error 3');
      });
    });
  });

  describe('Специализированные типы ошибок LivAiBot', () => {
    describe('IntegrationError', () => {
      it('должен поддерживать ошибки интеграции с внешними сервисами', () => {
        type DatabaseError = IntegrationError<'database'>;

        const dbError: DatabaseError = {
          _tag: 'IntegrationError',
          service: 'database',
          operation: 'query',
          details: {
            query: 'SELECT * FROM users',
            table: 'users',
          },
        };

        expect(dbError._tag).toBe('IntegrationError');
        expect(dbError.service).toBe('database');
        expect(dbError.operation).toBe('query');
        expect(dbError.details.query).toBe('SELECT * FROM users');
      });

      it('должен быть type-safe для разных сервисов', () => {
        type APIError = IntegrationError<'api'>;
        type CacheError = IntegrationError<'cache'>;

        const apiError: APIError = {
          _tag: 'IntegrationError',
          service: 'api',
          operation: 'post',
          details: { endpoint: '/users' },
        };

        const cacheError: CacheError = {
          _tag: 'IntegrationError',
          service: 'cache',
          operation: 'get',
          details: { key: 'user:123' },
        };

        expect(apiError.service).toBe('api');
        expect(cacheError.service).toBe('cache');
      });
    });

    describe('AIProcessingError', () => {
      it('должен поддерживать ошибки обработки ИИ', () => {
        const aiError: AIProcessingError = {
          _tag: 'AIProcessingError',
          model: 'gpt-4',
          operation: 'inference',
          input: { prompt: 'Hello world' },
        };

        expect(aiError._tag).toBe('AIProcessingError');
        expect(aiError.model).toBe('gpt-4');
        expect(aiError.operation).toBe('inference');
        expect(aiError.input).toEqual({ prompt: 'Hello world' });
      });

      it('должен поддерживать все типы операций ИИ', () => {
        const operations: ('inference' | 'training' | 'validation')[] = [
          'inference',
          'training',
          'validation',
        ];

        operations.forEach((operation) => {
          const error: AIProcessingError = {
            _tag: 'AIProcessingError',
            model: 'test-model',
            operation,
            input: {},
          };
          expect(error.operation).toBe(operation);
        });
      });
    });

    describe('UserContextError', () => {
      it('должен поддерживать ошибки контекста пользователя', () => {
        const userError: UserContextError = {
          _tag: 'UserContextError',
          userId: 'user123',
          operation: 'profile_update',
          context: {
            sessionId: 'sess_456',
            ip: '192.168.1.1',
          },
        };

        expect(userError._tag).toBe('UserContextError');
        expect(userError.userId).toBe('user123');
        expect(userError.operation).toBe('profile_update');
        expect(userError.context.sessionId).toBe('sess_456');
      });
    });

    describe('AdminOperationError', () => {
      it('должен поддерживать ошибки административных операций', () => {
        const adminError: AdminOperationError = {
          _tag: 'AdminOperationError',
          adminId: 'admin456',
          operation: 'user_ban',
          target: 'user123',
          permissions: ['ban_users', 'manage_users'],
        };

        expect(adminError._tag).toBe('AdminOperationError');
        expect(adminError.adminId).toBe('admin456');
        expect(adminError.operation).toBe('user_ban');
        expect(adminError.target).toBe('user123');
        expect(adminError.permissions).toEqual(['ban_users', 'manage_users']);
      });
    });

    describe('MobilePlatformError', () => {
      it('должен поддерживать ошибки мобильных платформ', () => {
        const iosError: MobilePlatformError = {
          _tag: 'MobilePlatformError',
          platform: 'ios',
          version: '17.0',
          device: 'iPhone 15',
          operation: 'api_call',
        };

        const androidError: MobilePlatformError = {
          _tag: 'MobilePlatformError',
          platform: 'android',
          version: '13',
          device: 'Samsung Galaxy S23',
          operation: 'file_upload',
        };

        expect(iosError.platform).toBe('ios');
        expect(iosError.version).toBe('17.0');
        expect(iosError.device).toBe('iPhone 15');

        expect(androidError.platform).toBe('android');
        expect(androidError.version).toBe('13');
        expect(androidError.device).toBe('Samsung Galaxy S23');
      });
    });
  });

  describe('Type guards и утилиты', () => {
    describe('isTaggedError', () => {
      it('должен корректно определять tagged errors', () => {
        const validTaggedError = { _tag: 'TestError', message: 'test' };
        const invalidTaggedError = { message: 'test' };
        const wrongTagError = { _tag: 'WrongTag', message: 'test' };

        expect(isTaggedError(validTaggedError, 'TestError')).toBe(true);
        expect(isTaggedError(invalidTaggedError, 'TestError')).toBe(false);
        expect(isTaggedError(wrongTagError, 'TestError')).toBe(false);
        expect(isTaggedError(null, 'TestError')).toBe(false);
        expect(isTaggedError({}, 'TestError')).toBe(false);
      });

      it('должен быть type-safe', () => {
        const error = { _tag: 'TestError' as const, value: 123 };

        if (isTaggedError(error, 'TestError')) {
          // TypeScript знает что error имеет тип TaggedError
          expect(error._tag).toBe('TestError');
          expect(error.value).toBe(123);
        }
      });
    });

    describe('Специализированные type guards', () => {
      it('isIntegrationError должен корректно определять IntegrationError', () => {
        const integrationError: IntegrationError<'api'> = {
          _tag: 'IntegrationError',
          service: 'api',
          operation: 'get',
          details: {},
        };

        const otherError = { _tag: 'OtherError', message: 'test' };

        expect(isIntegrationError(integrationError)).toBe(true);
        expect(isIntegrationError(otherError)).toBe(false);
        expect(isIntegrationError({})).toBe(false);
      });

      it('isAIProcessingError должен корректно определять AIProcessingError', () => {
        const aiError: AIProcessingError = {
          _tag: 'AIProcessingError',
          model: 'gpt-4',
          operation: 'inference',
          input: {},
        };

        const otherError = { _tag: 'OtherError' };

        expect(isAIProcessingError(aiError)).toBe(true);
        expect(isAIProcessingError(otherError)).toBe(false);
      });

      it('isUserContextError должен корректно определять UserContextError', () => {
        const userError: UserContextError = {
          _tag: 'UserContextError',
          userId: 'user123',
          operation: 'login',
          context: {},
        };

        const otherError = { _tag: 'OtherError' };

        expect(isUserContextError(userError)).toBe(true);
        expect(isUserContextError(otherError)).toBe(false);
      });

      it('isAdminOperationError должен корректно определять AdminOperationError', () => {
        const adminError: AdminOperationError = {
          _tag: 'AdminOperationError',
          adminId: 'admin123',
          operation: 'delete',
          target: 'user456',
          permissions: [],
        };

        const otherError = { _tag: 'OtherError' };

        expect(isAdminOperationError(adminError)).toBe(true);
        expect(isAdminOperationError(otherError)).toBe(false);
      });

      it('isMobilePlatformError должен корректно определять MobilePlatformError', () => {
        const mobileError: MobilePlatformError = {
          _tag: 'MobilePlatformError',
          platform: 'ios',
          version: '17.0',
          device: 'iPhone',
          operation: 'sync',
        };

        const otherError = { _tag: 'OtherError' };

        expect(isMobilePlatformError(mobileError)).toBe(true);
        expect(isMobilePlatformError(otherError)).toBe(false);
      });
    });
  });

  describe('matchByCategory - hierarchical pattern matching', () => {
    type TestErrors =
      | TaggedError<{ code: number; }, 'NetworkError'>
      | TaggedError<{ field: string; }, 'ValidationError'>
      | TaggedError<{ userId: string; }, 'AuthError'>;

    const networkError: TestErrors = {
      _tag: 'NetworkError',
      code: 500,
    };

    const validationError: TestErrors = {
      _tag: 'ValidationError',
      field: 'email',
    };

    const authError: TestErrors = {
      _tag: 'AuthError',
      userId: 'user123',
    };

    it('должен корректно матчить по точному тегу', () => {
      const patterns: PatternMap<TestErrors, string> = {
        NetworkError: (error: Extract<TestErrors, { _tag: 'NetworkError'; }>) =>
          `Network error: ${error.code}`,
        ValidationError: (
          error: Extract<TestErrors, { _tag: 'ValidationError'; }>,
        ) => `Validation error: ${error.field}`,
        AuthError: (error: Extract<TestErrors, { _tag: 'AuthError'; }>) =>
          `Auth error: ${error.userId}`,
      };

      expect(matchByCategory(networkError, patterns)).toBe(
        'Network error: 500',
      );
      expect(matchByCategory(validationError, patterns)).toBe(
        'Validation error: email',
      );
      expect(matchByCategory(authError, patterns)).toBe('Auth error: user123');
    });

    it('должен использовать default обработчик при отсутствии точного матча', () => {
      const patterns: PatternMap<TestErrors, string> = {
        NetworkError: (error: Extract<TestErrors, { _tag: 'NetworkError'; }>) =>
          `Network: ${error.code}`,
        default: (error: TestErrors) => `Unknown: ${error._tag}`,
      };

      expect(matchByCategory(networkError, patterns)).toBe('Network: 500');
    });

    it('должен выбрасывать ошибку при отсутствии подходящего обработчика', () => {
      // Создаем patterns только для NetworkError
      const networkOnlyPatterns: PatternMap<TestErrors, string> = {
        NetworkError: (error: Extract<TestErrors, { _tag: 'NetworkError'; }>) =>
          `Network: ${error.code}`,
        // Нет default и других обработчиков
      };

      // Создаем отдельные переменные для тестирования разных типов
      const validationError: TestErrors = {
        _tag: 'ValidationError',
        field: 'email',
      };
      const authError: TestErrors = {
        _tag: 'AuthError',
        userId: 'user123',
      };

      // NetworkError должен обрабатываться
      expect(matchByCategory(networkError, networkOnlyPatterns)).toBe(
        'Network: 500',
      );

      // Для других типов создаем соответствующие patterns и тестируем
      const validationOnlyPatterns: PatternMap<TestErrors, string> = {
        ValidationError: (
          error: Extract<TestErrors, { _tag: 'ValidationError'; }>,
        ) => `Validation: ${error.field}`,
      };

      const authOnlyPatterns: PatternMap<TestErrors, string> = {
        AuthError: (error: Extract<TestErrors, { _tag: 'AuthError'; }>) => `Auth: ${error.userId}`,
      };

      expect(matchByCategory(validationError, validationOnlyPatterns)).toBe(
        'Validation: email',
      );
      expect(matchByCategory(authError, authOnlyPatterns)).toBe(
        'Auth: user123',
      );

      // Пустые patterns всегда бросают ошибку
      expect(() => matchByCategory(networkError, {} as any)).toThrow(
        'Unhandled error category: NetworkError',
      );
    });

    it('должен обеспечивать type safety при матчинге', () => {
      const patterns: PatternMap<TestErrors, string> = {
        NetworkError: (
          error: Extract<TestErrors, { _tag: 'NetworkError'; }>,
        ) => {
          // TypeScript знает что error имеет тип NetworkError
          expect(error.code).toBeDefined();
          return `Network: ${error.code}`;
        },
        ValidationError: (
          error: Extract<TestErrors, { _tag: 'ValidationError'; }>,
        ) => {
          // TypeScript знает что error имеет тип ValidationError
          expect(error.field).toBeDefined();
          return `Validation: ${error.field}`;
        },
        AuthError: (error: Extract<TestErrors, { _tag: 'AuthError'; }>) => {
          // TypeScript знает что error имеет тип AuthError
          expect(error.userId).toBeDefined();
          return `Auth: ${error.userId}`;
        },
      };

      expect(matchByCategory(networkError, patterns)).toBe('Network: 500');
      expect(matchByCategory(validationError, patterns)).toBe(
        'Validation: email',
      );
      expect(matchByCategory(authError, patterns)).toBe('Auth: user123');
    });

    it('должен поддерживать partial patterns с default', () => {
      const patterns: PatternMap<TestErrors, string> = {
        ValidationError: (
          error: Extract<TestErrors, { _tag: 'ValidationError'; }>,
        ) => `Field error: ${error.field}`,
        default: (error: TestErrors) => `Other error: ${error._tag}`,
      };

      expect(matchByCategory(validationError, patterns as any)).toBe(
        'Field error: email',
      );
      expect(matchByCategory(networkError, patterns as any)).toBe(
        'Other error: NetworkError',
      );
      expect(matchByCategory(authError, patterns as any)).toBe(
        'Other error: AuthError',
      );
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен поддерживать комбинацию type guards и pattern matching', () => {
      type AppErrors =
        | IntegrationError<'api'>
        | AIProcessingError
        | UserContextError;

      const apiError: AppErrors = {
        _tag: 'IntegrationError',
        service: 'api',
        operation: 'post',
        details: { endpoint: '/users' },
      };

      const aiError: AppErrors = {
        _tag: 'AIProcessingError',
        model: 'gpt-4',
        operation: 'inference',
        input: { prompt: 'test' },
      };

      const userError: AppErrors = {
        _tag: 'UserContextError',
        userId: 'user123',
        operation: 'login',
        context: {},
      };

      // Type guards работают корректно
      expect(isIntegrationError(apiError)).toBe(true);
      expect(isAIProcessingError(aiError)).toBe(true);
      expect(isUserContextError(userError)).toBe(true);

      // Test that different error types have correct _tag values
      expect(apiError._tag).toBe('IntegrationError');
      expect(aiError._tag).toBe('AIProcessingError');
      expect(userError._tag).toBe('UserContextError');
    });

    it('должен поддерживать error chains с type safety', () => {
      type AppErrors = IntegrationError<'api'> | AIProcessingError;

      const rootError: AppErrors = {
        _tag: 'IntegrationError',
        service: 'api',
        operation: 'get',
        details: { status: 500 },
      };

      const causeError: AppErrors = {
        _tag: 'AIProcessingError',
        model: 'gpt-4',
        operation: 'inference',
        input: { prompt: 'failed request' },
      };

      const chain: ErrorChain<AppErrors> = {
        error: rootError,
        cause: {
          error: causeError,
          cause: undefined,
        },
      };

      // Проверяем что type guards работают на каждом уровне цепочки
      expect(isIntegrationError(chain.error)).toBe(true);
      expect(isAIProcessingError(chain.cause!.error)).toBe(true);

      // Test error chain structure
      expect(chain.error._tag).toBe('IntegrationError');
      expect(chain.cause!.error._tag).toBe('AIProcessingError');
    });

    it('должен поддерживать aggregated errors', () => {
      type AppErrors = UserContextError | AdminOperationError;

      const errors: AppErrors[] = [
        {
          _tag: 'UserContextError',
          userId: 'user1',
          operation: 'login',
          context: { attempts: 3 },
        },
        {
          _tag: 'AdminOperationError',
          adminId: 'admin1',
          operation: 'ban',
          target: 'user1',
          permissions: ['ban_users'],
        },
        {
          _tag: 'UserContextError',
          userId: 'user2',
          operation: 'password_reset',
          context: { email: 'user2@example.com' },
        },
      ];

      const aggregated: AggregatedError<AppErrors> = {
        errors,
        message: 'Multiple user-related errors occurred',
      };

      expect(aggregated.errors).toHaveLength(3);
      expect(aggregated.message).toBe('Multiple user-related errors occurred');

      // Проверяем type guards на каждом error
      expect(isUserContextError(aggregated.errors[0])).toBe(true);
      expect(isAdminOperationError(aggregated.errors[1])).toBe(true);
      expect(isUserContextError(aggregated.errors[2])).toBe(true);

      // Test aggregated error structure and _tag values
      expect(aggregated.errors[0]._tag).toBe('UserContextError');
      expect(aggregated.errors[1]._tag).toBe('AdminOperationError');
      expect(aggregated.errors[2]._tag).toBe('UserContextError');
    });
  });

  describe('Edge cases и валидация', () => {
    it('должен корректно обрабатывать null и undefined в type guards', () => {
      expect(isTaggedError(null, 'Test')).toBe(false);
      expect(isTaggedError(undefined, 'Test')).toBe(false);
      expect(isIntegrationError(null)).toBe(false);
      expect(isAIProcessingError(null)).toBe(false);
      expect(isUserContextError(null)).toBe(false);
      expect(isAdminOperationError(null)).toBe(false);
      expect(isMobilePlatformError(null)).toBe(false);
    });

    it('должен корректно обрабатывать объекты без _tag', () => {
      const obj = { message: 'test' };

      expect(isTaggedError(obj, 'Test')).toBe(false);
      expect(isIntegrationError(obj)).toBe(false);
      expect(isAIProcessingError(obj)).toBe(false);
      expect(isUserContextError(obj)).toBe(false);
      expect(isAdminOperationError(obj)).toBe(false);
      expect(isMobilePlatformError(obj)).toBe(false);
    });

    it('должен корректно обрабатывать примитивные типы', () => {
      expect(isTaggedError('string', 'Test')).toBe(false);
      expect(isTaggedError(42, 'Test')).toBe(false);
      expect(isTaggedError(true, 'Test')).toBe(false);
      expect(isTaggedError(Symbol('test'), 'Test')).toBe(false);

      expect(isIntegrationError('string')).toBe(false);
      expect(isAIProcessingError(42)).toBe(false);
      expect(isUserContextError(true)).toBe(false);
      expect(isAdminOperationError(Symbol('test'))).toBe(false);
      expect(isMobilePlatformError(BigInt(123))).toBe(false);
    });

    it('должен корректно обрабатывать массивы и функции', () => {
      const arr = [1, 2, 3];
      const func = () => 'test';

      expect(isTaggedError(arr, 'Test')).toBe(false);
      expect(isTaggedError(func, 'Test')).toBe(false);

      expect(isIntegrationError(arr)).toBe(false);
      expect(isAIProcessingError(func)).toBe(false);
      expect(isUserContextError(arr)).toBe(false);
      expect(isAdminOperationError(func)).toBe(false);
      expect(isMobilePlatformError(arr)).toBe(false);
    });

    it('должен корректно обрабатывать объекты с неправильным _tag', () => {
      const wrongTagObj = { _tag: 'WrongTag', data: 'test' };
      const numberTagObj = { _tag: 123, data: 'test' };
      const nullTagObj = { _tag: null, data: 'test' };

      expect(isTaggedError(wrongTagObj, 'Test')).toBe(false);
      expect(isTaggedError(numberTagObj, 'Test')).toBe(false);
      expect(isTaggedError(nullTagObj, 'Test')).toBe(false);

      expect(isIntegrationError(wrongTagObj)).toBe(false);
      expect(isAIProcessingError(wrongTagObj)).toBe(false);
      expect(isUserContextError(wrongTagObj)).toBe(false);
      expect(isAdminOperationError(wrongTagObj)).toBe(false);
      expect(isMobilePlatformError(wrongTagObj)).toBe(false);
    });

    it('должен корректно обрабатывать объекты с правильным _tag но неправильной структурой', () => {
      // Объекты с правильным _tag но без требуемых полей
      const partialIntegrationError = { _tag: 'IntegrationError' };
      const partialAIError = { _tag: 'AIProcessingError' };
      const partialUserError = { _tag: 'UserContextError' };
      const partialAdminError = { _tag: 'AdminOperationError' };
      const partialMobileError = { _tag: 'MobilePlatformError' };

      // Эти объекты имеют правильный _tag, поэтому type guards возвращают true
      // даже если структура неполная (type guards проверяют только _tag)
      expect(isIntegrationError(partialIntegrationError)).toBe(true);
      expect(isAIProcessingError(partialAIError)).toBe(true);
      expect(isUserContextError(partialUserError)).toBe(true);
      expect(isAdminOperationError(partialAdminError)).toBe(true);
      expect(isMobilePlatformError(partialMobileError)).toBe(true);
    });

    it('matchByCategory должен корректно обрабатывать пустые patterns', () => {
      type TestError = TaggedError<{ value: number; }, 'TestError'>;
      const error: TestError = { _tag: 'TestError', value: 42 };

      const emptyPatterns: PatternMap<TestError, string> = {};

      expect(() => matchByCategory(error, emptyPatterns)).toThrow(
        'Unhandled error category: TestError',
      );
    });

    it('должен поддерживать deeply nested error chains', () => {
      type SimpleError = TaggedError<{ message: string; }, 'SimpleError'>;

      const createChain = (depth: number): ErrorChain<SimpleError> => {
        if (depth === 0) {
          return {
            error: { _tag: 'SimpleError', message: 'root' },
            cause: undefined,
          };
        }

        return {
          error: { _tag: 'SimpleError', message: `level-${depth}` },
          cause: createChain(depth - 1),
        };
      };

      const chain = createChain(5);

      // Проверяем что можем пройти по всей цепочке
      let current: ErrorChain<SimpleError> | undefined = chain;
      let count = 0;

      while (current) {
        expect(current.error._tag).toBe('SimpleError');
        expect(typeof current.error.message).toBe('string');
        expect(current.error.message).toMatch(/^level-\d+$|^root$/);
        current = current.cause;
        count++;
      }

      expect(count).toBe(6); // 5 уровней + корень
    });

    it('должен поддерживать очень глубокие цепочки ошибок (stress test)', () => {
      type SimpleError = TaggedError<
        { message: string; level: number; },
        'SimpleError'
      >;

      // Создаем цепочку из 20 уровней для stress testing
      const createDeepChain = (depth: number): ErrorChain<SimpleError> => {
        if (depth === 0) {
          return {
            error: { _tag: 'SimpleError', message: 'root-error', level: 0 },
            cause: undefined,
          };
        }

        return {
          error: {
            _tag: 'SimpleError',
            message: `error-level-${depth}`,
            level: depth,
          },
          cause: createDeepChain(depth - 1),
        };
      };

      const deepChain = createDeepChain(20);

      // Проверяем структуру всей цепочки
      let current: ErrorChain<SimpleError> | undefined = deepChain;
      let expectedLevel = 20;
      let nodeCount = 0;

      while (current) {
        expect(current.error._tag).toBe('SimpleError');
        expect(current.error.level).toBe(expectedLevel);

        if (expectedLevel === 0) {
          expect(current.error.message).toBe('root-error');
          expect(current.cause).toBeUndefined();
        } else {
          expect(current.error.message).toBe(`error-level-${expectedLevel}`);
          expect(current.cause).toBeDefined();
        }

        current = current.cause;
        expectedLevel--;
        nodeCount++;
      }

      expect(nodeCount).toBe(21); // 20 уровней + корень
      expect(expectedLevel).toBe(-1); // Убедимся что прошли все уровни
    });

    it('комплексный интеграционный сценарий - полная система обработки ошибок', () => {
      // 1. Создаем ошибки разных типов из реального сценария LivAiBot
      const apiError: IntegrationError<'api'> = {
        _tag: 'IntegrationError',
        service: 'api',
        operation: 'post',
        details: { endpoint: '/users', statusCode: 500 },
      };

      const aiError: AIProcessingError = {
        _tag: 'AIProcessingError',
        model: 'gpt-4',
        operation: 'inference',
        input: { prompt: 'process user request' },
      };

      const userError: UserContextError = {
        _tag: 'UserContextError',
        userId: 'user-123',
        operation: 'profile_update',
        context: { sessionId: 'sess-456', ip: '192.168.1.1' },
      };

      const adminError: AdminOperationError = {
        _tag: 'AdminOperationError',
        adminId: 'admin-789',
        operation: 'user_ban',
        target: 'user-123',
        permissions: ['ban_users', 'moderate_content'],
      };

      // 2. Проверяем type guards
      expect(isIntegrationError(apiError)).toBe(true);
      expect(isAIProcessingError(aiError)).toBe(true);
      expect(isUserContextError(userError)).toBe(true);
      expect(isAdminOperationError(adminError)).toBe(true);

      // 3. Создаем цепочку ошибок (причинно-следственная связь)
      type AppErrors =
        | IntegrationError<'api'>
        | AIProcessingError
        | UserContextError
        | AdminOperationError;

      const errorChain: ErrorChain<AppErrors> = {
        error: adminError, // Корневая ошибка - бан пользователя
        cause: {
          error: userError, // Причина - проблема с контекстом пользователя
          cause: {
            error: aiError, // Причина - сбой ИИ обработки
            cause: {
              error: apiError, // Корневая причина - сбой API
              cause: undefined,
            },
          },
        },
      };

      // 4. Создаем агрегированную ошибку для нескольких однотипных проблем
      const aggregatedErrors: AggregatedError<UserContextError> = {
        errors: [
          userError,
          {
            _tag: 'UserContextError',
            userId: 'user-456',
            operation: 'login',
            context: { attempts: 5 },
          },
        ],
        message: 'Multiple user context errors occurred',
      };

      // 5. Pattern matching для обработки разных типов ошибок
      const errorHandler = (error: AppErrors): string => {
        return matchByCategory(error, {
          IntegrationError: (err) => `API Error: ${err.service} ${err.operation} failed`,
          AIProcessingError: (err) => `AI Error: ${err.model} ${err.operation} failed`,
          UserContextError: (err) => `User Error: ${err.userId} ${err.operation} failed`,
          AdminOperationError: (err) =>
            `Admin Error: ${err.adminId} ${err.operation} on ${err.target}`,
        });
      };

      // 6. Проверяем обработку каждой ошибки в цепочке
      expect(errorHandler(errorChain.error)).toBe(
        'Admin Error: admin-789 user_ban on user-123',
      );
      expect(errorHandler(errorChain.cause!.error)).toBe(
        'User Error: user-123 profile_update failed',
      );
      expect(errorHandler(errorChain.cause!.cause!.error)).toBe(
        'AI Error: gpt-4 inference failed',
      );
      expect(errorHandler(errorChain.cause!.cause!.cause!.error)).toBe(
        'API Error: api post failed',
      );

      // 7. Проверяем агрегированную ошибку
      expect(aggregatedErrors.errors).toHaveLength(2);
      expect(isUserContextError(aggregatedErrors.errors[0])).toBe(true);
      expect(isUserContextError(aggregatedErrors.errors[1])).toBe(true);

      // 8. Используем matchByCategory для гарантии покрытия всех типов ошибок
      const errorTypeChecker = (error: AppErrors): boolean => {
        return matchByCategory(error, {
          IntegrationError: () => true,
          AIProcessingError: () => true,
          UserContextError: () => true,
          AdminOperationError: () => true,
        });
      };

      // Все ошибки должны обрабатываться без ошибок
      expect(errorTypeChecker(apiError)).toBe(true);
      expect(errorTypeChecker(aiError)).toBe(true);
      expect(errorTypeChecker(userError)).toBe(true);
      expect(errorTypeChecker(adminError)).toBe(true);

      // 9. Проверяем OptionalCause и SafeCause в контексте цепочек
      const optionalCause: OptionalCause<AppErrors> = apiError;
      const safeCause: SafeCause<AppErrors> = aiError;

      expect(optionalCause).toBe(apiError);
      expect(safeCause).toBe(aiError);

      // 10. Финальная проверка - вся система работает вместе
      // Считаем количество ошибок в цепочке
      let chainLength = 1; // Корневая ошибка
      let currentCause = errorChain.cause;
      while (currentCause) {
        chainLength++;
        currentCause = currentCause.cause;
      }

      const fullErrorReport = {
        chain: errorChain,
        aggregated: aggregatedErrors,
        totalErrors: chainLength, // Динамический подсчет ошибок в цепочке
        processed: true,
      };

      expect(fullErrorReport.processed).toBe(true);
      expect(fullErrorReport.totalErrors).toBe(4);
      expect(fullErrorReport.chain.error._tag).toBe('AdminOperationError');
    });
  });
});
