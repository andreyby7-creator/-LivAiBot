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
 * - ✅ Использует shared мэпперы (`auth-api.mappers`) для TokenPair и MeResponse (консистентность между login/register/refresh)
 * - ✅ Safety boundary: защитная валидация dynamic `Record<string, unknown>` (для TokenPair.metadata и MeResponse.context через shared мэпперы)
 */

import type { LoginIdentifierType, LoginRequest } from '../../domain/LoginRequest.js';
import type { DomainLoginResult } from '../../domain/LoginResult.js';
import type { MfaChallengeRequest, MfaType } from '../../domain/MfaChallengeRequest.js';
import type { MfaInfo } from '../../domain/MfaInfo.js';
import type { LoginRequestValues, MfaChallengeRequestValues } from '../../schemas/index.js';
import { assertNever } from '../../types/login.dto.js';
import type { LoginResponseDto } from '../../types/login.dto.js';
import {
  mapMeResponseValuesToDomain,
  mapTokenPairValuesToDomain,
} from '../shared/auth-api.mappers.js';

/* ============================================================================
 * 🔧 INTERNAL HELPERS — REQUEST SIDE
 * ========================================================================== */

/**
 * Нормализует mfa-информацию в формат LoginRequestValues['mfa'].
 * @note Выполняет copy-on-write для массивов и объектов, не возвращая исходные ссылки.
 * @note Поддерживает discriminated union: для push типа token отсутствует.
 */
function normalizeMfa(
  mfa: LoginRequest<LoginIdentifierType>['mfa'],
): LoginRequestValues['mfa'] | undefined {
  if (mfa === undefined) {
    return undefined;
  }

  type NormalizedMfaItem =
    | {
      type: 'totp' | 'sms' | 'email';
      token: string;
      deviceId?: string;
    }
    | {
      type: 'push';
      deviceId: string;
    };

  const mapOne = (value: MfaInfo): NormalizedMfaItem => {
    if (value.type === 'push') {
      return {
        type: 'push',
        deviceId: value.deviceId,
      };
    }
    return {
      type: value.type,
      token: value.token,
      ...(value.deviceId !== undefined ? { deviceId: value.deviceId } : {}),
    };
  };

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
 * 🔧 INTERNAL HELPERS — MFA CHALLENGE MAPPING
 * ========================================================================== */

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
