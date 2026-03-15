/**
 * @file packages/feature-auth/src/effects/register/register-store-updater.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Register Store Updater
 * ============================================================================
 *
 * Единственная точка применения результата register-flow к auth/session/security состояниям.
 * Атомарное обновление через batchUpdate, использует `buildSessionState` для консистентности.
 *
 * Инварианты:
 * - ❌ Не пересчитывает security/risk (использует `initialSecurityState`)
 * - ❌ Не читает store, не принимает решений (pure sink над портом)
 * - ❌ Не вводит fallback-значения
 * - ✅ Обновляет только через `AuthStorePort`
 * - ✅ Fail-closed: гарантирует наличие `tokenPair` для success
 */

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { MeResponse, MeSessionInfo, MeUserInfo } from '../../dto/MeResponse.js';
import type { RegisterIdentifierType, RegisterRequest } from '../../dto/RegisterRequest.js';
import type { RegisterResponse } from '../../dto/RegisterResponse.js';
import type { TokenPair } from '../../dto/TokenPair.js';
import type { AuthState } from '../../types/auth.js';
import { initialSecurityState } from '../../types/auth-initial.js';
import type { AuthStorePort } from '../shared/auth-store.port.js';
import { buildSessionState } from '../shared/session-state.builder.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Параметры для обновления store при успешной регистрации.
 * Содержит все необходимые данные для построения auth/session/security состояний.
 */
export type RegisterSuccessParams = Readonly<{
  /** Результат регистрации с tokenPair (обязательно для success) */
  registerResponse: RegisterResponse & { readonly tokenPair: TokenPair; };
  /** Информация об устройстве для построения SessionState */
  deviceInfo: DeviceInfo;
  /** Ответ /me endpoint (опционально, если register effect делает запрос к /me) */
  meResponse?: MeResponse | undefined;
}>;

/**
 * Параметры для обновления store при MFA-требовании.
 * Пользователь переводится в состояние pending_secondary_verification.
 */
export type RegisterMfaParams = Readonly<{
  /** Результат регистрации с mfaChallenge */
  registerResponse: RegisterResponse & { readonly mfaRequired: true; };
}>;

/**
 * Возможные состояния результата register-flow с точки зрения store-updater.
 * @remarks
 * Используется для registry-паттерна обработчиков состояний.
 */
type RegisterStateKind = 'success' | 'mfa';

type RegisterStateHandlerParams = Readonly<{
  store: AuthStorePort;
  registerResponse: RegisterResponse;
  deviceInfo: DeviceInfo;
  meResponse?: MeResponse | undefined;
}>;

/* ============================================================================
 * 🔧 INTERNAL HELPERS
 * ============================================================================
 */

/**
 * Строит DeviceInfo из RegisterRequest для store updater.
 * @note deviceType: 'unknown' — fallback значение, так как register не использует security-pipeline.
 *       Это явно документировано, чтобы избежать domain-leak в store.
 *       В будущем, при добавлении security-pipeline, deviceType будет определяться через pipeline.
 */
function buildDeviceInfo(
  request: RegisterRequest<RegisterIdentifierType>,
): DeviceInfo {
  return {
    deviceId: request.clientContext?.deviceId ?? '',
    // @note Fallback значение: register не использует security-pipeline, поэтому deviceType неизвестен.
    //       Это не domain-leak, а явный fallback для отсутствующей информации об устройстве.
    //       При добавлении security-pipeline deviceType будет определяться через pipelineResult.deviceInfo.
    deviceType: 'unknown',
    ...(request.clientContext?.geo !== undefined
      ? { geo: request.clientContext.geo }
      : {}),
  };
}

/**
 * Минимальная проверка MeResponse.user для защиты от мусорных данных.
 * Инварианты:
 * - `user.id` должен быть непустой строкой
 * @param user - пользователь из MeResponse или минимальный fallback-пользователь
 * @param source - источник данных (для диагностики в сообщении об ошибке)
 */
function assertValidUser(
  user: Pick<MeUserInfo, 'id'>,
  source: 'me' | 'register_fallback' | 'register_mfa',
): void {
  const id = user.id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(
      `[register-store-updater] Invalid user.id from ${source}: "${String(id)}"`,
    );
  }
}

/**
 * Минимальная проверка MeResponse.session для защиты от мусорных данных.
 * Инварианты:
 * - `session.sessionId` должен быть непустой строкой
 * @param session - сессия из MeResponse
 */
function assertValidSession(session: Pick<MeSessionInfo, 'sessionId'>): void {
  const { sessionId } = session;
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new Error(
      `[register-store-updater] Invalid session.sessionId: "${String(sessionId)}"`,
    );
  }
}

/**
 * Минимальная проверка MeResponse.roles для защиты от мусорных данных.
 * Инварианты:
 * - `roles` должен быть массивом (не null, не undefined, не объектом)
 * @param roles - роли из MeResponse
 */
function assertValidRoles(roles: readonly string[]): void {
  if (!Array.isArray(roles)) {
    throw new Error(
      `[register-store-updater] Invalid roles: expected array, got ${typeof roles}`,
    );
  }
}

/**
 * Минимальная проверка MeResponse.permissions для защиты от мусорных данных.
 * Инварианты:
 * - `permissions` должен быть массивом (не null, не undefined, не объектом)
 * @param permissions - permissions из MeResponse
 */
function assertValidPermissions(permissions: readonly string[]): void {
  if (!Array.isArray(permissions)) {
    throw new Error(
      `[register-store-updater] Invalid permissions: expected array, got ${typeof permissions}`,
    );
  }
}

/**
 * Строит AuthState для успешной регистрации.
 * Использует MeResponse как источник истины, иначе минимальный AuthState из RegisterResponse.
 * Валидирует user/session/roles/permissions через assert-функции.
 * Optional fields (`features`, `context`) прокидываются как есть (readonly, immutable).
 */
function mapRegisterResponseToAuthState(
  registerResponse: RegisterResponse & { readonly tokenPair: TokenPair; },
  meResponse?: MeResponse,
): AuthState {
  if (meResponse !== undefined) {
    // Валидация пользователя, сессии, ролей и permissions из /me
    assertValidUser(meResponse.user, 'me');
    if (meResponse.session !== undefined) {
      assertValidSession(meResponse.session);
    }
    assertValidRoles(meResponse.roles);
    assertValidPermissions(meResponse.permissions);

    return {
      status: 'authenticated' as const,
      user: meResponse.user,
      // Session опционален в MeResponse, добавляем только если присутствует
      ...(meResponse.session !== undefined ? { session: meResponse.session } : {}),
      roles: meResponse.roles,
      // Object.freeze защищает от случайных мутаций Set (соответствует типу ReadonlySet)
      permissions: Object.freeze(new Set(meResponse.permissions)) as ReadonlySet<string>,
      // Optional immutable fields (readonly из MeResponse, прокидываются как есть)
      ...(meResponse.features !== undefined ? { features: meResponse.features } : {}),
      ...(meResponse.context !== undefined ? { context: meResponse.context } : {}),
    };
  }

  // Fallback: минимальный AuthState только по userId из RegisterResponse (если /me не вызывался)
  const fallbackUser = { id: registerResponse.userId };
  assertValidUser(fallbackUser, 'register_fallback');

  return {
    status: 'authenticated' as const,
    user: fallbackUser,
    roles: [], // Пустой массив, т.к. /me не вызывался
    permissions: Object.freeze(new Set<string>()) as ReadonlySet<string>, // Пустой Set, т.к. /me не вызывался
  };
}

/**
 * Применяет success-результат регистрации к auth/session/security состоянию.
 * Использует `buildSessionState` для SessionState, `initialSecurityState` для SecurityState.
 * Fail-closed: проверяет `tokenPair` и согласованность дат через `buildSessionState`.
 */
function applySuccessState(
  store: AuthStorePort,
  params: RegisterSuccessParams,
): void {
  const { registerResponse, deviceInfo, meResponse } = params;
  const { tokenPair } = registerResponse;

  // AuthState: authenticated (строится отдельным helper'ом для тестируемости и переиспользования)
  const newAuthState = mapRegisterResponseToAuthState(registerResponse, meResponse);

  // SessionState: active (используем builder для консистентности с login/refresh)
  // meSession опционален: если отсутствует, builder возвращает null (сессия не создается)
  const newSessionState = buildSessionState({
    deviceInfo,
    tokenPair,
    meSession: meResponse?.session,
  });

  // SecurityState: secure (register не использует security-pipeline, всегда initialSecurityState)
  const newSecurityState = initialSecurityState;

  // Атомарное обновление через batchUpdate (все изменения применяются в одной транзакции)
  store.batchUpdate([
    { type: 'setAuthState', state: newAuthState },
    { type: 'setSessionState', state: newSessionState },
    { type: 'setSecurityState', state: newSecurityState },
    { type: 'applyEventType', event: 'user_registered' },
  ]);
}

/**
 * Применяет результат `mfa_required` к auth/security состоянию.
 * Переводит пользователя в `pending_secondary_verification`, SecurityState → `initialSecurityState`.
 */
function applyMfaState(
  store: AuthStorePort,
  params: RegisterMfaParams,
): void {
  const { registerResponse } = params;

  // На данный момент register-flow ещё не завершён успешной регистрацией, пользователь в pending state
  // Минимальная валидация userId перед установкой состояния
  assertValidUser({ id: registerResponse.userId }, 'register_mfa');

  const newAuthState = {
    status: 'pending_secondary_verification' as const,
    userId: registerResponse.userId,
    verificationType: 'mfa' as const,
  };

  // SecurityState: secure (register не использует security-pipeline)
  const newSecurityState = initialSecurityState;

  // Атомарное обновление через batchUpdate
  // SessionState → null, т.к. регистрация не завершена (нет токенов)
  store.batchUpdate([
    { type: 'setAuthState', state: newAuthState },
    { type: 'setSessionState', state: null },
    { type: 'setSecurityState', state: newSecurityState },
    { type: 'applyEventType', event: 'mfa_challenge_sent' },
  ]);
}

/**
 * Registry обработчиков состояний register-flow.
 * @remarks
 * Позволяет масштабировать количество состояний без разрастания if/switch.
 */
const registerStateHandlers: Readonly<
  Record<RegisterStateKind, (params: RegisterStateHandlerParams) => void>
> = {
  success: (params: RegisterStateHandlerParams): void => {
    const { store, registerResponse, deviceInfo, meResponse } = params;
    applySuccessState(store, {
      registerResponse: registerResponse as RegisterResponse & { readonly tokenPair: TokenPair; },
      deviceInfo,
      meResponse,
    });
  },
  mfa: (params: RegisterStateHandlerParams): void => {
    const { store, registerResponse } = params;
    applyMfaState(store, {
      registerResponse: registerResponse as RegisterResponse & { readonly mfaRequired: true; },
    });
  },
} as const;

/**
 * Определяет RegisterStateKind на основе RegisterResponse.
 * @returns 'success' | 'mfa' или null, если состояние невалидно.
 */
function getRegisterStateKind(
  registerResponse: RegisterResponse,
): RegisterStateKind | null {
  if (registerResponse.tokenPair !== undefined) {
    return 'success';
  }

  if (registerResponse.mfaRequired) {
    return 'mfa';
  }

  return null;
}

/**
 * Строит детерминированное сообщение об ошибке для невалидного RegisterResponse.
 * @remarks
 * Избегает JSON.stringify для потенциально недетерминированных структур.
 */
function buildInvalidRegisterResponseMessage(
  registerResponse: RegisterResponse,
): string {
  const hasTokenPair = registerResponse.tokenPair !== undefined;

  const mfaRequired = Boolean(registerResponse.mfaRequired);

  return '[register-store-updater] Invalid RegisterResponse: must have either '
    + 'tokenPair or mfaRequired=true, got: '
    + `userId=${String(registerResponse.userId)}, `
    + `tokenPair=${hasTokenPair ? 'present' : 'absent'}, `
    + `mfaRequired=${mfaRequired}`;
}

/**
 * @internal
 * Вспомогательный экспорт только для unit-тестов, чтобы детерминированно проверять формат сообщений.
 * Не использовать в runtime-коде.
 */
export const testInvalidRegisterResponseMessage = buildInvalidRegisterResponseMessage;

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

/**
 * Обновляет auth/session/security состояние на основе результата register-flow.
 * Pure sink над портом стора: не читает store, не считает риск, использует готовый `RegisterResponse`.
 * SecurityState всегда `initialSecurityState` (register не использует security-pipeline).
 * Использует `buildSessionState` для консистентности с login/refresh.
 */
export function updateRegisterState(
  store: AuthStorePort, // Порт стора аутентификации, через который применяются все изменения
  registerResponse: RegisterResponse, // Доменный результат register-flow
  request: RegisterRequest<RegisterIdentifierType>, // Запрос регистрации для построения DeviceInfo
  meResponse?: MeResponse | undefined, // Опциональный ответ /me endpoint
): void {
  const deviceInfo = buildDeviceInfo(request);
  const stateKind = getRegisterStateKind(registerResponse);

  if (stateKind === null) {
    // Fail-closed: если нет ни tokenPair, ни mfaRequired, это невалидное состояние
    throw new Error(buildInvalidRegisterResponseMessage(registerResponse));
  }

  // Registry-паттерн: выбор обработчика по состоянию (без динамического доступа по ключу)
  if (stateKind === 'success') {
    registerStateHandlers.success({
      store,
      registerResponse,
      deviceInfo,
      meResponse,
    });
  } else {
    registerStateHandlers.mfa({
      store,
      registerResponse,
      deviceInfo,
      meResponse,
    });
  }
}
