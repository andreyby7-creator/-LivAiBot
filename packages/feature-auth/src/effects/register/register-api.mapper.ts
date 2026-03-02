/**
 * @file packages/feature-auth/src/effects/register/register-api.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Register API Mapper
 * ============================================================================
 *
 * Pure mapper между domain и transport слоями (без orchestration):
 * - RegisterRequest/OAuthRegisterRequest → transport payloads
 * - RegisterResponseValues → RegisterResponse
 *
 * Принципы:
 * - Fail-closed: exhaustive проверка полей, exhaustive switch по providers
 * - Иммутабельность: copy-on-write + Object.freeze
 * - Shared мэпперы для TokenPair (консистентность с login/refresh)
 * - Domain purity: OAuth transport input отделён от domain модели
 */

import type { OAuthRegisterRequest } from '../../domain/OAuthRegisterRequest.js';
import type { RegisterIdentifierType, RegisterRequest } from '../../domain/RegisterRequest.js';
import type { RegisterResponse } from '../../domain/RegisterResponse.js';
import type {
  OAuthRegisterRequestValues,
  RegisterRequestValues,
  RegisterResponseValues,
} from '../../schemas/index.js';
import { mapTokenPairValuesToDomain } from '../shared/auth-api.mappers.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ========================================================================== */

/** Дефолтное время жизни токена в секундах (1 час) при отсутствии expiresIn в ответе. */
const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 3600;

/** Endpoint для email регистрации. */
const REGISTER_ENDPOINT = '/v1/auth/register';

/** Endpoint для OAuth регистрации. */
const OAUTH_REGISTER_ENDPOINT = '/v1/auth/oauth/register';

/* ============================================================================
 * 🔧 INTERNAL HELPERS — REQUEST SIDE
 * ========================================================================== */

/**
 * Exhaustiveness guard для fail-closed поведения в switch по identifier types.
 * @note Выбрасывает ошибку, если появляется новый тип идентификатора и не обрабатывается в switch.
 */
function assertNever(x: never): never {
  throw new Error(
    `[register-api.mapper] Unhandled identifier type: ${String(x)}`,
  );
}

/**
 * Нормализует clientContext в формат RegisterRequestValues['clientContext'].
 * @note Явный whitelist полей для безопасности: только разрешённые поля попадают в API payload.
 * @note Transport-схема поддерживает только подмножество полей ClientContext.
 * @note Future поля ClientContext не протекают в API благодаря whitelist + freeze + as const.
 */
function normalizeClientContext(
  clientContext: RegisterRequest<RegisterIdentifierType>['clientContext'],
): RegisterRequestValues['clientContext'] | undefined {
  if (clientContext === undefined) {
    return undefined;
  }

  // Явный whitelist: только разрешённые поля transport-схемы
  // Используем as const для полной фиксации типа TypeScript
  const normalized = Object.freeze(
    {
      ...(clientContext.ip !== undefined ? { ip: clientContext.ip } : {}),
      ...(clientContext.deviceId !== undefined ? { deviceId: clientContext.deviceId } : {}),
      ...(clientContext.userAgent !== undefined ? { userAgent: clientContext.userAgent } : {}),
      ...(clientContext.locale !== undefined ? { locale: clientContext.locale } : {}),
      ...(clientContext.timezone !== undefined ? { timezone: clientContext.timezone } : {}),
    } as const,
  );

  // Если все поля undefined, возвращаем undefined
  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized as RegisterRequestValues['clientContext'];
}

/**
 * Нормализует clientContext в формат OAuthRegisterRequestValues['clientContext'].
 * @note Явный whitelist полей для безопасности: только разрешённые поля попадают в API payload.
 * @note Transport-схема OAuth регистрации поддерживает только ip, userAgent, deviceId.
 */
function normalizeOAuthClientContext(
  clientContext: OAuthRegisterRequest['clientContext'],
): OAuthRegisterRequestValues['clientContext'] | undefined {
  if (clientContext === undefined) {
    return undefined;
  }

  // Явный whitelist: только разрешённые поля transport-схемы OAuth регистрации
  const normalized = Object.freeze(
    {
      ...(clientContext.ip !== undefined ? { ip: clientContext.ip } : {}),
      ...(clientContext.deviceId !== undefined ? { deviceId: clientContext.deviceId } : {}),
      ...(clientContext.userAgent !== undefined ? { userAgent: clientContext.userAgent } : {}),
    } as const,
  );

  // Если все поля undefined, возвращаем undefined
  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized as OAuthRegisterRequestValues['clientContext'];
}

/* ============================================================================
 * 🎯 PUBLIC API — EMAIL REGISTER
 * ========================================================================== */

/**
 * Маппинг RegisterRequest (domain) → RegisterRequestValues (transport для /v1/auth/register).
 *
 * @note Transport-схема поддерживает только email. Остальные типы выбрасывают ошибку до добавления схемы.
 *       Password и workspaceName обязательны для email-регистрации.
 */
export function mapRegisterRequestToApiPayload(
  request: Readonly<RegisterRequest<RegisterIdentifierType>>,
): Readonly<RegisterRequestValues> {
  const clientContext = normalizeClientContext(request.clientContext);

  // Exhaustive switch по identifier.type для type-safety и fail-closed поведения
  switch (request.identifier.type) {
    case 'email': {
      if (request.password === undefined) {
        throw new Error(
          '[register-api.mapper] password is required for email registration',
        );
      }

      if (request.workspaceName === undefined) {
        throw new Error(
          '[register-api.mapper] workspaceName is required for email registration',
        );
      }

      // Transport-схема использует email напрямую, а не identifier
      const payload: RegisterRequestValues = {
        email: request.identifier.value,
        password: request.password,
        workspaceName: request.workspaceName,
        ...(clientContext !== undefined ? { clientContext } : {}),
      };

      return Object.freeze(payload);
    }

    case 'username': {
      throw new Error(
        `[register-api.mapper] identifier.type "username" is not supported for ${REGISTER_ENDPOINT}. `
          + 'Transport `registerRequestSchema` currently accepts only email identifier.',
      );
    }

    case 'phone': {
      throw new Error(
        `[register-api.mapper] identifier.type "phone" is not supported for ${REGISTER_ENDPOINT}. `
          + 'Transport `registerRequestSchema` currently accepts only email identifier.',
      );
    }

    case 'oauth': {
      throw new Error(
        `[register-api.mapper] identifier.type "oauth" is not supported for ${REGISTER_ENDPOINT}. `
          // eslint-disable-next-line no-secrets/no-secrets -- это имя функции, а не секрет
          + `Use \`mapOAuthRegisterRequestToApiPayload\` with dedicated OAuth registration endpoint ${OAUTH_REGISTER_ENDPOINT}.`,
      );
    }

    default: {
      // Exhaustiveness guard: если появляется новый тип идентификатора и не обрабатывается явно,
      // TypeScript подсветит это место при компиляции.
      const _exhaustiveCheck: never = request.identifier.type;
      return assertNever(_exhaustiveCheck);
    }
  }
}

/* ============================================================================
 * 🎯 PUBLIC API — OAUTH REGISTER
 * ========================================================================== */

/**
 * Transport input для OAuth регистрации.
 *
 * @remarks
 * Domain `OAuthRegisterRequest` использует `providerToken` (access token flow),
 * но transport требует `code`, `state`, `redirectUri` (authorization code flow).
 * Этот тип явно разделяет domain и transport модели.
 */
export type OAuthRegisterTransportInput = Readonly<{
  /** Domain OAuth request. */
  domain: OAuthRegisterRequest;
  /** Authorization code от OAuth провайдера (обязательно для transport) */
  code: string;
  /** State параметр для защиты от CSRF (обязательно для transport) */
  state: string;
  /** Redirect URI для OAuth callback (обязательно для transport) */
  redirectUri: string;
  /** Имя workspace для регистрации (обязательно для transport) */
  workspaceName: string;
}>;

/**
 * Маппинг OAuthRegisterRequest (domain) → OAuthRegisterRequestValues (transport для /v1/auth/oauth/register).
 *
 * @note Transport использует authorization code flow, domain — access token flow.
 *       Проверяет обязательные поля и provider через exhaustive switch.
 */
export function mapOAuthRegisterRequestToApiPayload(
  input: Readonly<OAuthRegisterTransportInput>,
): Readonly<OAuthRegisterRequestValues> {
  // Trim и валидация: используем trimmed значения для консистентности
  const code = input.code.trim();
  const state = input.state.trim();
  const redirectUri = input.redirectUri.trim();
  const workspaceName = input.workspaceName.trim();

  // Fail-fast: проверка обязательных полей для transport-схемы
  if (code === '') {
    throw new Error(
      '[register-api.mapper] code must not be empty for OAuth registration',
    );
  }

  if (state === '') {
    throw new Error(
      '[register-api.mapper] state must not be empty for OAuth registration',
    );
  }

  if (redirectUri === '') {
    throw new Error(
      '[register-api.mapper] redirectUri must not be empty for OAuth registration',
    );
  }

  if (workspaceName === '') {
    throw new Error(
      '[register-api.mapper] workspaceName must not be empty for OAuth registration',
    );
  }

  // Exhaustive switch по provider для compile-time fail-closed
  // Domain поддерживает: 'google' | 'yandex' | 'facebook' | 'vk'
  // Transport требует тип из OAuthRegisterRequestValues['provider'] (source of truth)
  let transportProvider: OAuthRegisterRequestValues['provider'];
  switch (input.domain.provider) {
    case 'google':
      transportProvider = 'google';
      break;

    case 'yandex':
    case 'facebook':
    case 'vk':
      throw new Error(
        `[register-api.mapper] OAuth provider "${input.domain.provider}" is not supported by transport schema. `
          + `Supported providers: google, github, microsoft, apple`,
      );

    default:
      // Exhaustiveness guard: если domain расширится, TypeScript упадёт здесь
      return assertNever(input.domain.provider);
  }

  const clientContext = normalizeOAuthClientContext(input.domain.clientContext);

  const payload: OAuthRegisterRequestValues = {
    provider: transportProvider,
    code,
    state,
    redirectUri,
    workspaceName,
    ...(clientContext !== undefined ? { clientContext } : {}),
  };

  return Object.freeze(payload);
}

/* ============================================================================
 * 🎯 PUBLIC API — RESPONSE MAPPING
 * ========================================================================== */

/**
 * Маппинг RegisterResponseValues (transport) → RegisterResponse (domain).
 *
 * @note Использует shared mapper для expiresIn → expiresAt. Проверяет accessToken и refreshToken.
 *       Детерминированный expiresAt через injected now (для тестов). dtoVersion по умолчанию '1.0'.
 */
export function mapRegisterResponseToDomain(
  dto: Readonly<RegisterResponseValues>,
  now: () => number = Date.now,
): Readonly<RegisterResponse> {
  // Fail-fast: explicit проверка обязательных полей перед использованием
  // @note accessToken и refreshToken обязательны по схеме (не опциональны), но проверяем на пустую строку
  if (dto.accessToken === '') {
    throw new Error(
      '[register-api.mapper] accessToken must not be empty',
    );
  }

  if (dto.refreshToken === '') {
    throw new Error(
      '[register-api.mapper] refreshToken must not be empty',
    );
  }

  // Guard: expiresIn должен быть > 0 для предотвращения fail-open сценария
  if (dto.expiresIn !== undefined && dto.expiresIn <= 0) {
    throw new Error(
      '[register-api.mapper] expiresIn must be > 0',
    );
  }

  // Преобразуем RegisterResponseValues в формат LoginTokenPairValues для использования shared mapper
  // RegisterResponseValues содержит accessToken, refreshToken, expiresIn (опционально)
  // Нужно преобразовать в формат с expiresAt (ISO 8601)
  const expiresAt = dto.expiresIn !== undefined
    ? new Date(now() + dto.expiresIn * 1000).toISOString()
    : new Date(now() + DEFAULT_TOKEN_EXPIRES_IN_SECONDS * 1000).toISOString();

  const tokenPairValues = {
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    expiresAt,
  };

  const tokenPair = mapTokenPairValuesToDomain(tokenPairValues);

  return Object.freeze({
    userId: dto.userId,
    tokenPair,
    mfaRequired: false, // RegisterResponseValues не содержит информации о MFA, по умолчанию false
    dtoVersion: '1.0', // Default version, так как transport-слой не содержит dtoVersion
  }) as RegisterResponse;
}
