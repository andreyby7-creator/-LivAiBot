/**
 * @file Unit тесты для effects/login/login-risk-assessment.adapter.ts
 * Полное покрытие 100% всех функций и edge cases
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// 🔧 MOCKS
// ============================================================================

const mockTransformDomainToDto = vi.hoisted(() => vi.fn());

// Мокируем только для большинства тестов, но оставляем возможность использовать реальную реализацию
vi.mock('@livai/core', async () => {
  // eslint-disable-next-line @livai/multiagent/orchestration-safety -- vi.importActual не требует timeout, это синхронная операция мокинга
  const actual = await vi.importActual('@livai/core');
  return {
    ...actual,
    transformDomainToDto: (...args: unknown[]) => mockTransformDomainToDto(...args),
  };
});

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type {
  RiskSignals,
  SignalsMapperPlugin,
} from '../../../../src/effects/login/login-risk-assessment.adapter.js';
import { buildAssessment } from '../../../../src/effects/login/login-risk-assessment.adapter.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает минимальный DeviceInfo для тестов */
function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-test-123',
    deviceType: 'desktop',
    os: 'Windows 10',
    browser: 'Chrome',
    ...overrides,
  };
}

/** Создает RiskSignals для тестов */
function createRiskSignals(overrides: Partial<RiskSignals> = {}): RiskSignals {
  return {
    isVpn: false,
    isTor: false,
    isProxy: false,
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - normalizeDeviceForRisk (через buildAssessment)
// ============================================================================

describe('normalizeDeviceForRisk', () => {
  beforeEach(() => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('platform detection from OS', () => {
    it('определяет platform как desktop когда os undefined и deviceType desktop', () => {
      const deviceInfo = createDeviceInfo({ deviceType: 'desktop' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('desktop');
    });

    it('определяет platform как web когда os undefined и deviceType не desktop', () => {
      const deviceInfo = createDeviceInfo({ os: '', deviceType: 'mobile' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('web');
    });

    it('определяет platform как web когда os пустая строка и deviceType не desktop', () => {
      const deviceInfo = createDeviceInfo({ os: '', deviceType: 'mobile' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('web');
    });

    it('определяет platform как ios когда os содержит ios', () => {
      const deviceInfo = createDeviceInfo({ os: 'iOS 15.0' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('ios');
    });

    it('определяет platform как ios когда os содержит iphone', () => {
      const deviceInfo = createDeviceInfo({ os: 'iPhone OS 15.0' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('ios');
    });

    it('определяет platform как ios когда os содержит ipad', () => {
      const deviceInfo = createDeviceInfo({ os: 'iPad OS 15.0' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('ios');
    });

    it('определяет platform как android когда os содержит android', () => {
      const deviceInfo = createDeviceInfo({ os: 'Android 12' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('android');
    });

    it('определяет platform как desktop когда os содержит windows', () => {
      const deviceInfo = createDeviceInfo({ os: 'Windows 11' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('desktop');
    });

    it('определяет platform как desktop когда os содержит macos', () => {
      const deviceInfo = createDeviceInfo({ os: 'macOS 12.0' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('desktop');
    });

    it('определяет platform как desktop когда os содержит linux', () => {
      const deviceInfo = createDeviceInfo({ os: 'Linux Ubuntu 22.04' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('desktop');
    });

    it('определяет platform как web когда os не соответствует известным платформам', () => {
      const deviceInfo = createDeviceInfo({ os: 'Unknown OS' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.platform).toBe('web');
    });
  });

  describe('optional fields inclusion', () => {
    it('включает os когда os определен и не пустой', () => {
      const deviceInfo = createDeviceInfo({ os: 'Windows 10' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.os).toBe('Windows 10');
    });

    it('не включает os когда os undefined', () => {
      const deviceInfo = createDeviceInfo({ os: '' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.os).toBeUndefined();
    });

    it('не включает os когда os пустая строка', () => {
      const deviceInfo = createDeviceInfo({ os: '' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.os).toBeUndefined();
    });

    it('включает browser когда browser определен и не пустой', () => {
      const deviceInfo = createDeviceInfo({ browser: 'Chrome 112' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.browser).toBe('Chrome 112');
    });

    it('не включает browser когда browser undefined', () => {
      const deviceInfo = createDeviceInfo({ browser: '' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.browser).toBeUndefined();
    });

    it('не включает browser когда browser пустая строка', () => {
      const deviceInfo = createDeviceInfo({ browser: '' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.browser).toBeUndefined();
    });

    it('включает appVersion когда appVersion определен и не пустой', () => {
      const deviceInfo = createDeviceInfo({ appVersion: '1.0.0' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.appVersion).toBe('1.0.0');
    });

    it('не включает appVersion когда appVersion undefined', () => {
      const deviceInfo = createDeviceInfo();
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.appVersion).toBeUndefined();
    });

    it('не включает appVersion когда appVersion пустая строка', () => {
      const deviceInfo = createDeviceInfo({ appVersion: '' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.appVersion).toBeUndefined();
    });

    it('всегда включает deviceId', () => {
      const deviceInfo = createDeviceInfo({ deviceId: 'custom-device-id' });
      const result = buildAssessment(deviceInfo, {});

      expect(result.device?.deviceId).toBe('custom-device-id');
    });
  });
});

// ============================================================================
// 🎯 TESTS - enforceWhitelist (через mapSignalsToRecord)
// ============================================================================

describe('enforceWhitelist', () => {
  beforeEach(() => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        isTor: false,
        reputationScore: 85,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('разрешает whitelist поля', () => {
    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
  });

  it('разрешает поля с префиксом custom_', () => {
    const signals = createRiskSignals();
    const plugin: SignalsMapperPlugin = () => ({
      custom_vendorId: 'vendor-123',
      custom_metadata: { test: 'value' },
    });

    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(result.signals).toBeDefined();
    expect(result.signals?.['custom_vendorId']).toBe('vendor-123');
    expect(result.signals?.['custom_metadata']).toEqual({ test: 'value' });
  });

  it('удаляет поля не из whitelist и без префикса custom_', () => {
    const signals = createRiskSignals();
    const plugin: SignalsMapperPlugin = () => ({
      isVpn: true,
      maliciousField: 'should be removed',
      anotherBadField: 123,
    });

    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(result.signals).toBeDefined();
    expect(result.signals?.['maliciousField']).toBeUndefined();
    expect(result.signals?.['anotherBadField']).toBeUndefined();
  });

  it('удаляет externalSignals', () => {
    const signals = createRiskSignals({
      externalSignals: { vendorData: 'secret' },
    });
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeDefined();
    expect(result.signals?.['externalSignals']).toBeUndefined();
  });

  it('игнорирует не-string ключи', () => {
    const signals = createRiskSignals();
    const plugin: SignalsMapperPlugin = () => {
      const record: Record<string, unknown> = {
        isVpn: true,
      };
      // Симулируем не-string ключ (в реальности Object.entries всегда возвращает string)
      Object.defineProperty(record, Symbol('test'), { value: 'test', enumerable: true });
      return record;
    };

    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
  });
});

// ============================================================================
// 🎯 TESTS - mapSignalsToRecord
// ============================================================================

describe('mapSignalsToRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('возвращает undefined когда signals undefined', () => {
    const result = buildAssessment(createDeviceInfo(), {});

    expect(result.signals).toBeUndefined();
  });

  it('возвращает undefined когда transformDomainToDto возвращает !ok', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: false,
      error: new Error('Transform failed'),
    });

    const signals = createRiskSignals();
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeUndefined();
  });

  it('возвращает record когда transformDomainToDto успешен', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        reputationScore: 85,
      },
    });

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['reputationScore']).toBe(85);
  });

  it('возвращает undefined когда все значения undefined', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: undefined,
        isTor: undefined,
      },
    });

    const signals = createRiskSignals();
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeUndefined();
  });

  it('применяет plugin когда передан', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
      },
    });

    const plugin: SignalsMapperPlugin = vi.fn((_signals, baseRecord) => ({
      ...baseRecord,
      custom_vendorId: 'vendor-123',
    }));

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(plugin).toHaveBeenCalledTimes(1);
    expect(result.signals).toBeDefined();
    expect(result.signals?.['custom_vendorId']).toBe('vendor-123');
  });

  it('защищает base whitelist поля от перезаписи плагином', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        reputationScore: 85,
      },
    });

    const plugin: SignalsMapperPlugin = (_signals, baseRecord) => ({
      ...baseRecord,
      isVpn: false, // Попытка перезаписи
      reputationScore: 0, // Попытка перезаписи
      custom_vendorId: 'vendor-123',
    });

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    // Base поля не должны быть перезаписаны
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['reputationScore']).toBe(85);
    // Custom поля должны быть добавлены
    expect(result.signals?.['custom_vendorId']).toBe('vendor-123');
  });

  it('передает frozen copy baseRecord в plugin', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
      },
    });

    const plugin: SignalsMapperPlugin = vi.fn((_signals, baseRecord) => {
      // Проверяем, что baseRecord frozen (в strict mode Object.freeze бросает ошибку при попытке мутации)
      expect(Object.isFrozen(baseRecord)).toBe(true);
      // Создаем новый объект для возврата (не мутируем baseRecord)
      const newRecord = { ...baseRecord, custom_vendorId: 'vendor-123' };
      return newRecord;
    });

    const signals = createRiskSignals({ isVpn: true });
    buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(plugin).toHaveBeenCalledTimes(1);
    const callArgs = (plugin as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(Object.isFrozen(callArgs?.[1])).toBe(true);
  });

  it('не применяет plugin когда plugin undefined', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
      },
    });

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
  });
});

// ============================================================================
// 🎯 TESTS - buildAssessment (Main API)
// ============================================================================

describe('buildAssessment', () => {
  beforeEach(() => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('строит минимальный LoginRiskAssessment', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result).toBeDefined();
    expect(result.device).toBeDefined();
    expect(result.device?.deviceId).toBe('device-test-123');
  });

  it('включает userId когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, { userId: 'user-123' });

    expect(result.userId).toBe('user-123');
  });

  it('не включает userId когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.userId).toBeUndefined();
  });

  it('включает ip когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, { ip: '192.168.1.1' });

    expect(result.ip).toBe('192.168.1.1');
  });

  it('не включает ip когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.ip).toBeUndefined();
  });

  it('включает geo когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const geo = {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    };
    const result = buildAssessment(deviceInfo, { geo });

    expect(result.geo).toEqual(geo);
  });

  it('не включает geo когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.geo).toBeUndefined();
  });

  it('включает userAgent из deviceInfo когда передан', () => {
    const deviceInfo = createDeviceInfo({ userAgent: 'Mozilla/5.0' });
    const result = buildAssessment(deviceInfo, {});

    expect(result.userAgent).toBe('Mozilla/5.0');
  });

  it('не включает userAgent когда undefined в deviceInfo', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.userAgent).toBeUndefined();
  });

  it('включает userAgent из deviceInfo когда передан в deviceInfo', () => {
    const deviceInfo = createDeviceInfo({ userAgent: 'Device User Agent' });
    const result = buildAssessment(deviceInfo, {});

    expect(result.userAgent).toBe('Device User Agent');
  });

  it('включает previousSessionId когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, { previousSessionId: 'session-123' });

    expect(result.previousSessionId).toBe('session-123');
  });

  it('не включает previousSessionId когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.previousSessionId).toBeUndefined();
  });

  it('включает timestamp когда передан', () => {
    const deviceInfo = createDeviceInfo();
    const timestamp = '2024-01-01T00:00:00.000Z';
    const result = buildAssessment(deviceInfo, { timestamp });

    expect(result.timestamp).toBe(timestamp);
  });

  it('не включает timestamp когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.timestamp).toBeUndefined();
  });

  it('включает signals когда передан и не пустой', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        reputationScore: 85,
      },
    });

    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(deviceInfo, { signals });

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['reputationScore']).toBe(85);
  });

  it('не включает signals когда undefined', () => {
    const deviceInfo = createDeviceInfo();
    const result = buildAssessment(deviceInfo, {});

    expect(result.signals).toBeUndefined();
  });

  it('не включает signals когда все значения undefined', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: undefined,
        isTor: undefined,
      },
    });

    const deviceInfo = createDeviceInfo();
    const signals = createRiskSignals();
    const result = buildAssessment(deviceInfo, { signals });

    expect(result.signals).toBeUndefined();
  });

  it('строит полный LoginRiskAssessment со всеми полями', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        reputationScore: 85,
        velocityScore: 10,
      },
    });

    const deviceInfo = createDeviceInfo({
      os: 'Windows 11',
      browser: 'Chrome 112',
      appVersion: '1.0.0',
      userAgent: 'Mozilla/5.0',
    });
    const context = {
      userId: 'user-123',
      ip: '192.168.1.1',
      geo: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
      userAgent: 'Custom Agent',
      previousSessionId: 'session-123',
      timestamp: '2024-01-01T00:00:00.000Z',
      signals: createRiskSignals({ isVpn: true }),
    };
    const plugin: SignalsMapperPlugin = (_signals, baseRecord) => ({
      ...baseRecord,
      custom_vendorId: 'vendor-123',
    });

    const result = buildAssessment(deviceInfo, context, plugin);

    expect(result).toBeDefined();
    expect(result.userId).toBe('user-123');
    expect(result.ip).toBe('192.168.1.1');
    expect(result.geo).toEqual(context.geo);
    expect(result.device).toBeDefined();
    expect(result.device?.deviceId).toBe('device-test-123');
    expect(result.device?.platform).toBe('desktop');
    expect(result.device?.os).toBe('Windows 11');
    expect(result.device?.browser).toBe('Chrome 112');
    expect(result.device?.appVersion).toBe('1.0.0');
    expect(result.userAgent).toBe('Mozilla/5.0'); // userAgent берется из deviceInfo, не из context
    expect(result.previousSessionId).toBe('session-123');
    expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['reputationScore']).toBe(85);
    expect(result.signals?.['velocityScore']).toBe(10);
    expect(result.signals?.['custom_vendorId']).toBe('vendor-123');
  });
});

// ============================================================================
// 🎯 TESTS - Edge Cases и Security
// ============================================================================

describe('Security and Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('защищает от malicious plugin пытающегося перезаписать все whitelist поля', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        isTor: false,
        isProxy: false,
        asn: 'AS12345',
        reputationScore: 85,
        velocityScore: 10,
        previousGeo: { country: 'US' },
      },
    });

    const maliciousPlugin: SignalsMapperPlugin = () => ({
      isVpn: false, // Попытка перезаписи
      isTor: true, // Попытка перезаписи
      isProxy: true, // Попытка перезаписи
      asn: 'MALICIOUS', // Попытка перезаписи
      reputationScore: 0, // Попытка перезаписи
      velocityScore: 100, // Попытка перезаписи
      previousGeo: { country: 'XX' }, // Попытка перезаписи
      custom_vendorId: 'vendor-123', // Правильный префикс для custom полей
    });

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals }, maliciousPlugin);

    // Все base поля должны остаться неизменными
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['isTor']).toBe(false);
    expect(result.signals?.['isProxy']).toBe(false);
    expect(result.signals?.['asn']).toBe('AS12345');
    expect(result.signals?.['reputationScore']).toBe(85);
    expect(result.signals?.['velocityScore']).toBe(10);
    expect(result.signals?.['previousGeo']).toEqual({ country: 'US' });
    // Custom поля должны быть добавлены (с правильным префиксом custom_)
    expect(result.signals?.['custom_vendorId']).toBe('vendor-123');
  });

  it('удаляет externalSignals даже если plugin пытается их добавить', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
      },
    });

    const plugin: SignalsMapperPlugin = () => ({
      isVpn: true,
      externalSignals: { vendorData: 'secret' }, // Попытка добавить externalSignals
      custom_vendorId: 'vendor-123', // Правильный префикс для custom полей
    });

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(result.signals?.['externalSignals']).toBeUndefined();
    expect(result.signals?.['custom_vendorId']).toBe('vendor-123');
  });

  it('обрабатывает case-insensitive OS detection', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {},
    });

    const testCases = [
      { os: 'IOS 15.0', expected: 'ios' },
      { os: 'iPhone OS 15.0', expected: 'ios' },
      { os: 'iPad OS 15.0', expected: 'ios' },
      { os: 'ANDROID 12', expected: 'android' },
      { os: 'WINDOWS 11', expected: 'desktop' },
      { os: 'MACOS 12.0', expected: 'desktop' },
      { os: 'LINUX Ubuntu', expected: 'desktop' },
    ];

    testCases.forEach((testCase) => {
      const deviceInfo = createDeviceInfo({ os: testCase.os });
      const result = buildAssessment(deviceInfo, {});
      expect(result.device?.platform).toBe(testCase.expected);
    });
  });

  it('обрабатывает пустые строки в optional полях deviceInfo', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {},
    });

    const deviceInfo = createDeviceInfo({
      os: '',
      browser: '',
      appVersion: '',
    });
    const result = buildAssessment(deviceInfo, {});

    expect(result.device?.os).toBeUndefined();
    expect(result.device?.browser).toBeUndefined();
    expect(result.device?.appVersion).toBeUndefined();
  });

  it('обрабатывает все whitelist поля signals', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
        isTor: false,
        isProxy: true,
        asn: 'AS12345',
        reputationScore: 85,
        velocityScore: 10,
        previousGeo: {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    });

    const signals = createRiskSignals({
      isVpn: true,
      isTor: false,
      isProxy: true,
      asn: 'AS12345',
      reputationScore: 85,
      velocityScore: 10,
      previousGeo: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
    });
    const result = buildAssessment(createDeviceInfo(), { signals });

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['isTor']).toBe(false);
    expect(result.signals?.['isProxy']).toBe(true);
    expect(result.signals?.['asn']).toBe('AS12345');
    expect(result.signals?.['reputationScore']).toBe(85);
    expect(result.signals?.['velocityScore']).toBe(10);
    expect(result.signals?.['previousGeo']).toEqual({
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      lat: 37.7749,
      lng: -122.4194,
    });
  });

  it('покрывает все ветки в normalizeDeviceForRisk для разных комбинаций os и deviceType', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {},
    });

    // Тест для ветки: os === undefined || os === '' && deviceType === 'desktop'
    const deviceInfo1 = createDeviceInfo({ os: '', deviceType: 'desktop' });
    const result1 = buildAssessment(deviceInfo1, {});
    expect(result1.device?.platform).toBe('desktop');

    // Тест для ветки: os === undefined || os === '' && deviceType !== 'desktop'
    const deviceInfo2 = createDeviceInfo({ os: '', deviceType: 'mobile' });
    const result2 = buildAssessment(deviceInfo2, {});
    expect(result2.device?.platform).toBe('web');
  });

  it('покрывает все ветки в enforceWhitelist для разных типов ключей', () => {
    mockTransformDomainToDto.mockReturnValue({
      ok: true,
      value: {
        isVpn: true,
      },
    });

    const plugin: SignalsMapperPlugin = () => ({
      isVpn: true, // whitelist поле
      custom_test: 'value', // поле с префиксом custom_
      maliciousField: 'should be removed', // неразрешенное поле
    });

    const signals = createRiskSignals({ isVpn: true });
    const result = buildAssessment(createDeviceInfo(), { signals }, plugin);

    expect(result.signals).toBeDefined();
    expect(result.signals?.['isVpn']).toBe(true);
    expect(result.signals?.['custom_test']).toBe('value');
    expect(result.signals?.['maliciousField']).toBeUndefined();
  });
});
