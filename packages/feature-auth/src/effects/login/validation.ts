/**
 * @file packages/feature-auth/src/effects/login/validation.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Validation (Type Guards)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Type guards для LoginRequest
 * - Валидация структуры и формата данных
 * - Domain-pure, deterministic, microservice-ready
 *
 * Принципы:
 * - ✅ Чистые функции — без side-effects
 * - ✅ Deterministic — одинаковый вход → одинаковый выход
 * - ✅ Domain-pure — только domain типы, без инфраструктурных зависимостей
 * - ✅ Strict typing — union-типы, без string и Record в domain
 * - ✅ SRP — каждая функция имеет одну ответственность
 * - ❌ Нет бизнес-логики → business logic layer
 * - ❌ Нет API calls → api-client layer
 * - ❌ Нет store operations → store layer
 *
 * @example
 * if (isValidLoginRequest(value, customOAuthProviders)) {
 *   // value теперь типизирован как LoginRequest
 *   value.identifier.type; // 'email' | 'username' | 'phone' | 'oauth'
 * }
 */

import type { LoginIdentifierType, LoginRequest } from '../../domain/LoginRequest.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Минимальная длина providerToken для OAuth */
const MIN_PROVIDER_TOKEN_LENGTH = 10;

/** Максимальная длина providerToken для OAuth */
const MAX_PROVIDER_TOKEN_LENGTH = 2048;

/** Минимальная длина identifier.value */
const MIN_IDENTIFIER_VALUE_LENGTH = 1;

/** Максимальная длина identifier.value */
const MAX_IDENTIFIER_VALUE_LENGTH = 256;

/** Дефолтный whitelist разрешенных OAuth провайдеров */
const DEFAULT_OAUTH_PROVIDERS: ReadonlySet<string> = Object.freeze(
  new Set<string>(['google', 'yandex', 'facebook', 'vk']),
);

/** Допустимые типы MFA */
const VALID_MFA_TYPES: ReadonlySet<string> = Object.freeze(
  new Set<string>(['totp', 'sms', 'email', 'push']),
);

/** Разрешенные ключи для MfaInfo (strict shape) */
const MFA_INFO_ALLOWED_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>(['type', 'token', 'deviceId']),
);

/** Максимальная длина email (RFC 5321) */
const MAX_EMAIL_LENGTH = 320;

/**
 * Regex для базовой проверки формы email
 *
 * @note Это не полная RFC 5321 валидация, а basic shape validation
 * @note Допускает минимально валидные формы (например, "a@b.c")
 * @note Для production API boundary рекомендуется использовать Zod или специализированную библиотеку
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Regex для валидации phone формата (E.164: +[country code][number]) */
const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;

/** Разрешенные ключи для identifier (strict shape) */
const IDENTIFIER_ALLOWED_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>(['type', 'value']),
);

/** Поддерживаемые версии DTO */
const SUPPORTED_DTO_VERSIONS: ReadonlySet<string> = Object.freeze(
  new Set<string>(['1.0', '1.1']),
);

/** Разрешенные ключи для LoginRequest (базовые, без OAuth) */
const BASE_ALLOWED_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    'identifier',
    'dtoVersion',
    'password',
    'mfa',
    'clientContext',
    'rememberMe',
  ]),
);

/** Разрешенные ключи для LoginRequest (с OAuth полями) */
const OAUTH_ALLOWED_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    'identifier',
    'dtoVersion',
    'password',
    'mfa',
    'clientContext',
    'rememberMe',
    'provider',
    'providerToken',
  ]),
);

/* ============================================================================
 * 🔧 VALIDATION UTILITIES
 * ============================================================================
 */

/**
 * Проверяет, что объект не содержит лишних полей (strict shape validation)
 *
 * @param obj - Объект для проверки
 * @param allowedKeys - Множество разрешенных ключей
 * @returns true если объект содержит только разрешенные ключи
 */
function hasStrictShape(
  obj: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  const objKeys = Object.keys(obj);
  return objKeys.every((key) => allowedKeys.has(key));
}

/* ============================================================================
 * 🔧 VALIDATION HELPERS (для снижения Cognitive Complexity)
 * ============================================================================
 */

/** Результат валидации структуры identifier (discriminated union) */
type IdentifierStructureResult =
  | { isValid: true; type: LoginIdentifierType; value: string; }
  | { isValid: false; };

/** Валидирует базовую структуру identifier */
function validateIdentifierStructure(
  identifierObj: Record<string, unknown>,
): IdentifierStructureResult {
  // Проверка обязательных полей identifier
  if (!('type' in identifierObj) || !('value' in identifierObj)) {
    return { isValid: false };
  }

  // Проверка strict shape для identifier (только type и value)
  if (!hasStrictShape(identifierObj, IDENTIFIER_ALLOWED_KEYS)) {
    return { isValid: false };
  }

  // Проверка типа identifier.type (union-тип, не string)
  const identifierType = identifierObj['type'];
  if (
    identifierType !== 'email'
    && identifierType !== 'username'
    && identifierType !== 'phone'
    && identifierType !== 'oauth'
  ) {
    return { isValid: false };
  }

  // Проверка типа identifier.value (должен быть string)
  const identifierValue = identifierObj['value'];
  if (typeof identifierValue !== 'string') {
    return { isValid: false };
  }

  return {
    isValid: true,
    type: identifierType as LoginIdentifierType,
    value: identifierValue,
  };
}

/** Валидирует формат identifier value */
function validateIdentifierFormat(
  identifierType: string,
  identifierValue: string,
): boolean {
  // Проверка длины identifier.value
  if (
    identifierValue.length < MIN_IDENTIFIER_VALUE_LENGTH
    || identifierValue.length > MAX_IDENTIFIER_VALUE_LENGTH
  ) {
    return false;
  }

  // Format validation для email и phone
  if (identifierType === 'email') {
    // Basic shape validation (не полная RFC 5321 валидация)
    return identifierValue.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(identifierValue);
  }

  if (identifierType === 'phone') {
    return PHONE_E164_REGEX.test(identifierValue);
  }

  return true;
}

/** Результат валидации identifier (discriminated union) */
type IdentifierValidationResult =
  | { isValid: true; type: LoginIdentifierType; value: string; }
  | { isValid: false; };

/** Валидирует identifier структуру и формат */
function validateIdentifier(
  identifierObj: Record<string, unknown>,
): IdentifierValidationResult {
  const structure = validateIdentifierStructure(identifierObj);
  if (!structure.isValid) {
    return { isValid: false };
  }

  if (!validateIdentifierFormat(structure.type, structure.value)) {
    return { isValid: false };
  }

  return {
    isValid: true,
    type: structure.type,
    value: structure.value,
  };
}

/** Валидирует dtoVersion поле */
function validateDtoVersion(dtoVersion: unknown): boolean {
  return typeof dtoVersion === 'string' && SUPPORTED_DTO_VERSIONS.has(dtoVersion);
}

/**
 * Валидирует опциональные поля LoginRequest
 *
 * @note password опционален для всех типов identifier
 * @note Это intentional: поддерживаются следующие сценарии:
 *   - OAuth flow (password не требуется)
 *   - MFA-only authentication (password не требуется на этом этапе)
 *   - Passwordless login flows
 * @note Бизнес-логика валидации обязательности password должна быть в business logic layer
 */
function validateOptionalFields(
  obj: Record<string, unknown>,
): boolean {
  // dtoVersion должен быть поддерживаемой версией если присутствует
  if (
    ('dtoVersion' in obj && obj['dtoVersion'] !== undefined)
    && !validateDtoVersion(obj['dtoVersion'])
  ) {
    return false;
  }

  // password должен быть string если присутствует
  // @note password опционален (см. документацию функции выше)
  if (
    ('password' in obj && obj['password'] !== undefined)
    && typeof obj['password'] !== 'string'
  ) {
    return false;
  }

  // rememberMe должен быть boolean если присутствует
  if (
    ('rememberMe' in obj && obj['rememberMe'] !== undefined)
    && typeof obj['rememberMe'] !== 'boolean'
  ) {
    return false;
  }

  // clientContext должен быть объектом если присутствует
  // @note Intentional: clientContext не strict validated (может содержать произвольные поля)
  // @note Это позволяет клиентам передавать дополнительные контекстные данные
  // @note Для strict validation используйте Zod.strict() в API boundary layer
  const clientContext = obj['clientContext'];
  if (
    ('clientContext' in obj && clientContext !== undefined)
    && (clientContext === null || typeof clientContext !== 'object')
  ) {
    return false;
  }

  return true;
}

/** Валидирует MFA поле */
function validateMfaField(mfa: unknown): boolean {
  if (Array.isArray(mfa)) {
    return mfa.every((item) => {
      if (item === null || typeof item !== 'object') {
        return false;
      }

      return isValidMfaInfo(item as Record<string, unknown>);
    });
  }

  if (mfa === null || typeof mfa !== 'object') {
    return false;
  }

  return isValidMfaInfo(mfa as Record<string, unknown>);
}

/** Валидирует OAuth provider */
function validateOAuthProvider(
  provider: unknown,
  allowedOAuthProviders: ReadonlySet<string>,
): boolean {
  return (
    typeof provider === 'string'
    && provider.length > 0
    && allowedOAuthProviders.has(provider)
  );
}

/**
 * Валидирует OAuth providerToken
 *
 * @note Проверяет только базовую структуру (тип и длину)
 * @note Формат токена (JWT / opaque token / authorization code) не проверяется
 * @note Валидация формата и подписи должна выполняться в downstream layer
 *   (например, при проверке JWT signature в API boundary layer)
 */
function validateOAuthProviderToken(providerToken: unknown): boolean {
  return (
    typeof providerToken === 'string'
    && providerToken.length >= MIN_PROVIDER_TOKEN_LENGTH
    && providerToken.length <= MAX_PROVIDER_TOKEN_LENGTH
  );
}

/** Валидирует OAuth поля */
function validateOAuthFields(
  obj: Record<string, unknown>,
  allowedOAuthProviders: ReadonlySet<string>,
): boolean {
  const provider = obj['provider'];
  if (!validateOAuthProvider(provider, allowedOAuthProviders)) {
    return false;
  }

  const providerToken = obj['providerToken'];
  return validateOAuthProviderToken(providerToken);
}

/** Валидирует push MFA (обязателен deviceId, token отсутствует) */
function validatePushMfaInfo(mfaObj: Record<string, unknown>): boolean {
  // Для push: обязателен deviceId, token отсутствует
  if (!('deviceId' in mfaObj) || typeof mfaObj['deviceId'] !== 'string') {
    return false;
  }
  const deviceId = mfaObj['deviceId'];
  if (deviceId.length === 0) {
    return false;
  }
  // Проверка, что token отсутствует для push
  return !('token' in mfaObj);
}

/** Валидирует token-based MFA (totp/sms/email: обязателен token) */
function validateTokenBasedMfaInfo(mfaObj: Record<string, unknown>): boolean {
  // Для totp/sms/email: обязателен token
  if (!('token' in mfaObj) || typeof mfaObj['token'] !== 'string') {
    return false;
  }
  const token = mfaObj['token'];
  if (token.length === 0) {
    return false;
  }
  // deviceId опционален, но если присутствует - должен быть string
  if (
    ('deviceId' in mfaObj && mfaObj['deviceId'] !== undefined)
    && typeof mfaObj['deviceId'] !== 'string'
  ) {
    return false;
  }
  return true;
}

/**
 * Валидирует структуру MfaInfo (strict shape + типы)
 *
 * @param mfaObj - Объект MFA для валидации
 * @returns true если объект является валидным MfaInfo
 *
 * @warning Для полной schema validation используйте Zod.strict() в API boundary layer
 */
function isValidMfaInfo(mfaObj: Record<string, unknown>): boolean {
  // Проверка strict shape (только разрешенные ключи)
  if (!hasStrictShape(mfaObj, MFA_INFO_ALLOWED_KEYS)) {
    return false;
  }

  // Проверка обязательного поля type
  if (!('type' in mfaObj) || typeof mfaObj['type'] !== 'string') {
    return false;
  }

  const mfaType = mfaObj['type'];
  // Проверка допустимых значений type (union-тип)
  if (!VALID_MFA_TYPES.has(mfaType)) {
    return false;
  }

  // Discriminated union validation: push не имеет token, остальные требуют token
  return mfaType === 'push'
    ? validatePushMfaInfo(mfaObj)
    : validateTokenBasedMfaInfo(mfaObj);
}

/** Валидирует базовую структуру объекта и identifier */
function validateBaseStructure(
  value: unknown,
): { isValid: boolean; obj?: Record<string, unknown>; identifierType?: LoginIdentifierType; } {
  // Проверка базовой структуры: должен быть объект
  if (value === null || typeof value !== 'object') {
    return { isValid: false };
  }

  const obj = value as Record<string, unknown>;

  // Проверка обязательного поля identifier
  if (!('identifier' in obj)) {
    return { isValid: false };
  }

  const identifier = obj['identifier'];
  if (identifier === null || typeof identifier !== 'object') {
    return { isValid: false };
  }

  const identifierObj = identifier as Record<string, unknown>;
  const identifierValidation = validateIdentifier(identifierObj);
  if (!identifierValidation.isValid) {
    return { isValid: false };
  }

  return {
    isValid: true,
    obj,
    identifierType: identifierValidation.type,
  };
}

/** Валидирует strict shape и все поля LoginRequest */
function validateRequestFields(
  obj: Record<string, unknown>,
  identifierType: LoginIdentifierType,
  allowedOAuthProviders: ReadonlySet<string>,
): boolean {
  // Выбираем разрешенные ключи в зависимости от типа identifier (предвычисленные Sets)
  const allowedKeys = identifierType === 'oauth' ? OAUTH_ALLOWED_KEYS : BASE_ALLOWED_KEYS;

  // Проверка strict shape для основного объекта (защита от injection)
  if (!hasStrictShape(obj, allowedKeys)) {
    return false;
  }

  // Проверка опциональных полей
  if (!validateOptionalFields(obj)) {
    return false;
  }

  // Валидация MFA если присутствует
  if (
    ('mfa' in obj && obj['mfa'] !== undefined)
    && !validateMfaField(obj['mfa'])
  ) {
    return false;
  }

  // Валидация OAuth полей если тип oauth
  if (
    identifierType === 'oauth'
    && !validateOAuthFields(obj, allowedOAuthProviders)
  ) {
    return false;
  }

  return true;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Type guard для проверки валидности LoginRequest
 *
 * @param value - Значение для проверки (unknown для type safety)
 * @param allowedOAuthProviders - Whitelist разрешенных OAuth провайдеров (опционально)
 * @returns true если value является валидным LoginRequest
 *
 * @note Проверяет структуру, формат (email/phone), strict shape, MFA validation
 * @note OAuth whitelist инжектируется для гибкости
 *
 * @warning Production boundary layer: для полной schema-level exhaustiveness используйте
 * Zod.strict() или io-ts exact() в API boundary layer. Этот type guard обеспечивает
 * базовую runtime type safety, но не заменяет полноценную schema validation.
 *
 * @example
 * if (isValidLoginRequest(value, customOAuthProviders)) {
 *   // value теперь типизирован как LoginRequest
 *   value.identifier.type; // 'email' | 'username' | 'phone' | 'oauth'
 * }
 */
export function isValidLoginRequest(
  value: unknown,
  allowedOAuthProviders: ReadonlySet<string> = DEFAULT_OAUTH_PROVIDERS,
): value is LoginRequest<LoginIdentifierType> {
  const baseValidation = validateBaseStructure(value);
  if (
    !baseValidation.isValid
    || baseValidation.obj === undefined
    || baseValidation.identifierType === undefined
  ) {
    return false;
  }

  return validateRequestFields(
    baseValidation.obj,
    baseValidation.identifierType,
    allowedOAuthProviders,
  );
}
