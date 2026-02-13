/**
 * @file Unit тесты для effects/login/metadata-builders.ts
 * Полное покрытие metadata builders с тестированием всех функций и edge cases
 *
 * @note Все тестовые данные создаются в контролируемой среде и валидируются через buildLoginMetadata.
 * eslint-disable комментарии для ai-security/model-poisoning добавлены там, где это требуется линтером.
 */

import { describe, expect, it, vi } from 'vitest';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type {
  LoginIdentifierType,
  LoginRequest,
  MfaInfo,
} from '../../../../src/domain/LoginRequest.js';
import { buildLoginMetadata } from '../../../../src/effects/login/metadata-builders.js';
import type {
  IdentifierHasher,
  LoginContext,
  LoginMetadata,
  MetadataBuilder,
  MetadataConfig,
  RiskMetadata,
} from '../../../../src/effects/login/metadata-builders.js';
import type { RiskLevel } from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает LoginRequest для тестов */
function createLoginRequest<T extends LoginIdentifierType>(
  type: T,
  overrides: Partial<LoginRequest<T>> = {},
): LoginRequest<T> {
  const base = {
    identifier: {
      type,
      value: type === 'email'
        ? 'user@example.com'
        : type === 'phone'
        ? '+1234567890'
        : 'test-value',
    },
  } as LoginRequest<T>;

  return { ...base, ...overrides } as LoginRequest<T>;
}

/** Создает DeviceInfo для тестов */
function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-test-123',
    deviceType: 'desktop',
    os: 'Windows 10',
    browser: 'Chrome',
    ...overrides,
  };
}

/** Создает RiskMetadata для тестов */
function createRiskMetadata(overrides: Partial<RiskMetadata> = {}): RiskMetadata {
  return {
    riskScore: 50,
    riskLevel: 'medium',
    triggeredRuleIds: ['rule-1', 'rule-2'],
    ...overrides,
  };
}

/** Создает LoginContext для тестов */
function createLoginContext(overrides: Partial<LoginContext> = {}): LoginContext {
  return {
    request: createLoginRequest('email'),
    traceId: 'trace-123',
    timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Создает IdentifierHasher для тестов */
function createIdentifierHasher(prefix: string = 'hash-'): IdentifierHasher {
  return (value: string) => `${prefix}${value}`;
}

/** Создает MetadataConfig для тестов */
function createMetadataConfig(overrides: Partial<MetadataConfig> = {}): MetadataConfig {
  return {
    identifierHasher: createIdentifierHasher(),
    ...overrides,
  };
}

/** Создает MfaInfo для тестов */
function createMfaInfo(
  type: 'totp' | 'sms' | 'email' | 'push',
  token: string,
  deviceId?: string,
): MfaInfo {
  const base: MfaInfo = { type, token };
  return deviceId !== undefined ? { ...base, deviceId } : base;
}

// ============================================================================
// 🧪 BUILD LOGIN METADATA - Основная функция
// ============================================================================

describe('buildLoginMetadata', () => {
  it('создает метаданные с минимальным контекстом', () => {
    const context = createLoginContext();
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    expect(metadata).toHaveLength(3); // trace, identifier, timestamp
    expect(metadata[0]).toMatchObject({ type: 'trace', traceId: 'trace-123' });
    expect(metadata[1]).toMatchObject({
      type: 'identifier',
      identifierType: 'email',
      identifierHash: 'hash-user@example.com',
    });
    expect(metadata[2]).toMatchObject({
      type: 'timestamp',
      timestamp: '2024-01-01T00:00:00Z',
      operation: 'login',
    });
  });

  it('создает метаданные с deviceInfo', () => {
    const context = createLoginContext({
      deviceInfo: createDeviceInfo(),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    expect(metadata).toHaveLength(4); // trace, device, identifier, timestamp
    expect(metadata[1]).toMatchObject({
      type: 'device',
      deviceId: 'device-test-123',
      deviceType: 'desktop',
      os: 'Windows 10',
      browser: 'Chrome',
    });
  });

  it('создает метаданные с deviceInfo без os и browser', () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-test-123',
      deviceType: 'desktop',
    };

    const context = createLoginContext({
      deviceInfo,
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const deviceMetadata = metadata.find((m) => m.type === 'device');
    expect(deviceMetadata).toMatchObject({
      type: 'device',
      deviceId: 'device-test-123',
      deviceType: 'desktop',
    });
    expect(deviceMetadata).not.toHaveProperty('os');
    expect(deviceMetadata).not.toHaveProperty('browser');
  });

  it('создает метаданные с riskMetadata', () => {
    const context = createLoginContext({
      riskMetadata: createRiskMetadata(),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const riskMetadata = metadata.find((m) => m.type === 'risk');
    expect(riskMetadata).toMatchObject({
      type: 'risk',
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRuleIds: ['rule-1', 'rule-2'],
    });
  });

  it('создает метаданные с MFA (одиночный)', () => {
    const context = createLoginContext({
      request: createLoginRequest('email', {
        mfa: createMfaInfo('totp', '123456'),
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const mfaMetadata = metadata.filter((m) => m.type === 'mfa');
    expect(mfaMetadata).toHaveLength(1);
    expect(mfaMetadata[0]).toMatchObject({
      type: 'mfa',
      mfaType: 'totp',
      mfaRequired: true,
    });
  });

  it('создает метаданные с MFA (массив)', () => {
    const context = createLoginContext({
      request: createLoginRequest('email', {
        mfa: [createMfaInfo('totp', '123456'), createMfaInfo('sms', '789012')],
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const mfaMetadata = metadata.filter((m) => m.type === 'mfa');
    expect(mfaMetadata).toHaveLength(2);
    expect(mfaMetadata[0]).toMatchObject({
      type: 'mfa',
      mfaType: 'totp',
      mfaRequired: true,
    });
    expect(mfaMetadata[1]).toMatchObject({
      type: 'mfa',
      mfaType: 'sms',
      mfaRequired: true,
    });
  });

  it('не создает MFA метаданные если MFA отсутствует', () => {
    const context = createLoginContext({
      request: createLoginRequest('email'),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const mfaMetadata = metadata.filter((m) => m.type === 'mfa');
    expect(mfaMetadata).toHaveLength(0);
  });

  it('не создает device метаданные если deviceInfo отсутствует', () => {
    const context = createLoginContext();
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const deviceMetadata = metadata.find((m) => m.type === 'device');
    expect(deviceMetadata).toBeUndefined();
  });

  it('не создает risk метаданные если riskMetadata отсутствует', () => {
    const context = createLoginContext();
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const riskMetadata = metadata.find((m) => m.type === 'risk');
    expect(riskMetadata).toBeUndefined();
  });

  it('создает метаданные для всех типов identifier', () => {
    const types: LoginIdentifierType[] = ['email', 'username', 'phone', 'oauth'];

    types.forEach((type) => {
      const context = createLoginContext({
        request: createLoginRequest(type),
      });
      const config = createMetadataConfig();

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const metadata = buildLoginMetadata(context, config);

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const identifierMetadata = metadata.find((m) => m.type === 'identifier');
      expect(identifierMetadata).toMatchObject({
        type: 'identifier',
        identifierType: type,
      });
      expect(identifierMetadata?.type === 'identifier' && identifierMetadata.identifierHash)
        .toBeTruthy();
    });
  });

  it('использует injected identifierHasher', () => {
    const customHasher: IdentifierHasher = (value) => `custom-${value}-hash`;
    const context = createLoginContext();
    const config = createMetadataConfig({
      identifierHasher: customHasher,
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const identifierMetadata = metadata.find((m) => m.type === 'identifier');
    expect(identifierMetadata).toMatchObject({
      type: 'identifier',
      identifierHash: 'custom-user@example.com-hash',
    });
  });

  it('поддерживает additionalBuilders', () => {
    const customBuilder: MetadataBuilder = (context) => ({
      type: 'trace',
      traceId: `${context.traceId}-custom`,
      spanId: 'custom-span',
    });

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [customBuilder],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // Проверяем что custom builder добавил метаданные
    const customMetadata = metadata.filter((m) =>
      m.type === 'trace' && 'spanId' in m && m.spanId === 'custom-span'
    );
    expect(customMetadata.length).toBeGreaterThan(0);
  });

  it('поддерживает additionalBuilders возвращающие массив', () => {
    const customBuilder: MetadataBuilder = () => [
      { type: 'trace', traceId: 'custom-1' },
      { type: 'trace', traceId: 'custom-2' },
    ];

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [customBuilder],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const customTraces = metadata.filter((m) =>
      m.type === 'trace' && m.traceId.startsWith('custom-')
    );
    expect(customTraces.length).toBeGreaterThanOrEqual(2);
  });

  it('игнорирует builders возвращающие null', () => {
    const nullBuilder: MetadataBuilder = () => null;

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [nullBuilder],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // Должны быть только стандартные метаданные
    expect(metadata.length).toBe(3); // trace, identifier, timestamp
  });

  it('возвращает frozen массив', () => {
    const context = createLoginContext();
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('создает полный набор метаданных', () => {
    const context = createLoginContext({
      deviceInfo: createDeviceInfo(),

      riskMetadata: createRiskMetadata(),

      request: createLoginRequest('email', {
        mfa: createMfaInfo('totp', '123456'),
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    expect(metadata.length).toBeGreaterThanOrEqual(6); // trace, device, identifier, risk, timestamp, mfa

    const types = metadata.map((m) => m.type);
    expect(types).toContain('trace');
    expect(types).toContain('device');
    expect(types).toContain('identifier');
    expect(types).toContain('risk');
    expect(types).toContain('timestamp');
    expect(types).toContain('mfa');
  });
});

// ============================================================================
// 🛡️ VALIDATION - Валидация входных данных
// ============================================================================

describe('buildLoginMetadata - валидация config', () => {
  it('выбрасывает ошибку если config не объект', () => {
    const context = createLoginContext();

    expect(() => {
      buildLoginMetadata(context, null as unknown as MetadataConfig);
    }).toThrow('config must be an object');

    expect(() => {
      buildLoginMetadata(context, undefined as unknown as MetadataConfig);
    }).toThrow('config must be an object');
  });

  it('выбрасывает ошибку если identifierHasher отсутствует', () => {
    const context = createLoginContext();
    const config = {} as MetadataConfig;

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('identifierHasher must be a function');
  });

  it('выбрасывает ошибку если identifierHasher не функция', () => {
    const context = createLoginContext();
    const config = {
      identifierHasher: 'not-a-function',
    } as unknown as MetadataConfig;

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('identifierHasher must be a function');
  });
});

describe('buildLoginMetadata - валидация context', () => {
  it('выбрасывает ошибку если context не объект', () => {
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(null as unknown as LoginContext, config);
    }).toThrow('context must be an object');

    expect(() => {
      buildLoginMetadata(undefined as unknown as LoginContext, config);
    }).toThrow('context must be an object');
  });

  it('выбрасывает ошибку если traceId отсутствует', () => {
    const context = createLoginContext();
    const contextRecord = context as Record<string, unknown>;
    delete contextRecord['traceId'];
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(contextRecord as LoginContext, config);
    }).toThrow('context.traceId must be a non-empty string');
  });

  it('выбрасывает ошибку если traceId пустой', () => {
    const context = createLoginContext({ traceId: '' });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.traceId must be a non-empty string');
  });

  it('выбрасывает ошибку если timestamp отсутствует', () => {
    const context = createLoginContext();
    const contextRecord = context as Record<string, unknown>;
    delete contextRecord['timestamp'];
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(contextRecord as LoginContext, config);
    }).toThrow('context.timestamp must be a non-empty string');
  });

  it('выбрасывает ошибку если timestamp пустой', () => {
    const context = createLoginContext({ timestamp: '' });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.timestamp must be a non-empty string');
  });

  it('выбрасывает ошибку если request отсутствует', () => {
    const context = createLoginContext();
    const contextRecord = context as Record<string, unknown>;
    delete contextRecord['request'];
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(contextRecord as LoginContext, config);
    }).toThrow('context.request must be a valid LoginRequest object');
  });

  it('выбрасывает ошибку если request не объект', () => {
    const context = createLoginContext({
      request: null as unknown as LoginRequest<LoginIdentifierType>,
    });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.request must be a valid LoginRequest object');
  });

  it('выбрасывает ошибку если identifier отсутствует', () => {
    const context = createLoginContext({
      request: {} as LoginRequest<LoginIdentifierType>,
    });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.request.identifier must be a valid identifier object');
  });

  it('выбрасывает ошибку если identifier не объект', () => {
    const context = createLoginContext({
      request: {
        identifier: null,
      } as unknown as LoginRequest<LoginIdentifierType>,
    });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.request.identifier must be a valid identifier object');
  });

  it('выбрасывает ошибку если identifier.type отсутствует', () => {
    const context = createLoginContext({
      request: {
        identifier: { value: 'test' },
      } as unknown as LoginRequest<LoginIdentifierType>,
    });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.request.identifier.type must be a string');
  });

  it('выбрасывает ошибку если identifier.value отсутствует', () => {
    const context = createLoginContext({
      request: {
        identifier: { type: 'email' },
      } as unknown as LoginRequest<LoginIdentifierType>,
    });
    const config = createMetadataConfig();

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('context.request.identifier.value must be a string');
  });
});

describe('buildLoginMetadata - валидация additionalBuilders', () => {
  it('выбрасывает ошибку если additionalBuilders не массив', () => {
    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: 'not-an-array' as unknown as readonly MetadataBuilder[],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('additionalBuilders must be an array');
  });

  it('выбрасывает ошибку если additionalBuilders содержит не-функцию', () => {
    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [123 as unknown as MetadataBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('additionalBuilders must contain only functions');
  });

  it('принимает отсутствующий additionalBuilders', () => {
    const context = createLoginContext();
    const config: MetadataConfig = {
      identifierHasher: createIdentifierHasher(),
    };

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    expect(metadata.length).toBe(3); // trace, identifier, timestamp
  });

  it('принимает пустой массив additionalBuilders', () => {
    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    expect(metadata.length).toBe(3); // trace, identifier, timestamp
  });
});

// ============================================================================
// 🔍 VALIDATE BUILDER RESULT - Валидация результатов external builders
// ============================================================================

describe('buildLoginMetadata - валидация результатов external builders', () => {
  it('валидирует external builder результат с валидным типом', () => {
    const validBuilder: MetadataBuilder = () => ({
      type: 'trace',
      traceId: 'external-trace',
    });

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [validBuilder],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const externalTrace = metadata.find((m) =>
      m.type === 'trace' && m.traceId === 'external-trace'
    );
    expect(externalTrace).toBeDefined();
  });

  it('валидирует external builder результат с risk типом и валидным riskLevel', () => {
    const riskBuilder: MetadataBuilder = () => ({
      type: 'risk',
      riskScore: 75,
      riskLevel: 'high',
      triggeredRuleIds: ['rule-1'],
    });

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [riskBuilder],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const externalRisk = metadata.find((m) => m.type === 'risk' && m.riskScore === 75);
    expect(externalRisk).toBeDefined();
    expect(externalRisk?.type === 'risk' && externalRisk.riskLevel).toBe('high');
  });

  it('выбрасывает ошибку если external builder возвращает невалидный тип', () => {
    const invalidBuilder: MetadataBuilder = () => ({
      type: 'invalid-type',
    } as unknown as LoginMetadata);

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('Builder result type must be one of:');
  });

  it('выбрасывает ошибку если external builder возвращает risk с невалидным riskLevel', () => {
    const invalidRiskBuilder: MetadataBuilder = () => ({
      type: 'risk',
      riskScore: 75,
      riskLevel: 'invalid-level',
      triggeredRuleIds: [],
    } as unknown as LoginMetadata);

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidRiskBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('risk metadata riskLevel must be one of:');
  });

  it('выбрасывает ошибку если external builder возвращает risk с riskLevel не string', () => {
    const invalidRiskBuilder: MetadataBuilder = () => ({
      type: 'risk',
      riskScore: 75,
      riskLevel: 123,
      triggeredRuleIds: [],
    } as unknown as LoginMetadata);

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidRiskBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('risk metadata riskLevel must be one of:');
  });

  it('выбрасывает ошибку если external builder возвращает не объект', () => {
    const invalidBuilder: MetadataBuilder = () => 'not-an-object' as unknown as LoginMetadata;

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('Builder must return valid LoginMetadata or null');
  });

  it('выбрасывает ошибку если external builder возвращает null как объект', () => {
    const invalidBuilder: MetadataBuilder = () => null as unknown as LoginMetadata;

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidBuilder],
    });

    // null обрабатывается корректно (пропускается)
    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);
    expect(metadata.length).toBe(3); // trace, identifier, timestamp
  });

  it('выбрасывает ошибку если external builder результат не имеет type поля', () => {
    const invalidBuilder: MetadataBuilder = () => ({
      notType: 'trace',
    } as unknown as LoginMetadata);

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('Builder result must have a string type field');
  });

  it('выбрасывает ошибку если external builder результат имеет type не string', () => {
    const invalidBuilder: MetadataBuilder = () => ({
      type: 123,
    } as unknown as LoginMetadata);

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [invalidBuilder],
    });

    expect(() => {
      buildLoginMetadata(context, config);
    }).toThrow('Builder result must have a string type field');
  });
});

// ============================================================================
// 📊 ПОКРЫТИЕ ВСЕХ ТИПОВ МЕТАДАННЫХ
// ============================================================================

describe('buildLoginMetadata - покрытие всех типов метаданных', () => {
  it('создает trace метаданные', () => {
    const context = createLoginContext({ traceId: 'custom-trace-123' });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const traceMetadata = metadata.find((m) => m.type === 'trace');
    expect(traceMetadata).toMatchObject({
      type: 'trace',
      traceId: 'custom-trace-123',
    });
  });

  it('создает device метаданные со всеми полями', () => {
    const context = createLoginContext({
      deviceInfo: createDeviceInfo({
        deviceId: 'device-full',
        deviceType: 'mobile',
        os: 'iOS 17',
        browser: 'Safari',
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const deviceMetadata = metadata.find((m) => m.type === 'device');
    expect(deviceMetadata).toMatchObject({
      type: 'device',
      deviceId: 'device-full',
      deviceType: 'mobile',
      os: 'iOS 17',
      browser: 'Safari',
    });
  });

  it('создает risk метаданные со всеми полями', () => {
    const context = createLoginContext({
      riskMetadata: createRiskMetadata({
        riskScore: 85,
        riskLevel: 'critical',
        triggeredRuleIds: ['rule-1', 'rule-2', 'rule-3'],
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const riskMetadata = metadata.find((m) => m.type === 'risk');
    expect(riskMetadata).toMatchObject({
      type: 'risk',
      riskScore: 85,
      riskLevel: 'critical',
      triggeredRuleIds: ['rule-1', 'rule-2', 'rule-3'],
    });
  });

  it('создает identifier метаданные для всех типов', () => {
    const types: LoginIdentifierType[] = ['email', 'username', 'phone', 'oauth'];

    types.forEach((type) => {
      const context = createLoginContext({
        request: createLoginRequest(type),
      });
      const config = createMetadataConfig();

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const metadata = buildLoginMetadata(context, config);

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const identifierMetadata = metadata.find((m) => m.type === 'identifier');
      expect(identifierMetadata).toMatchObject({
        type: 'identifier',
        identifierType: type,
      });
      expect(identifierMetadata?.type === 'identifier' && identifierMetadata.identifierHash)
        .toBeTruthy();
    });
  });

  it('создает timestamp метаданные', () => {
    const context = createLoginContext({ timestamp: '2024-12-31T23:59:59Z' });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const timestampMetadata = metadata.find((m) => m.type === 'timestamp');
    expect(timestampMetadata).toMatchObject({
      type: 'timestamp',
      timestamp: '2024-12-31T23:59:59Z',
      operation: 'login',
    });
  });

  it('создает mfa метаданные для всех типов MFA', () => {
    const mfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

    mfaTypes.forEach((mfaType) => {
      const context = createLoginContext({
        request: createLoginRequest('email', {
          mfa: createMfaInfo(mfaType, 'token-123'),
        }),
      });
      const config = createMetadataConfig();

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const metadata = buildLoginMetadata(context, config);

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const mfaMetadata = metadata.find((m) => m.type === 'mfa' && m.mfaType === mfaType);
      expect(mfaMetadata).toMatchObject({
        type: 'mfa',
        mfaType,
        mfaRequired: true,
      });
    });
  });
});

// ============================================================================
// 🔄 DETERMINISM - Детерминированность
// ============================================================================

describe('buildLoginMetadata - детерминированность', () => {
  it('возвращает одинаковые метаданные для одинакового контекста', () => {
    const context1 = createLoginContext();
    const context2 = createLoginContext();
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata1 = buildLoginMetadata(context1, config);
    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata2 = buildLoginMetadata(context2, config);

    expect(metadata1).toEqual(metadata2);
  });

  it('возвращает разные метаданные для разных traceId', () => {
    const context1 = createLoginContext({ traceId: 'trace-1' });
    const context2 = createLoginContext({ traceId: 'trace-2' });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata1 = buildLoginMetadata(context1, config);
    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata2 = buildLoginMetadata(context2, config);

    const trace1 = metadata1.find((m) => m.type === 'trace');

    const trace2 = metadata2.find((m) => m.type === 'trace');

    expect(trace1?.type === 'trace' && trace1['traceId']).toBe('trace-1');
    expect(trace2?.type === 'trace' && trace2['traceId']).toBe('trace-2');
  });

  it('возвращает разные identifierHash для разных identifierHasher', () => {
    const context = createLoginContext();
    const config1 = createMetadataConfig({ identifierHasher: (v) => `hash1-${v}` });
    const config2 = createMetadataConfig({ identifierHasher: (v) => `hash2-${v}` });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata1 = buildLoginMetadata(context, config1);
    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata2 = buildLoginMetadata(context, config2);

    const id1 = metadata1.find((m) => m.type === 'identifier');

    const id2 = metadata2.find((m) => m.type === 'identifier');

    expect(id1?.type === 'identifier' && id1['identifierHash']).toBe('hash1-user@example.com');
    expect(id2?.type === 'identifier' && id2['identifierHash']).toBe('hash2-user@example.com');
  });
});

// ============================================================================
// 🔐 SECURITY - PII Protection
// ============================================================================

describe('buildLoginMetadata - PII protection', () => {
  it('не включает raw identifier value в метаданные', () => {
    // Используем hasher, который не включает исходное значение в hash
    const safeHasher: IdentifierHasher = () => 'hashed-identifier-value';

    const context = createLoginContext({
      request: createLoginRequest('email', {
        identifier: { type: 'email', value: 'sensitive@example.com' },
      }),
    });
    const config = createMetadataConfig({
      identifierHasher: safeHasher,
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadataString = JSON.stringify(metadata);
    expect(metadataString).not.toContain('sensitive@example.com');
    expect(metadataString).toContain('hashed-identifier-value');
  });

  it('использует injected hasher для всех типов identifier', () => {
    const hasher = vi.fn((value: string) => `hashed-${value}`);
    const types: LoginIdentifierType[] = ['email', 'username', 'phone', 'oauth'];

    types.forEach((type) => {
      hasher.mockClear();
      const context = createLoginContext({
        request: createLoginRequest(type),
      });
      const config = createMetadataConfig({ identifierHasher: hasher });

      buildLoginMetadata(context, config);

      expect(hasher).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// 🎯 EDGE CASES - Граничные случаи
// ============================================================================

describe('buildLoginMetadata - edge cases', () => {
  it('обрабатывает пустой массив MFA', () => {
    const context = createLoginContext({
      request: createLoginRequest('email', {
        mfa: [],
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const mfaMetadata = metadata.filter((m) => m.type === 'mfa');
    expect(mfaMetadata).toHaveLength(0);
  });

  it('обрабатывает riskMetadata с пустым массивом triggeredRuleIds', () => {
    const context = createLoginContext({
      riskMetadata: createRiskMetadata({
        triggeredRuleIds: [],
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const riskMetadata = metadata.find((m) => m.type === 'risk');
    expect(riskMetadata).toMatchObject({
      type: 'risk',
      triggeredRuleIds: [],
    });
  });

  it('обрабатывает deviceInfo только с обязательными полями', () => {
    const context = createLoginContext({
      deviceInfo: {
        deviceId: 'minimal-device',
        deviceType: 'unknown',
      },
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const deviceMetadata = metadata.find((m) => m.type === 'device');
    expect(deviceMetadata).toMatchObject({
      type: 'device',
      deviceId: 'minimal-device',
      deviceType: 'unknown',
    });
    expect(deviceMetadata).not.toHaveProperty('os');
    expect(deviceMetadata).not.toHaveProperty('browser');
  });

  it('обрабатывает все типы RiskLevel', () => {
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    riskLevels.forEach((riskLevel) => {
      const context = createLoginContext({
        riskMetadata: createRiskMetadata({ riskLevel }),
      });
      const config = createMetadataConfig();

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const metadata = buildLoginMetadata(context, config);

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
      const riskMetadata = metadata.find((m) => m.type === 'risk');
      expect(riskMetadata).toMatchObject({
        type: 'risk',
        riskLevel,
      });
    });
  });

  it('обрабатывает multiple additionalBuilders', () => {
    const builder1: MetadataBuilder = () => ({ type: 'trace', traceId: 'builder1' });
    const builder2: MetadataBuilder = () => ({ type: 'trace', traceId: 'builder2' });
    const builder3: MetadataBuilder = () => null;

    const context = createLoginContext();
    const config = createMetadataConfig({
      additionalBuilders: [builder1, builder2, builder3],
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const traces = metadata.filter((m) => m.type === 'trace');
    const traceIds = traces.map((t) => t['traceId']).filter(Boolean);
    expect(traceIds).toContain('builder1');
    expect(traceIds).toContain('builder2');
  });

  it('сохраняет порядок метаданных', () => {
    const context = createLoginContext({
      deviceInfo: createDeviceInfo(),

      riskMetadata: createRiskMetadata(),

      request: createLoginRequest('email', {
        mfa: createMfaInfo('totp', '123456'),
      }),
    });
    const config = createMetadataConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildLoginMetadata
    const metadata = buildLoginMetadata(context, config);

    const types = metadata.map((m) => m.type);
    // Порядок: trace, device, identifier, risk, timestamp, mfa
    expect(types[0]).toBe('trace');
    expect(types[1]).toBe('device');
    expect(types[2]).toBe('identifier');
    expect(types[3]).toBe('risk');
    expect(types[4]).toBe('timestamp');
    expect(types[5]).toBe('mfa');
  });
});
