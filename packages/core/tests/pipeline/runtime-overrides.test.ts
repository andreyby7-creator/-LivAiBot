/**
 * @file Unit тесты для Runtime Overrides (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';
import {
  applyRuntimeOverrides,
  createCustomOverrideProvider,
  createDefaultEnvProvider,
  createDefaultOverrideMapper,
  createEnvProviderFromObject,
  DEFAULT_RUNTIME_OVERRIDES,
  getActiveOverrideKeys,
  hasActiveOverrides,
  readRuntimeOverridesFromEnv,
  validateRuntimeOverrides,
} from '../../src/pipeline/runtime-overrides.js';
import type {
  EnvProvider,
  OverrideKey,
  OverridePriority,
  RuntimeOverrides,
} from '../../src/pipeline/runtime-overrides.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestConfig = Readonly<{
  readonly version?: number;
  readonly provider?: string;
  readonly failClosed?: boolean;
  readonly shadowMode?: boolean;
  readonly circuitBreakerEnabled?: boolean;
}>;

function createTestConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return {
    version: 2,
    provider: 'test-provider',
    failClosed: true,
    shadowMode: false,
    circuitBreakerEnabled: true,
    ...overrides,
  };
}

function createTestEnv(env: Record<string, string | undefined> = {}): EnvProvider {
  return createEnvProviderFromObject({
    PIPELINE_OVERRIDE_FORCE_VERSION: 'false',
    PIPELINE_OVERRIDE_DISABLE_PROVIDER: 'false',
    PIPELINE_OVERRIDE_FAIL_OPEN_MODE: 'false',
    PIPELINE_OVERRIDE_ENABLE_SHADOW_MODE: 'false',
    PIPELINE_OVERRIDE_DISABLE_CIRCUIT_BREAKER: 'false',
    ...env,
  });
}

function createActiveOverrides(overrides: Partial<RuntimeOverrides> = {}): RuntimeOverrides {
  return {
    ...DEFAULT_RUNTIME_OVERRIDES,
    ...overrides,
  };
}

/* ============================================================================
 * 🏭 ENVIRONMENT PROVIDERS — TESTS
 * ============================================================================
 */

describe('Environment Providers', () => {
  describe('createDefaultEnvProvider', () => {
    it('создает provider с доступом к process.env', () => {
      const provider = createDefaultEnvProvider();
      expect(typeof provider.get).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
    });

    it('возвращает undefined для отсутствующей переменной', () => {
      const provider = createDefaultEnvProvider();
      const result = provider.get('NON_EXISTENT_VAR');
      expect(result).toBeUndefined();
    });

    it('возвращает значение существующей переменной', () => {
      // Mock process.env for testing
      const originalEnv = process.env;
      // eslint-disable-next-line fp/no-mutation
      (process as any).env = { TEST_VAR: 'test_value' };

      try {
        const provider = createDefaultEnvProvider();
        const result = provider.get('TEST_VAR');
        expect(result).toBe('test_value');
      } finally {
        // eslint-disable-next-line fp/no-mutation
        (process as any).env = originalEnv;
      }
    });

    it('isAvailable возвращает true когда process.env доступен', () => {
      const provider = createDefaultEnvProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    it('isAvailable возвращает false когда process.env недоступен', () => {
      // Mock undefined process
      const originalProcess = global.process;
      // eslint-disable-next-line fp/no-mutation
      (global as any).process = undefined;

      try {
        const provider = createDefaultEnvProvider();
        expect(provider.isAvailable()).toBe(false);
        // Test the get method returns undefined when process is undefined
        expect(provider.get('ANY_KEY')).toBeUndefined();
      } finally {
        // eslint-disable-next-line fp/no-mutation
        (global as any).process = originalProcess;
      }
    });
  });

  describe('createEnvProviderFromObject', () => {
    it('создает provider из объекта', () => {
      const env = { VAR1: 'value1', VAR2: undefined };
      const provider = createEnvProviderFromObject(env);
      expect(typeof provider.get).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
    });

    it('возвращает значение из объекта', () => {
      const env = { VAR1: 'value1', VAR2: undefined };
      const provider = createEnvProviderFromObject(env);
      expect(provider.get('VAR1')).toBe('value1');
      expect(provider.get('VAR2')).toBeUndefined();
      expect(provider.get('VAR3')).toBeUndefined();
    });

    it('isAvailable всегда возвращает true', () => {
      const provider = createEnvProviderFromObject({});
      expect(provider.isAvailable()).toBe(true);
    });
  });
});

/* ============================================================================
 * 🏭 OVERRIDE PROVIDERS — TESTS
 * ============================================================================
 */

describe('Override Providers', () => {
  describe('readRuntimeOverridesFromEnv', () => {
    it('возвращает дефолтные overrides когда env недоступен', () => {
      const mockEnv = {
        get: vi.fn().mockReturnValue(undefined),
        isAvailable: vi.fn().mockReturnValue(false),
      };
      const result = readRuntimeOverridesFromEnv(mockEnv);
      expect(result).toEqual(DEFAULT_RUNTIME_OVERRIDES);
    });

    it('читает все override keys из environment', () => {
      const env = createTestEnv({
        PIPELINE_OVERRIDE_FORCE_VERSION: 'true',
        PIPELINE_OVERRIDE_DISABLE_PROVIDER: '1',
        PIPELINE_OVERRIDE_FAIL_OPEN_MODE: 'false',
        PIPELINE_OVERRIDE_ENABLE_SHADOW_MODE: 'true',
        PIPELINE_OVERRIDE_DISABLE_CIRCUIT_BREAKER: '0',
      });
      const result = readRuntimeOverridesFromEnv(env);
      expect(result).toEqual({
        forceVersion: true,
        disableProvider: true,
        failOpenMode: false,
        enableShadowMode: true,
        disableCircuitBreaker: false,
      });
    });

    it('обрабатывает различные форматы true/false', () => {
      const env = createTestEnv({
        PIPELINE_OVERRIDE_FORCE_VERSION: 'TRUE',
        PIPELINE_OVERRIDE_DISABLE_PROVIDER: '1',
        PIPELINE_OVERRIDE_ENABLE_SHADOW_MODE: 'false',
        PIPELINE_OVERRIDE_DISABLE_CIRCUIT_BREAKER: '0',
      });
      const result = readRuntimeOverridesFromEnv(env);
      expect(result.forceVersion).toBe(true);
      expect(result.disableProvider).toBe(true);
      expect(result.enableShadowMode).toBe(false);
      expect(result.disableCircuitBreaker).toBe(false);
    });

    it('fail-safe: возвращает false при ошибке чтения env', () => {
      const mockEnv = {
        get: vi.fn().mockImplementation(() => {
          throw new Error('Env read error');
        }),
        isAvailable: vi.fn().mockReturnValue(true),
      };
      const result = readRuntimeOverridesFromEnv(mockEnv);
      expect(result).toEqual(DEFAULT_RUNTIME_OVERRIDES);
    });

    it('использует дефолтный env provider когда не указан', () => {
      // Это может вызвать проблемы в тестовой среде, но должно работать
      const result = readRuntimeOverridesFromEnv();
      expect(typeof result).toBe('object');
      expect(result.forceVersion).toBe(false);
    });

    it('нормализует значения с пробелами', () => {
      const env = createTestEnv({
        PIPELINE_OVERRIDE_FORCE_VERSION: '  true  ',
        PIPELINE_OVERRIDE_DISABLE_PROVIDER: ' 1 ',
      });
      const result = readRuntimeOverridesFromEnv(env);
      expect(result.forceVersion).toBe(true);
      expect(result.disableProvider).toBe(true);
    });
  });

  describe('createCustomOverrideProvider', () => {
    it('возвращает результат custom provider', () => {
      const customProvider = vi.fn().mockReturnValue({ customKey: 'customValue' });
      const provider = createCustomOverrideProvider(customProvider);
      const env = createTestEnv();
      const result = provider(env);
      expect(customProvider).toHaveBeenCalledWith(env);
      expect(result).toEqual({ customKey: 'customValue' });
    });

    it('fail-safe: возвращает пустой объект при ошибке в custom provider', () => {
      const customProvider = vi.fn().mockImplementation(() => {
        throw new Error('Custom provider error');
      });
      const provider = createCustomOverrideProvider(customProvider);
      const env = createTestEnv();
      const result = provider(env);
      expect(result).toEqual({});
    });
  });
});

/* ============================================================================
 * 🧪 API FUNCTIONS — TESTS
 * ============================================================================
 */

describe('API Functions', () => {
  describe('createDefaultOverrideMapper', () => {
    it('создает mapper со всеми override keys', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const expectedKeys: OverrideKey[] = [
        'force_version',
        'disable_provider',
        'fail_open_mode',
        'enable_shadow_mode',
        'disable_circuit_breaker',
      ];
      expectedKeys.forEach((key) => {
        expect(typeof mapper[key]).toBe('function');
      });
    });

    it('force_version applier устанавливает version: 1', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig({ version: 2 });
      const result = mapper.force_version(config, 'force_version');
      expect(result.version).toBe(1);
    });

    it('force_version applier не изменяет config без version поля', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig();
      delete (config as any).version;
      const result = mapper.force_version(config, 'force_version');
      expect(result).toBe(config);
    });

    it('disable_provider applier удаляет provider поле', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig({ provider: 'test-provider' });
      const result = mapper.disable_provider(config, 'disable_provider');
      expect(result).not.toHaveProperty('provider');
      expect(result.version).toBe(2); // остальные поля сохраняются
    });

    it('disable_provider applier не изменяет config без provider поля', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig();
      delete (config as any).provider;
      const result = mapper.disable_provider(config, 'disable_provider');
      expect(result).toBe(config);
    });

    it('fail_open_mode applier устанавливает failClosed: false', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig({ failClosed: true });
      const result = mapper.fail_open_mode(config, 'fail_open_mode');
      expect(result.failClosed).toBe(false);
    });

    it('fail_open_mode applier не изменяет config без failClosed поля', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig();
      delete (config as any).failClosed;
      const result = mapper.fail_open_mode(config, 'fail_open_mode');
      expect(result).toBe(config);
    });

    it('enable_shadow_mode applier устанавливает shadowMode: true', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig({ shadowMode: false });
      const result = mapper.enable_shadow_mode(config, 'enable_shadow_mode');
      expect(result.shadowMode).toBe(true);
    });

    it('enable_shadow_mode applier не изменяет config без shadowMode поля', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig();
      delete (config as any).shadowMode;
      const result = mapper.enable_shadow_mode(config, 'enable_shadow_mode');
      expect(result).toBe(config);
    });

    it('disable_circuit_breaker applier устанавливает circuitBreakerEnabled: false', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig({ circuitBreakerEnabled: true });
      const result = mapper.disable_circuit_breaker(config, 'disable_circuit_breaker');
      expect(result.circuitBreakerEnabled).toBe(false);
    });

    it('disable_circuit_breaker applier не изменяет config без circuitBreakerEnabled поля', () => {
      const mapper = createDefaultOverrideMapper<TestConfig>();
      const config = createTestConfig();
      delete (config as any).circuitBreakerEnabled;
      const result = mapper.disable_circuit_breaker(config, 'disable_circuit_breaker');
      expect(result).toBe(config);
    });
  });

  describe('applyRuntimeOverrides', () => {
    it('возвращает config без изменений когда нет активных overrides', () => {
      const config = createTestConfig();
      const overrides = DEFAULT_RUNTIME_OVERRIDES;
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(false);
      expect(result.activeKeys).toEqual([]);
      expect(result.sources).toEqual([]);
      expect(result.appliedAt).toBeDefined();
      expect(result.version).toBe(2); // оригинальный config сохраняется
    });

    it('применяет force_version override', () => {
      const config = createTestConfig({ version: 2 });
      const overrides = createActiveOverrides({ forceVersion: true });
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual(['force_version']);
      expect(result.version).toBe(1);
    });

    it('применяет disable_provider override', () => {
      const config = createTestConfig({ provider: 'test-provider' });
      const overrides = createActiveOverrides({ disableProvider: true });
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual(['disable_provider']);
      expect(result).not.toHaveProperty('provider');
    });

    it('применяет fail_open_mode override', () => {
      const config = createTestConfig({ failClosed: true });
      const overrides = createActiveOverrides({ failOpenMode: true });
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual(['fail_open_mode']);
      expect(result.failClosed).toBe(false);
    });

    it('применяет enable_shadow_mode override', () => {
      const config = createTestConfig({ shadowMode: false });
      const overrides = createActiveOverrides({ enableShadowMode: true });
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual(['enable_shadow_mode']);
      expect(result.shadowMode).toBe(true);
    });

    it('применяет disable_circuit_breaker override', () => {
      const config = createTestConfig({ circuitBreakerEnabled: true });
      const overrides = createActiveOverrides({ disableCircuitBreaker: true });
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual(['disable_circuit_breaker']);
      expect(result.circuitBreakerEnabled).toBe(false);
    });

    it('применяет множественные overrides', () => {
      const config = createTestConfig({
        version: 2,
        provider: 'test-provider',
        shadowMode: false,
      });
      const overrides = createActiveOverrides({
        forceVersion: true,
        disableProvider: true,
        enableShadowMode: true,
      });
      const result = applyRuntimeOverrides(config, overrides);
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual([
        'force_version',
        'disable_provider',
        'enable_shadow_mode',
      ]);
      expect(result.version).toBe(1);
      expect(result).not.toHaveProperty('provider');
      expect(result.shadowMode).toBe(true);
    });

    it('использует custom overrideMapper', () => {
      const config = createTestConfig();
      const overrides = createActiveOverrides({ forceVersion: true });
      const customMapper = {
        force_version: vi.fn().mockImplementation((config) => ({
          ...config,
          customField: 'applied',
        })),
        disable_provider: vi.fn(),
        fail_open_mode: vi.fn(),
        enable_shadow_mode: vi.fn(),
        disable_circuit_breaker: vi.fn(),
      };
      const result = applyRuntimeOverrides(config, overrides, undefined, customMapper);
      expect(customMapper.force_version).toHaveBeenCalledWith(config, 'force_version');
      expect(result['customField']).toBe('applied');
    });

    it('вызывает onOverrideApplied callback для каждого примененного override', () => {
      const config = createTestConfig();
      const overrides = createActiveOverrides({ forceVersion: true });
      const onOverrideApplied = vi.fn();
      const now = 1234567890;
      applyRuntimeOverrides(
        config,
        overrides,
        now,
        undefined,
        undefined,
        'environment',
        onOverrideApplied,
      );

      expect(onOverrideApplied).toHaveBeenCalledTimes(1);
      expect(onOverrideApplied).toHaveBeenCalledWith({
        key: 'force_version',
        source: { kind: 'environment', key: 'PIPELINE_OVERRIDE_FORCE_VERSION' },
        timestamp: now,
        configBefore: config,
        configAfter: expect.any(Object),
      });
    });

    it('fail-safe: продолжает работу при ошибке в onOverrideApplied callback', () => {
      const config = createTestConfig();
      const overrides = createActiveOverrides({ forceVersion: true });
      const onOverrideApplied = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const result = applyRuntimeOverrides(
        config,
        overrides,
        undefined,
        undefined,
        undefined,
        'environment',
        onOverrideApplied,
      );
      expect(result.applied).toBe(true);
      expect(result.activeKeys).toEqual(['force_version']);
    });

    it('использует overridePriorityMap для определения source', () => {
      const config = createTestConfig();
      const overrides = createActiveOverrides({ forceVersion: true });
      const overridePriorityMap = { force_version: 'custom' as OverridePriority };
      const result = applyRuntimeOverrides(
        config,
        overrides,
        undefined,
        undefined,
        overridePriorityMap,
      );
      expect(result.sources[0]).toEqual({ kind: 'custom', provider: 'customProvider' });
    });

    it('использует общий overridePriority как fallback', () => {
      const config = createTestConfig();
      const overrides = createActiveOverrides({ forceVersion: true });
      const result = applyRuntimeOverrides(
        config,
        overrides,
        undefined,
        undefined,
        undefined,
        'runtime',
      );
      expect(result.sources[0]).toEqual({ kind: 'runtime', timestamp: expect.any(Number) });
    });
  });

  describe('hasActiveOverrides', () => {
    it('возвращает false для дефолтных overrides', () => {
      const result = hasActiveOverrides(DEFAULT_RUNTIME_OVERRIDES);
      expect(result).toBe(false);
    });

    it('возвращает true когда forceVersion активен', () => {
      const overrides = createActiveOverrides({ forceVersion: true });
      const result = hasActiveOverrides(overrides);
      expect(result).toBe(true);
    });

    it('возвращает true когда disableProvider активен', () => {
      const overrides = createActiveOverrides({ disableProvider: true });
      const result = hasActiveOverrides(overrides);
      expect(result).toBe(true);
    });

    it('возвращает true когда failOpenMode активен', () => {
      const overrides = createActiveOverrides({ failOpenMode: true });
      const result = hasActiveOverrides(overrides);
      expect(result).toBe(true);
    });

    it('возвращает true когда enableShadowMode активен', () => {
      const overrides = createActiveOverrides({ enableShadowMode: true });
      const result = hasActiveOverrides(overrides);
      expect(result).toBe(true);
    });

    it('возвращает true когда disableCircuitBreaker активен', () => {
      const overrides = createActiveOverrides({ disableCircuitBreaker: true });
      const result = hasActiveOverrides(overrides);
      expect(result).toBe(true);
    });

    it('возвращает false когда все overrides false', () => {
      const overrides = createActiveOverrides({
        forceVersion: false,
        disableProvider: false,
        failOpenMode: false,
        enableShadowMode: false,
        disableCircuitBreaker: false,
      });
      const result = hasActiveOverrides(overrides);
      expect(result).toBe(false);
    });
  });

  describe('getActiveOverrideKeys', () => {
    it('возвращает пустой массив для дефолтных overrides', () => {
      const result = getActiveOverrideKeys(DEFAULT_RUNTIME_OVERRIDES);
      expect(result).toEqual([]);
    });

    it('возвращает массив с активными ключами', () => {
      const overrides = createActiveOverrides({
        forceVersion: true,
        disableProvider: true,
        enableShadowMode: true,
      });
      const result = getActiveOverrideKeys(overrides);
      expect(result).toEqual(['force_version', 'disable_provider', 'enable_shadow_mode']);
    });

    it('возвращает пустой массив когда все overrides false', () => {
      const overrides = createActiveOverrides({
        forceVersion: false,
        disableProvider: false,
        failOpenMode: false,
        enableShadowMode: false,
        disableCircuitBreaker: false,
      });
      const result = getActiveOverrideKeys(overrides);
      expect(result).toEqual([]);
    });
  });

  describe('validateRuntimeOverrides', () => {
    it('возвращает true для валидного RuntimeOverrides', () => {
      const overrides = createActiveOverrides({
        forceVersion: true,
        disableProvider: false,
      });
      const result = validateRuntimeOverrides(overrides);
      expect(result).toBe(true);
    });

    it('возвращает true для дефолтных overrides', () => {
      const result = validateRuntimeOverrides(DEFAULT_RUNTIME_OVERRIDES);
      expect(result).toBe(true);
    });

    it('возвращает false для null', () => {
      const result = validateRuntimeOverrides(null);
      expect(result).toBe(false);
    });

    it('возвращает false для не-объекта', () => {
      expect(validateRuntimeOverrides('string')).toBe(false);
      expect(validateRuntimeOverrides(123)).toBe(false);
      expect(validateRuntimeOverrides(true)).toBe(false);
    });

    it('возвращает false для объекта с неправильными типами полей', () => {
      const invalid = {
        forceVersion: 'not_boolean',
        disableProvider: true,
      };
      const result = validateRuntimeOverrides(invalid);
      expect(result).toBe(false);
    });

    it('возвращает false для объекта с лишними полями', () => {
      const invalid = {
        forceVersion: true,
        extraField: 'not_allowed',
      };
      const result = validateRuntimeOverrides(invalid);
      expect(result).toBe(false);
    });

    it('возвращает true для объекта с undefined полями', () => {
      const valid = {
        forceVersion: true,
        disableProvider: undefined,
        failOpenMode: false,
        enableShadowMode: undefined,
        disableCircuitBreaker: undefined,
      };
      const result = validateRuntimeOverrides(valid);
      expect(result).toBe(true);
    });
  });
});

/* ============================================================================
 * 🧪 CONSTANTS & TYPES — TESTS
 * ============================================================================
 */

describe('Constants & Types', () => {
  describe('DEFAULT_RUNTIME_OVERRIDES', () => {
    it('содержит все поля с false значениями', () => {
      expect(DEFAULT_RUNTIME_OVERRIDES.forceVersion).toBe(false);
      expect(DEFAULT_RUNTIME_OVERRIDES.disableProvider).toBe(false);
      expect(DEFAULT_RUNTIME_OVERRIDES.failOpenMode).toBe(false);
      expect(DEFAULT_RUNTIME_OVERRIDES.enableShadowMode).toBe(false);
      expect(DEFAULT_RUNTIME_OVERRIDES.disableCircuitBreaker).toBe(false);
    });
  });

  describe('OverrideKey type', () => {
    it('принимает все валидные override keys', () => {
      const keys: OverrideKey[] = [
        'force_version',
        'disable_provider',
        'fail_open_mode',
        'enable_shadow_mode',
        'disable_circuit_breaker',
      ];
      expect(keys).toHaveLength(5);
    });
  });

  describe('OverridePriority type', () => {
    it('принимает все валидные приоритеты', () => {
      const priorities: OverridePriority[] = ['custom', 'runtime', 'environment'];
      expect(priorities).toHaveLength(3);
    });
  });

  describe('RuntimeOverrides type', () => {
    it('поддерживает все поля как boolean или undefined', () => {
      const overrides: RuntimeOverrides = {
        forceVersion: true,
        disableProvider: false,
        enableShadowMode: true,
      };
      expect(overrides.forceVersion).toBe(true);
      expect(overrides.disableProvider).toBe(false);
      expect(overrides.failOpenMode).toBeUndefined();
      expect(overrides.enableShadowMode).toBe(true);
      expect(overrides.disableCircuitBreaker).toBeUndefined();
    });
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & STRESS TESTS
 * ============================================================================
 */

describe('Edge Cases & Stress Tests', () => {
  it('работает с пустым config объектом', () => {
    const config = {};
    const overrides = createActiveOverrides({ forceVersion: true });
    const result = applyRuntimeOverrides(config as TestConfig, overrides);
    expect(result.applied).toBe(true);
    expect(result.activeKeys).toEqual(['force_version']);
  });

  it('работает с config без полей для overrides', () => {
    const config = { customField: 'value' };
    const overrides = createActiveOverrides({
      disableProvider: true,
      failOpenMode: true,
      enableShadowMode: true,
      disableCircuitBreaker: true,
    });
    const result = applyRuntimeOverrides(config as TestConfig, overrides);
    expect(result.applied).toBe(true);
    expect(result.activeKeys).toEqual([
      'disable_provider',
      'fail_open_mode',
      'enable_shadow_mode',
      'disable_circuit_breaker',
    ]);
    expect((result as any)['customField']).toBe('value'); // оригинальные поля сохраняются
  });

  it('нормализует env values с различными case', () => {
    const env = createTestEnv({
      PIPELINE_OVERRIDE_FORCE_VERSION: 'True',
      PIPELINE_OVERRIDE_DISABLE_PROVIDER: 'FALSE',
      PIPELINE_OVERRIDE_ENABLE_SHADOW_MODE: '1',
      PIPELINE_OVERRIDE_DISABLE_CIRCUIT_BREAKER: '0',
    });
    const result = readRuntimeOverridesFromEnv(env);
    expect(result.forceVersion).toBe(true);
    expect(result.disableProvider).toBe(false);
    expect(result.enableShadowMode).toBe(true);
    expect(result.disableCircuitBreaker).toBe(false);
  });

  it('обрабатывает env values состоящие только из пробелов', () => {
    const env = createTestEnv({
      PIPELINE_OVERRIDE_FORCE_VERSION: '   ', // только пробелы
      PIPELINE_OVERRIDE_DISABLE_PROVIDER: '\t\n ', // табуляция, новая строка, пробел
    });
    const result = readRuntimeOverridesFromEnv(env);
    expect(result.forceVersion).toBe(false);
    expect(result.disableProvider).toBe(false);
  });

  it('работает с длинными env values', () => {
    const longValue = '1   '; // длинная строка с пробелами
    const env = createTestEnv({
      PIPELINE_OVERRIDE_FORCE_VERSION: longValue,
    });
    const result = readRuntimeOverridesFromEnv(env);
    expect(result.forceVersion).toBe(true);
  });

  it('работает с undefined env provider', () => {
    const result = readRuntimeOverridesFromEnv(undefined);
    expect(result).toEqual(DEFAULT_RUNTIME_OVERRIDES);
  });

  it('applyRuntimeOverrides использует Date.now() по умолчанию', () => {
    const config = createTestConfig();
    const overrides = createActiveOverrides({ forceVersion: true });
    const result = applyRuntimeOverrides(config, overrides);
    expect(typeof result.appliedAt).toBe('number');
    expect(result.appliedAt).toBeGreaterThan(0);
  });

  it('overrideMapper может возвращать новый объект', () => {
    const config = createTestConfig({ version: 2 });
    const overrides = createActiveOverrides({ forceVersion: true });
    const baseMapper = createDefaultOverrideMapper<TestConfig>();
    // Создаем новый mapper с переопределенным applier
    const customMapper = {
      ...baseMapper,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      force_version: (config: TestConfig, key: string) => {
        const result = baseMapper.force_version(config, key as any);
        return { ...result, modified: true };
      },
    };
    const result = applyRuntimeOverrides(config, overrides, undefined, customMapper);
    expect((result as any)['modified']).toBe(true);
  });
});
