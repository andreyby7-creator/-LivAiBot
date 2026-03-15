/**
 * @file packages/feature-auth/src/effects/register/register-audit.mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Register Audit Event Mapper
 * ============================================================================
 *
 * Архитектурная роль:
 * - Pure mapper из результата register-effect + контекста в AuditEventValues.
 * - Инкапсулирует форму audit-событий, чтобы orchestrator не знал про структуру аудита.
 *
 * Принципы:
 * - ❌ Нет бизнес-логики, только проекция данных.
 * - ✅ Использует auditEventSchema для валидации (fail-closed на уровне схемы).
 * - ✅ Immutable возвращаемые объекты.
 * - ✅ Табличный подход (mapping table) для масштабируемости без увеличения cyclomatic complexity.
 * @note Контекст должен быть подготовлен на уровне orchestrator (flattened, валидированный, очищенный от null/empty).
 *       Не строить контекст внутри маппера, это нарушает SRP и увеличивает coupling.
 */

import { z } from 'zod';

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { RegisterIdentifierType, RegisterRequest } from '../../dto/RegisterRequest.js';
import type { RegisterResponse } from '../../dto/RegisterResponse.js';
import type { AuditEventValues } from '../../schemas/index.js';
import { auditEventSchema } from '../../schemas/index.js';
import type { AuthError } from '../../types/auth.js';

/* ============================================================================
 * 🔧 INTERNAL HELPERS — ERROR SANITIZATION
 * ========================================================================== */

/**
 * Возвращает безопасный для аудита error code.
 * @remarks Для audit используем только `AuthError.kind` (без message/raw/stack).
 */
function getAuditSafeErrorCode(error: AuthError): string {
  return error.kind;
}

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Публичный результат register-effect (структурно совместим с RegisterResult из register.ts). */
export type RegisterResultForAudit =
  | Readonly<{ type: 'success'; userId: string; }>
  | Readonly<{ type: 'mfa_required'; userId: string; }>
  | Readonly<{ type: 'error'; error: AuthError; }>;

/**
 * Контекст для построения audit-события.
 * @remarks Flattened контекст; отсутствующие значения моделируются как `T | undefined`.
 */
export type RegisterAuditContext = Readonly<{
  /** Доменный результат регистрации (для получения sessionId, если нужно). */
  domainResult: RegisterResponse | undefined;
  /** Timestamp события (ISO 8601). */
  timestamp: string;
  /** Correlation / trace ID для трассировки (опционально). */
  traceId: string | undefined;
  /** Уникальный идентификатор события (генерируется в orchestrator для детерминизма в тестах). */
  eventId: string;
  /** IP адрес клиента (flattened из request.clientContext, должен быть очищен от null/empty на уровне orchestrator). */
  ip: string | undefined;
  /** User-Agent клиента (flattened из request.clientContext, должен быть очищен от null/empty на уровне orchestrator). */
  userAgent: string | undefined;
  /** Идентификатор устройства (flattened из metadata, должен быть очищен от null/empty на уровне orchestrator). */
  deviceId: string | undefined;
  /** Геолокация (flattened из metadata, должна быть валидирована на уровне orchestrator). */
  geo: { readonly lat?: number; readonly lng?: number; } | undefined;
  /** Тип регистрации (email/username/phone/oauth). */
  registrationType: 'email' | 'username' | 'phone' | 'oauth' | undefined;
  /** OAuth провайдер (только для OAuth регистрации). */
  oauthProvider: string | undefined;
}>;

/* ============================================================================
 * 🔧 CONTEXT BUILDER — ПОСТРОЕНИЕ AUDIT КОНТЕКСТА
 * ============================================================================
 */

/**
 * Контекст для построения register metadata (используется для создания audit context).
 */
type RegisterContext = {
  readonly request: RegisterRequest<RegisterIdentifierType>;
  readonly traceId: string;
  readonly timestamp: string;
};

/**
 * Создает flattened RegisterAuditContext из registerContext и domainResult.
 * @remarks Exported для orchestrator; маппер не строит контекст сам.
 */
export function createRegisterAuditContext(
  registerContext: RegisterContext,
  originalRequest: RegisterRequest<RegisterIdentifierType>,
  domainResult: RegisterResponse | undefined,
  eventId: string,
  deviceInfo?: DeviceInfo | undefined,
): RegisterAuditContext {
  return {
    domainResult,
    timestamp: registerContext.timestamp,
    traceId: registerContext.traceId,
    eventId,
    ip: originalRequest.clientContext?.ip,
    userAgent: originalRequest.clientContext?.userAgent,
    deviceId: deviceInfo?.deviceId ?? originalRequest.clientContext?.deviceId,
    geo: deviceInfo?.geo !== undefined
      ? {
        lat: deviceInfo.geo.lat,
        lng: deviceInfo.geo.lng,
      }
      : originalRequest.clientContext?.geo,
    registrationType: originalRequest.identifier.type,
    oauthProvider: originalRequest.identifier.type === 'oauth'
      ? originalRequest.provider
      : undefined,
  };
}

/* ============================================================================
 * 🔧 CONSTANTS & VALIDATION
 * ============================================================================
 */

/** Минимальная широта (стандартный диапазон координат). */
const MIN_LATITUDE = -90;
/** Максимальная широта (стандартный диапазон координат). */
const MAX_LATITUDE = 90;
/** Минимальная долгота (стандартный диапазон координат). */
const MIN_LONGITUDE = -180;
/** Максимальная долгота (стандартный диапазон координат). */
const MAX_LONGITUDE = 180;

/**
 * Схема валидации geo координат для защиты от garbage данных.
 * @remarks lat: [-90..90], lng: [-180..180]
 */
const geoCoordinateSchema = z.object({
  lat: z.number().min(MIN_LATITUDE).max(MAX_LATITUDE).optional(),
  lng: z.number().min(MIN_LONGITUDE).max(MAX_LONGITUDE).optional(),
}).strict();

/* ============================================================================
 * 🔧 HELPERS
 * ============================================================================
 */

/**
 * Извлекает sessionId из domainResult для success событий.
 * @remarks sessionId обычно доступен только при наличии данных /me.
 */
function extractSessionId(context: RegisterAuditContext): string | undefined {
  const domain = context.domainResult;
  if (domain?.tokenPair !== undefined) {
    // sessionId может быть в clientContext или в MeResponse (если /me вызывался)
    // Для register обычно sessionId не доступен сразу, но оставляем для расширяемости
    return domain.clientContext?.sessionId;
  }
  return undefined;
}

/** Фильтрует строковое поле: только непустые строки. */
function filterNonEmptyString(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== '' ? value : undefined;
}

/** Валидирует и нормализует geo координаты. */
function validateAndNormalizeGeo(
  geo: { readonly lat?: number; readonly lng?: number; } | undefined,
): AuditEventValues['geo'] {
  if (geo === undefined) {
    return undefined;
  }

  const validationResult = geoCoordinateSchema.safeParse(geo);
  if (!validationResult.success) {
    // Если валидация не прошла, geo остается undefined (fail-closed: игнорируем garbage)
    return undefined;
  }

  const validated = validationResult.data;
  if (validated.lat === undefined && validated.lng === undefined) {
    return undefined;
  }

  return {
    ...(validated.lat !== undefined ? { lat: validated.lat } : {}),
    ...(validated.lng !== undefined ? { lng: validated.lng } : {}),
  };
}

/**
 * Фильтрует и валидирует base event поля (IP, User-Agent, geo) для защиты от null/empty и garbage данных.
 * @remarks Фильтрует пустые строки и валидирует geo (garbage → undefined).
 */
function buildBaseEvent(context: RegisterAuditContext): Partial<AuditEventValues> {
  const ip = filterNonEmptyString(context.ip);
  const userAgent = filterNonEmptyString(context.userAgent);
  const deviceId = filterNonEmptyString(context.deviceId);
  const geo = validateAndNormalizeGeo(context.geo);

  return {
    eventId: context.eventId,
    timestamp: context.timestamp,
    ...(ip !== undefined ? { ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(geo !== undefined ? { geo } : {}),
    ...(context.traceId !== undefined ? { correlationId: context.traceId } : {}),
  };
}

/**
 * Строит context object для audit события (provider/registrationType).
 * @remarks Всегда возвращает объект (возможно пустой).
 */
function buildEventContext(
  context: RegisterAuditContext,
  errorCode?: string,
): Record<string, unknown> {
  const isOAuth = context.registrationType === 'oauth';
  const eventContext: Record<string, unknown> = {};

  if (errorCode !== undefined) {
    eventContext['error'] = errorCode;
  }

  if (isOAuth && context.oauthProvider !== undefined && context.oauthProvider.trim() !== '') {
    eventContext['provider'] = context.oauthProvider;
  }

  if (!isOAuth && context.registrationType !== undefined) {
    eventContext['registrationType'] = context.registrationType;
  }

  return eventContext;
}

/* ============================================================================
 * 🔧 MAPPING TABLE — EVENT TYPE MAPPING
 * ============================================================================
 */

/**
 * Таблица маппинга типов результата регистрации в типы audit событий.
 * @note Табличный подход (проще расширять без switch).
 */
const eventTypeMapping = {
  success: 'oauth_register_success',
  mfa_required: 'mfa_challenge',
  error: 'oauth_register_failure',
} as const satisfies Record<RegisterResultForAudit['type'], AuditEventValues['type']>;

/* ============================================================================
 * 🔧 MAPPING TABLE — EVENT BUILDERS
 * ============================================================================
 */

/**
 * Таблица builder'ов для построения специфичных полей каждого типа события.
 * @note Каждый builder возвращает Partial<AuditEventValues> для своего типа.
 */
const eventBuilders = {
  success: (context: RegisterAuditContext, result: RegisterResultForAudit) => {
    if (result.type !== 'success') {
      throw new Error('[register-audit.mapper] Invalid result type for success builder');
    }

    const sessionId = extractSessionId(context);
    const eventContext = buildEventContext(context);
    // Проверяем наличие свойств через явную проверку ключей (избегаем Object.keys для context-leakage safety)
    const hasContext = 'error' in eventContext
      || 'provider' in eventContext
      || 'registrationType' in eventContext;

    // Явное создание объекта без spread для eventContext (избегает context-leakage warnings)
    const auditResult: Partial<AuditEventValues> = {
      userId: result.userId,
    };
    if (sessionId !== undefined) {
      auditResult.sessionId = sessionId;
    }
    if (hasContext) {
      auditResult.context = eventContext;
    }
    // eslint-disable-next-line @livai/rag/source-citation -- это локальный объект, не RAG response
    return auditResult;
  },

  mfa_required: (context: RegisterAuditContext, result: RegisterResultForAudit) => {
    if (result.type !== 'mfa_required') {
      throw new Error('[register-audit.mapper] Invalid result type for mfa_required builder');
    }

    const eventContext = buildEventContext(context);
    // Проверяем наличие свойств через явную проверку ключей (избегаем Object.keys для context-leakage safety)
    const hasContext = 'error' in eventContext
      || 'provider' in eventContext
      || 'registrationType' in eventContext;

    // Явное создание объекта без spread для eventContext (избегает context-leakage warnings)
    const auditResult: Partial<AuditEventValues> = {
      userId: result.userId,
    };
    if (hasContext) {
      auditResult.context = eventContext;
    }
    // eslint-disable-next-line @livai/rag/source-citation -- это локальный объект, не RAG response
    return auditResult;
  },

  error: (context: RegisterAuditContext, result: RegisterResultForAudit) => {
    if (result.type !== 'error') {
      throw new Error('[register-audit.mapper] Invalid result type for error builder');
    }

    const errorCode = getAuditSafeErrorCode(result.error);
    const eventContext = buildEventContext(context, errorCode);
    // Проверяем наличие свойств через явную проверку ключей (избегаем Object.keys для context-leakage safety)
    const hasContext = 'error' in eventContext
      || 'provider' in eventContext
      || 'registrationType' in eventContext;

    // Явное создание объекта без spread для eventContext (избегает context-leakage warnings)
    const auditResult: Partial<AuditEventValues> = {
      errorCode,
    };
    if (hasContext) {
      auditResult.context = eventContext;
    }
    // eslint-disable-next-line @livai/rag/source-citation -- это локальный объект, не RAG response
    return auditResult;
  },
} as const satisfies Record<
  RegisterResultForAudit['type'],
  (context: RegisterAuditContext, result: RegisterResultForAudit) => Partial<AuditEventValues>
>;

/**
 * @internal
 * Тестовые helper'ы для unit-тестов eventBuilders.
 * Не использовать в runtime-коде.
 */
export const testSuccessEventBuilder = eventBuilders.success;
export const testMfaEventBuilder = eventBuilders.mfa_required;
export const testErrorEventBuilder = eventBuilders.error;

/* ============================================================================
 * 🗺️ RESULT MAPPING — ТАБЛИЧНЫЙ ПОДХОД ДЛЯ ОБРАБОТКИ РЕЗУЛЬТАТОВ
 * ============================================================================
 */

/**
 * Маппинг domain RegisterResponse в RegisterResultForAudit.
 * @note Табличный подход (унификация и расширяемость).
 */
const domainResultToAuditResult = {
  success: (domainResult: RegisterResponse): RegisterResultForAudit | null => {
    if (domainResult.tokenPair !== undefined) {
      return {
        type: 'success',
        userId: domainResult.userId,
      };
    }
    return null;
  },
  mfa_required: (domainResult: RegisterResponse): RegisterResultForAudit | null => {
    if (domainResult.mfaRequired) {
      return {
        type: 'mfa_required',
        userId: domainResult.userId,
      };
    }
    return null;
  },
} as const satisfies {
  readonly success: (domainResult: RegisterResponse) => RegisterResultForAudit | null;
  readonly mfa_required: (domainResult: RegisterResponse) => RegisterResultForAudit | null;
};

/**
 * Преобразует domain RegisterResponse в RegisterResultForAudit.
 * @note Fail-closed: если нет ни tokenPair, ни mfaRequired=true — это невалидное состояние.
 */
export function mapDomainResultToAuditResult(
  domainResult: RegisterResponse,
): RegisterResultForAudit {
  // Пробуем success (приоритет выше, так как tokenPair означает успешную регистрацию)
  const successResult = domainResultToAuditResult.success(domainResult);
  if (successResult !== null) {
    // eslint-disable-next-line @livai/rag/source-citation -- Это локальное преобразование типов, не RAG response
    return successResult;
  }
  // Пробуем mfa_required
  const mfaResult = domainResultToAuditResult.mfa_required(domainResult);
  if (mfaResult !== null) {
    // eslint-disable-next-line @livai/rag/source-citation -- Это локальное преобразование типов, не RAG response
    return mfaResult;
  }
  // Fail-closed: если нет ни tokenPair, ни mfaRequired, это невалидное состояние
  throw new Error(
    `[register] Invalid RegisterResponse: must have either tokenPair or mfaRequired=true, got: ${
      JSON.stringify({
        userId: domainResult.userId,
        mfaRequired: domainResult.mfaRequired,
      })
    }`,
  );
}

/**
 * Преобразует RegisterResultForAudit в публичный результат.
 * @remarks Сейчас это identity mapping; оставлено как явная точка расширения.
 */
export function mapAuditResultToPublicResult(
  auditResult: RegisterResultForAudit,
): RegisterResultForAudit {
  // eslint-disable-next-line @livai/rag/source-citation -- Это локальное преобразование типов, не RAG response
  return auditResult;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Маппит RegisterResult + контекст в AuditEventValues и валидирует через auditEventSchema.
 * @note Fail-closed: несоответствие схеме → исключение.
 * @note Deterministic: eventId приходит извне (orchestrator).
 * @throws ZodError если собранное событие не соответствует схеме (architectural bug).
 */
export function mapRegisterResultToAuditEvent(
  result: RegisterResultForAudit,
  context: RegisterAuditContext,
): AuditEventValues {
  const baseEvent = buildBaseEvent(context);
  const eventType = eventTypeMapping[result.type];
  // TypeScript гарантирует, что все ключи RegisterResultForAudit['type'] присутствуют в eventBuilders
  const builder = eventBuilders[result.type];
  const specificFields = builder(context, result);

  const event: Partial<AuditEventValues> = {
    ...baseEvent,
    type: eventType,
    ...specificFields,
  };

  return auditEventSchema.parse(event);
}
