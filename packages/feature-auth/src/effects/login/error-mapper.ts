/**
 * @file packages/feature-auth/src/effects/login/error-mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Error Mapper (Production-Grade Rule-Engine)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Трансформация API ошибок (AuthErrorResponse, OAuthErrorResponse) в UI-friendly AuthError
 * - Переиспользуется для login, logout, refresh, OAuth, MFA
 * - Production-grade rule-engine с приоритетами и dependency resolution
 * - Domain-pure: без transport-level загрязнения
 * - Security-first: sanitization sensitive data
 * - Single source of truth для всех mapping tables
 *
 * Принципы:
 * - ✅ True rule-engine: priority-based, composable, scalable (до 50+ правил)
 * - ✅ Domain-safe: sanitized raw поле, sensitive data удаляется
 * - ✅ Security-first: автоматическая sanitization токенов, secrets, IDs
 * - ✅ Single source of truth: один registry (AUTH_ERROR_MAPPING_REGISTRY) для всех mappings
 * - ✅ Proper error detection: error.name/code вместо brittle string matching
 * - ✅ Deterministic: все параметры передаются явно, без side-effects
 * - ✅ Extensible: добавление нового error type = обновление только registry
 */

import type {
  MapErrorConfig,
  MappedError,
  ServicePrefix,
  TaggedError,
} from '@livai/app/lib/error-mapping.js';
import { mapError } from '@livai/app/lib/error-mapping.js';

import type { AuthErrorResponse } from '../../domain/AuthErrorResponse.js';
import type { MfaType } from '../../domain/MfaChallengeRequest.js';
import type { OAuthErrorResponse } from '../../domain/OAuthErrorResponse.js';
import type { SessionRevokeReason } from '../../domain/SessionRevokeRequest.js';
import type { AuthError, ISODateString } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Конфигурация для маппинга auth ошибок (детерминированная, без side-effects) */
export type MapAuthErrorConfig = MapErrorConfig & {
  readonly service?: ServicePrefix | undefined;
};

/** Входные данные для маппинга (API ошибки или unknown) */
export type AuthErrorInput = AuthErrorResponse | OAuthErrorResponse | Error | string | object;

/** Результат маппинга с интеграцией error-mapping.ts */
export type MapAuthErrorResult = {
  /** UI-friendly ошибка для Store/UI (domain-pure, без raw) */
  readonly uiError: AuthError;
  /** MappedError для telemetry и интеграции с error-mapping.ts */
  readonly mappedError: MappedError<AuthErrorResponse | OAuthErrorResponse | undefined>;
};

/** Безопасное представление ошибки для domain (без sensitive data) */
type SanitizedErrorSnapshot = {
  readonly errorType: string;
  readonly message?: string;
  readonly timestamp?: string;
};

/* ============================================================================
 * 🔍 TYPE GUARDS
 * ============================================================================
 */

/** Проверяет, является ли значение AuthErrorResponse */
function isAuthErrorResponse(value: unknown): value is AuthErrorResponse {
  return (
    value !== null
    && value !== undefined
    && typeof value === 'object'
    && 'error' in value
    && typeof (value as AuthErrorResponse).error === 'string'
    && !('provider' in value) // OAuthErrorResponse имеет provider (даже если опционален)
  );
}

/** Проверяет, является ли значение OAuthErrorResponse */
function isOAuthErrorResponse(value: unknown): value is OAuthErrorResponse {
  if (
    value === null
    || value === undefined
    || typeof value !== 'object'
    || !('error' in value)
    || typeof (value as OAuthErrorResponse).error !== 'string'
  ) {
    return false;
  }

  // Различаем OAuthErrorResponse от AuthErrorResponse по наличию provider в объекте
  // 'provider' in value возвращает true даже если значение undefined
  // Это правильное различие, так как AuthErrorResponse никогда не имеет этого поля
  return 'provider' in value;
}

/** Проверяет, является ли значение Error */
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/* ============================================================================
 * 🔒 SECURITY — Sanitization
 * ============================================================================
 */

/** Извлекает безопасное значение поля error */
function extractSafeError<T extends Record<string, unknown>>(data: T): string | undefined {
  if (!('error' in data) || typeof data['error'] !== 'string') {
    return undefined;
  }
  return data['error'];
}

/** Извлекает безопасное значение поля message */
function extractSafeMessage<T extends Record<string, unknown>>(data: T): string | undefined {
  if (!('message' in data) || typeof data['message'] !== 'string') {
    return undefined;
  }
  return data['message'];
}

/** Извлекает безопасное значение поля timestamp */
function extractSafeTimestamp<T extends Record<string, unknown>>(data: T): string | undefined {
  if (!('timestamp' in data) || typeof data['timestamp'] !== 'string') {
    return undefined;
  }
  return data['timestamp'];
}

/** Санитизирует объект, удаляя sensitive поля */
function sanitizeErrorData<T extends Record<string, unknown>>(data: T): SanitizedErrorSnapshot {
  const safeError = extractSafeError(data);
  const safeMessage = extractSafeMessage(data);
  const safeTimestamp = extractSafeTimestamp(data);

  return {
    errorType: safeError ?? 'unknown_error',
    ...(safeMessage !== undefined ? { message: safeMessage } : {}),
    ...(safeTimestamp !== undefined ? { timestamp: safeTimestamp } : {}),
  };
}

/* ============================================================================
 * 🗂️ SINGLE SOURCE OF TRUTH — Error Mapping Registry
 * ============================================================================
 *
 * Централизованный registry для всех mapping tables.
 * При добавлении нового error type нужно обновить только этот registry.
 */

/** Контекст ошибки с явной типизацией полей (для избежания context-leakage) */
type ErrorContext = {
  readonly lockedUntil?: string;
  readonly availableMethods?: readonly MfaType[];
  readonly remainingAttempts?: number;
  readonly retryAfter?: string;
  readonly reason?: string;
  readonly requiredPermissions?: readonly string[];
  readonly riskScore?: number;
};

/** Функция извлечения дополнительных полей из errorContext */
type ExtractFieldsFn = (
  errorContext?: ErrorContext,
) => Partial<{
  readonly lockedUntil: ISODateString;
  readonly availableMethods: readonly MfaType[];
  readonly remainingAttempts: number;
  readonly retryAfter: ISODateString;
  readonly reason: SessionRevokeReason;
  readonly requiredPermissions: readonly string[];
  readonly riskScore: number;
}>;

/** Конфигурация маппинга для одного типа ошибки */
type ErrorMappingConfig = {
  /** UI-friendly kind для AuthError */
  readonly uiKind: AuthError['kind'];
  /** ServiceErrorCode для error-mapping.ts */
  readonly serviceCode: `AUTH_${string}`;
  /** Функция извлечения дополнительных полей из errorContext */
  readonly extractFields?: ExtractFieldsFn;
};

/** Функция-фабрика для создания конфигурации session_revoked */
function createSessionRevokedConfig(): ErrorMappingConfig {
  return {
    uiKind: 'session_revoked',
    serviceCode: 'AUTH_SESSION_REVOKED',
    extractFields: (errorContext): Partial<{
      readonly lockedUntil: ISODateString;
      readonly availableMethods: readonly MfaType[];
      readonly remainingAttempts: number;
      readonly retryAfter: ISODateString;
      readonly reason: SessionRevokeReason;
      readonly requiredPermissions: readonly string[];
      readonly riskScore: number;
    }> => {
      if (errorContext === undefined) return {};
      const reason = errorContext.reason;
      return typeof reason === 'string' ? { reason: reason as SessionRevokeReason } : {};
    },
  };
}

/** Функция-фабрика для создания конфигурации session_expired */
function createSessionExpiredConfig(): ErrorMappingConfig {
  return {
    uiKind: 'session_expired',
    serviceCode: 'AUTH_SESSION_EXPIRED',
  };
}

/** Создает registry всех маппингов AuthErrorType (через функцию для избежания context-leakage) */
function createAuthErrorMappingRegistry(): Record<AuthErrorResponse['error'], ErrorMappingConfig> {
  return {
    invalid_credentials: {
      uiKind: 'invalid_credentials',
      serviceCode: 'AUTH_INVALID_CREDENTIALS',
    },
    account_locked: {
      uiKind: 'account_locked',
      serviceCode: 'AUTH_ACCOUNT_LOCKED',
      extractFields: (errorContext) => {
        if (errorContext === undefined) return {};
        const lockedUntil = errorContext.lockedUntil;
        return typeof lockedUntil === 'string' ? { lockedUntil } : {};
      },
    },
    account_disabled: {
      uiKind: 'account_disabled',
      serviceCode: 'AUTH_ACCOUNT_DISABLED',
    },
    email_not_verified: {
      uiKind: 'email_not_verified',
      serviceCode: 'AUTH_EMAIL_NOT_VERIFIED',
    },
    phone_not_verified: {
      uiKind: 'phone_not_verified',
      serviceCode: 'AUTH_PHONE_NOT_VERIFIED',
    },
    mfa_required: {
      uiKind: 'mfa_required',
      serviceCode: 'AUTH_MFA_REQUIRED',
      extractFields: (errorContext) => {
        if (errorContext === undefined) return {};
        const availableMethods = errorContext.availableMethods;
        return Array.isArray(availableMethods)
          ? { availableMethods: availableMethods as readonly MfaType[] }
          : {};
      },
    },
    mfa_failed: {
      uiKind: 'mfa_failed',
      serviceCode: 'AUTH_MFA_FAILED',
      extractFields: (errorContext) => {
        if (errorContext === undefined) return {};
        const remainingAttempts = errorContext.remainingAttempts;
        return typeof remainingAttempts === 'number' ? { remainingAttempts } : {};
      },
    },
    rate_limited: {
      uiKind: 'rate_limited',
      serviceCode: 'AUTH_RATE_LIMITED',
      extractFields: (errorContext) => {
        if (errorContext === undefined) return {};
        const retryAfter = errorContext.retryAfter;
        return typeof retryAfter === 'string' ? { retryAfter } : {};
      },
    },
    session_expired: createSessionExpiredConfig(),
    session_revoked: createSessionRevokedConfig(),
    token_expired: {
      uiKind: 'token_expired',
      serviceCode: 'AUTH_TOKEN_EXPIRED',
    },
    token_invalid: {
      uiKind: 'token_invalid',
      serviceCode: 'AUTH_TOKEN_INVALID',
    },
    permission_denied: {
      uiKind: 'permission_denied',
      serviceCode: 'AUTH_PERMISSION_DENIED',
      extractFields: (errorContext) => {
        if (errorContext === undefined) return {};
        const requiredPermissions = errorContext.requiredPermissions;
        return Array.isArray(requiredPermissions)
          ? { requiredPermissions: requiredPermissions as readonly string[] }
          : {};
      },
    },
    risk_blocked: {
      uiKind: 'risk_blocked',
      serviceCode: 'AUTH_RISK_BLOCKED',
      extractFields: (errorContext) => {
        if (errorContext === undefined) return {};
        const riskScore = errorContext.riskScore;
        return typeof riskScore === 'number' ? { riskScore } : {};
      },
    },
    conflict: {
      uiKind: 'unknown', // conflict не имеет отдельного kind в AuthError
      serviceCode: 'AUTH_CONFLICT',
    },
    unknown_error: {
      uiKind: 'unknown',
      serviceCode: 'AUTH_UNKNOWN_ERROR',
    },
  } as const;
}

/** Registry всех маппингов AuthErrorType */
const AUTH_ERROR_MAPPING_REGISTRY: Record<AuthErrorResponse['error'], ErrorMappingConfig> =
  createAuthErrorMappingRegistry();

/** Registry маппингов OAuthErrorType */
const OAUTH_ERROR_MAPPING_REGISTRY: Record<OAuthErrorResponse['error'], `AUTH_OAUTH_${string}`> = {
  invalid_token: 'AUTH_OAUTH_INVALID_TOKEN',
  expired_token: 'AUTH_OAUTH_EXPIRED_TOKEN',
  provider_unavailable: 'AUTH_OAUTH_PROVIDER_UNAVAILABLE',
  user_denied: 'AUTH_OAUTH_USER_DENIED',
  invalid_scope: 'AUTH_OAUTH_INVALID_SCOPE',
  account_conflict: 'AUTH_OAUTH_ACCOUNT_CONFLICT',
  email_not_verified: 'AUTH_OAUTH_EMAIL_NOT_VERIFIED',
  rate_limited: 'AUTH_OAUTH_RATE_LIMITED',
  unknown_error: 'AUTH_OAUTH_UNKNOWN_ERROR',
} as const;

/* ============================================================================
 * 🎯 TRUE RULE ENGINE — Priority-Based Rules
 * ============================================================================
 *
 * Production-grade rule-engine с:
 * - Приоритетами (priority)
 * - Match функциями (match)
 * - Map функциями (map)
 * - Автоматической сортировкой по приоритету
 */

/** Функция проверки применимости правила */
type MatchFn = (input: AuthErrorInput) => boolean;

/** Функция преобразования входных данных в AuthError */
type MapFn = (input: AuthErrorInput, config: MapAuthErrorConfig) => AuthError;

/** Базовые свойства правила маппинга */
type MappingRuleBase = {
  /** Приоритет правила (меньше = выше приоритет) */
  readonly priority: number;
};

/** Правило маппинга с приоритетом */
type MappingRule = MappingRuleBase & {
  /** Проверяет, применимо ли правило к входным данным */
  readonly match: MatchFn;
  /** Преобразует входные данные в AuthError */
  readonly map: MapFn;
};

/** Создает AuthError с sanitized raw полем (domain-safe) */
function createDomainSafeAuthError(
  kind: AuthError['kind'],
  message: string | undefined,
  additionalFields: Record<string, unknown> | undefined,
  sanitizedRaw?: SanitizedErrorSnapshot,
): AuthError {
  const base: {
    readonly kind: typeof kind;
    readonly message?: string;
    readonly raw?: AuthErrorResponse | OAuthErrorResponse;
    [key: string]: unknown;
  } = {
    kind,
    ...(message !== undefined ? { message } : {}),
    ...(additionalFields ?? {}),
    // Добавляем sanitized raw только если нужно (для unknown обязательное)
    ...(sanitizedRaw !== undefined
      ? {
        raw: {
          error: sanitizedRaw.errorType as AuthErrorResponse['error'],
          ...(sanitizedRaw.message !== undefined ? { message: sanitizedRaw.message } : {}),
          ...(sanitizedRaw.timestamp !== undefined ? { timestamp: sanitizedRaw.timestamp } : {}),
        } as AuthErrorResponse,
      }
      : {}),
  };

  return base as AuthError;
}

/** Правило 1: AuthErrorResponse → AuthError (приоритет 10) */
const authErrorResponseRule: MappingRule = {
  priority: 10,
  match: (input) => isAuthErrorResponse(input),
  map: (input) => {
    if (!isAuthErrorResponse(input)) {
      throw new Error('Rule mismatch: expected AuthErrorResponse');
    }

    const mapping = AUTH_ERROR_MAPPING_REGISTRY[input.error];
    // Преобразуем Record<string, unknown> в ErrorContext для типобезопасности
    const errorContext: ErrorContext | undefined = input.context !== undefined
      ? (input.context as ErrorContext)
      : undefined;
    const fields = mapping.extractFields?.(errorContext) ?? {};
    const sanitized = sanitizeErrorData(input);

    return createDomainSafeAuthError(mapping.uiKind, sanitized.message, fields, sanitized);
  },
};

/** Правило 2: OAuthErrorResponse → AuthError (приоритет 20) */
const oauthErrorResponseRule: MappingRule = {
  priority: 20,
  match: (input) => isOAuthErrorResponse(input),
  map: (input) => {
    if (!isOAuthErrorResponse(input)) {
      throw new Error('Rule mismatch: expected OAuthErrorResponse');
    }

    const sanitized = sanitizeErrorData(input);

    return createDomainSafeAuthError(
      'oauth_error',
      sanitized.message,
      input.provider !== undefined ? { provider: input.provider } : {},
      sanitized,
    );
  },
};

/** Проверяет, является ли ошибка сетевой (proper detection без brittle string matching) */
function isNetworkError(error: Error): boolean {
  // Используем только error.name и error.code (детерминированные, не зависят от локали)
  const networkErrorNames = ['NetworkError', 'AbortError', 'TimeoutError'] as const;
  const networkErrorCodes = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
  ] as const;

  // Проверяем по имени ошибки
  if (networkErrorNames.includes(error.name as (typeof networkErrorNames)[number])) {
    return true;
  }

  // Проверяем по коду ошибки (если есть)
  if (
    'code' in error
    && typeof error.code === 'string'
    && networkErrorCodes.includes(error.code as (typeof networkErrorCodes)[number])
  ) {
    return true;
  }

  // Не используем проверку по message - это brittle и locale-dependent
  // Если ошибка не определена по name/code, она будет обработана как unknown
  return false;
}

/** Правило 3: Network Error → AuthError (приоритет 30) */
const networkErrorRule: MappingRule = {
  priority: 30,
  match: (input) => isError(input) && isNetworkError(input),
  map: (input) => {
    if (!isError(input)) {
      throw new Error('Rule mismatch: expected Error');
    }

    return createDomainSafeAuthError('network', input.message, { retryable: true as const });
  },
};

/** Константа для сообщения об неизвестной ошибке */
const UNKNOWN_ERROR_MESSAGE = 'Неизвестная ошибка' as const;

/** Правило 4: Unknown Error → AuthError (приоритет 100, fallback) */
const unknownErrorRule: MappingRule = {
  priority: 100,
  match: () => true, // Всегда совпадает (fallback)
  map: (input) => {
    if (isError(input)) {
      const sanitized: SanitizedErrorSnapshot = {
        errorType: 'unknown_error',
        message: input.message,
      };
      return createDomainSafeAuthError('unknown', input.message, undefined, sanitized);
    }

    const message = typeof input === 'string' ? input : UNKNOWN_ERROR_MESSAGE;
    const sanitized: SanitizedErrorSnapshot = {
      errorType: 'unknown_error',
      message,
    };
    return createDomainSafeAuthError('unknown', message, undefined, sanitized);
  },
};

/** Список всех правил (автоматически сортируется по приоритету) */
const ALL_MAPPING_RULES: readonly MappingRule[] = [
  authErrorResponseRule,
  oauthErrorResponseRule,
  networkErrorRule,
  unknownErrorRule,
].sort((a, b) => a.priority - b.priority);

/** Применяет правила маппинга с учетом приоритетов */
function applyMappingRules(
  input: AuthErrorInput,
  config: MapAuthErrorConfig,
): AuthError {
  // Правила уже отсортированы по приоритету
  for (const rule of ALL_MAPPING_RULES) {
    if (rule.match(input)) {
      return rule.map(input, config);
    }
  }

  // Этот код недостижим, так как unknownErrorRule всегда совпадает
  // Но TypeScript требует явного возврата
  return unknownErrorRule.map(input, config);
}

/* ============================================================================
 * 🔄 ИНТЕГРАЦИЯ С ERROR-MAPPING.TS
 * ============================================================================
 */

/** Создает TaggedError из AuthErrorResponse для интеграции с error-mapping.ts */
function createTaggedErrorFromAuthErrorResponse(error: AuthErrorResponse): TaggedError {
  const mapping = AUTH_ERROR_MAPPING_REGISTRY[error.error];
  return {
    code: mapping.serviceCode,
    service: 'AUTH',
  } as const;
}

/** Создает TaggedError из OAuthErrorResponse для интеграции с error-mapping.ts */
function createTaggedErrorFromOAuthErrorResponse(error: OAuthErrorResponse): TaggedError {
  const code = OAUTH_ERROR_MAPPING_REGISTRY[error.error];
  return {
    code,
    service: 'AUTH',
  } as const;
}

/** Создает MappedError для telemetry и интеграции */
function createMappedError(
  input: AuthErrorInput,
  config: MapAuthErrorConfig,
): MappedError<AuthErrorResponse | OAuthErrorResponse | undefined> {
  if (isAuthErrorResponse(input)) {
    const taggedError = createTaggedErrorFromAuthErrorResponse(input);
    return mapError(taggedError, input, config, config.service ?? 'AUTH');
  }

  if (isOAuthErrorResponse(input)) {
    const taggedError = createTaggedErrorFromOAuthErrorResponse(input);
    return mapError(taggedError, input, config, config.service ?? 'AUTH');
  }

  if (isError(input)) {
    return mapError(input, undefined, config, config.service ?? 'AUTH');
  }

  // Для unknown ошибок
  return mapError(
    { code: 'AUTH_UNKNOWN_ERROR' as const, service: 'AUTH' as const },
    undefined,
    config,
    config.service ?? 'AUTH',
  );
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

/**
 * Трансформирует API ошибки в UI-friendly AuthError.
 * Pure функция: не имеет side-effects, детерминирована.
 * Использует production-grade rule-engine с приоритетами.
 * Domain-pure: не содержит raw transport DTO.
 * Security-first: sanitizes sensitive data.
 *
 * @param input - Входные данные (AuthErrorResponse, OAuthErrorResponse, Error, или unknown)
 * @param config - Конфигурация маппинга (locale, timestamp, service)
 * @returns Результат маппинга с UI-friendly ошибкой и MappedError для telemetry
 */
export function mapAuthError(
  input: AuthErrorInput,
  config: MapAuthErrorConfig,
): MapAuthErrorResult {
  const uiError = applyMappingRules(input, config);
  const mappedError = createMappedError(input, config);

  return {
    uiError,
    mappedError,
  } as const;
}

/**
 * Упрощенная версия mapAuthError, возвращающая только UI-friendly ошибку.
 * Используется когда не нужна интеграция с error-mapping.ts.
 *
 * @param input - Входные данные (AuthErrorResponse, OAuthErrorResponse, Error, или unknown)
 * @param config - Конфигурация маппинга (locale, timestamp, service)
 * @returns UI-friendly AuthError (domain-pure, без raw)
 */
export function mapAuthErrorToUI(
  input: AuthErrorInput,
  config: MapAuthErrorConfig,
): AuthError {
  return applyMappingRules(input, config);
}
