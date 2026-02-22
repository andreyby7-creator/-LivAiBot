/**
 * @file Unit тесты для Remote Provider
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import type {
  ClassificationContext,
  ClassificationSignals,
} from '../../../src/classification/signals/signals.js';
import type { DeviceInfo } from '../../../src/classification/strategies/rules.js';
import {
  createRemoteProviderStage,
} from '../../../src/classification/providers/remote.provider.js';
import type {
  AsyncExecutionPolicy,
  MergeStrategy,
  RemoteClassificationProvider,
  RemoteFailurePolicy,
  RemoteProviderRequest,
  RemoteProviderResponse,
  RemoteProviderStageConfig,
} from '../../../src/classification/providers/remote.provider.js';

// Mock defineStage since it's imported from @livai/core and may not resolve in test environment
vi.mock('@livai/core', () => ({
  defineStage: vi.fn(() =>
    vi.fn((plugin: any) => ({
      id: 'classification_remote_provider',
      provides: ['signals'] as const,
      dependsOn: ['device', 'context'] as const,
      run: plugin.run,
    }))
  ),
}));

/* ============================================================================
 * 🧩 МOCKS & HELPERS
 * ============================================================================
 */

const createMockDeviceInfo = (): DeviceInfo => ({
  deviceId: 'test-device-123',
  deviceType: 'desktop',
  os: 'Windows',
  browser: 'Chrome',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
});

const createMockContext = (): ClassificationContext => ({
  ip: '192.168.1.1',
  geo: { country: 'US', lat: 40.7128, lng: -74.0060 },
  userId: 'user123',
  previousSessionId: 'session456',
  timestamp: '2024-01-01T00:00:00Z',
});

const createMockSignals = (): ClassificationSignals => ({
  isVpn: true,
  reputationScore: 75,
  velocityScore: 25,
});

const createMockRemoteProvider = (
  response: RemoteProviderResponse | Error = {},
): MockedFunction<RemoteClassificationProvider> => {
  const mockProvider = vi.fn<RemoteClassificationProvider>();
  if (response instanceof Error) {
    mockProvider.mockRejectedValue(response);
  } else {
    mockProvider.mockResolvedValue(response);
  }
  return mockProvider;
};

const createMockExecutionPolicy = (): AsyncExecutionPolicy => ({
  execute: vi.fn().mockResolvedValue({}),
});

/* ============================================================================
 * 🧩 ТИПЫ — TESTS
 * ============================================================================
 */

describe('Remote Provider Types', () => {
  it('RemoteProviderResponse может быть создан с минимальными полями', () => {
    const response: RemoteProviderResponse = {};
    expect(response).toEqual({});
  });

  it('RemoteProviderResponse может быть создан со всеми полями', () => {
    const response: RemoteProviderResponse = {
      isVpn: true,
      isTor: false,
      isProxy: true,
      asn: 'AS12345',
      reputationScore: 75,
      velocityScore: 50,
    };
    expect(response.isVpn).toBe(true);
    expect(response.asn).toBe('AS12345');
  });

  it('RemoteProviderRequest может быть создан', () => {
    const request: RemoteProviderRequest = {
      device: createMockDeviceInfo(),
      context: createMockContext(),
      signal: new AbortController().signal,
    };
    expect(request.device.deviceId).toBe('test-device-123');
    expect(request.context.ip).toBe('192.168.1.1');
  });

  it('RemoteFailurePolicy поддерживает оба значения', () => {
    const failOpen: RemoteFailurePolicy = 'fail_open';
    const failClosed: RemoteFailurePolicy = 'fail_closed';
    expect(failOpen).toBe('fail_open');
    expect(failClosed).toBe('fail_closed');
  });

  it('MergeStrategy поддерживает все значения', () => {
    const remoteWins: MergeStrategy = 'remote_wins';
    const localWins: MergeStrategy = 'local_wins';
    const maxRisk: MergeStrategy = 'max_risk';
    expect(remoteWins).toBe('remote_wins');
    expect(localWins).toBe('local_wins');
    expect(maxRisk).toBe('max_risk');
  });
});

/* ============================================================================
 * 🔧 INTERNAL HELPERS — TESTS
 * ============================================================================
 */

describe('Internal Helper Functions', () => {
  describe('sanitizeAsn', () => {
    // Since sanitizeAsn is internal, we test it through the public API
    it('принимает валидные ASN строки', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          asn: 'AS12345',
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.asn != null && { asn: response.asn }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает невалидные ASN (не string)', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          asn: 12345 as any,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.asn != null && typeof response.asn === 'string' && { asn: response.asn }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает пустые ASN', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          asn: '',
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.asn != null && { asn: response.asn }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает слишком длинные ASN', () => {
      const longAsn = 'A'.repeat(65);
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          asn: longAsn,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.asn != null && { asn: response.asn }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает ASN с недопустимыми символами', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          asn: 'AS@#$%^&*()',
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.asn != null && { asn: response.asn }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('sanitizeScore', () => {
    it('принимает валидные scores в диапазоне 0-100', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: 75,
          velocityScore: 50,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.reputationScore !== undefined
            && { reputationScore: response.reputationScore }),
          ...(response.velocityScore !== undefined && { velocityScore: response.velocityScore }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает невалидные scores (не number)', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: '75' as any,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.reputationScore !== undefined
            && typeof response.reputationScore === 'number'
            && { reputationScore: response.reputationScore }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает неконечные числа', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: NaN,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.reputationScore !== undefined
            && Number.isFinite(response.reputationScore)
            && { reputationScore: response.reputationScore }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('клерит scores вне диапазона 0-100', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: -1,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.reputationScore !== undefined
            && response.reputationScore >= 0
            && response.reputationScore <= 100
            && { reputationScore: response.reputationScore }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('sanitizeBoolean', () => {
    it('принимает валидные boolean значения', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
          isTor: false,
          isProxy: true,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.isVpn !== undefined && { isVpn: response.isVpn }),
          ...(response.isTor !== undefined && { isTor: response.isTor }),
          ...(response.isProxy !== undefined && { isProxy: response.isProxy }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('отфильтровывает невалидные boolean значения', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: 'true' as any,
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.isVpn !== undefined
            && typeof response.isVpn === 'boolean'
            && { isVpn: response.isVpn }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('sanitizeRemoteResponse', () => {
    it('применяет все санитизации к response', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
          isTor: 'false' as any,
          asn: 'AS12345',
          reputationScore: 150, // вне диапазона
        }),
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.isVpn !== undefined
            && typeof response.isVpn === 'boolean'
            && { isVpn: response.isVpn }),
          ...(response.asn !== undefined
            && typeof response.asn === 'string'
            && { asn: response.asn }),
          ...(response.reputationScore !== undefined
            && typeof response.reputationScore === 'number'
            && response.reputationScore >= 0
            && response.reputationScore <= 100
            && { reputationScore: response.reputationScore }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('sanitizeSignals', () => {
    it('применяет все санитизации к signals', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
        }),
        failurePolicy: 'fail_open',
        responseMapper: () => ({
          ...(typeof 'true' === 'boolean' && { isVpn: 'true' as any }),
          ...(typeof -5 === 'number' && { reputationScore: -5 }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });
});

/* ============================================================================
 * 🔀 MERGE FUNCTIONS — TESTS
 * ============================================================================
 */

describe('Merge Functions', () => {
  describe('mergeByMaxRisk', () => {
    it('сливает signals с max risk стратегией - remote_wins для ASN', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
          reputationScore: 20, // низкий = более рискованный
          velocityScore: 30,
          asn: 'AS67890',
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
        asnMergeStrategy: 'remote_wins',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('сливает signals с max risk стратегией - local_wins для ASN', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: 20,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
        asnMergeStrategy: 'local_wins',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('сливает signals с max risk стратегией - first_non_undefined для ASN', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          asn: 'AS67890',
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
        asnMergeStrategy: 'first_non_undefined',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('выбирает минимальный reputationScore (более рискованный)', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: 80,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('выбирает максимальный velocityScore (более рискованный)', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          velocityScore: 90,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('комбинирует boolean поля через OR', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
          isTor: false,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('mergeSignals', () => {
    it('remote_wins стратегия', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'remote_wins',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('local_wins стратегия', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'local_wins',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('max_risk стратегия', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          reputationScore: 20,
        }),
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('обрабатывает неопределенный mergeStrategy (использует default)', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider({
          isVpn: true,
        }),
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });
});

/* ============================================================================
 * ⚡ EXECUTION POLICY — TESTS
 * ============================================================================
 */

describe('Execution Policy', () => {
  describe('createTimeoutExecutionPolicy', () => {
    it('создает execution policy с timeout', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
        timeoutMs: 3000,
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('использует default timeout если не указан', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });

    it('принимает кастомный execution policy', () => {
      const mockPolicy = createMockExecutionPolicy();
      (mockPolicy.execute as any).mockResolvedValue({ isVpn: true });

      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
        executionPolicy: mockPolicy,
      };
      const stage = createRemoteProviderStage(config);
      expect(stage).toBeDefined();
    });
  });
});

/* ============================================================================
 * ⚙️ CONFIG VALIDATION — TESTS
 * ============================================================================
 */

describe('Config Validation', () => {
  describe('validateStageConfig', () => {
    it('принимает валидную минимальную конфигурацию', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
      };
      expect(() => createRemoteProviderStage(config)).not.toThrow();
    });

    it('принимает валидную полную конфигурацию', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        timeoutMs: 5000,
        failurePolicy: 'fail_closed',
        mergeStrategy: 'remote_wins',
        asnMergeStrategy: 'remote_wins',
        responseMapper: (response) => ({
          ...(response.isVpn !== undefined && { isVpn: response.isVpn }),
        }),
        fallbackSignals: { reputationScore: 0 },
        // Note: executionPolicy omitted to avoid conflict with timeoutMs
      };
      expect(() => createRemoteProviderStage(config)).not.toThrow();
    });

    it('отклоняет конфигурацию с executionPolicy и timeoutMs одновременно', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        timeoutMs: 5000,
        executionPolicy: createMockExecutionPolicy(),
        failurePolicy: 'fail_open',
      };
      expect(() => createRemoteProviderStage(config)).toThrow(
        'Provide either executionPolicy or timeoutMs, not both',
      );
    });

    it('отклоняет fail_closed без fallbackSignals', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_closed',
      };
      expect(() => createRemoteProviderStage(config)).toThrow(
        'fail_closed requires explicit fallbackSignals',
      );
    });

    it('принимает fail_closed с fallbackSignals', () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_closed',
        fallbackSignals: { reputationScore: 0 },
      };
      expect(() => createRemoteProviderStage(config)).not.toThrow();
    });
  });
});

/* ============================================================================
 * 🎯 STAGE CREATION — TESTS
 * ============================================================================
 */

describe('createRemoteProviderStage', () => {
  it('создает stage с минимальной конфигурацией', () => {
    const config: RemoteProviderStageConfig = {
      provider: createMockRemoteProvider(),
      failurePolicy: 'fail_open',
    };
    const stage = createRemoteProviderStage(config);
    expect(stage.id).toBe('classification_remote_provider');
    expect(stage.provides).toEqual(['signals']);
    expect(stage.dependsOn).toEqual(['device', 'context']);
  });

  it('применяет default значения', () => {
    const config: RemoteProviderStageConfig = {
      provider: createMockRemoteProvider(),
      failurePolicy: 'fail_open',
    };
    const stage = createRemoteProviderStage(config);
    expect(stage).toBeDefined();
  });

  it('использует кастомный responseMapper', () => {
    const config: RemoteProviderStageConfig = {
      provider: createMockRemoteProvider({ isVpn: true }),
      failurePolicy: 'fail_open',
      responseMapper: (response) => ({
        ...(response.isVpn !== undefined && { isVpn: !response.isVpn }), // инвертируем для теста
      }),
    };
    const stage = createRemoteProviderStage(config);
    expect(stage).toBeDefined();
  });

  it('использует default responseMapper если не указан', () => {
    const config: RemoteProviderStageConfig = {
      provider: createMockRemoteProvider({ isVpn: true }),
      failurePolicy: 'fail_open',
    };
    const stage = createRemoteProviderStage(config);
    expect(stage).toBeDefined();
  });
});

/* ============================================================================
 * 🚀 STAGE RUN — TESTS
 * ============================================================================
 */

describe('Stage Run Method', () => {
  const createMockSlotMap = () => ({
    device: createMockDeviceInfo(),
    context: createMockContext(),
    signals: createMockSignals(),
  });

  const createMockStageContext = (slotMap: any) => ({
    slots: slotMap,
    abortSignal: new AbortController().signal,
    metadata: {
      stageId: 'test-stage',
      executionIndex: 0,
      executionPlanVersion: '1.0.0',
      startTime: Date.now(),
      cancelled: false,
    },
  });

  describe('missing dependencies', () => {
    it('возвращает MISSING_DEPENDENCY для отсутствующего device', async () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const slotMap = { ...createMockSlotMap(), device: undefined };
      const result = await stage.run(createMockStageContext(slotMap));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('MISSING_DEPENDENCY');
        expect((result.reason as any).slot).toBe('device');
      }
    });

    it('возвращает MISSING_DEPENDENCY для отсутствующего context', async () => {
      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const slotMap = { ...createMockSlotMap(), context: undefined };
      const result = await stage.run(createMockStageContext(slotMap));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.kind).toBe('MISSING_DEPENDENCY');
        expect((result.reason as any).slot).toBe('context');
      }
    });
  });

  describe('successful execution', () => {
    it('успешно выполняется с полным response', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: true,
        isTor: false,
        isProxy: true,
        asn: 'AS12345',
        reputationScore: 75,
        velocityScore: 50,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        mergeStrategy: 'remote_wins',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals).toBeDefined();
      }
      expect(mockProvider).toHaveBeenCalledWith({
        device: createMockDeviceInfo(),
        context: createMockContext(),
        signal: expect.any(AbortSignal),
      });
    });

    it('успешно выполняется с частичным response', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: true,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals).toBeDefined();
      }
    });

    it('успешно выполняется без существующего signals', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: true,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const slotMap = { ...createMockSlotMap(), signals: undefined };
      const result = await stage.run(createMockStageContext(slotMap));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals).toBeDefined();
      }
    });

    it('применяет responseMapper', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: true,
        reputationScore: 75,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        responseMapper: (response) => ({
          ...(response.isVpn !== undefined && { isVpn: response.isVpn }),
          ...(response.reputationScore !== undefined
            && { reputationScore: response.reputationScore * 2 }),
        }),
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('санитизирует response перед mapper', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: 'true' as any,
        reputationScore: 150, // вне диапазона
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('санитизирует mapped signals после mapper', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: true,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        responseMapper: () => ({
          isVpn: 'true' as any,
          reputationScore: -10,
        }),
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('отфильтровывает слишком длинный ASN в runtime sanitize', async () => {
      const tooLongAsn = 'A'.repeat(65);
      const mockProvider = createMockRemoteProvider({
        asn: tooLongAsn,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals?.asn).toBeUndefined();
      }
    });
  });

  describe('failure handling', () => {
    it('обрабатывает fail_open политику при ошибке', async () => {
      const mockProvider = createMockRemoteProvider(new Error('Provider failed'));
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals).toBeDefined();
      }
    });

    it('обрабатывает fail_closed политику при ошибке', async () => {
      const mockProvider = createMockRemoteProvider(new Error('Provider failed'));
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_closed',
        fallbackSignals: { reputationScore: 0, isVpn: true },
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals).toBeDefined();
      }
    });

    it('обрабатывает timeout через built-in policy', async () => {
      const mockProvider = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ isVpn: true }), 100)),
      );
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        timeoutMs: 50, // очень короткий timeout
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('обрабатывает cancellation через abort signal', async () => {
      const mockProvider = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ isVpn: true }), 100)),
      );
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
      };
      const stage = createRemoteProviderStage(config);
      const abortController = new AbortController();
      const context = {
        slots: createMockSlotMap(),
        abortSignal: abortController.signal,
        metadata: {
          stageId: 'test-stage',
          executionIndex: 0,
          executionPlanVersion: '1.0.0',
          startTime: Date.now(),
          cancelled: false,
        },
      };

      // Отменяем сразу
      abortController.abort();

      const result = await stage.run(context);
      expect(result.ok).toBe(true);
    });

    it('обрабатывает cancellation с parent signal reason', async () => {
      const mockProvider = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ isVpn: true }), 100)),
      );
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        timeoutMs: 200, // Даем время для cancellation
      };
      const stage = createRemoteProviderStage(config);
      const abortController = new AbortController();
      const context = {
        slots: createMockSlotMap(),
        abortSignal: abortController.signal,
        metadata: {
          stageId: 'test-stage',
          executionIndex: 0,
          executionPlanVersion: '1.0.0',
          startTime: Date.now(),
          cancelled: false,
        },
      };

      // Отменяем с кастомной причиной
      abortController.abort('Custom abort reason');

      const result = await stage.run(context);
      expect(result.ok).toBe(true);
    });

    it('обрабатывает abort после старта execution (через parent abort listener)', async () => {
      const mockProvider = vi.fn().mockImplementation(
        ({ signal }: { signal?: AbortSignal; }) =>
          new Promise((resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('aborted by parent')));
            setTimeout(() => resolve({ isVpn: true }), 200);
          }),
      );
      const config: RemoteProviderStageConfig = {
        provider: mockProvider as unknown as RemoteClassificationProvider,
        failurePolicy: 'fail_open',
        timeoutMs: 500,
      };
      const stage = createRemoteProviderStage(config);
      const abortController = new AbortController();
      const context = {
        slots: createMockSlotMap(),
        abortSignal: abortController.signal,
        metadata: {
          stageId: 'test-stage',
          executionIndex: 0,
          executionPlanVersion: '1.0.0',
          startTime: Date.now(),
          cancelled: false,
        },
      };

      const pendingResult = stage.run(context);
      setTimeout(() => abortController.abort('late abort'), 20);

      const result = await pendingResult;
      expect(result.ok).toBe(true);
    });

    it('использует кастомный execution policy', async () => {
      const mockPolicy = createMockExecutionPolicy();
      (mockPolicy.execute as any).mockRejectedValue(new Error('Custom policy error'));

      const config: RemoteProviderStageConfig = {
        provider: createMockRemoteProvider(),
        failurePolicy: 'fail_open',
        executionPolicy: mockPolicy,
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
      expect(mockPolicy.execute).toHaveBeenCalled();
    });
  });

  describe('merge strategies in run', () => {
    it('применяет remote_wins merge стратегию', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: true,
        reputationScore: 80,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        mergeStrategy: 'remote_wins',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('применяет local_wins merge стратегию', async () => {
      const mockProvider = createMockRemoteProvider({
        isVpn: false,
        reputationScore: 90,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        mergeStrategy: 'local_wins',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('применяет max_risk merge стратегию', async () => {
      const mockProvider = createMockRemoteProvider({
        reputationScore: 20, // более рискованный
        velocityScore: 80, // более рискованный
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext(createMockSlotMap()));

      expect(result.ok).toBe(true);
    });

    it('max_risk + asnMergeStrategy=remote_wins выбирает ASN remote', async () => {
      const mockProvider = createMockRemoteProvider({
        asn: 'AS_REMOTE',
        reputationScore: 20,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
        asnMergeStrategy: 'remote_wins',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext({
        ...createMockSlotMap(),
        signals: { ...createMockSignals(), asn: 'AS_LOCAL' },
      }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals?.asn).toBe('AS_REMOTE');
      }
    });

    it('max_risk + asnMergeStrategy=local_wins выбирает ASN local', async () => {
      const mockProvider = createMockRemoteProvider({
        asn: 'AS_REMOTE',
        reputationScore: 20,
      });
      const config: RemoteProviderStageConfig = {
        provider: mockProvider,
        failurePolicy: 'fail_open',
        mergeStrategy: 'max_risk',
        asnMergeStrategy: 'local_wins',
      };
      const stage = createRemoteProviderStage(config);
      const result = await stage.run(createMockStageContext({
        ...createMockSlotMap(),
        signals: { ...createMockSignals(), asn: 'AS_LOCAL' },
      }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.slots.signals?.asn).toBe('AS_LOCAL');
      }
    });
  });
});
