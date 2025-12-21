import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  AdminErrorBuilders,
  createAsyncError,
  createAsyncErrorWithBuilder,
  createBaseMetadata,
  DomainErrorBuilders,
  ErrorBuilder,
  errorBuilder,
  InfraErrorBuilders,
  LivAiErrorBuilder,
  ServiceErrorBuilders,
} from '../../../../src/errors/base/ErrorBuilders';
import type { ErrorBuildResult, ErrorConfig } from '../../../../src/errors/base/ErrorBuilders';

import type { LivAiErrorCode } from '../../../../src/errors/base/ErrorCode';
import type { TaggedError } from '../../../../src/errors/base/BaseErrorTypes';
import type {
  ErrorMetadataContext,
  MetadataClock,
} from '../../../../src/errors/base/ErrorMetadata';

describe('ErrorBuilders', () => {
  // Mock MetadataClock для тестирования
  const mockClock: MetadataClock = {
    generateCorrelationId: vi.fn(() => 'test-correlation-id' as any),
    getCurrentTimestamp: vi.fn(() => 1234567890 as any),
  };

  describe('createBaseMetadata', () => {
    it('должен создавать базовые метаданные без domain context', () => {
      const result = createBaseMetadata(mockClock);

      expect(result.correlationId).toBe('test-correlation-id');
      expect(result.timestamp).toBe(1234567890);
      expect(result.context).toBeUndefined();

      expect(mockClock.generateCorrelationId).toHaveBeenCalledTimes(1);
      expect(mockClock.getCurrentTimestamp).toHaveBeenCalledTimes(1);
    });

    it('должен создавать базовые метаданные с domain context', () => {
      const domainContext = {
        type: 'user' as const,
        userId: 'test-user',
      };

      const result = createBaseMetadata(mockClock, domainContext);

      expect(result.correlationId).toBe('test-correlation-id');
      expect(result.timestamp).toBe(1234567890);
      expect(result.context).toEqual(domainContext);
    });
  });

  describe('ErrorBuilder', () => {
    describe('конструктор и базовые методы', () => {
      it('должен создавать builder без параметров', () => {
        const builder = new ErrorBuilder();
        expect(builder).toBeInstanceOf(ErrorBuilder);
      });

      it('withClock должен устанавливать clock', () => {
        const builder = new ErrorBuilder();
        const builderWithClock = builder.withClock(mockClock);

        expect(builderWithClock).toBeInstanceOf(ErrorBuilder);
        expect(builderWithClock).not.toBe(builder); // Иммутабельность
      });

      it('withDomainContext должен устанавливать domain context', () => {
        const builder = new ErrorBuilder();
        const context = { type: 'user' as const, userId: 'test-user' };
        const builderWithContext = builder.withDomainContext(context);

        expect(builderWithContext).toBeInstanceOf(ErrorBuilder);
        expect(builderWithContext).not.toBe(builder); // Иммутабельность
      });

      it('code должен устанавливать код ошибки', () => {
        const builder = new ErrorBuilder();
        const builderWithCode = builder.code('DOMAIN_TEST_001' as LivAiErrorCode);

        expect(builderWithCode).toBeInstanceOf(ErrorBuilder);
        expect(builderWithCode).not.toBe(builder);
      });

      it('message должен устанавливать сообщение ошибки', () => {
        const builder = new ErrorBuilder();
        const builderWithMessage = builder.message('Test error message');

        expect(builderWithMessage).toBeInstanceOf(ErrorBuilder);
        expect(builderWithMessage).not.toBe(builder);
      });

      it('metadata должен устанавливать метаданные', () => {
        const builder = new ErrorBuilder();
        const metadata: ErrorMetadataContext = {
          correlationId: 'test-id' as any,
          timestamp: 1234567890 as any,
        };
        const builderWithMetadata = builder.metadata(metadata);

        expect(builderWithMetadata).toBeInstanceOf(ErrorBuilder);
        expect(builderWithMetadata).not.toBe(builder);
      });

      it('classification должен устанавливать классификацию', () => {
        const builder = new ErrorBuilder();
        const classification = {
          severity: 'error' as any,
          category: 'technical' as any,
          origin: 'internal' as any,
          impact: 'low' as any,
          scope: 'single' as any,
          layer: 'domain' as any,
          priority: 'medium' as any,
          retryPolicy: 'none' as any,
        };
        const builderWithClassification = builder.classification(classification);

        expect(builderWithClassification).toBeInstanceOf(ErrorBuilder);
        expect(builderWithClassification).not.toBe(builder);
      });

      it('cause должен устанавливать причину ошибки', () => {
        const builder = new ErrorBuilder();
        const cause = new Error('Original error');
        const builderWithCause = builder.cause(cause);

        expect(builderWithCause).toBeInstanceOf(ErrorBuilder);
        expect(builderWithCause).not.toBe(builder);
      });
    });

    describe('buildWithTag', () => {
      it('должен возвращать ошибку валидации при отсутствии code или message', () => {
        const builder = new ErrorBuilder();
        const result = builder.buildWithTag('TestError');

        expect(result.validation.isValid).toBe(false);
        expect(result.validation.errors).toHaveLength(1);
        expect(result.validation.errors[0].code).toBe('MISSING_CODE_OR_MESSAGE');
        expect((result.error as any)._tag).toBe('TestError');
        expect((result.error as any).code).toBe('DOMAIN_VALIDATION_001');
      });

      it('должен создавать ошибку с минимальными полями', () => {
        const builder = new ErrorBuilder()
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('Test error');

        const result = builder.buildWithTag('TestError');

        expect(result.validation.isValid).toBe(true);
        expect((result.error as any)._tag).toBe('TestError');
        expect((result.error as any).code).toBe('DOMAIN_TEST_001');
        expect((result.error as any).message).toBe('Test error');
        expect((result.error as any).metadata).toBeUndefined();
        expect((result.error as any).classification).toBeUndefined();
        expect((result.error as any).cause).toBeUndefined();
      });

      it('должен автоматически генерировать метаданные при наличии clock', () => {
        const builder = new ErrorBuilder()
          .withClock(mockClock)
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('Test error');

        const result = builder.buildWithTag('TestError');

        expect((result.error as any).metadata).toBeDefined();
        expect((result.error as any).metadata?.correlationId).toBe('test-correlation-id');
        expect((result.error as any).metadata?.timestamp).toBe(1234567890);
      });

      it('должен использовать предоставленные метаданные вместо автоматической генерации', () => {
        const customMetadata: ErrorMetadataContext = {
          correlationId: 'custom-id' as any,
          timestamp: 999999999 as any,
          context: { type: 'user' as const, userId: 'custom-user' },
        };

        const builder = new ErrorBuilder()
          .withClock(mockClock)
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('Test error')
          .metadata(customMetadata);

        const result = builder.buildWithTag('TestError');

        expect((result.error as any).metadata).toBe(customMetadata);
        expect((result.error as any).metadata?.correlationId).toBe('custom-id');
        expect((result.error as any).metadata?.context?.userId).toBe('custom-user');
      });

      it('должен включать все поля в построенную ошибку', () => {
        const cause = new Error('Root cause');
        const classification = {
          severity: 'critical' as any,
          category: 'technical' as any,
          origin: 'infrastructure' as any,
          impact: 'system' as any,
          scope: 'global' as any,
          layer: 'infrastructure' as any,
          priority: 'critical' as any,
          retryPolicy: 'exponential_backoff' as any,
        };

        const builder = new ErrorBuilder()
          .code('INFRA_DB_001' as LivAiErrorCode)
          .message('Database connection failed')
          .classification(classification)
          .cause(cause);

        const result = builder.buildWithTag('DatabaseError');

        expect((result.error as any)._tag).toBe('DatabaseError');
        expect((result.error as any).code).toBe('INFRA_DB_001');
        expect((result.error as any).message).toBe('Database connection failed');
        expect((result.error as any).classification).toBe(classification);
        expect((result.error as any).cause).toBe(cause);
      });
    });
  });

  describe('DomainErrorBuilders', () => {
    let domainBuilders: DomainErrorBuilders;

    beforeEach(() => {
      domainBuilders = new DomainErrorBuilders(mockClock);
    });

    it('auth должен создавать builder с UserContext', () => {
      const builder = domainBuilders.auth('user-123', 'session-456');

      expect(builder).toBeInstanceOf(ErrorBuilder);

      // Проверяем что domain context установлен правильно
      const result = builder
        .code('DOMAIN_AUTH_001' as LivAiErrorCode)
        .message('Authentication failed')
        .buildWithTag('AuthError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
        sessionId: 'session-456',
      });
    });

    it('auth должен работать без sessionId', () => {
      const builder = domainBuilders.auth('user-123');

      const result = builder
        .code('DOMAIN_AUTH_001' as LivAiErrorCode)
        .message('Authentication failed')
        .buildWithTag('AuthError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
      });
    });

    it('user должен создавать builder с UserContext', () => {
      const builder = domainBuilders.user('user-123', 'session-456');

      const result = builder
        .code('DOMAIN_USER_001' as LivAiErrorCode)
        .message('User error')
        .buildWithTag('UserError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
        sessionId: 'session-456',
      });
    });

    it('subscription должен создавать builder с UserContext', () => {
      const builder = domainBuilders.subscription('user-123');

      const result = builder
        .code('DOMAIN_SUBSCRIPTION_001' as LivAiErrorCode)
        .message('Subscription error')
        .buildWithTag('SubscriptionError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
      });
    });

    it('bot должен создавать builder с BotContext', () => {
      const builder = domainBuilders.bot('bot-123', 'assistant', '1.0.0');

      const result = builder
        .code('DOMAIN_BOT_001' as LivAiErrorCode)
        .message('Bot error')
        .buildWithTag('BotError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'bot',
        botId: 'bot-123',
        botType: 'assistant',
        version: '1.0.0',
      });
    });

    it('token должен создавать builder с UserContext', () => {
      const builder = domainBuilders.token('user-123');

      const result = builder
        .code('DOMAIN_TOKEN_001' as LivAiErrorCode)
        .message('Token error')
        .buildWithTag('TokenError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
      });
    });

    it('integration должен создавать builder с IntegrationContext', () => {
      const builder = domainBuilders.integration('integration-123', 'api');

      const result = builder
        .code('DOMAIN_INTEGRATION_001' as LivAiErrorCode)
        .message('Integration error')
        .buildWithTag('IntegrationError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'integration',
        integrationId: 'integration-123',
        integrationType: 'api',
      });
    });
  });

  describe('InfraErrorBuilders', () => {
    let infraBuilders: InfraErrorBuilders;

    beforeEach(() => {
      infraBuilders = new InfraErrorBuilders(mockClock);
    });

    it('database должен создавать builder с InfraContext для database', () => {
      const builder = infraBuilders.database('users', 'SELECT');

      const result = builder
        .code('INFRA_DB_001' as LivAiErrorCode)
        .message('Database error')
        .buildWithTag('DatabaseError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'infrastructure',
        component: 'database',
        tableName: 'users',
        operation: 'SELECT',
      });
    });

    it('database должен работать с минимальными параметрами', () => {
      const builder = infraBuilders.database();

      const result = builder
        .code('INFRA_DB_001' as LivAiErrorCode)
        .message('Database error')
        .buildWithTag('DatabaseError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'infrastructure',
        component: 'database',
      });
    });

    it('cache должен создавать builder с InfraContext для cache', () => {
      const builder = infraBuilders.cache('user:123', 'GET');

      const result = builder
        .code('INFRA_CACHE_001' as LivAiErrorCode)
        .message('Cache error')
        .buildWithTag('CacheError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'infrastructure',
        component: 'cache',
        cacheKey: 'user:123',
        operation: 'GET',
      });
    });

    it('network должен создавать builder с InfraContext для network', () => {
      const builder = infraBuilders.network('https://api.example.com', 'POST');

      const result = builder
        .code('INFRA_NETWORK_001' as LivAiErrorCode)
        .message('Network error')
        .buildWithTag('NetworkError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'infrastructure',
        component: 'network',
        url: 'https://api.example.com',
        method: 'POST',
      });
    });

    it('external должен создавать builder с IntegrationContext', () => {
      const builder = infraBuilders.external('payment-service', 'stripe-001');

      const result = builder
        .code('INFRA_EXTERNAL_001' as LivAiErrorCode)
        .message('External service error')
        .buildWithTag('ExternalError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'integration',
        integrationId: 'payment-service',
        integrationType: 'external-service',
        externalSystemId: 'stripe-001',
      });
    });
  });

  describe('ServiceErrorBuilders', () => {
    let serviceBuilders: ServiceErrorBuilders;

    beforeEach(() => {
      serviceBuilders = new ServiceErrorBuilders(mockClock);
    });

    it('ai должен создавать builder с AIProcessingContext', () => {
      const builder = serviceBuilders.ai('gpt-4', 'text-generation');

      const result = builder
        .code('SERVICE_AI_001' as LivAiErrorCode)
        .message('AI processing error')
        .buildWithTag('AIError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'aiProcessing',
        modelId: 'gpt-4',
        processingType: 'text-generation',
      });
    });

    it('billing должен создавать builder с расширенным UserContext', () => {
      const builder = serviceBuilders.billing('user-123', 'charge');

      const result = builder
        .code('SERVICE_BILLING_001' as LivAiErrorCode)
        .message('Billing error')
        .buildWithTag('BillingError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
        billingOperation: 'charge',
      });
    });

    it('mobile должен создавать builder с расширенным UserContext', () => {
      const builder = serviceBuilders.mobile('user-123', 'device-456');

      const result = builder
        .code('SERVICE_MOBILE_001' as LivAiErrorCode)
        .message('Mobile error')
        .buildWithTag('MobileError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'user',
        userId: 'user-123',
        deviceId: 'device-456',
        platform: 'mobile',
      });
    });

    it('tenant должен создавать builder с IntegrationContext для tenant', () => {
      const builder = serviceBuilders.tenant('tenant-123', 'create');

      const result = builder
        .code('SERVICE_TENANT_001' as LivAiErrorCode)
        .message('Tenant error')
        .buildWithTag('TenantError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'integration',
        integrationId: 'tenant-123',
        integrationType: 'database',
        operation: 'create',
      });
    });

    it('feature должен создавать builder с IntegrationContext для feature flags', () => {
      const builder = serviceBuilders.feature('new-ui-feature', 'user-123');

      const result = builder
        .code('SERVICE_FEATURE_001' as LivAiErrorCode)
        .message('Feature flag error')
        .buildWithTag('FeatureError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'integration',
        integrationId: 'new-ui-feature',
        integrationType: 'api',
        userId: 'user-123',
      });
    });
  });

  describe('AdminErrorBuilders', () => {
    let adminBuilders: AdminErrorBuilders;

    beforeEach(() => {
      adminBuilders = new AdminErrorBuilders(mockClock);
    });

    it('user должен создавать builder с AdminContext для user management', () => {
      const builder = adminBuilders.user('admin-123', 'target-user-456', 'delete');

      const result = builder
        .code('ADMIN_USER_001' as LivAiErrorCode)
        .message('Admin user error')
        .buildWithTag('AdminUserError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'admin',
        adminId: 'admin-123',
        role: 'admin',
        action: 'delete',
      });
    });

    it('finance должен создавать builder с AdminContext для finance operations', () => {
      const builder = adminBuilders.finance('admin-123', 'refund', 99.99);

      const result = builder
        .code('ADMIN_FINANCE_001' as LivAiErrorCode)
        .message('Admin finance error')
        .buildWithTag('AdminFinanceError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'admin',
        adminId: 'admin-123',
        role: 'admin',
        action: 'refund',
        amount: 99.99,
      });
    });

    it('audit должен создавать builder с AdminContext для audit operations', () => {
      const builder = adminBuilders.audit('auditor-123', 'review-logs');

      const result = builder
        .code('ADMIN_AUDIT_001' as LivAiErrorCode)
        .message('Admin audit error')
        .buildWithTag('AdminAuditError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'admin',
        adminId: 'auditor-123',
        role: 'auditor',
        action: 'review-logs',
      });
    });

    it('integration должен создавать builder с расширенным AdminContext', () => {
      const builder = adminBuilders.integration('admin-123', 'slack-integration', 'configure');

      const result = builder
        .code('ADMIN_INTEGRATION_001' as LivAiErrorCode)
        .message('Admin integration error')
        .buildWithTag('AdminIntegrationError');

      expect((result.error as any).metadata?.context).toEqual({
        type: 'admin',
        adminId: 'admin-123',
        role: 'admin',
        action: 'configure',
        integrationId: 'slack-integration',
      });
    });
  });

  describe('LivAiErrorBuilder', () => {
    it('должен предоставлять доступ ко всем типам builders', () => {
      const mainBuilder = new LivAiErrorBuilder(mockClock);

      expect(mainBuilder.domain).toBeInstanceOf(DomainErrorBuilders);
      expect(mainBuilder.infra).toBeInstanceOf(InfraErrorBuilders);
      expect(mainBuilder.service).toBeInstanceOf(ServiceErrorBuilders);
      expect(mainBuilder.admin).toBeInstanceOf(AdminErrorBuilders);
    });

    it('должен передавать clock всем sub-builders', () => {
      const mainBuilder = new LivAiErrorBuilder(mockClock);

      // Проверяем что clock передан через создание ошибки
      const result = mainBuilder.domain.auth('user-123')
        .code('DOMAIN_AUTH_001' as LivAiErrorCode)
        .message('Test auth error')
        .buildWithTag('AuthError');

      expect((result.error as any).metadata?.correlationId).toBe('test-correlation-id');
      expect((result.error as any).metadata?.timestamp).toBe(1234567890);
    });
  });

  describe('глобальный errorBuilder', () => {
    it('должен быть доступен как singleton', () => {
      expect(errorBuilder).toBeInstanceOf(LivAiErrorBuilder);
      expect(errorBuilder.domain).toBeDefined();
      expect(errorBuilder.infra).toBeDefined();
      expect(errorBuilder.service).toBeDefined();
      expect(errorBuilder.admin).toBeDefined();
    });

    it('должен позволять создавать ошибки всех типов', () => {
      // Domain error
      const domainResult = errorBuilder.domain.auth('user-123')
        .code('DOMAIN_AUTH_001' as LivAiErrorCode)
        .message('Authentication failed')
        .buildWithTag('AuthError');

      expect((domainResult.error as any)._tag).toBe('AuthError');
      expect((domainResult.error as any).code).toBe('DOMAIN_AUTH_001');

      // Infra error
      const infraResult = errorBuilder.infra.database('users')
        .code('INFRA_DB_001' as LivAiErrorCode)
        .message('Database error')
        .buildWithTag('DatabaseError');

      expect((infraResult.error as any)._tag).toBe('DatabaseError');
      expect((infraResult.error as any).code).toBe('INFRA_DB_001');
    });
  });

  describe('Effect интеграция', () => {
    describe('createAsyncError', () => {
      it('должен создавать ошибку в Effect контексте', async () => {
        const config: ErrorConfig = {
          code: 'DOMAIN_TEST_001' as LivAiErrorCode,
          message: 'Async test error',
        };

        const effect = createAsyncError('AsyncError', config, mockClock);
        const result = await Effect.runPromise(effect);

        expect((result.error as any)._tag).toBe('AsyncError');
        expect((result.error as any).code).toBe('DOMAIN_TEST_001');
        expect((result.error as any).message).toBe('Async test error');
        expect((result.error as any).metadata?.correlationId).toBe('test-correlation-id');
      });

      it('должен работать без clock', async () => {
        const config: ErrorConfig = {
          code: 'DOMAIN_TEST_002' as LivAiErrorCode,
          message: 'Async test without clock',
        };

        const effect = createAsyncError('AsyncError', config);
        const result = await Effect.runPromise(effect);

        expect((result.error as any)._tag).toBe('AsyncError');
        expect((result.error as any).code).toBe('DOMAIN_TEST_002');
        expect((result.error as any).metadata).toBeUndefined();
      });

      it('должен использовать предоставленные метаданные', async () => {
        const customMetadata: ErrorMetadataContext = {
          correlationId: 'custom-async-id' as any,
          timestamp: 999999999 as any,
        };

        const config: ErrorConfig = {
          code: 'DOMAIN_TEST_003' as LivAiErrorCode,
          message: 'Async test with custom metadata',
          metadata: customMetadata,
        };

        const effect = createAsyncError('AsyncError', config, mockClock);
        const result = await Effect.runPromise(effect);

        expect((result.error as any).metadata).toBe(customMetadata);
        expect((result.error as any).metadata?.correlationId).toBe('custom-async-id');
      });
    });

    describe('createAsyncErrorWithBuilder', () => {
      it('должен использовать предоставленный builder', async () => {
        const builder = new ErrorBuilder().withClock(mockClock);
        const config: ErrorConfig = {
          code: 'DOMAIN_TEST_004' as LivAiErrorCode,
          message: 'Async test with builder',
        };

        const effect = createAsyncErrorWithBuilder(builder, 'BuilderError', config);
        const result = await Effect.runPromise(effect);

        expect((result.error as any)._tag).toBe('BuilderError');
        expect((result.error as any).code).toBe('DOMAIN_TEST_004');
        expect((result.error as any).metadata?.correlationId).toBe('test-correlation-id');
      });

      it('должен поддерживать все опции конфигурации', async () => {
        const builder = new ErrorBuilder().withClock(mockClock);
        const cause = new Error('Root cause');

        const config: ErrorConfig = {
          code: 'DOMAIN_TEST_005' as LivAiErrorCode,
          message: 'Full config async error',
          classification: {
            severity: 'error' as any,
            category: 'business' as any,
            origin: 'user' as any,
            impact: 'medium' as any,
            scope: 'single' as any,
            layer: 'domain' as any,
            priority: 'high' as any,
            retryPolicy: 'retry_once' as any,
          },
          cause,
        };

        const effect = createAsyncErrorWithBuilder(builder, 'FullConfigError', config);
        const result = await Effect.runPromise(effect);

        expect((result.error as any)._tag).toBe('FullConfigError');
        expect((result.error as any).code).toBe('DOMAIN_TEST_005');
        expect((result.error as any).message).toBe('Full config async error');
        expect((result.error as any).classification?.severity).toBe('error');
        expect((result.error as any).cause).toBe(cause);
        expect((result.error as any).metadata?.correlationId).toBe('test-correlation-id');
      });
    });
  });

  describe('Критические зоны и edge cases', () => {
    describe('Обработка ошибок валидации', () => {
      it('buildWithTag должен возвращать корректную структуру при ошибке валидации', () => {
        const builder = new ErrorBuilder();

        const result = builder.buildWithTag('InvalidError');

        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('validation');
        expect(result.validation.isValid).toBe(false);
        expect((result.error as any)._tag).toBe('InvalidError');
        expect((result.error as any).code).toBe('DOMAIN_VALIDATION_001');
      });

      it('должен обрабатывать невалидные коды ошибок', () => {
        const builder = new ErrorBuilder()
          .code('INVALID_CODE' as any)
          .message('Test message');

        const result = builder.buildWithTag('InvalidCodeError');

        expect(result.validation.isValid).toBe(false);
        expect(result.validation.errors.some((e) => e.code === 'INVALID_ERROR_CODE_FORMAT')).toBe(
          true,
        );
      });
    });

    describe('Иммутабельность builders', () => {
      it('все методы должны возвращать новые экземпляры', () => {
        const original = new ErrorBuilder();

        const withClock = original.withClock(mockClock);
        const withCode = withClock.code('DOMAIN_TEST_001' as LivAiErrorCode);
        const withMessage = withCode.message('Test message');
        const withMetadata = withMessage.metadata({
          correlationId: 'test' as any,
          timestamp: 123 as any,
        });
        const withCause = withMetadata.cause(new Error('Cause'));

        expect(withClock).not.toBe(original);
        expect(withCode).not.toBe(withClock);
        expect(withMessage).not.toBe(withCode);
        expect(withMetadata).not.toBe(withMessage);
        expect(withCause).not.toBe(withMetadata);
      });
    });

    describe('Обработка undefined и null значений', () => {
      it('должен корректно обрабатывать undefined clock', () => {
        const builder = new ErrorBuilder()
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('Test without clock');

        const result = builder.buildWithTag('NoClockError');

        expect(result.validation.isValid).toBe(true);
        expect((result.error as any).metadata).toBeUndefined();
      });

      it('должен корректно обрабатывать undefined domain context', () => {
        const builder = new ErrorBuilder()
          .withClock(mockClock)
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('Test without domain context');

        const result = builder.buildWithTag('NoContextError');

        expect((result.error as any).metadata?.context).toBeUndefined();
      });

      it('builders без clock должны работать корректно', () => {
        const domainBuilders = new DomainErrorBuilders(); // без clock
        const infraBuilders = new InfraErrorBuilders(); // без clock
        const serviceBuilders = new ServiceErrorBuilders(); // без clock
        const adminBuilders = new AdminErrorBuilders(); // без clock

        expect(() => domainBuilders.auth('user-123')).not.toThrow();
        expect(() => infraBuilders.database()).not.toThrow();
        expect(() => serviceBuilders.ai('model-1', 'text-generation')).not.toThrow();
        expect(() => adminBuilders.user('admin-1', 'user-1', 'action')).not.toThrow();
      });
    });

    describe('Валидация входных параметров', () => {
      it('должен отклонять пустые строки в коде ошибки', () => {
        const builder = new ErrorBuilder()
          .code('' as any)
          .message('Test message');

        const result = builder.buildWithTag('EmptyCodeError');

        expect(result.validation.isValid).toBe(false);
      });

      it('должен отклонять пустые сообщения', () => {
        const builder = new ErrorBuilder()
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('');

        const result = builder.buildWithTag('EmptyMessageError');

        expect(result.validation.isValid).toBe(false);
      });

      it('должен принимать корректные коды ошибок всех доменов', () => {
        const testCases = [
          'DOMAIN_AUTH_001',
          'INFRA_DB_002',
          'SERVICE_AI_003',
          'ADMIN_USER_004',
        ] as LivAiErrorCode[];

        testCases.forEach((code) => {
          const builder = new ErrorBuilder()
            .code(code)
            .message('Test message');

          const result = builder.buildWithTag('TestError');
          expect(result.validation.isValid).toBe(true);
        });
      });
    });

    describe('Интеграция с типами', () => {
      it('должен корректно работать с TaggedError типами', () => {
        type AuthError = TaggedError<{ userId: string; }, 'AuthError'>;

        const builder = new LivAiErrorBuilder(mockClock).domain.auth('user-123')
          .code('DOMAIN_AUTH_001' as LivAiErrorCode)
          .message('Authentication failed');

        const result = builder.buildWithTag('AuthError');

        // Проверяем структуру, совместимую с AuthError типом
        const error = result.error as any;
        expect(error._tag).toBe('AuthError');
        expect(error.code).toBe('DOMAIN_AUTH_001');
        expect(error.message).toBe('Authentication failed');
        expect(error.metadata?.context?.userId).toBe('user-123');
      });

      it('должен поддерживать custom типы в ErrorBuildResult', () => {
        type CustomError = TaggedError<{ customField: number; }, 'CustomError'>;

        const builder = new ErrorBuilder<{ customField: number; }, 'CustomError'>()
          .code('DOMAIN_TEST_001' as LivAiErrorCode)
          .message('Custom error');

        const result: ErrorBuildResult<{ customField: number; }, 'CustomError'> = builder
          .buildWithTag('CustomError');

        expect((result.error as any)._tag).toBe('CustomError');
      });
    });
  });
});
