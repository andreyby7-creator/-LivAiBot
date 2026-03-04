/**
 * @file packages/feature-auth/src/lib/device-fingerprint.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Device Fingerprint (Pure Effect)
 * ============================================================================
 * Архитектурная роль:
 * - Чистая функция для сбора данных об устройстве без side-effects
 * - Генерация стабильного deviceId на основе fingerprint данных
 * - Используется для оценки риска и аудита логина
 * Принципы:
 * - ✅ Чистая логика — только сбор данных об устройстве
 * - ✅ Без side-effects — не изменяет внешнее состояние
 * - ✅ Pure Effect — детерминированный результат
 * - ❌ Нет store — store layer
 * - ❌ Нет telemetry — observability layer
 * - ❌ Нет orchestration — orchestrator
 * - ❌ Нет timeout — effect-timeout layer
 * - ❌ Нет isolation — effect-isolation layer
 *
 * @example
 * // Использование в login orchestrator:
 * // const runtime = Runtime.makeDefault();
 * // const deviceInfo = await runtime.runPromise(DeviceFingerprint());
 * // // { deviceId: '...', deviceType: 'desktop', os: 'Windows 11', ... }
 */

import { Effect } from 'effect';

import type { DeviceInfo, DeviceType } from '../domain/DeviceInfo.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Внутренний тип для fingerprint данных */
type FingerprintData = {
  readonly userAgent: string;
  readonly platform: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly timezone: string;
  readonly language: string;
  readonly colorDepth: number;
  readonly pixelRatio: number;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Максимальная ширина экрана для определения mobile устройства */
const MOBILE_MAX_WIDTH = 768;

/** Максимальная высота экрана для определения mobile устройства */
const MOBILE_MAX_HEIGHT = 1024;

/** Минимальная ширина экрана для определения tablet устройства */
const TABLET_MIN_WIDTH = 600;

/** Минимальная высота экрана для определения tablet устройства */
const TABLET_MIN_HEIGHT = 800;

/** Битовая позиция для хеш-алгоритма */
const HASH_BIT_SHIFT = 5;

/** Основание системы счисления для преобразования числа в строку */
const BASE_36 = 36;

/* ============================================================================
 * 🔧 HELPER FUNCTIONS
 * ============================================================================
 */

/** Проверяет, является ли устройство mobile на основе userAgent */
function isMobileUserAgent(userAgent: string): boolean {
  return /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
}

/** Проверяет, является ли устройство tablet на основе размеров экрана */
function isTabletScreen(screenWidth: number, screenHeight: number): boolean {
  return screenWidth >= TABLET_MIN_WIDTH && screenHeight >= TABLET_MIN_HEIGHT;
}

/** Проверяет, является ли устройство mobile на основе размеров экрана */
function isMobileScreen(screenWidth: number, screenHeight: number): boolean {
  return screenWidth <= MOBILE_MAX_WIDTH && screenHeight <= MOBILE_MAX_HEIGHT;
}

/**
 * Проверяет, является ли устройство IoT на основе userAgent
 * @note Эвристика: может классифицировать backend-requests (curl, wget, python, java, node)
 * как IoT устройства. Для auth-risk это приемлемо, так как такие запросы требуют
 * дополнительной проверки безопасности.
 */
function isIoTUserAgent(userAgent: string): boolean {
  const hasIoTPattern = /curl|wget|python|java|node/i.test(userAgent);
  const hasBrowserPattern = /mozilla|chrome|safari|edge/i.test(userAgent);
  return hasIoTPattern && !hasBrowserPattern;
}

/** Проверяет, является ли устройство desktop на основе userAgent */
function isDesktopUserAgent(userAgent: string): boolean {
  return /windows|macintosh|linux|x11/i.test(userAgent);
}

/**
 * Определяет тип устройства на основе userAgent и screen размеров
 * @note Tablet detection: проверяется раньше mobile, так как некоторые планшеты
 * могут иметь desktop UA, но tablet screen размеры. Приоритет: tablet screen > mobile UA.
 */
function detectDeviceType(
  userAgent: string,
  screenWidth: number,
  screenHeight: number,
): DeviceType {
  const ua = userAgent.toLowerCase();

  // Tablet detection (приоритет: screen размеры важнее UA)
  // Некоторые планшеты имеют desktop UA, но tablet screen размеры
  if (isTabletScreen(screenWidth, screenHeight)) {
    return 'tablet';
  }

  // Mobile detection
  if (isMobileUserAgent(ua) || isMobileScreen(screenWidth, screenHeight)) {
    return 'mobile';
  }

  // IoT detection (minimal user agent or specific patterns)
  if (isIoTUserAgent(ua)) {
    return 'iot';
  }

  // Desktop (default for web browsers)
  if (isDesktopUserAgent(ua)) {
    return 'desktop';
  }

  return 'unknown';
}

/** Парсит версию Android из userAgent */
function parseAndroidVersion(userAgent: string): string | undefined {
  const match = userAgent.match(/android\s([0-9.]+)/i);
  const version = match?.[1];
  return version !== undefined && version.length > 0 ? `Android ${version}` : 'Android';
}

/** Парсит версию iOS из userAgent */
function parseIOSVersion(userAgent: string): string | undefined {
  const match = userAgent.match(/os\s([0-9_]+)/i);
  const version = match?.[1];
  return version !== undefined && version.length > 0 ? `iOS ${version.replace(/_/g, '.')}` : 'iOS';
}

/** Парсит OS из userAgent */
function parseOS(userAgent: string): string | undefined {
  const ua = userAgent.toLowerCase();

  if (/windows nt 10.0/i.test(ua)) return 'Windows 10/11';
  if (/windows nt 6.3/i.test(ua)) return 'Windows 8.1';
  if (/windows nt 6.2/i.test(ua)) return 'Windows 8';
  if (/windows nt 6.1/i.test(ua)) return 'Windows 7';
  if (/windows nt 6.0/i.test(ua)) return 'Windows Vista';
  if (/windows/i.test(ua)) return 'Windows';
  // Android и iOS должны проверяться раньше Linux и macOS,
  // так как их userAgent содержат эти строки
  if (/android/i.test(ua)) {
    return parseAndroidVersion(ua);
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    return parseIOSVersion(ua);
  }
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';

  return undefined;
}

/** Парсит версию браузера из userAgent */
function parseBrowserVersion(userAgent: string, pattern: RegExp, name: string): string {
  const match = userAgent.match(pattern);
  const version = match?.[1];
  return version !== undefined && version.length > 0 ? `${name} ${version}` : name;
}

/** Парсит браузер из userAgent */
function parseBrowser(userAgent: string): string | undefined {
  const ua = userAgent.toLowerCase();

  if (/edg/i.test(ua)) {
    return parseBrowserVersion(ua, /edg\/([0-9.]+)/i, 'Edge');
  }
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) {
    return parseBrowserVersion(ua, /chrome\/([0-9.]+)/i, 'Chrome');
  }
  if (/firefox/i.test(ua)) {
    return parseBrowserVersion(ua, /firefox\/([0-9.]+)/i, 'Firefox');
  }
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    return parseBrowserVersion(ua, /version\/([0-9.]+)/i, 'Safari');
  }
  if (/opera|opr/i.test(ua)) {
    return parseBrowserVersion(ua, /(?:opera|opr)\/([0-9.]+)/i, 'Opera');
  }

  return undefined;
}

/**
 * Генерирует стабильный deviceId на основе fingerprint данных
 * Использует простой хеш для создания уникального идентификатора
 * @note Hash collision: используется 32-bit hash, что может давать коллизии.
 * Для high-security сценариев это недостаточно, но для login risk scoring
 * это приемлемо, так как deviceId используется для оценки риска, а не для
 * криптографической идентификации.
 */
function generateDeviceId(data: FingerprintData): string {
  // Создаем строку из стабильных характеристик устройства
  const fingerprint = [
    data.userAgent,
    data.platform,
    data.screenWidth,
    data.screenHeight,
    data.timezone,
    data.language,
    data.colorDepth,
    data.pixelRatio,
  ].join('|');

  // Простой хеш-алгоритм для генерации стабильного ID (32-bit)
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << HASH_BIT_SHIFT) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }

  // Преобразуем в положительное число и добавляем префикс
  const deviceId = `device-${Math.abs(hash).toString(BASE_36)}`;

  return deviceId;
}

/** Собирает fingerprint данные из браузерного окружения */
function collectFingerprintData(): FingerprintData {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const screen = typeof window !== 'undefined' ? window.screen : null;

  const timezoneOptions = Intl.DateTimeFormat().resolvedOptions();
  const rawPixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  // Округляем pixelRatio до 2 знаков после запятой для стабильности
  // (может быть 1.25, 1.5, 2.625 и т.д.)
  const pixelRatio = Math.round(rawPixelRatio * 100) / 100;

  return {
    userAgent: nav?.userAgent ?? '',
    platform: nav?.platform ?? '',
    screenWidth: screen?.width ?? 0,
    screenHeight: screen?.height ?? 0,
    timezone: timezoneOptions.timeZone,
    language: nav?.language ?? '',
    colorDepth: screen?.colorDepth ?? 0,
    pixelRatio,
  };
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Собирает информацию об устройстве и генерирует deviceId
 * @returns Effect с DeviceInfo объектом
 * @note Fingerprint должен быть стабильным и детерминированным.
 * lastUsedAt устанавливается в login orchestrator (effects/login.ts), не здесь.
 *
 * @example
 * const runtime = Runtime.makeDefault();
 * const deviceInfo = await runtime.runPromise(DeviceFingerprint());
 */
export function DeviceFingerprint(): Effect.Effect<DeviceInfo> {
  return Effect.sync(() => {
    const fingerprint = collectFingerprintData();
    const deviceId = generateDeviceId(fingerprint);
    const deviceType = detectDeviceType(
      fingerprint.userAgent,
      fingerprint.screenWidth,
      fingerprint.screenHeight,
    );
    const os = parseOS(fingerprint.userAgent);
    const browser = parseBrowser(fingerprint.userAgent);

    const deviceInfo: DeviceInfo = {
      deviceId,
      deviceType,
      ...(os !== undefined && { os }),
      ...(browser !== undefined && { browser }),
      ...(fingerprint.userAgent.length > 0 && { userAgent: fingerprint.userAgent }),
      // lastUsedAt устанавливается в orchestration слое для детерминированности
    };

    return deviceInfo;
  });
}
