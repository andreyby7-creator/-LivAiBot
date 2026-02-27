/**
 * @file packages/feature-auth/src/effects/login/login-api.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login API Mapper
 * ============================================================================
 *
 * Назначение (только mapping, без orchestration):
 * - Domain `LoginRequest` → transport `LoginRequestValues` (payload для `POST /v1/auth/login`)
 * - Feature/transport aggregate `LoginResponseDto` → domain `DomainLoginResult`
 *
 * Гарантии:
 * - ❌ Не содержит логики store/security/telemetry и не читает `SecurityPipelineResult`
 * - ✅ Fail-closed: exhaustive switch по `LoginResponseDto['type']` + `assertNever`
 * - ✅ Иммутабельность: copy-on-write + `Object.freeze` (не протекают мутабельные ссылки из DTO)
 * - ✅ Safety boundary: защитная валидация dynamic `Record<string, unknown>` перед тем, как переносить его в domain
 */

import type { LoginIdentifierType, LoginRequest } from '../../domain/LoginRequest.js';
import type { DomainLoginResult } from '../../domain/LoginResult.js';
import type { MeResponse } from '../../domain/MeResponse.js';
import type { MfaChallengeRequest, MfaType } from '../../domain/MfaChallengeRequest.js';
import type { TokenPair } from '../../domain/TokenPair.js';
import type {
  LoginRequestValues,
  LoginTokenPairValues,
  MeResponseValues,
  MfaChallengeRequestValues,
} from '../../schemas/index.js';
import { assertNever } from '../../types/login.dto.js';
import type { LoginResponseDto } from '../../types/login.dto.js';

/* ============================================================================
 * 🔧 INTERNAL HELPERS — REQUEST SIDE
 * ========================================================================== */

/**
 * Нормализует mfa-информацию в формат LoginRequestValues['mfa'].
 * @note Выполняет copy-on-write для массивов и объектов, не возвращая исходные ссылки.
 */
function normalizeMfa(
  mfa: LoginRequest<LoginIdentifierType>['mfa'],
): LoginRequestValues['mfa'] | undefined {
  if (mfa === undefined) {
    return undefined;
  }

  type NormalizedMfaItem = {
    readonly type: string;
    readonly token: string;
    readonly deviceId?: string;
  };

  const mapOne = (value: NormalizedMfaItem): NormalizedMfaItem => ({
    type: value.type,
    token: value.token,
    ...(value.deviceId !== undefined ? { deviceId: value.deviceId } : {}),
  });

  if (Array.isArray(mfa)) {
    // Возвращаем новый mutable-массив (schema-уровень), не исходный input
    return mfa.map(mapOne);
  }

  return mapOne(mfa);
}

/**
 * Нормализует clientContext в формат LoginRequestValues['clientContext'].
 * @note Добавляет только те поля, которые присутствуют в domain-типе ClientContext.
 */
function normalizeClientContext(
  clientContext: LoginRequest<LoginIdentifierType>['clientContext'],
): LoginRequestValues['clientContext'] | undefined {
  if (clientContext === undefined) {
    return undefined;
  }

  const geo = clientContext.geo;

  return Object.freeze({
    ip: clientContext.ip,
    deviceId: clientContext.deviceId,
    userAgent: clientContext.userAgent,
    locale: clientContext.locale,
    timezone: clientContext.timezone,
    sessionId: clientContext.sessionId,
    appVersion: clientContext.appVersion,
    ...(geo !== undefined
      ? {
        geo: Object.freeze({
          lat: geo.lat,
          lng: geo.lng,
        }),
      }
      : {}),
  });
}

/* ============================================================================
 * 🔧 INTERNAL HELPERS — RESPONSE SIDE
 * ========================================================================== */

/**
 * Проверяет, что значение является plain object (без прототипов/классов).
 * @note Используется как минимальная защита boundary для `Record<string, unknown>` полей.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Reflect.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isSafePrimitive(value: unknown): value is string | number | boolean | null {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean';
}

function isSafePrimitiveArray(
  value: unknown,
): value is readonly (string | number | boolean | null)[] {
  return Array.isArray(value) && value.every(isSafePrimitive);
}

/**
 * Минимальная валидация для dynamic Record payload, чтобы исключить не-сериализуемые/исполняемые значения.
 * @note Fail-closed: при несовпадении формы бросаем ошибку (это boundary violation).
 */
function validateSafeRecordPayload(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`[login-api.mapper] Unsafe ${label}: expected plain object`);
  }

  const ok = Object.values(value).every((v) => isSafePrimitive(v) || isSafePrimitiveArray(v));
  if (!ok) {
    throw new Error(
      `[login-api.mapper] Unsafe ${label}: only primitive values or arrays of primitives are allowed`,
    );
  }
}

function freezeShallowRecord<T extends Record<string, unknown>>(record: T): Readonly<T> {
  return Object.freeze({ ...record });
}

function freezeArrayCopy<T>(arr: readonly T[]): readonly T[] {
  return Object.freeze([...arr]);
}

function validateAndFreezeRecordPayload(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  validateSafeRecordPayload(value, label);
  return freezeShallowRecord(value);
}

function addIfDefined<K extends string, V>(
  key: K,
  value: V | undefined,
): Partial<Record<K, V>> {
  return value === undefined ? {} : { [key]: value } as Partial<Record<K, V>>;
}

function mapMeSessionValuesToDomain(
  session: Readonly<NonNullable<MeResponseValues['session']>>,
): NonNullable<MeResponse>['session'] {
  return Object.freeze({
    sessionId: session.sessionId,
    ...(session.ip !== undefined ? { ip: session.ip } : {}),
    ...(session.deviceId !== undefined ? { deviceId: session.deviceId } : {}),
    ...(session.userAgent !== undefined ? { userAgent: session.userAgent } : {}),
    ...(session.issuedAt !== undefined ? { issuedAt: session.issuedAt } : {}),
    ...(session.expiresAt !== undefined ? { expiresAt: session.expiresAt } : {}),
  });
}

function mapMeUserValuesToDomain(
  user: Readonly<MeResponseValues['user']>,
): MeResponse['user'] {
  return Object.freeze({
    id: user.id,
    ...addIfDefined('email', user.email),
    ...addIfDefined('emailVerified', user.emailVerified),
    ...addIfDefined('phone', user.phone),
    ...addIfDefined('phoneVerified', user.phoneVerified),
    ...addIfDefined('username', user.username),
    ...addIfDefined('displayName', user.displayName),
    ...addIfDefined('avatarUrl', user.avatarUrl),
    ...addIfDefined('authProvider', user.authProvider),
    ...addIfDefined('status', user.status),
    ...addIfDefined('createdAt', user.createdAt),
    ...addIfDefined('lastLoginAt', user.lastLoginAt),
  });
}

/**
 * Маппит LoginTokenPairValues (transport) в TokenPair (domain).
 * @note Выполняет copy-on-write для массивов/объектов и freeze результата.
 */
function mapTokenPairValuesToDomain(
  tokenPair: Readonly<LoginTokenPairValues>,
): Readonly<TokenPair> {
  const scope = tokenPair.scope !== undefined ? freezeArrayCopy(tokenPair.scope) : undefined;

  // eslint-disable-next-line ai-security/model-poisoning -- tokenPair.metadata валидируется (plain object + primitive/primitive[] values) перед переносом в domain
  const metadata = tokenPair.metadata !== undefined
    ? validateAndFreezeRecordPayload(tokenPair.metadata, 'tokenPair.metadata')
    : undefined;

  return Object.freeze({
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresAt: tokenPair.expiresAt,
    ...(tokenPair.issuedAt !== undefined ? { issuedAt: tokenPair.issuedAt } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

/**
 * Маппит MeResponseValues (transport) в MeResponse (domain).
 * @note Все коллекции копируются и замораживаются, чтобы не протекали мутабельные ссылки из DTO.
 */
function mapMeResponseValuesToDomain(
  me: Readonly<MeResponseValues>,
): Readonly<MeResponse> {
  const roles = freezeArrayCopy(me.roles);
  const permissions = freezeArrayCopy(me.permissions);

  const session = me.session ? mapMeSessionValuesToDomain(me.session) : undefined;
  const features = me.features !== undefined ? Object.freeze({ ...me.features }) : undefined;
  const context = me.context !== undefined
    ? validateAndFreezeRecordPayload(me.context, 'me.context')
    : undefined;

  return Object.freeze({
    user: mapMeUserValuesToDomain(me.user),
    roles,
    permissions,
    ...(session !== undefined ? { session } : {}),
    ...(features !== undefined ? { features } : {}),
    ...(context !== undefined ? { context } : {}),
  });
}

/**
 * Маппит MfaChallengeRequestValues (transport) в MfaChallengeRequest (domain).
 * @note MFA mapping 1:1 — mapper не генерирует/не модифицирует challenge, только нормализует поля.
 */
function mapMfaChallengeValuesToDomain(
  challenge: Readonly<MfaChallengeRequestValues>,
): Readonly<MfaChallengeRequest> {
  // schema использует поле method, domain — type; значения union совпадают
  const type = challenge.method as MfaType;

  return Object.freeze({
    userId: challenge.userId,
    type,
  });
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ========================================================================== */

/**
 * Маппинг LoginRequest (domain) → LoginRequestValues (transport для /v1/auth/login).
 *
 * Инварианты:
 * - ❌ Нет логики store/security — только shape-конвертация
 * - ✅ dtoVersion всегда задан (явный default '1.0' для schema-совместимости)
 * - ✅ Массивы/объекты копируются (copy-on-write), результат Object.freeze
 */

function isOAuthLoginRequest(
  request: Readonly<LoginRequest<LoginIdentifierType>>,
): request is Readonly<LoginRequest<'oauth'>> {
  return request.identifier.type === 'oauth';
}

export function mapLoginRequestToApiPayload(
  request: Readonly<LoginRequest<LoginIdentifierType>>,
): Readonly<LoginRequestValues> {
  const mfa = normalizeMfa(request.mfa);
  const clientContext = normalizeClientContext(request.clientContext);
  const identifier = {
    type: request.identifier.type,
    value: request.identifier.value,
  } as const;

  // Разделяем OAuth и не-OAuth запросы, чтобы сохранить type-safety без лишних type assertion
  if (isOAuthLoginRequest(request)) {
    const payload: LoginRequestValues = {
      identifier,
      dtoVersion: request.dtoVersion ?? '1.0',
      rememberMe: request.rememberMe,
      ...(clientContext !== undefined ? { clientContext } : {}),
      ...(mfa !== undefined ? { mfa } : {}),
      provider: request.provider,
      providerToken: request.providerToken,
    };

    return Object.freeze(payload);
  }

  const payload: LoginRequestValues = {
    identifier,
    password: request.password,
    dtoVersion: request.dtoVersion ?? '1.0',
    rememberMe: request.rememberMe,
    ...(clientContext !== undefined ? { clientContext } : {}),
    ...(mfa !== undefined ? { mfa } : {}),
  };

  return Object.freeze(payload);
}

/**
 * Маппинг LoginResponseDto (feature/transport aggregate) → DomainLoginResult (domain).
 *
 * Инварианты:
 * - ❌ Нет логики store/security/telemetry
 * - ✅ Exhaustive switch по dto.type + assertNever для fail-closed поведения
 * - ✅ MFA mapping 1:1 — challenge не модифицируется и не генерируется заново
 * - ✅ TokenPair/MeResponse нормализуются в domain-формат с readonly-массивами и Object.freeze
 */
export function mapLoginResponseToDomain(
  dto: Readonly<LoginResponseDto>,
): Readonly<DomainLoginResult> {
  switch (dto.type) {
    case 'success': {
      const tokenPair = mapTokenPairValuesToDomain(dto.tokenPair);
      const me = mapMeResponseValuesToDomain(dto.me);

      return Object.freeze({
        type: 'success',
        tokenPair,
        me,
      }) as DomainLoginResult;
    }

    case 'mfa_required': {
      const challenge = mapMfaChallengeValuesToDomain(dto.challenge);

      return Object.freeze({
        type: 'mfa_required',
        challenge,
      }) as DomainLoginResult;
    }

    default: {
      // Exhaustiveness guard: если появляется новая ветка LoginResponseDto и не обрабатывается явно,
      // TypeScript подсветит это место при компиляции.
      const _exhaustiveCheck: never = dto;
      return assertNever(_exhaustiveCheck);
    }
  }
}
