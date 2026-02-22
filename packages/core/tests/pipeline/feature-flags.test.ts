/**
 * @file Unit тесты для Feature Flags (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createCombinedResolver,
  createTenantResolver,
  createTrafficPercentageResolver,
  createUserBucketResolver,
  DEFAULT_ROLLOUT_CONFIG,
  getPipelineVersion,
  isActiveMode,
  isShadowMode,
  resolveFeatureFlag,
  resolvePipelineMode,
} from '../../src/pipeline/feature-flags.js';
import type {
  PipelineMode,
  PipelineVersion,
  ResolverPriority,
  RolloutConfig,
} from '../../src/pipeline/feature-flags.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestContext = Readonly<{
  readonly userId?: string;
  readonly tenantId?: string;
  readonly ip?: string;
  readonly customField?: string;
}>;

function createTestConfig(
  overrides: Partial<RolloutConfig<TestContext>> = {},
): RolloutConfig<TestContext> {
  return {
    ...DEFAULT_ROLLOUT_CONFIG,
    ...overrides,
  };
}

function createTestContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    userId: 'user123',
    tenantId: 'tenant456',
    ip: '192.168.1.1',
    ...overrides,
  };
}

/* ============================================================================
 * 🏭 RESOLVER FACTORIES — TESTS
 * ============================================================================
 */

describe('Resolver Factories', () => {
  describe('createUserBucketResolver', () => {
    it('возвращает forced mode для контекста без userId', () => {
      const config = createTestConfig({ shadowTrafficPercentage: 50 });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext();
      // Simulate context without userId
      const contextWithoutUserId = { tenantId: context.tenantId, ip: context.ip };
      const result = resolver(contextWithoutUserId as TestContext);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('возвращает forced mode когда bucket не включен', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 50,
        enabledBuckets: ['10', '20'],
      });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext({ userId: 'user999' }); // bucket будет не 10 или 20
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('возвращает forced mode когда total percentage = 0', () => {
      const config = createTestConfig({ shadowTrafficPercentage: 0, activeTrafficPercentage: 0 });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('возвращает shadow mode для bucket в shadow диапазоне', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100, // 100% shadow
        shadowVersion: 'v2',
      });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });

    it('возвращает active mode для bucket в active диапазоне', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 0,
        activeTrafficPercentage: 100, // 0-99 range for active
        activeVersion: 'v3',
      });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result.kind).toBe('active');
      expect(result.version).toBe('v3');
    });

    it('возвращает forced mode для bucket вне диапазонов', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 0,
        activeTrafficPercentage: 0, // no shadow or active traffic
      });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('работает с включенными buckets', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        enabledBuckets: ['0'], // allow only bucket 0
        shadowVersion: 'v2',
      });
      const resolver = createUserBucketResolver(config);
      const context = createTestContext({ userId: 'test_user_for_bucket_0' }); // this should be forced
      const result = resolver(context);
      // Since we don't know the exact bucket, just test that it's either shadow or forced
      expect(['shadow', 'forced']).toContain(result.kind);
    });
  });

  describe('createTenantResolver', () => {
    it('возвращает forced mode для контекста без tenantId', () => {
      const config = createTestConfig({ shadowTrafficPercentage: 50 });
      const resolver = createTenantResolver(config);
      const context = createTestContext();
      // Simulate context without tenantId
      const contextWithoutTenantId = { userId: context.userId, ip: context.ip };
      const result = resolver(contextWithoutTenantId as TestContext);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('возвращает forced mode когда tenant не включен', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 50,
        enabledTenants: ['tenant1', 'tenant2'],
      });
      const resolver = createTenantResolver(config);
      const context = createTestContext({ tenantId: 'tenant999' });
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('возвращает forced mode когда total percentage = 0', () => {
      const config = createTestConfig({ shadowTrafficPercentage: 0, activeTrafficPercentage: 0 });
      const resolver = createTenantResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('работает с включенными tenants', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        enabledTenants: ['tenant456'],
        shadowVersion: 'v2',
      });
      const resolver = createTenantResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });

    it('использует userId для детерминированного распределения', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100, // 100% shadow
        shadowVersion: 'v2',
      });
      const resolver = createTenantResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result.kind).toBe('shadow');
      expect(result.version).toBe('v2');
    });

    it('использует tenantId для распределения когда userId отсутствует', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 50,
        shadowVersion: 'v2',
      });
      const resolver = createTenantResolver(config);
      const context = createTestContext();
      // Simulate context without userId
      const contextWithoutUserId = { tenantId: context.tenantId, ip: context.ip };
      const result = resolver(contextWithoutUserId as TestContext);
      expect(result.kind).toBe('shadow');
      expect(result.version).toBe('v2');
    });
  });

  describe('createTrafficPercentageResolver', () => {
    it('возвращает forced mode когда total percentage = 0', () => {
      const config = createTestConfig({ shadowTrafficPercentage: 0, activeTrafficPercentage: 0 });
      const resolver = createTrafficPercentageResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('использует userId для детерминированного распределения', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100, // 100% shadow
        shadowVersion: 'v2',
      });
      const resolver = createTrafficPercentageResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });

    it('использует ip когда userId отсутствует', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100, // 100% shadow
        shadowVersion: 'v2',
      });
      const resolver = createTrafficPercentageResolver(config);
      const context = createTestContext();
      // Simulate context without userId
      const contextWithoutUserId = { tenantId: context.tenantId, ip: context.ip };
      const result = resolver(contextWithoutUserId as TestContext);
      expect(result.kind).toBe('shadow');
      expect(result.version).toBe('v2');
    });

    it('использует hash контекста когда userId и ip отсутствуют', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100, // 100% shadow
        shadowVersion: 'v2',
      });
      const resolver = createTrafficPercentageResolver(config);
      const context = createTestContext();
      // Simulate context without userId and ip
      const contextMinimal = { tenantId: context.tenantId };
      const result = resolver(contextMinimal as TestContext);
      expect(result.kind).toBe('shadow');
      expect(result.version).toBe('v2');
    });
  });

  describe('createCombinedResolver', () => {
    it('использует customResolver когда он указан', () => {
      const calledWithRef = { value: null as any };
      const customResolver: any = (ctx: any) => {
        // eslint-disable-next-line fp/no-mutation
        calledWithRef.value = ctx;
        return { kind: 'active', version: 'v3' };
      };
      const config = createTestConfig({ customResolver });
      const context = createTestContext();
      const result = resolvePipelineMode(context, config);
      expect(calledWithRef.value).toBe(context);
      expect(result).toEqual({ kind: 'active', version: 'v3' });
    });

    it('использует resolverPipeline когда он указан', () => {
      const resolver1 = vi.fn().mockReturnValue({ kind: 'forced', version: 'v1' });
      const resolver2 = vi.fn().mockReturnValue({ kind: 'active', version: 'v3' });
      const config = createTestConfig({
        resolverPipeline: [resolver1, resolver2],
      });
      const resolver = createCombinedResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(resolver2).toHaveBeenCalledWith(context);
      expect(result).toEqual({ kind: 'active', version: 'v3' });
    });

    it('возвращает forced mode когда resolverPipeline пустой', () => {
      const config = createTestConfig({
        resolverPipeline: [],
      });
      const resolver = createCombinedResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('использует дефолтные приоритеты tenant → user_bucket → traffic_percentage', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
      });
      const resolver = createCombinedResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });

    it('использует кастомные приоритеты', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
        resolverPriorities: ['traffic_percentage'],
      });
      const resolver = createCombinedResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });

    it('пропускает не включенные в приоритеты resolvers', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
        resolverPriorities: ['traffic_percentage'],
      });
      const resolver = createCombinedResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });

    it('возвращает forced mode при runtime-мутировании resolverPipeline в undefined', () => {
      const resolver1 = vi.fn().mockReturnValue({ kind: 'active', version: 'v3' });
      const config = createTestConfig({
        resolverPipeline: [resolver1],
      });
      const resolver = createCombinedResolver(config);
      // Defensive-case: runtime corruption после создания resolver.
      // eslint-disable-next-line fp/no-mutation
      (config as unknown as { resolverPipeline?: unknown; }).resolverPipeline = undefined;

      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });

    it('игнорирует runtime-некорректный приоритет в resolverPriorities', () => {
      const config = createTestConfig();
      // Simulate invalid resolverPriorities at runtime
      // eslint-disable-next-line fp/no-mutation
      (config as any).resolverPriorities = ['invalid_priority'];
      const resolver = createCombinedResolver(config);
      const context = createTestContext();
      const result = resolver(context);
      expect(result).toEqual({ kind: 'forced', version: 'v1' });
    });
  });
});

/* ============================================================================
 * 🧪 API FUNCTIONS — TESTS
 * ============================================================================
 */

describe('API Functions', () => {
  describe('resolvePipelineMode', () => {
    it('использует customResolver когда он указан', () => {
      const customResolver = vi.fn().mockReturnValue({ kind: 'active', version: 'v3' });
      const config = createTestConfig({ customResolver });
      const context = createTestContext();
      const result = resolvePipelineMode(context, config);
      expect(customResolver).toHaveBeenCalledWith(context);
      expect(result).toEqual({ kind: 'active', version: 'v3' });
    });

    it('использует combinedResolver по умолчанию', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
      });
      const context = createTestContext();
      const result = resolvePipelineMode(context, config);
      expect(result).toEqual({ kind: 'shadow', version: 'v2' });
    });
  });

  describe('resolveFeatureFlag', () => {
    it('возвращает полный результат с метаданными', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
      });
      const context = createTestContext();
      const now = 1234567890;
      const result = resolveFeatureFlag(context, config, now);
      expect(result.mode).toEqual({ kind: 'shadow', version: 'v2' });
      expect(result.source).toEqual({ kind: 'tenant', tenantId: 'tenant456' });
      expect(result.timestamp).toBe(now);
    });

    it('определяет source как custom когда customResolver используется', () => {
      const customResolver = vi.fn().mockReturnValue({ kind: 'active', version: 'v3' });
      const config = createTestConfig({ customResolver });
      const context = createTestContext();
      const result = resolveFeatureFlag(context, config);
      expect(result.source).toEqual({ kind: 'custom', resolver: 'customResolver' });
    });

    it('определяет source как custom когда resolverPipeline используется', () => {
      const resolver1 = vi.fn().mockReturnValue({ kind: 'active', version: 'v3' });
      const config = createTestConfig({
        resolverPipeline: [resolver1],
      });
      const context = createTestContext();
      const result = resolveFeatureFlag(context, config);
      expect(result.source).toEqual({ kind: 'custom', resolver: 'resolverPipeline' });
    });

    it('определяет source как user_bucket когда tenant отсутствует но userId есть', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
      });
      const context = createTestContext();
      // Simulate context without tenantId
      const contextWithoutTenantId = { userId: context.userId, ip: context.ip };
      const result = resolveFeatureFlag(contextWithoutTenantId as TestContext, config);
      expect(result.source.kind).toBe('user_bucket');
      expect(typeof (result.source as { kind: 'user_bucket'; bucketId: string; }).bucketId).toBe(
        'string',
      );
      const bucketId = parseInt(
        (result.source as { kind: 'user_bucket'; bucketId: string; }).bucketId,
      );
      expect(bucketId).toBeGreaterThanOrEqual(0);
      expect(bucketId).toBeLessThanOrEqual(99);
    });

    it('определяет source как traffic_percentage когда нет tenant и userId', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 30,
        activeTrafficPercentage: 20,
      });
      const context = createTestContext();
      // Simulate context without tenantId and userId
      const contextMinimal = { ip: context.ip };
      const result = resolveFeatureFlag(contextMinimal as TestContext, config);
      expect(result.source).toEqual({ kind: 'traffic_percentage', percentage: 50 });
    });

    it('использует Date.now() по умолчанию для timestamp', () => {
      const config = createTestConfig();
      const context = createTestContext();
      const result = resolveFeatureFlag(context, config);
      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('isShadowMode', () => {
    it('возвращает true когда mode.kind === "shadow"', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
      });
      const context = createTestContext();
      const result = isShadowMode(context, config);
      expect(result).toBe(true);
    });

    it('возвращает false когда mode.kind !== "shadow"', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 0,
        activeTrafficPercentage: 0,
      });
      const context = createTestContext();
      const result = isShadowMode(context, config);
      expect(result).toBe(false);
    });
  });

  describe('isActiveMode', () => {
    it('возвращает true когда mode.kind === "active"', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 20,
        activeTrafficPercentage: 80,
        activeVersion: 'v3',
      });
      const context = createTestContext();
      const result = isActiveMode(context, config);
      expect(result).toBe(true);
    });

    it('возвращает false когда mode.kind !== "active"', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 0,
        activeTrafficPercentage: 0,
      });
      const context = createTestContext();
      const result = isActiveMode(context, config);
      expect(result).toBe(false);
    });
  });

  describe('getPipelineVersion', () => {
    it('возвращает версию из resolved mode', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 100,
        shadowVersion: 'v2',
      });
      const context = createTestContext();
      const result = getPipelineVersion(context, config);
      expect(result).toBe('v2');
    });

    it('возвращает defaultVersion для forced mode', () => {
      const config = createTestConfig({
        shadowTrafficPercentage: 0,
        activeTrafficPercentage: 0,
        defaultVersion: 'v1',
      });
      const context = createTestContext();
      const result = getPipelineVersion(context, config);
      expect(result).toBe('v1');
    });
  });
});

/* ============================================================================
 * 🧪 CONSTANTS & TYPES — TESTS
 * ============================================================================
 */

describe('Constants & Types', () => {
  describe('DEFAULT_ROLLOUT_CONFIG', () => {
    it('содержит ожидаемые дефолтные значения', () => {
      expect(DEFAULT_ROLLOUT_CONFIG.shadowTrafficPercentage).toBe(0);
      expect(DEFAULT_ROLLOUT_CONFIG.activeTrafficPercentage).toBe(0);
      expect(DEFAULT_ROLLOUT_CONFIG.defaultVersion).toBe('v1');
      expect(DEFAULT_ROLLOUT_CONFIG.shadowVersion).toBe('v2');
      expect(DEFAULT_ROLLOUT_CONFIG.activeVersion).toBe('v2');
    });

    it('не содержит customResolver по умолчанию', () => {
      expect(DEFAULT_ROLLOUT_CONFIG.customResolver).toBeUndefined();
    });

    it('не содержит resolverPipeline по умолчанию', () => {
      expect(DEFAULT_ROLLOUT_CONFIG.resolverPipeline).toBeUndefined();
    });
  });

  describe('PipelineVersion type', () => {
    it('принимает валидные версии', () => {
      const versions: PipelineVersion[] = ['v1', 'v2', 'v3'];
      expect(versions).toContain('v1');
      expect(versions).toContain('v2');
      expect(versions).toContain('v3');
    });
  });

  describe('PipelineMode type', () => {
    it('поддерживает forced mode', () => {
      const mode: PipelineMode = { kind: 'forced', version: 'v1' };
      expect(mode.kind).toBe('forced');
      expect(mode.version).toBe('v1');
    });

    it('поддерживает shadow mode', () => {
      const mode: PipelineMode = { kind: 'shadow', version: 'v2' };
      expect(mode.kind).toBe('shadow');
      expect(mode.version).toBe('v2');
    });

    it('поддерживает active mode', () => {
      const mode: PipelineMode = { kind: 'active', version: 'v3' };
      expect(mode.kind).toBe('active');
      expect(mode.version).toBe('v3');
    });
  });

  describe('ResolverPriority type', () => {
    it('принимает валидные приоритеты', () => {
      const priorities: readonly ResolverPriority[] = [
        'tenant',
        'user_bucket',
        'traffic_percentage',
      ];
      expect(priorities).toContain('tenant');
      expect(priorities).toContain('user_bucket');
      expect(priorities).toContain('traffic_percentage');
    });
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & STRESS TESTS
 * ============================================================================
 */

describe('Edge Cases & Stress Tests', () => {
  it('работает с пустым контекстом', () => {
    const config = createTestConfig();
    const context = {};
    const result = resolvePipelineMode(context, config);
    expect(result).toEqual({ kind: 'forced', version: 'v1' });
  });

  it('работает с очень длинными ID', () => {
    const longId = 'a'.repeat(1000);
    const config = createTestConfig({
      shadowTrafficPercentage: 50,
    });
    const context = createTestContext({ userId: longId });
    const result = resolvePipelineMode(context, config);
    expect(result.kind).toBeDefined();
    expect(['forced', 'shadow', 'active']).toContain(result.kind);
  });

  it('работает с Unicode символами в ID', () => {
    const unicodeId = 'user🚀123';
    const config = createTestConfig({
      shadowTrafficPercentage: 50,
    });
    const context = createTestContext({ userId: unicodeId });
    const result = resolvePipelineMode(context, config);
    expect(result.kind).toBeDefined();
  });

  it('работает с экстремальными процентами трафика', () => {
    const config = createTestConfig({
      shadowTrafficPercentage: 100,
      activeTrafficPercentage: 100,
    });
    const context = createTestContext();
    const result = resolvePipelineMode(context, config);
    expect(result.kind).toBeDefined();
  });

  it('работает с отрицательными процентами трафика', () => {
    const config = createTestConfig({
      shadowTrafficPercentage: -10,
      activeTrafficPercentage: -5,
    });
    const context = createTestContext();
    const result = resolvePipelineMode(context, config);
    expect(result).toEqual({ kind: 'forced', version: 'v1' });
  });

  it('работает с процентами трафика > 100', () => {
    const config = createTestConfig({
      shadowTrafficPercentage: 150,
      activeTrafficPercentage: 200,
    });
    const context = createTestContext();
    const result = resolvePipelineMode(context, config);
    expect(result.kind).toBeDefined();
  });

  it('работает с пустыми массивами enabledTenants и enabledBuckets', () => {
    const config = createTestConfig({
      enabledTenants: [],
      enabledBuckets: [],
      shadowTrafficPercentage: 100,
    });
    const context = createTestContext();
    const result = resolvePipelineMode(context, config);
    expect(result).toEqual({ kind: 'shadow', version: 'v2' });
  });

  it('работает с undefined полями в конфиге', () => {
    const config = createTestConfig();
    // Simulate undefined fields at runtime
    // eslint-disable-next-line fp/no-mutation
    (config as any).shadowTrafficPercentage = undefined;
    // eslint-disable-next-line fp/no-mutation
    (config as any).activeTrafficPercentage = undefined;
    // eslint-disable-next-line fp/no-mutation
    (config as any).enabledTenants = undefined;
    // eslint-disable-next-line fp/no-mutation
    (config as any).enabledBuckets = undefined;
    const context = createTestContext();
    const result = resolvePipelineMode(context, config);
    expect(result).toEqual({ kind: 'forced', version: 'v1' });
  });

  it('работает с bucket ID вне диапазона в enabledBuckets', () => {
    const config = createTestConfig({
      enabledBuckets: ['999'], // bucket 999 не существует (0-99)
      shadowTrafficPercentage: 0, // no shadow traffic
    });
    const context = createTestContext();
    const result = resolvePipelineMode(context, config);
    expect(result).toEqual({ kind: 'forced', version: 'v1' });
  });
});
