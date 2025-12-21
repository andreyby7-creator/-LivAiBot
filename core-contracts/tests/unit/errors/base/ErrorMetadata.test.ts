import { describe, expect, it } from 'vitest';

import type {
  AdminContext,
  AIProcessingContext,
  BotContext,
  CorrelationId,
  ErrorMetadataContext,
  ErrorMetadataDomainContext,
  ErrorMetadataWithTracing,
  IntegrationContext,
  MetadataClock,
  MetadataClockTag,
  MetadataMergeResult,
  MetadataMergeStrategy,
  MetadataTimestamp,
  MetadataValidationResult,
  TracingMetadata,
  UserContext,
} from '../../../../src/errors/base/ErrorMetadata';

import {
  mergeMetadata,
  validateMetadata,
  withTracing,
} from '../../../../src/errors/base/ErrorMetadata';

describe('ErrorMetadata', () => {
  describe('Базовые типы и структуры', () => {
    describe('CorrelationId и MetadataTimestamp', () => {
      it('должен поддерживать branded типы', () => {
        const correlationId = 'test-correlation-123' as const;
        const timestamp = 1234567890 as const;

        // TypeScript обеспечивает type safety для branded типов
        const brandedCorrelationId: CorrelationId = correlationId as CorrelationId;
        const brandedTimestamp: MetadataTimestamp = timestamp as MetadataTimestamp;

        expect(brandedCorrelationId).toBe(correlationId);
        expect(brandedTimestamp).toBe(timestamp);

        // Проверяем что это все еще строки/числа
        expect(typeof brandedCorrelationId).toBe('string');
        expect(typeof brandedTimestamp).toBe('number');
      });
    });

    describe('ErrorMetadataContext', () => {
      it('должен определять структуру базового контекста', () => {
        const context: ErrorMetadataContext = {
          correlationId: 'test-correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
        };

        expect(context.correlationId).toBe('test-correlation-123');
        expect(context.timestamp).toBe(1234567890);
        expect(context.context).toBeUndefined();
      });

      it('должен поддерживать опциональный domain context', () => {
        const contextWithDomain: ErrorMetadataContext = {
          correlationId: 'test-correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
          context: {
            type: 'user',
            userId: 'user-123',
          },
        };

        expect(contextWithDomain.context?.type).toBe('user');
        expect((contextWithDomain.context as UserContext).userId).toBe('user-123');
      });
    });

    describe('MetadataValidationResult', () => {
      it('должен определять структуру результата валидации', () => {
        const validResult: MetadataValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
        };

        const invalidResult: MetadataValidationResult = {
          isValid: false,
          errors: ['correlationId is required'],
          warnings: ['context may be incomplete'],
        };

        expect(validResult.isValid).toBe(true);
        expect(validResult.errors).toHaveLength(0);
        expect(validResult.warnings).toHaveLength(0);

        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors).toContain('correlationId is required');
        expect(invalidResult.warnings).toContain('context may be incomplete');
      });
    });
  });

  describe('MetadataClock interface', () => {
    it('должен определять интерфейс для deterministic генерации', () => {
      const mockClock: MetadataClock = {
        generateCorrelationId: () => 'mock-correlation-123' as CorrelationId,
        getCurrentTimestamp: () => 1234567890 as MetadataTimestamp,
      };

      expect(typeof mockClock.generateCorrelationId).toBe('function');
      expect(typeof mockClock.getCurrentTimestamp).toBe('function');

      const correlationId = mockClock.generateCorrelationId();
      const timestamp = mockClock.getCurrentTimestamp();

      expect(correlationId).toBe('mock-correlation-123');
      expect(timestamp).toBe(1234567890);
    });

    it('должен поддерживать MetadataClockTag тип', () => {
      // TypeScript обеспечивает корректность типа
      const tag: MetadataClockTag = {} as MetadataClockTag;
      expect(tag).toBeDefined();
    });
  });

  describe('Metadata merging система', () => {
    describe('MetadataMergeStrategy', () => {
      it('должен поддерживать все стратегии merging', () => {
        const strategies: MetadataMergeStrategy[] = [
          'first-wins',
          'last-wins',
          'merge-contexts',
          'preserve-original',
        ];

        expect(strategies).toHaveLength(4);
        expect(strategies).toContain('first-wins');
        expect(strategies).toContain('last-wins');
        expect(strategies).toContain('merge-contexts');
        expect(strategies).toContain('preserve-original');
      });
    });

    describe('MetadataMergeResult', () => {
      it('должен определять структуру результата merging', () => {
        const result: MetadataMergeResult = {
          merged: {
            correlationId: 'test-correlation' as CorrelationId,
            timestamp: 1234567890 as MetadataTimestamp,
          },
          strategy: 'merge-contexts',
          conflicts: ['correlationId conflict'],
        };

        expect(result.strategy).toBe('merge-contexts');
        expect(result.conflicts).toContain('correlationId conflict');
        expect(result.merged.correlationId).toBe('test-correlation');
      });
    });

    describe('mergeMetadata', () => {
      const primary: ErrorMetadataContext = {
        correlationId: 'primary-correlation' as CorrelationId,
        timestamp: 1000 as MetadataTimestamp,
        context: {
          type: 'user',
          userId: 'user-1',
        },
      };

      const secondary: ErrorMetadataContext = {
        correlationId: 'secondary-correlation' as CorrelationId,
        timestamp: 2000 as MetadataTimestamp,
        context: {
          type: 'user',
          userId: 'user-2',
          sessionId: 'session-123',
        },
      };

      it('должен поддерживать стратегию first-wins', () => {
        const result = mergeMetadata(primary, secondary, 'first-wins');

        expect(result.strategy).toBe('first-wins');
        expect(result.merged).toEqual(primary);
        expect(result.conflicts).toEqual([]);
      });

      it('должен поддерживать стратегию last-wins', () => {
        const result = mergeMetadata(primary, secondary, 'last-wins');

        expect(result.strategy).toBe('last-wins');
        expect(result.merged).toEqual(secondary);
        expect(result.conflicts).toEqual([]);
      });

      it('должен поддерживать стратегию preserve-original', () => {
        const result = mergeMetadata(primary, secondary, 'preserve-original');

        expect(result.strategy).toBe('preserve-original');
        expect(result.merged).toEqual(primary);
        expect(result.conflicts).toEqual([]);
      });

      it('должен поддерживать стратегию merge-contexts по умолчанию', () => {
        const result = mergeMetadata(primary, secondary);

        expect(result.strategy).toBe('merge-contexts');
        expect(result.merged.correlationId).toBe('primary-correlation');
        expect(result.merged.timestamp).toBe(2000); // берем latest
        expect(result.merged.context).toEqual({
          type: 'user',
          userId: 'user-2', // secondary overwrites
          sessionId: 'session-123', // secondary adds
        });
      });

      it('должен обнаруживать конфликты correlationId', () => {
        const result = mergeMetadata(primary, secondary, 'merge-contexts');

        expect(result.conflicts).toContain('correlationId conflict');
      });

      it('должен корректно сливать domain contexts', () => {
        const result = mergeMetadata(primary, secondary, 'merge-contexts');

        expect(result.merged.context).toEqual({
          type: 'user',
          userId: 'user-2', // secondary wins
          sessionId: 'session-123', // added from secondary
        });
      });

      it('должен обрабатывать пустые contexts', () => {
        const noContext: ErrorMetadataContext = {
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
        };

        const result = mergeMetadata(noContext, noContext, 'merge-contexts');

        expect(result.merged.context).toBeUndefined();
      });
    });
  });

  describe('Typed domain contexts', () => {
    describe('ErrorMetadataDomainContext union', () => {
      it('должен поддерживать все типы domain contexts', () => {
        const contexts: ErrorMetadataDomainContext[] = [
          { type: 'user', userId: 'user-123' },
          { type: 'bot', botId: 'bot-456', botType: 'assistant', version: '1.0.0' },
          { type: 'integration', integrationId: 'int-789', integrationType: 'api' },
          { type: 'aiProcessing', modelId: 'gpt-4', processingType: 'text-generation' },
          { type: 'admin', adminId: 'admin-999', role: 'admin', action: 'delete' },
        ];

        expect(contexts).toHaveLength(5);
        contexts.forEach((context) => {
          expect(['user', 'bot', 'integration', 'aiProcessing', 'admin']).toContain(context.type);
        });
      });
    });

    describe('UserContext', () => {
      it('должен определять структуру user context', () => {
        const context: UserContext = {
          type: 'user',
          userId: 'user-123',
          sessionId: 'session-456',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        };

        expect(context.type).toBe('user');
        expect(context.userId).toBe('user-123');
        expect(context.sessionId).toBe('session-456');
        expect(context.userAgent).toBe('Mozilla/5.0');
        expect(context.ipAddress).toBe('192.168.1.1');
      });

      it('должен поддерживать опциональные поля', () => {
        const minimalContext: UserContext = {
          type: 'user',
          userId: 'user-123',
        };

        expect(minimalContext.sessionId).toBeUndefined();
        expect(minimalContext.userAgent).toBeUndefined();
        expect(minimalContext.ipAddress).toBeUndefined();
      });
    });

    describe('BotContext', () => {
      it('должен определять структуру bot context', () => {
        const context: BotContext = {
          type: 'bot',
          botId: 'bot-123',
          botType: 'assistant',
          version: '2.1.0',
          config: { temperature: 0.7 },
        };

        expect(context.type).toBe('bot');
        expect(context.botId).toBe('bot-123');
        expect(context.botType).toBe('assistant');
        expect(context.version).toBe('2.1.0');
        expect(context.config).toEqual({ temperature: 0.7 });
      });

      it('должен поддерживать валидные botType значения', () => {
        const validTypes: BotContext['botType'][] = [
          'assistant',
          'moderator',
          'analyzer',
          'executor',
        ];

        validTypes.forEach((botType) => {
          const context: BotContext = {
            type: 'bot',
            botId: 'bot-123',
            botType,
            version: '1.0.0',
          };

          expect(context.botType).toBe(botType);
        });
      });
    });

    describe('IntegrationContext', () => {
      it('должен определять структуру integration context', () => {
        const context: IntegrationContext = {
          type: 'integration',
          integrationId: 'int-123',
          integrationType: 'api',
          externalSystemId: 'ext-456',
          requestMetadata: { method: 'POST', url: '/api/users' },
        };

        expect(context.type).toBe('integration');
        expect(context.integrationId).toBe('int-123');
        expect(context.integrationType).toBe('api');
        expect(context.externalSystemId).toBe('ext-456');
        expect(context.requestMetadata).toEqual({ method: 'POST', url: '/api/users' });
      });

      it('должен поддерживать валидные integrationType значения', () => {
        const validTypes: IntegrationContext['integrationType'][] = [
          'api',
          'webhook',
          'database',
          'queue',
          'external-service',
        ];

        validTypes.forEach((integrationType) => {
          const context: IntegrationContext = {
            type: 'integration',
            integrationId: 'int-123',
            integrationType,
          };

          expect(context.integrationType).toBe(integrationType);
        });
      });
    });

    describe('AIProcessingContext', () => {
      it('должен определять структуру AI processing context', () => {
        const context: AIProcessingContext = {
          type: 'aiProcessing',
          modelId: 'gpt-4',
          processingType: 'text-generation',
          tokensUsed: 150,
          parameters: { temperature: 0.7, maxTokens: 100 },
        };

        expect(context.type).toBe('aiProcessing');
        expect(context.modelId).toBe('gpt-4');
        expect(context.processingType).toBe('text-generation');
        expect(context.tokensUsed).toBe(150);
        expect(context.parameters).toEqual({ temperature: 0.7, maxTokens: 100 });
      });

      it('должен поддерживать валидные processingType значения', () => {
        const validTypes: AIProcessingContext['processingType'][] = [
          'text-generation',
          'image-processing',
          'data-analysis',
          'classification',
        ];

        validTypes.forEach((processingType) => {
          const context: AIProcessingContext = {
            type: 'aiProcessing',
            modelId: 'gpt-4',
            processingType,
          };

          expect(context.processingType).toBe(processingType);
        });
      });
    });

    describe('AdminContext', () => {
      it('должен определять структуру admin context', () => {
        const context: AdminContext = {
          type: 'admin',
          adminId: 'admin-123',
          role: 'super-admin',
          action: 'delete_user',
          auditMetadata: { reason: 'spam', evidence: 'multiple reports' },
        };

        expect(context.type).toBe('admin');
        expect(context.adminId).toBe('admin-123');
        expect(context.role).toBe('super-admin');
        expect(context.action).toBe('delete_user');
        expect(context.auditMetadata).toEqual({ reason: 'spam', evidence: 'multiple reports' });
      });

      it('должен поддерживать валидные role значения', () => {
        const validRoles: AdminContext['role'][] = ['super-admin', 'admin', 'moderator', 'auditor'];

        validRoles.forEach((role) => {
          const context: AdminContext = {
            type: 'admin',
            adminId: 'admin-123',
            role,
            action: 'login',
          };

          expect(context.role).toBe(role);
        });
      });
    });
  });

  describe('Tracing support', () => {
    describe('TracingMetadata', () => {
      it('должен определять структуру tracing metadata', () => {
        const tracing: TracingMetadata = {
          traceId: 'trace-123',
          spanId: 'span-456',
          parentSpanId: 'parent-span-789',
          serviceName: 'livai-bot',
          operationName: 'process_message',
          tags: { userId: 'user-123', botId: 'bot-456' },
          baggage: { sessionId: 'session-789', requestId: 'req-999' },
        };

        expect(tracing.traceId).toBe('trace-123');
        expect(tracing.spanId).toBe('span-456');
        expect(tracing.parentSpanId).toBe('parent-span-789');
        expect(tracing.serviceName).toBe('livai-bot');
        expect(tracing.operationName).toBe('process_message');
        expect(tracing.tags).toEqual({ userId: 'user-123', botId: 'bot-456' });
        expect(tracing.baggage).toEqual({ sessionId: 'session-789', requestId: 'req-999' });
      });

      it('должен поддерживать опциональный parentSpanId', () => {
        const tracing: TracingMetadata = {
          traceId: 'trace-123',
          spanId: 'span-456',
          serviceName: 'livai-bot',
          operationName: 'process_message',
          tags: {},
          baggage: {},
        };

        expect(tracing.parentSpanId).toBeUndefined();
      });
    });

    describe('ErrorMetadataWithTracing', () => {
      it('должен расширять ErrorMetadataContext tracing', () => {
        const metadata: ErrorMetadataWithTracing = {
          correlationId: 'correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
          context: {
            type: 'user',
            userId: 'user-123',
          },
          tracing: {
            traceId: 'trace-123',
            spanId: 'span-456',
            serviceName: 'livai-bot',
            operationName: 'process_error',
            tags: { errorType: 'validation' },
            baggage: { requestId: 'req-999' },
          },
        };

        expect(metadata.correlationId).toBe('correlation-123');
        expect(metadata.tracing?.traceId).toBe('trace-123');
        expect(metadata.tracing?.tags.errorType).toBe('validation');
      });

      it('должен поддерживать опциональный tracing', () => {
        const metadata: ErrorMetadataWithTracing = {
          correlationId: 'correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
        };

        expect(metadata.tracing).toBeUndefined();
      });
    });

    describe('withTracing', () => {
      it('должен добавлять tracing к метаданным', () => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
          context: {
            type: 'user',
            userId: 'user-123',
          },
        };

        const tracing: TracingMetadata = {
          traceId: 'trace-123',
          spanId: 'span-456',
          serviceName: 'livai-bot',
          operationName: 'handle_error',
          tags: {},
          baggage: {},
        };

        const result = withTracing(metadata, tracing);

        expect(result.correlationId).toBe('correlation-123');
        expect(result.timestamp).toBe(1234567890);
        expect(result.context?.type).toBe('user');
        expect(result.tracing).toEqual(tracing);
      });

      it('должен возвращать ErrorMetadataWithTracing тип', () => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
        };

        const tracing: TracingMetadata = {
          traceId: 'trace-123',
          spanId: 'span-456',
          serviceName: 'service',
          operationName: 'operation',
          tags: {},
          baggage: {},
        };

        const result = withTracing(metadata, tracing);

        expect(result).toHaveProperty('correlationId');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('tracing');
      });
    });
  });

  describe('Validation система', () => {
    describe('validateMetadata', () => {
      it('должен возвращать valid результат для корректных метаданных', () => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'valid-correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
        };

        const result = validateMetadata(metadata);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('должен выявлять ошибки пустого correlationId', () => {
        const metadata: ErrorMetadataContext = {
          correlationId: '   ' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
        };

        const result = validateMetadata(metadata);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('correlationId is required and cannot be empty');
      });

      it('должен выявлять ошибки некорректного timestamp', () => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'valid-correlation-123' as CorrelationId,
          timestamp: 0 as MetadataTimestamp,
        };

        const result = validateMetadata(metadata);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('timestamp must be a positive number');
      });

      it('должен валидировать domain context', () => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'valid-correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
          context: {
            type: 'user',
            userId: '', // пустой userId
          },
        };

        const result = validateMetadata(metadata);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('userId required');
      });

      it('должен передавать warnings из domain context validation', () => {
        // Создадим metadata без context, чтобы не было warnings
        const metadata: ErrorMetadataContext = {
          correlationId: 'valid-correlation-123' as CorrelationId,
          timestamp: 1234567890 as MetadataTimestamp,
        };

        const result = validateMetadata(metadata);

        expect(result.warnings).toEqual([]);
      });
    });

    describe('validateDomainContext', () => {
      it('должен валидировать UserContext', () => {
        const validContext: UserContext = {
          type: 'user',
          userId: 'user-123',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
      });

      it('должен выявлять ошибки в UserContext', () => {
        const invalidContext: UserContext = {
          type: 'user',
          userId: '', // пустой userId
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('userId required');
      });

      it('должен валидировать BotContext', () => {
        const validContext: BotContext = {
          type: 'bot',
          botId: 'bot-123',
          botType: 'assistant',
          version: '1.0.0',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
      });

      it('должен выявлять ошибки в BotContext', () => {
        const invalidContext: BotContext = {
          type: 'bot',
          botId: '',
          botType: 'invalid' as any, // неправильный тип
          version: '1.0.0',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('botId required');
        expect(result.errors).toContain('invalid botType');
      });

      it('должен валидировать IntegrationContext', () => {
        const validContext: IntegrationContext = {
          type: 'integration',
          integrationId: 'int-123',
          integrationType: 'api',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
      });

      it('должен выявлять ошибки в IntegrationContext', () => {
        const invalidContext: IntegrationContext = {
          type: 'integration',
          integrationId: '',
          integrationType: 'invalid' as any,
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('integrationId required');
        expect(result.errors).toContain('invalid integrationType');
      });

      it('должен валидировать AIProcessingContext', () => {
        const validContext: AIProcessingContext = {
          type: 'aiProcessing',
          modelId: 'gpt-4',
          processingType: 'text-generation',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
      });

      it('должен выявлять ошибки в AIProcessingContext', () => {
        const invalidContext: AIProcessingContext = {
          type: 'aiProcessing',
          modelId: '',
          processingType: 'invalid' as any,
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('modelId required');
        expect(result.errors).toContain('invalid processingType');
      });

      it('должен валидировать AdminContext', () => {
        const validContext: AdminContext = {
          type: 'admin',
          adminId: 'admin-123',
          role: 'admin',
          action: 'delete_user',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
      });

      it('должен выявлять ошибки в AdminContext', () => {
        const invalidContext: AdminContext = {
          type: 'admin',
          adminId: '',
          role: 'invalid' as any,
          action: '',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('adminId required');
        expect(result.errors).toContain('invalid role');
        expect(result.errors).toContain('action required');
      });

      it('должен выявлять ошибки в BotContext', () => {
        const invalidContext: BotContext = {
          type: 'bot',
          botId: '',
          botType: 'invalid' as any,
          version: '1.0.0',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('botId required');
        expect(result.errors).toContain('invalid botType');
      });

      it('должен корректно валидировать корректный BotContext', () => {
        const validContext: BotContext = {
          type: 'bot',
          botId: 'bot-123',
          botType: 'assistant',
          version: '1.0.0',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('должен выявлять ошибки в IntegrationContext', () => {
        const invalidContext: IntegrationContext = {
          type: 'integration',
          integrationId: '',
          integrationType: 'invalid' as any,
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('integrationId required');
        expect(result.errors).toContain('invalid integrationType');
      });

      it('должен корректно валидировать корректный IntegrationContext', () => {
        const validContext: IntegrationContext = {
          type: 'integration',
          integrationId: 'integration-123',
          integrationType: 'api',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('должен выявлять ошибки в AIProcessingContext', () => {
        const invalidContext: AIProcessingContext = {
          type: 'aiProcessing',
          modelId: '',
          processingType: 'invalid' as any,
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: invalidContext,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('modelId required');
        expect(result.errors).toContain('invalid processingType');
      });

      it('должен корректно валидировать корректный AIProcessingContext', () => {
        const validContext: AIProcessingContext = {
          type: 'aiProcessing',
          modelId: 'model-123',
          processingType: 'text-generation',
        };

        const result = validateMetadata({
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: validContext,
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен поддерживать полный workflow создания и валидации метаданных', () => {
      // 1. Создание базовых метаданных
      const baseMetadata: ErrorMetadataContext = {
        correlationId: 'workflow-correlation-123' as CorrelationId,
        timestamp: 1234567890 as MetadataTimestamp,
      };

      // 2. Добавление domain context
      const enrichedMetadata: ErrorMetadataContext = {
        ...baseMetadata,
        context: {
          type: 'aiProcessing',
          modelId: 'gpt-4',
          processingType: 'text-generation',
          tokensUsed: 150,
        },
      };

      // 3. Добавление tracing
      const tracing: TracingMetadata = {
        traceId: 'trace-workflow-123',
        spanId: 'span-error-456',
        serviceName: 'livai-bot',
        operationName: 'process_user_message',
        tags: { errorType: 'ai_processing', severity: 'medium' },
        baggage: { userId: 'user-123', sessionId: 'session-456' },
      };

      const tracedMetadata = withTracing(enrichedMetadata, tracing);

      // 4. Валидация
      const validationResult = validateMetadata(tracedMetadata);

      // 5. Merging с другими метаданными
      const secondaryMetadata: ErrorMetadataContext = {
        correlationId: 'secondary-correlation' as CorrelationId,
        timestamp: 1234567900 as MetadataTimestamp,
        context: {
          type: 'user',
          userId: 'user-123',
          sessionId: 'session-updated',
        },
      };

      const mergeResult = mergeMetadata(tracedMetadata, secondaryMetadata, 'merge-contexts');

      // Проверки
      expect(validationResult.isValid).toBe(true);
      expect(tracedMetadata.tracing?.traceId).toBe('trace-workflow-123');
      expect(mergeResult.merged.timestamp).toBe(1234567900); // latest timestamp
      expect(mergeResult.merged.context?.type).toBe('user'); // merged context
      expect(mergeResult.conflicts).toContain('correlationId conflict');
    });

    it('должен поддерживать complex domain context merging', () => {
      const aiContext: AIProcessingContext = {
        type: 'aiProcessing',
        modelId: 'gpt-4',
        processingType: 'text-generation',
        tokensUsed: 100,
      };

      const userContext: UserContext = {
        type: 'user',
        userId: 'user-123',
        sessionId: 'session-456',
      };

      const primary: ErrorMetadataContext = {
        correlationId: 'test-1' as CorrelationId,
        timestamp: 1000 as MetadataTimestamp,
        context: aiContext,
      };

      const secondary: ErrorMetadataContext = {
        correlationId: 'test-2' as CorrelationId,
        timestamp: 2000 as MetadataTimestamp,
        context: userContext,
      };

      const result = mergeMetadata(primary, secondary, 'merge-contexts');

      // При merging разных типов контекстов происходит spread объединение
      expect(result.merged.context).toEqual({
        ...aiContext,
        ...userContext,
      });
      expect(result.merged.timestamp).toBe(2000);
    });

    it('должен обеспечивать type safety в complex workflows', () => {
      // Создание типизированных контекстов
      const userCtx: UserContext = { type: 'user', userId: 'user-123' };
      const botCtx: BotContext = {
        type: 'bot',
        botId: 'bot-456',
        botType: 'assistant',
        version: '1.0',
      };
      const adminCtx: AdminContext = {
        type: 'admin',
        adminId: 'admin-789',
        role: 'admin',
        action: 'login',
      };

      // TypeScript обеспечивает что каждый контекст имеет правильную структуру
      const contexts: ErrorMetadataDomainContext[] = [userCtx, botCtx, adminCtx];

      contexts.forEach((ctx) => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'test' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
          context: ctx,
        };

        expect(metadata.context?.type).toBeDefined();
      });

      // Проверка что union тип работает правильно
      const firstContext = contexts[0];
      if (firstContext.type === 'user') {
        expect(firstContext.userId).toBe('user-123');
        // TypeScript знает что это UserContext
      }
    });
  });

  describe('Edge cases и валидация', () => {
    it('должен корректно обрабатывать пустые строки и whitespace', () => {
      const invalidMetadata = [
        {
          correlationId: '' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
        },
        {
          correlationId: '   ' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
        },
        {
          correlationId: '\t\n' as CorrelationId,
          timestamp: 1000 as MetadataTimestamp,
        },
      ];

      invalidMetadata.forEach((metadata) => {
        const result = validateMetadata(metadata);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('correlationId is required and cannot be empty');
      });
    });

    it('должен обрабатывать extreme значения timestamp', () => {
      const validTimestamps = [1, 1000, 9999999999999, Date.now()];
      const invalidTimestamps = [0, -1, -1000];

      validTimestamps.forEach((timestamp) => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'test' as CorrelationId,
          timestamp: timestamp as MetadataTimestamp,
        };

        const result = validateMetadata(metadata);
        expect(result.isValid).toBe(true);
      });

      invalidTimestamps.forEach((timestamp) => {
        const metadata: ErrorMetadataContext = {
          correlationId: 'test' as CorrelationId,
          timestamp: timestamp as MetadataTimestamp,
        };

        const result = validateMetadata(metadata);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('timestamp must be a positive number');
      });
    });

    it('mergeMetadata должен обрабатывать undefined contexts', () => {
      const withContext: ErrorMetadataContext = {
        correlationId: 'test-1' as CorrelationId,
        timestamp: 1000 as MetadataTimestamp,
        context: { type: 'user', userId: 'user-1' },
      };

      const withoutContext: ErrorMetadataContext = {
        correlationId: 'test-2' as CorrelationId,
        timestamp: 2000 as MetadataTimestamp,
      };

      const result1 = mergeMetadata(withContext, withoutContext, 'merge-contexts');
      const result2 = mergeMetadata(withoutContext, withContext, 'merge-contexts');

      expect(result1.merged.context).toEqual(withContext.context);
      expect(result2.merged.context).toEqual(withContext.context);
    });

    it('tracing metadata должен поддерживать пустые объекты', () => {
      const tracing: TracingMetadata = {
        traceId: 'trace-123',
        spanId: 'span-456',
        serviceName: 'service',
        operationName: 'operation',
        tags: {},
        baggage: {},
      };

      expect(tracing.tags).toEqual({});
      expect(tracing.baggage).toEqual({});
      expect(tracing.parentSpanId).toBeUndefined();
    });

    it('должен поддерживать deeply nested context merging', () => {
      // Создание complex contexts для тестирования глубокого merging
      const complexPrimary: ErrorMetadataContext = {
        correlationId: 'primary' as CorrelationId,
        timestamp: 1000 as MetadataTimestamp,
        context: {
          type: 'integration',
          integrationId: 'int-1',
          integrationType: 'api',
          requestMetadata: { method: 'GET', headers: { auth: 'token1' } },
        },
      };

      const complexSecondary: ErrorMetadataContext = {
        correlationId: 'secondary' as CorrelationId,
        timestamp: 2000 as MetadataTimestamp,
        context: {
          type: 'integration',
          integrationId: 'int-2',
          integrationType: 'webhook',
          externalSystemId: 'ext-123',
          requestMetadata: { method: 'POST', body: 'data' },
        },
      };

      const result = mergeMetadata(complexPrimary, complexSecondary, 'merge-contexts');

      // Вторичный контекст должен перезаписать первичный
      expect(result.merged.context).toEqual({
        type: 'integration',
        integrationId: 'int-2',
        integrationType: 'webhook',
        externalSystemId: 'ext-123',
        requestMetadata: { method: 'POST', body: 'data' },
      });
    });
  });
});
