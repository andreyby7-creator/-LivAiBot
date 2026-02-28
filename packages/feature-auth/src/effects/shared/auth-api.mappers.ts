/**
 * @file packages/feature-auth/src/effects/shared/auth-api.mappers.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Shared API Mappers
 * ============================================================================
 *
 * Общие мэпперы для преобразования transport-слоя (schemas) в domain-слой.
 * Используются во всех auth-эффектах (login/register/refresh) для консистентности.
 *
 * Архитектурные решения:
 * - Pure functions: без side-effects, детерминированные
 * - Copy-on-write: создает копии массивов/объектов, не мутирует входные данные
 * - Immutability: Object.freeze для защиты от мутаций
 * - Safety boundary: валидация dynamic Record и массивов перед переносом в domain
 *
 * Инварианты:
 * - Не читает store (pure functions)
 * - Все коллекции копируются и замораживаются
 * - Валидация unsafe payload (plain object + primitive values only)
 *
 * ⚠️ Ограничения API (осознанный контракт):
 * - Dynamic Record (context, metadata): разрешены только примитивы (string, number, boolean, null)
 *   и массивы примитивов. Вложенные plain objects НЕ разрешены.
 * - Массивы (roles, permissions, scope): разрешены только строки (string).
 *   Объекты, числа, boolean и null в массивах НЕ разрешены.
 */

import type { MeResponse } from '../../domain/MeResponse.js';
import type { TokenPair } from '../../domain/TokenPair.js';
import type { LoginTokenPairValues, MeResponseValues } from '../../schemas/index.js';

/* ============================================================================
 * 🔧 INTERNAL HELPERS — VALIDATION & FREEZE
 * ============================================================================
 */

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
  value: unknown, // Значение для валидации
  label: string, // Метка для сообщения об ошибке
): asserts value is Record<string, unknown> { // Утверждает, что value является Record<string, unknown>
  if (!isPlainObject(value)) {
    throw new Error(`[auth-api.mappers] Unsafe ${label}: expected plain object`);
  }

  const ok = Object.values(value).every((v) => isSafePrimitive(v) || isSafePrimitiveArray(v));
  if (!ok) {
    throw new Error(
      `[auth-api.mappers] Unsafe ${label}: only primitive values or arrays of primitives are allowed`,
    );
  }
}

function freezeShallowRecord<T extends Record<string, unknown>>(
  record: T, // Записываемый объект для заморозки
): Readonly<T> { // Замороженная readonly копия
  return Object.freeze({ ...record });
}

/**
 * Валидирует и замораживает массив строк.
 * @note Fail-closed: выбрасывает ошибку если массив содержит не-строки (объекты, числа, функции и т.д.)
 */
function validateAndFreezeStringArray(
  value: unknown, // Значение для валидации
  label: string, // Метка для сообщения об ошибке
): readonly string[] { // Замороженный массив строк
  if (!Array.isArray(value)) {
    throw new Error(`[auth-api.mappers] Invalid ${label}: expected array`);
  }

  // После проверки Array.isArray TypeScript знает, что value - массив
  const arrayValue = value as unknown[];

  // Проверяем, что все элементы - строки
  const invalidIndices: number[] = [];
  for (let i = 0; i < arrayValue.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i валидируется через проверку длины массива
    const element = arrayValue[i];
    if (typeof element !== 'string') {
      invalidIndices.push(i);
    }
  }

  if (invalidIndices.length > 0) {
    throw new Error(
      `[auth-api.mappers] Unsafe ${label}: only string values are allowed in array, found non-string at indices: ${
        invalidIndices.join(', ')
      }`,
    );
  }

  // Создаем новый массив строк из валидированного массива
  const stringArray: string[] = [];
  for (let i = 0; i < arrayValue.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i валидируется через проверку длины массива, элемент уже проверен как string выше
    const element = arrayValue[i];
    if (typeof element === 'string') {
      stringArray.push(element);
    }
  }
  return Object.freeze(stringArray);
}

function validateAndFreezeRecordPayload(
  value: unknown, // Значение для валидации
  label: string, // Метка для сообщения об ошибке
): Readonly<Record<string, unknown>> { // Валидированный и замороженный Record
  validateSafeRecordPayload(value, label);
  return freezeShallowRecord(value);
}

function addIfDefined<K extends string, V>(
  key: K, // Ключ для записи
  value: V | undefined, // Значение (если undefined, возвращается пустой объект)
): Partial<Record<K, V>> { // Объект с ключом или пустой объект
  return value === undefined ? {} : { [key]: value } as Partial<Record<K, V>>;
}

/* ============================================================================
 * 🔧 INTERNAL HELPERS — ME RESPONSE MAPPING
 * ============================================================================
 */

function mapMeSessionValuesToDomain(
  session: Readonly<NonNullable<MeResponseValues['session']>>, // Значения сессии из transport-слоя
): NonNullable<MeResponse>['session'] { // Сессия в domain-формате
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
  user: Readonly<MeResponseValues['user']>, // Значения пользователя из transport-слоя
): MeResponse['user'] { // Пользователь в domain-формате
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

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

/**
 * Маппит LoginTokenPairValues (transport) в TokenPair (domain).
 * @note Выполняет copy-on-write для массивов/объектов и freeze результата.
 */
export function mapTokenPairValuesToDomain(
  tokenPair: Readonly<LoginTokenPairValues>, // Значения токенов из transport-слоя
): Readonly<TokenPair> { // TokenPair в domain-формате с readonly-массивами и Object.freeze
  const scope = tokenPair.scope !== undefined
    ? validateAndFreezeStringArray(tokenPair.scope, 'tokenPair.scope')
    : undefined;

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
export function mapMeResponseValuesToDomain(
  me: Readonly<MeResponseValues>, // Значения MeResponse из transport-слоя
): Readonly<MeResponse> { // MeResponse в domain-формате с readonly-массивами и Object.freeze
  const roles = validateAndFreezeStringArray(me.roles, 'me.roles');
  const permissions = validateAndFreezeStringArray(me.permissions, 'me.permissions');

  const session = me.session ? mapMeSessionValuesToDomain(me.session) : undefined;

  // features: Record<string, boolean> - строго типизированное поле, но валидируем для безопасности
  const features = me.features !== undefined
    ? ((): Readonly<Record<string, boolean>> => {
      if (!isPlainObject(me.features)) {
        throw new Error('[auth-api.mappers] Unsafe me.features: expected plain object');
      }
      // Валидация: все значения должны быть boolean (согласно схеме z.record(z.string(), z.boolean()))
      const invalidValues = Object.entries(me.features).filter(([, v]) => typeof v !== 'boolean');
      if (invalidValues.length > 0) {
        throw new Error(
          `[auth-api.mappers] Unsafe me.features: all values must be boolean, found: ${
            invalidValues.map(([k]) => k).join(', ')
          }`,
        );
      }
      return Object.freeze({ ...me.features }) as Readonly<Record<string, boolean>>;
    })()
    : undefined;

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
