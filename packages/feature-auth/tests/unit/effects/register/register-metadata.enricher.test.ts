/**
 * @file Unit тесты для effects/register/register-metadata.enricher.ts
 * Полное покрытие buildRegisterMetadata с тестированием happy-path и всех guard-веток.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  RegisterIdentifierType,
  RegisterRequest,
} from '../../../../src/dto/RegisterRequest.js';
import type {
  RegisterMetadata,
  RegisterMetadataConfig,
  RegisterMetadataContext,
  RegisterMetadataVersion,
} from '../../../../src/effects/register/register-metadata.enricher.js';
import { buildRegisterMetadata } from '../../../../src/effects/register/register-metadata.enricher.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createRegisterRequest<T extends RegisterIdentifierType>(
  type: T,
  overrides: Partial<RegisterRequest<T>> = {},
): RegisterRequest<T> {
  const base: RegisterRequest<T> = {
    identifier: {
      type,
      value: 'user@example.com',
    },
  } as RegisterRequest<T>;

  return { ...base, ...overrides } as RegisterRequest<T>;
}

function createContext(
  overrides: Partial<RegisterMetadataContext> = {},
): RegisterMetadataContext {
  return {
    request: createRegisterRequest('email'),
    traceId: 'trace-123',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createConfig(
  overrides: Partial<RegisterMetadataConfig> = {},
): RegisterMetadataConfig {
  const identifierHasher = (value: string) => `hash-${value}`;
  return {
    identifierHasher,
    ...overrides,
  };
}

// ============================================================================
// 🧪 buildRegisterMetadata — базовое поведение
// ============================================================================

describe('buildRegisterMetadata', () => {
  it('создает базовый набор метаданных (trace, identifier, timestamp) с версией v=1', () => {
    const context = createContext();
    const config = createConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildRegisterMetadata
    const metadata = buildRegisterMetadata(context, config);

    expect(Array.isArray(metadata)).toBe(true);
    expect(metadata).toHaveLength(3);

    const [trace, identifier, timestamp] = metadata;

    const version: RegisterMetadataVersion = '1';

    expect(trace).toEqual<RegisterMetadata>({
      v: version,
      type: 'trace',
      traceId: 'trace-123',
    });

    expect(identifier).toEqual<RegisterMetadata>({
      v: version,
      type: 'identifier',
      identifierType: 'email',
      identifierHash: 'hash-user@example.com',
    });

    expect(timestamp).toEqual<RegisterMetadata>({
      v: version,
      type: 'timestamp',
      timestamp: '2026-01-01T00:00:00.000Z',
      operation: 'register',
    });

    // frozen contract
    expect(Object.isFrozen(metadata)).toBe(true);
    metadata.forEach((item) => {
      expect(Object.isFrozen(item)).toBe(true);
    });
  });

  it('использует identifier.type из RegisterRequest для всех типов идентификатора', () => {
    const types: RegisterIdentifierType[] = ['email', 'username', 'phone', 'oauth'];

    types.forEach((type) => {
      const request = createRegisterRequest(type, {
        identifier: {
          type,
          value: `${type}-value`,
        } as RegisterRequest<typeof type>['identifier'],
      });
      const context = createContext({ request });
      const hasher = vi.fn((value: string) => `hashed-${value}`);
      const config = createConfig({ identifierHasher: hasher });

      // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildRegisterMetadata
      const metadata = buildRegisterMetadata(context, config);

      const identifier = metadata.find((m) => m.type === 'identifier');
      expect(identifier).toMatchObject({
        type: 'identifier',
        identifierType: type,
        identifierHash: `hashed-${type}-value`,
      });
      expect(hasher).toHaveBeenCalledTimes(1);
      expect(hasher).toHaveBeenCalledWith(`${type}-value`);
    });
  });

  it('детерминированен для одинакового контекста и конфигурации', () => {
    const context = createContext();
    const config = createConfig();

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildRegisterMetadata
    const metadata1 = buildRegisterMetadata(context, config);
    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildRegisterMetadata
    const metadata2 = buildRegisterMetadata(context, config);

    expect(metadata1).toEqual(metadata2);
  });

  it('меняет traceId и timestamp при различиях в контексте', () => {
    const context1 = createContext({
      traceId: 'trace-1',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const context2 = createContext({
      traceId: 'trace-2',
      timestamp: '2026-01-02T00:00:00.000Z',
    });
    const config = createConfig();

    const [trace1, , ts1] = buildRegisterMetadata(context1, config);
    const [trace2, , ts2] = buildRegisterMetadata(context2, config);

    expect(trace1).toMatchObject({ type: 'trace', traceId: 'trace-1' });
    expect(trace2).toMatchObject({ type: 'trace', traceId: 'trace-2' });
    expect(ts1).toMatchObject({ type: 'timestamp', timestamp: '2026-01-01T00:00:00.000Z' });
    expect(ts2).toMatchObject({ type: 'timestamp', timestamp: '2026-01-02T00:00:00.000Z' });
  });

  it("делегирует PII-protection hasher'у: raw identifier может быть скрыт", () => {
    const context = createContext({
      request: createRegisterRequest('email', {
        identifier: {
          type: 'email',
          value: 'sensitive@example.com',
        },
      } as RegisterRequest<'email'>),
    });
    const config = createConfig({
      identifierHasher: () => 'hashed-identifier-value',
    });

    // eslint-disable-next-line ai-security/model-poisoning -- Test data validated by buildRegisterMetadata
    const metadata = buildRegisterMetadata(context, config);
    const serialized = JSON.stringify(metadata);

    expect(serialized).not.toContain('sensitive@example.com');
    expect(serialized).toContain('hashed-identifier-value');
  });
});

// ============================================================================
// 🛡️ buildRegisterMetadata — валидация входных данных
// ============================================================================

describe("buildRegisterMetadata - валидация контекста и hasher'а", () => {
  it('выбрасывает ошибку если identifier.value пустой (после trim)', () => {
    const context = createContext({
      request: createRegisterRequest('email', {
        identifier: {
          type: 'email',
          value: '   ',
        },
      } as RegisterRequest<'email'>),
    });
    const config = createConfig();

    expect(() => buildRegisterMetadata(context, config)).toThrow(
      '[register-metadata] Invalid identifier.value: must be a non-empty string',
    );
  });

  it('выбрасывает ошибку если traceId пустой (после trim)', () => {
    const context = createContext({
      traceId: '   ',
    });
    const config = createConfig();

    expect(() => buildRegisterMetadata(context, config)).toThrow(
      '[register-metadata] Invalid traceId: must be a non-empty string',
    );
  });

  it('выбрасывает ошибку если timestamp пустой (после trim)', () => {
    const context = createContext({
      timestamp: '   ',
    });
    const config = createConfig();

    expect(() => buildRegisterMetadata(context, config)).toThrow(
      '[register-metadata] Invalid timestamp: must be a non-empty string',
    );
  });

  it('выбрасывает ошибку если identifierHasher вернул пустую строку (после trim)', () => {
    const context = createContext();
    const config = createConfig({
      identifierHasher: () => '   ',
    });

    expect(() => buildRegisterMetadata(context, config)).toThrow(
      '[register-metadata] Invalid identifierHash: hasher returned empty value',
    );
  });

  it('выбрасывает ошибку если identifierHasher вернул не строку', () => {
    const context = createContext();
    const config = createConfig({
      identifierHasher: (() => 12345) as unknown as RegisterMetadataConfig['identifierHasher'],
    });

    expect(() => buildRegisterMetadata(context, config)).toThrow(
      '[register-metadata] Invalid identifierHash: hasher returned empty value',
    );
  });
});
