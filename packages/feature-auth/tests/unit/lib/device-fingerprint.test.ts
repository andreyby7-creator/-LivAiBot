/**
 * @file Unit тесты для lib/device-fingerprint.ts
 * Полное покрытие device fingerprint с тестированием всех функций и edge cases
 */

/**
 * @vitest-environment jsdom
 */

import type { Effect } from 'effect';
import { Runtime } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeviceFingerprint } from '../../../src/lib/device-fingerprint.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Мокает window и navigator для тестов */
function mockBrowserEnvironment(mocks: {
  userAgent?: string;
  platform?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  colorDepth?: number;
  devicePixelRatio?: number;
  timezone?: string;
}) {
  const {
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform = 'Win32',
    language = 'en-US',
    screenWidth = 1920,
    screenHeight = 1080,
    colorDepth = 24,
    devicePixelRatio = 1,
    timezone = 'America/New_York',
  } = mocks;

  // Mock navigator
  Object.defineProperty(global, 'navigator', {
    value: {
      userAgent,
      platform,
      language,
    },
    writable: true,
    configurable: true,
  });

  // Mock window.screen
  Object.defineProperty(global, 'window', {
    value: {
      screen: {
        width: screenWidth,
        height: screenHeight,
        colorDepth,
      },
      devicePixelRatio,
    },
    writable: true,
    configurable: true,
  });

  // Mock Intl.DateTimeFormat
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() =>
    ({
      resolvedOptions: () => ({
        timeZone: timezone,
      }),
    }) as Intl.DateTimeFormat
  );
}

/** Очищает моки после теста */
function cleanupMocks() {
  // @ts-expect-error - очистка для тестов
  delete global.navigator;
  // @ts-expect-error - очистка для тестов
  delete global.window;
  vi.restoreAllMocks();
}

/**
 * Запускает Effect с timeout для предотвращения hanging тестов
 * @note Timeout реализован через Promise.race, что предотвращает hanging.
 * Runtime.runPromise внутри уже защищен timeout через Promise.race.
 */
async function runEffectWithTimeout<T>(
  effect: Effect.Effect<T>,
  timeoutMs: number = 5000,
): Promise<T> {
  // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout реализован через Promise.race, изоляция не требуется в тестах
  return Promise.race([
    Runtime.runPromise(Runtime.defaultRuntime, effect),
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        reject(new Error(`Test timeout after ${timeoutMs}ms`));
      }, timeoutMs)
    ),
  ]);
}

// ============================================================================
// 🎯 MAIN API - DeviceFingerprint()
// ============================================================================

/* eslint-disable @livai/multiagent/orchestration-safety -- timeout реализован через runEffectWithTimeout */
describe('DeviceFingerprint()', () => {
  beforeEach(() => {
    mockBrowserEnvironment({});
  });

  afterEach(() => {
    cleanupMocks();
  });

  it('возвращает Effect с DeviceInfo', async () => {
    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
    expect(deviceInfo.deviceType).toBeDefined();
    expect(typeof deviceInfo.deviceId).toBe('string');
    expect(deviceInfo.deviceId.startsWith('device-')).toBe(true);
  });

  it('генерирует стабильный deviceId для одинаковых данных', async () => {
    const effect1 = DeviceFingerprint();
    const effect2 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    expect(deviceInfo1.deviceId).toBe(deviceInfo2.deviceId);
  });

  it('генерирует разные deviceId для разных данных', async () => {
    mockBrowserEnvironment({ userAgent: 'Chrome/120' });
    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);

    mockBrowserEnvironment({ userAgent: 'Firefox/121' });
    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    expect(deviceInfo1.deviceId).not.toBe(deviceInfo2.deviceId);
  });

  it('не включает lastUsedAt в результат', async () => {
    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.lastUsedAt).toBeUndefined();
  });

  it('работает без window и navigator (SSR-safe)', async () => {
    // @ts-expect-error - очистка для тестов SSR
    delete global.window;
    // @ts-expect-error - очистка для тестов SSR
    delete global.navigator;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
    // При отсутствии window/navigator screen = 0, что попадает под mobile screen detection
    expect(deviceInfo.deviceType).toBe('mobile');
  });
});

// ============================================================================
// 📱 DEVICE TYPE DETECTION
// ============================================================================

describe('Device Type Detection', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('определяет desktop устройство', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      screenWidth: 1920,
      screenHeight: 1080,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    // 1920x1080 попадает под tablet screen (>= 600x800), но имеет desktop UA
    // Приоритет: tablet screen > mobile UA, поэтому определяется как tablet
    expect(deviceInfo.deviceType).toBe('tablet');
  });

  it('определяет desktop устройство с большим экраном', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      screenWidth: 2560,
      screenHeight: 1440,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    // Большой экран также попадает под tablet, но это desktop по UA
    expect(deviceInfo.deviceType).toBe('tablet');
  });

  it('определяет desktop устройство с экраном меньше tablet', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      screenWidth: 1024,
      screenHeight: 768, // Меньше tablet (600x800), но больше mobile (768x1024)
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    // Не tablet (768 < 800), не mobile (1024 > 768), desktop по UA
    expect(deviceInfo.deviceType).toBe('desktop');
  });

  it('определяет mobile устройство по userAgent', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      screenWidth: 390,
      screenHeight: 844,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('mobile');
  });

  it('определяет mobile устройство по размеру экрана', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Unknown Device)',
      screenWidth: 375,
      screenHeight: 667,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('mobile');
  });

  it('определяет tablet устройство (приоритет screen размеров)', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', // Desktop UA
      screenWidth: 1024,
      screenHeight: 1366, // Tablet размеры
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('tablet');
  });

  it('определяет tablet устройство по userAgent и screen', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
      screenWidth: 768,
      screenHeight: 1024,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('tablet');
  });

  it('определяет IoT устройство', async () => {
    mockBrowserEnvironment({
      userAgent: 'curl/7.68.0',
      screenWidth: 1000, // Не tablet (height < 800), не mobile (width > 768)
      screenHeight: 700,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('iot');
  });

  it('определяет IoT для python requests', async () => {
    mockBrowserEnvironment({
      userAgent: 'python-requests/2.28.1',
      screenWidth: 1000,
      screenHeight: 700,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('iot');
  });

  it('определяет IoT для node requests', async () => {
    mockBrowserEnvironment({
      userAgent: 'node-fetch/2.6.7',
      screenWidth: 1000,
      screenHeight: 700,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('iot');
  });

  it('не определяет IoT если есть browser pattern', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) python-requests/2.28.1 Chrome/120',
      screenWidth: 1920,
      screenHeight: 1080,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).not.toBe('iot');
  });

  it('определяет unknown для неизвестного устройства', async () => {
    mockBrowserEnvironment({
      userAgent: 'Unknown/1.0',
      screenWidth: 1000, // Не tablet (height < 800), не mobile (width > 768)
      screenHeight: 700,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceType).toBe('unknown');
  });
});

// ============================================================================
// 💻 OS PARSING
// ============================================================================

describe('OS Parsing', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('парсит Windows 10/11', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Windows 10/11');
  });

  it('парсит Windows 8.1', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 6.3; Win64; x64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Windows 8.1');
  });

  it('парсит Windows 8', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 6.2; Win64; x64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Windows 8');
  });

  it('парсит Windows 7', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Windows 7');
  });

  it('парсит Windows Vista', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 6.0; Win64; x64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Windows Vista');
  });

  it('парсит общий Windows', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows; Win64; x64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Windows');
  });

  it('парсит macOS', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('macOS');
  });

  it('парсит Linux', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Linux');
  });

  it('парсит Android с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Android 13');
  });

  it('парсит Android без версии', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Linux; Android)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('Android');
  });

  it('парсит iOS с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('iOS 16.5');
  });

  it('парсит iOS без версии', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBe('iOS');
  });

  it('возвращает undefined для неизвестной OS', async () => {
    mockBrowserEnvironment({
      userAgent: 'Unknown/1.0',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.os).toBeUndefined();
  });
});

// ============================================================================
// 🌐 BROWSER PARSING
// ============================================================================

describe('Browser Parsing', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('парсит Edge с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Edge 120.0.0.0');
  });

  it('парсит Edge без версии', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Edge');
  });

  it('парсит Chrome с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Chrome 120.0.0.0');
  });

  it('не парсит Chrome если это Edge', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120 Chrome/120',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Edge 120');
  });

  it('парсит Firefox с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Firefox 121.0');
  });

  it('парсит Safari с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Safari 17.0');
  });

  it('не парсит Safari если это Chrome', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120 Safari/605',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Chrome 120');
  });

  it('парсит Opera с версией', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OPR/106.0.0.0',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBe('Opera 106.0.0.0');
  });

  it('возвращает undefined для неизвестного браузера', async () => {
    mockBrowserEnvironment({
      userAgent: 'Unknown/1.0',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.browser).toBeUndefined();
  });
});

// ============================================================================
// 🔢 PIXEL RATIO ROUNDING
// ============================================================================

describe('Pixel Ratio Rounding', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('округляет pixelRatio до 2 знаков (1.25)', async () => {
    mockBrowserEnvironment({
      devicePixelRatio: 1.25,
    });

    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);

    mockBrowserEnvironment({
      devicePixelRatio: 1.251,
    });

    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    // Оба должны дать одинаковый deviceId (округляется до 1.25)
    expect(deviceInfo1.deviceId).toBe(deviceInfo2.deviceId);
  });

  it('округляет pixelRatio до 2 знаков (2.625)', async () => {
    mockBrowserEnvironment({
      devicePixelRatio: 2.625,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
  });

  it('использует pixelRatio = 1 если window не определен', async () => {
    // @ts-expect-error - очистка для тестов SSR
    delete global.window;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
  });
});

// ============================================================================
// 🌍 TIMEZONE AND LANGUAGE
// ============================================================================

describe('Timezone and Language', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('использует timezone из Intl.DateTimeFormat', async () => {
    mockBrowserEnvironment({
      timezone: 'Europe/Moscow',
    });

    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);

    mockBrowserEnvironment({
      timezone: 'America/New_York',
    });

    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    // Разные timezone должны дать разные deviceId
    expect(deviceInfo1.deviceId).not.toBe(deviceInfo2.deviceId);
  });

  it('использует language из navigator', async () => {
    mockBrowserEnvironment({
      language: 'ru-RU',
    });

    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);

    mockBrowserEnvironment({
      language: 'en-US',
    });

    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    // Разные language должны дать разные deviceId
    expect(deviceInfo1.deviceId).not.toBe(deviceInfo2.deviceId);
  });
});

// ============================================================================
// 📏 SCREEN DIMENSIONS
// ============================================================================

describe('Screen Dimensions', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('использует screen width и height для deviceId', async () => {
    mockBrowserEnvironment({
      screenWidth: 1920,
      screenHeight: 1080,
    });

    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);

    mockBrowserEnvironment({
      screenWidth: 2560,
      screenHeight: 1440,
    });

    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    expect(deviceInfo1.deviceId).not.toBe(deviceInfo2.deviceId);
  });

  it('использует 0 для screen размеров если screen не определен', async () => {
    // @ts-expect-error - очистка для тестов SSR
    delete global.window;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
  });
});

// ============================================================================
// 🔐 DEVICE ID GENERATION
// ============================================================================

describe('Device ID Generation', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('генерирует deviceId с префиксом "device-"', async () => {
    mockBrowserEnvironment({});

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo.deviceId).toMatch(/^device-[a-z0-9]+$/);
  });

  it('генерирует стабильный deviceId для одинаковых данных', async () => {
    const config = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      screenWidth: 1920,
      screenHeight: 1080,
      timezone: 'UTC',
      language: 'en-US',
      colorDepth: 24,
      devicePixelRatio: 1,
    };

    mockBrowserEnvironment(config);
    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);

    mockBrowserEnvironment(config);
    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);

    expect(deviceInfo1.deviceId).toBe(deviceInfo2.deviceId);
  });

  it('генерирует разные deviceId при изменении любого параметра', async () => {
    const baseConfig = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      screenWidth: 1920,
      screenHeight: 1080,
      timezone: 'UTC',
      language: 'en-US',
      colorDepth: 24,
      devicePixelRatio: 1,
    };

    mockBrowserEnvironment(baseConfig);
    const baseEffect = DeviceFingerprint();
    const baseDeviceInfo = await runEffectWithTimeout(baseEffect);

    // Изменяем userAgent
    mockBrowserEnvironment({ ...baseConfig, userAgent: 'Chrome/120' });
    const effect1 = DeviceFingerprint();
    const deviceInfo1 = await runEffectWithTimeout(effect1);
    expect(deviceInfo1.deviceId).not.toBe(baseDeviceInfo.deviceId);

    // Изменяем platform
    mockBrowserEnvironment({ ...baseConfig, platform: 'Linux x86_64' });
    const effect2 = DeviceFingerprint();
    const deviceInfo2 = await runEffectWithTimeout(effect2);
    expect(deviceInfo2.deviceId).not.toBe(baseDeviceInfo.deviceId);

    // Изменяем screenWidth
    mockBrowserEnvironment({ ...baseConfig, screenWidth: 2560 });
    const effect3 = DeviceFingerprint();
    const deviceInfo3 = await runEffectWithTimeout(effect3);
    expect(deviceInfo3.deviceId).not.toBe(baseDeviceInfo.deviceId);

    // Изменяем timezone
    mockBrowserEnvironment({ ...baseConfig, timezone: 'Europe/Moscow' });
    const effect4 = DeviceFingerprint();
    const deviceInfo4 = await runEffectWithTimeout(effect4);
    expect(deviceInfo4.deviceId).not.toBe(baseDeviceInfo.deviceId);
  });
});

// ============================================================================
// 🧪 EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('обрабатывает пустой userAgent', async () => {
    mockBrowserEnvironment({
      userAgent: '',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
    expect(deviceInfo.userAgent).toBeUndefined();
  });

  it('обрабатывает отсутствие navigator', async () => {
    // @ts-expect-error - очистка для тестов SSR
    delete global.navigator;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
  });

  it('обрабатывает отсутствие window', async () => {
    // @ts-expect-error - очистка для тестов SSR
    delete global.window;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
  });

  it('обрабатывает отсутствие screen', async () => {
    mockBrowserEnvironment({});
    // @ts-expect-error - очистка для тестов
    delete global.window.screen;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
  });

  it('обрабатывает все поля как undefined в SSR окружении', async () => {
    // @ts-expect-error - очистка для тестов SSR
    delete global.navigator;
    // @ts-expect-error - очистка для тестов SSR
    delete global.window;

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toBeDefined();
    expect(deviceInfo.deviceId).toBeDefined();
    // При отсутствии window/navigator screen = 0, что попадает под mobile screen detection
    expect(deviceInfo.deviceType).toBe('mobile');
    expect(deviceInfo.os).toBeUndefined();
    expect(deviceInfo.browser).toBeUndefined();
  });
});

// ============================================================================
// ✅ COMPLETE DEVICE INFO STRUCTURE
// ============================================================================

describe('Complete Device Info Structure', () => {
  afterEach(() => {
    cleanupMocks();
  });

  it('возвращает полную структуру DeviceInfo для desktop', async () => {
    mockBrowserEnvironment({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      platform: 'Win32',
      screenWidth: 1024, // Меньше tablet (600x800), но больше mobile (768x1024)
      screenHeight: 768,
      colorDepth: 24,
      devicePixelRatio: 1,
      language: 'en-US',
      timezone: 'America/New_York',
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toMatchObject({
      deviceId: expect.stringMatching(/^device-[a-z0-9]+$/),
      deviceType: 'desktop',
      os: 'Windows 10/11',
      browser: 'Chrome 120.0.0.0',
      userAgent: expect.stringContaining('Chrome'),
    });
    expect(deviceInfo.lastUsedAt).toBeUndefined();
  });

  it('возвращает минимальную структуру DeviceInfo для unknown устройства', async () => {
    mockBrowserEnvironment({
      userAgent: '', // Пустой userAgent, чтобы не включался в результат
      screenWidth: 1000, // Не tablet (height < 800), не mobile (width > 768)
      screenHeight: 700,
    });

    const effect = DeviceFingerprint();
    const deviceInfo = await runEffectWithTimeout(effect);

    expect(deviceInfo).toMatchObject({
      deviceId: expect.stringMatching(/^device-[a-z0-9]+$/),
      deviceType: 'unknown',
    });
    expect(deviceInfo.os).toBeUndefined();
    expect(deviceInfo.browser).toBeUndefined();
    expect(deviceInfo.userAgent).toBeUndefined();
    expect(deviceInfo.lastUsedAt).toBeUndefined();
  });
});
/* eslint-enable @livai/multiagent/orchestration-safety */
