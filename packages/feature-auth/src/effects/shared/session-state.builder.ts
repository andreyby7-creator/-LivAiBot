/**
 * @file packages/feature-auth/src/effects/shared/session-state.builder.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Session State Builder (Shared)
 * ============================================================================
 *
 * Единая точка построения SessionState из deviceInfo, tokenPair и me.session.
 * Используется во всех auth-эффектах (login/register/refresh) для консистентности.
 *
 * Архитектурные решения:
 * - Pure function: без side-effects, детерминированная
 * - Fail-closed: проверка issuedAt <= expiresAt, падает при нарушении
 * - Copy-on-write: создает новый объект, не мутирует входные данные
 * - Shallow freeze: защита от случайных мутаций корневого объекта
 * - Fallback логика: использует tokenPair как fallback для issuedAt/expiresAt
 * - Fail-fast: выбрасывает ошибку если обязательные поля отсутствуют (предотвращает silent masking)
 *
 * Инварианты:
 * - Не читает store (pure function)
 * - Проверяет согласованность дат (issuedAt <= expiresAt) через Date.parse() для безопасного сравнения
 * - Fail-fast: выбрасывает ошибку если issuedAt или expiresAt отсутствуют (предотвращает silent masking backend bugs)
 * - Валидация ISO формата дат (Date.parse возвращает NaN для невалидных дат)
 * - Возвращает null если me.session отсутствует (семантика: intentional absence - сессия не строится)
 * - Все поля readonly для иммутабельности
 */

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { MeSessionInfo } from '../../domain/MeResponse.js';
import type { TokenPair } from '../../domain/TokenPair.js';
import type { SessionState } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

export type BuildSessionStateParams = Readonly<{
  deviceInfo: DeviceInfo; // Информация об устройстве из security-pipeline
  tokenPair: TokenPair; // Пара токенов (access + refresh)
  meSession?: MeSessionInfo | undefined; // Информация о сессии из /me (опционально, для создания SessionState нужен sessionId)
}>;

/* ============================================================================
 * 🔧 BUILDER
 * ============================================================================
 */

/**
 * Строит SessionState из deviceInfo, tokenPair и me.session.
 *
 * Fallback для дат (приоритет: me.session > tokenPair):
 * - `issuedAt`: me.session.issuedAt ?? tokenPair.issuedAt (обязательное поле, выбрасывает ошибку если отсутствует)
 * - `expiresAt`: me.session.expiresAt ?? tokenPair.expiresAt (обязательное поле, выбрасывает ошибку если отсутствует)
 *
 * Контракт: даты в формате ISO-8601 (Date.parse() безопасно обрабатывает различные варианты формата).
 *
 * Семантика возвращаемого значения:
 * - `null`: intentional absence - me.session отсутствует, сессия не строится
 * - `SessionState`: успешно построенная сессия с валидацией всех полей
 *
 * @throws Error если issuedAt > expiresAt
 * @throws Error если issuedAt или expiresAt отсутствуют (после всех fallback'ов)
 * @throws Error если даты не в формате ISO-8601 (Date.parse() возвращает NaN)
 *
 * @example
 * buildSessionState({
 *   deviceInfo: { deviceId: 'device-123', deviceType: 'desktop' },
 *   tokenPair: { accessToken: '...', expiresAt: '2026-12-31T23:59:59Z' },
 *   meSession: { sessionId: 'sess-abc' }
 * });
 */
export function buildSessionState(
  params: BuildSessionStateParams, // Параметры для построения SessionState
): SessionState | null { // SessionState или null (если me.session отсутствует)
  const { deviceInfo, tokenPair, meSession } = params;

  if (meSession === undefined) {
    return null; // Intentional absence: сессия не строится
  }

  const expiresAt = meSession.expiresAt ?? tokenPair.expiresAt; // Fallback: me.session > tokenPair
  const issuedAt = meSession.issuedAt ?? tokenPair.issuedAt; // Fallback: me.session > tokenPair

  // Fail-fast: проверка обязательных полей (предотвращает silent masking backend bugs)
  if (issuedAt === undefined || issuedAt === '') {
    throw new Error(
      `[session-state.builder] Missing issuedAt: required field absent in me.session and tokenPair`,
    );
  }
  // Проверка на undefined нужна для runtime safety (даже если TypeScript считает expiresAt всегда string)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety: tokenPair может прийти с undefined из внешних данных
  if (expiresAt === undefined || expiresAt === '') {
    throw new Error(
      `[session-state.builder] Missing expiresAt: required field absent in me.session and tokenPair`,
    );
  }

  // Валидация ISO формата дат и проверка инварианта (Date.parse возвращает NaN для невалидных дат)
  const issuedAtTimestamp = Date.parse(issuedAt);
  const expiresAtTimestamp = Date.parse(expiresAt);
  if (Number.isNaN(issuedAtTimestamp) || Number.isNaN(expiresAtTimestamp)) {
    throw new Error(
      `[session-state.builder] Invalid date format: must be ISO-8601, issuedAt="${issuedAt}", expiresAt="${expiresAt}"`,
    );
  }
  if (issuedAtTimestamp > expiresAtTimestamp) { // Fail-closed: проверка согласованности (безопасное сравнение через Date.parse)
    throw new Error(
      `[session-state.builder] Invariant violated: issuedAt (${issuedAt}) > expiresAt (${expiresAt})`,
    );
  }

  // Copy-on-write: shallow copy deviceInfo (immutability - ответственность domain layer)
  const deviceInfoCopy = { ...deviceInfo };

  const sessionState: SessionState = Object.freeze({
    status: 'active' as const,
    sessionId: meSession.sessionId,
    device: deviceInfoCopy,
    issuedAt,
    expiresAt,
  });

  return sessionState;
}
