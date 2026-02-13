/**
 * @file packages/feature-auth/src/effects/login/metadata-builders.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Metadata Builders (Pure Utilities)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистые утилиты для создания метаданных логина
 * - Extensible через builder registry pattern с injection
 * - Domain-pure, deterministic, microservice-ready
 *
 * Принципы:
 * - ✅ Чистые функции — без side-effects
 * - ✅ Deterministic — одинаковый вход → одинаковый выход (traceId обязателен)
 * - ✅ Domain-pure — только domain типы, без инфраструктурных зависимостей
 * - ✅ SRP — каждая функция имеет одну ответственность
 * - ✅ Extensible — расширяемость через builder registry с injection
 * - ✅ Security-first — PII хеширование через injection, нет raw значений
 * - ❌ Нет бизнес-логики → business logic layer
 * - ❌ Нет API calls → api-client layer
 * - ❌ Нет store operations → store layer
 * - ❌ Нет telemetry → observability layer
 * - ❌ Нет UUID generation → effect layer (orchestration)
 * - ❌ Нет хеширования → effect layer (security policy injection)
 *
 * @example
 * const metadata = buildLoginMetadata(
 *   { ...context, traceId: 'required-trace-id' },
 *   { identifierHasher: (v) => hmacSha256(v, secret) }
 * );
 */

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { LoginIdentifierType, LoginRequest } from '../../domain/LoginRequest.js';
import type { RiskLevel } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Проецированные данные оценки риска (без domain coupling) */
export type RiskMetadata = {
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly triggeredRuleIds: readonly string[];
};

/**
 * Контекст для создания метаданных логина
 * @note traceId обязателен для детерминированности
 * @note riskMetadata - проекция без domain coupling
 */
export type LoginContext = {
  /** Запрос на логин */
  readonly request: LoginRequest<LoginIdentifierType>;

  /** Trace ID для корреляции запросов (обязателен для детерминированности) */
  readonly traceId: string;

  /** Timestamp события (ISO 8601) - передается извне для детерминизма */
  readonly timestamp: string;

  /** Информация об устройстве (опционально, может отсутствовать на ранних этапах) */
  readonly deviceInfo?: DeviceInfo;

  /** Проецированные данные оценки риска (опционально) */
  readonly riskMetadata?: RiskMetadata;
};

/**
 * Типизированные метаданные логина
 * @note identifierHash вместо identifierValue (PII protection)
 */
export type LoginMetadata =
  | {
    readonly type: 'trace';
    readonly traceId: string;
    readonly spanId?: string;
  }
  | {
    readonly type: 'device';
    readonly deviceId: string;
    readonly deviceType: DeviceInfo['deviceType'];
    readonly os?: string;
    readonly browser?: string;
  }
  | {
    readonly type: 'risk';
    readonly riskScore: number;
    readonly riskLevel: RiskLevel;
    readonly triggeredRuleIds: readonly string[];
  }
  | {
    readonly type: 'identifier';
    readonly identifierType: LoginIdentifierType;
    readonly identifierHash: string;
  }
  | {
    readonly type: 'timestamp';
    readonly timestamp: string;
    readonly operation: 'login' | 'register' | 'oauth' | 'refresh';
  }
  | {
    readonly type: 'mfa';
    readonly mfaType: 'totp' | 'sms' | 'email' | 'push';
    readonly mfaRequired: boolean;
  };

/**
 * Builder функция для создания метаданных
 * @note Возвращает null если метаданные не должны быть созданы
 * @note Может возвращать массив для множественных метаданных (например, MFA)
 */
export type MetadataBuilder = (
  context: LoginContext,
) => LoginMetadata | LoginMetadata[] | null;

/**
 * Функция хеширования идентификатора (injection для security policy)
 * @note Должна быть криптографически стойкой (HMAC-SHA256)
 * @note Прокидывается из effect layer (security policy)
 */
export type IdentifierHasher = (value: string) => string;

/** Базовая конфигурация с hasher */
type MetadataConfigBase = Readonly<{
  readonly identifierHasher: IdentifierHasher;
}>;

/** Расширенная конфигурация с builders */
type MetadataConfigWithBuilders = Readonly<{
  readonly additionalBuilders?: readonly MetadataBuilder[];
}>;

/** Конфигурация для buildLoginMetadata */
export type MetadataConfig = MetadataConfigBase & MetadataConfigWithBuilders;

/* ============================================================================
 * 🔧 METADATA BUILDERS (Extensible Registry Pattern)
 * ============================================================================
 */

/** Builder для trace метаданных */
function buildTraceMetadata(context: LoginContext): LoginMetadata | null {
  return {
    type: 'trace',
    traceId: context.traceId,
  };
}

/** Builder для device метаданных */
function buildDeviceMetadata(context: LoginContext): LoginMetadata | null {
  if (context.deviceInfo === undefined) {
    return null;
  }

  return {
    type: 'device',
    deviceId: context.deviceInfo.deviceId,
    deviceType: context.deviceInfo.deviceType,
    ...(context.deviceInfo.os !== undefined && { os: context.deviceInfo.os }),
    ...(context.deviceInfo.browser !== undefined
      && { browser: context.deviceInfo.browser }),
  };
}

/** Builder для risk метаданных */
function buildRiskMetadata(context: LoginContext): LoginMetadata | null {
  if (context.riskMetadata === undefined) {
    return null;
  }

  const { riskLevel, riskScore, triggeredRuleIds } = context.riskMetadata;

  return {
    type: 'risk',
    riskScore,
    riskLevel,
    // Проекция: только IDs правил (всегда массив, даже если пустой)
    triggeredRuleIds,
  };
}

/** Builder для identifier метаданных (с PII хешированием через injection) */
function buildIdentifierMetadata(
  context: LoginContext,
  identifierHasher: IdentifierHasher,
): LoginMetadata | null {
  const { type, value } = context.request.identifier;

  return {
    type: 'identifier',
    identifierType: type,
    // Security: хешируем PII значение через injected hasher
    identifierHash: identifierHasher(value),
  };
}

/** Builder для timestamp метаданных */
function buildTimestampMetadata(context: LoginContext): LoginMetadata | null {
  return {
    type: 'timestamp',
    timestamp: context.timestamp,
    operation: 'login',
  };
}

/**
 * Builder для MFA метаданных
 *
 * @note Возвращает массив metadata для каждого MFA метода
 * @note Если MFA не требуется, возвращает null
 */
function buildMfaMetadata(context: LoginContext): LoginMetadata[] | null {
  const { mfa } = context.request;

  if (mfa === undefined) {
    // MFA не требуется - не создаем метаданные
    return null;
  }

  const mfaArray = Array.isArray(mfa) ? mfa : [mfa];

  if (mfaArray.length === 0) {
    return null;
  }

  // Создаем metadata для каждого MFA метода
  return mfaArray.map((mfaItem) => ({
    type: 'mfa' as const,
    mfaType: mfaItem.type,
    mfaRequired: true,
  }));
}

/** Создает функцию builder для identifier metadata с injected hasher */
function createIdentifierMetadataBuilder(
  identifierHasher: IdentifierHasher,
): MetadataBuilder {
  return (context: LoginContext) => buildIdentifierMetadata(context, identifierHasher);
}

/** Валидирует конфигурацию метаданных */
function validateMetadataConfig(config: unknown): asserts config is MetadataConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('config must be an object');
  }

  const cfg = config as Record<string, unknown>;
  if (typeof cfg['identifierHasher'] !== 'function') {
    throw new Error('identifierHasher must be a function');
  }
}

/**
 * Валидирует контекст логина
 * @note Полная boundary validation для защиты от невалидных данных
 */
function validateLoginContext(context: unknown): asserts context is LoginContext {
  if (typeof context !== 'object' || context === null) {
    throw new Error('context must be an object');
  }

  const ctx = context as Record<string, unknown>;
  if (typeof ctx['traceId'] !== 'string' || ctx['traceId'].length === 0) {
    throw new Error('context.traceId must be a non-empty string');
  }

  if (typeof ctx['timestamp'] !== 'string' || ctx['timestamp'].length === 0) {
    throw new Error('context.timestamp must be a non-empty string');
  }

  // Проверка обязательного поля request
  if (!('request' in ctx) || ctx['request'] === null || typeof ctx['request'] !== 'object') {
    throw new Error('context.request must be a valid LoginRequest object');
  }

  const request = ctx['request'] as Record<string, unknown>;
  if (
    !('identifier' in request)
    || request['identifier'] === null
    || typeof request['identifier'] !== 'object'
  ) {
    throw new Error('context.request.identifier must be a valid identifier object');
  }

  // Проверка структуры identifier (boundary protection)
  const identifier = request['identifier'] as Record<string, unknown>;
  if (!('type' in identifier) || typeof identifier['type'] !== 'string') {
    throw new Error('context.request.identifier.type must be a string');
  }

  if (!('value' in identifier) || typeof identifier['value'] !== 'string') {
    throw new Error('context.request.identifier.value must be a string');
  }
}

/**
 * Валидирует результат builder (минимальный guard для external builders)
 *
 * @note Минимальная валидация только для additionalBuilders
 * @note Internal builders (buildTraceMetadata и т.д.) не валидируются - они type-safe
 * @note Проверяет только allowed types и критичные поля (не полная schema validation)
 * @note Для полной schema validation используйте Zod в plugin system
 */
function validateBuilderResult(result: unknown): asserts result is LoginMetadata {
  if (typeof result !== 'object' || result === null) {
    throw new Error('Builder must return valid LoginMetadata or null');
  }

  const res = result as Record<string, unknown>;

  // Проверка обязательного поля type
  const type = res['type'];
  if (typeof type !== 'string') {
    throw new Error('Builder result must have a string type field');
  }

  // Проверка allowed types (structural guarantee)
  const allowedTypes: readonly string[] = [
    'trace',
    'device',
    'risk',
    'identifier',
    'timestamp',
    'mfa',
  ];
  if (!allowedTypes.includes(type)) {
    throw new Error(`Builder result type must be one of: ${allowedTypes.join(', ')}`);
  }

  // Минимальная проверка критичных полей (не полная schema validation)
  if (type === 'risk') {
    // Валидация RiskLevel union
    const validRiskLevels: readonly string[] = ['low', 'medium', 'high', 'critical'];
    if (typeof res['riskLevel'] !== 'string' || !validRiskLevels.includes(res['riskLevel'])) {
      throw new Error(`risk metadata riskLevel must be one of: ${validRiskLevels.join(', ')}`);
    }
  }
}

/** Создает и валидирует массив дополнительных builders */
function createAdditionalBuilders(
  additionalBuilders: unknown,
): readonly MetadataBuilder[] {
  if (additionalBuilders === undefined) {
    return [];
  }

  if (!Array.isArray(additionalBuilders)) {
    throw new Error('additionalBuilders must be an array');
  }

  // Валидация что все элементы - функции
  const validatedBuilders: MetadataBuilder[] = [];
  for (const builder of additionalBuilders) {
    // Валидация типа builder
    if (typeof builder !== 'function') {
      throw new Error('additionalBuilders must contain only functions');
    }
    validatedBuilders.push(builder);
  }

  return Object.freeze(validatedBuilders);
}

/**
 * Создает типизированные метаданные логина из контекста
 *
 * @param context - Контекст для создания метаданных (traceId обязателен)
 * @param config - Конфигурация с injected hasher и опциональными builders
 * @returns Массив типизированных метаданных (LoginMetadata[])
 *
 * @note Одинаковый контекст → одинаковые метаданные (traceId обязателен)
 * @note identifierHash через injected hasher (HMAC-SHA256 в effect layer)
 *
 * @example
 * const metadata = buildLoginMetadata(
 *   { ...context, traceId: 'required-trace-id' },
 *   { identifierHasher: (v) => hmacSha256(v, secret) }
 * );
 */
export function buildLoginMetadata(
  context: LoginContext,
  config: MetadataConfig,
): readonly LoginMetadata[] {
  // Валидация config и context
  validateMetadataConfig(config);
  validateLoginContext(context);

  // Создаем массив дополнительных builders
  const additionalBuilders = createAdditionalBuilders(config.additionalBuilders);

  // Создаем identifier builder с injected hasher
  const identifierBuilder = createIdentifierMetadataBuilder(config.identifierHasher);

  // Явный ordered array internal builders (не хрупкий slicing)
  // @note Порядок: trace, device, identifier, risk, timestamp, mfa
  const INTERNAL_BUILDERS: readonly MetadataBuilder[] = Object.freeze([
    buildTraceMetadata, // trace
    buildDeviceMetadata, // device
    identifierBuilder, // identifier (с injected hasher)
    buildRiskMetadata, // risk
    buildTimestampMetadata, // timestamp
    buildMfaMetadata, // mfa
  ]);

  // Объединяем internal и external builders
  const orderedBuilders: readonly MetadataBuilder[] = Object.freeze([
    ...INTERNAL_BUILDERS,
    ...additionalBuilders, // дополнительные builders
  ]);

  const internalBuildersCount = INTERNAL_BUILDERS.length;

  // Применяем все builders (результаты валидируются внутри applyBuilders)
  // eslint-disable-next-line ai-security/model-poisoning -- Все элементы валидируются через validateBuilderResult перед добавлением в metadata
  const metadata = applyBuilders(orderedBuilders, context, internalBuildersCount);

  // Freeze без лишней аллокации
  return Object.freeze(metadata);
}

/**
 * Применяет builders и собирает метаданные
 * @note Вынесено для снижения cognitive complexity
 * @note Все данные валидируются через validateBuilderResult перед добавлением
 */
function applyBuilders(
  builders: readonly MetadataBuilder[],
  context: LoginContext,
  internalBuildersCount: number,
): LoginMetadata[] {
  // Инициализация валидированного массива метаданных
  // eslint-disable-next-line ai-security/model-poisoning -- Все элементы валидируются через validateBuilderResult перед добавлением
  const metadata: LoginMetadata[] = [];

  let builderIndex = 0;
  for (const builder of builders) {
    const result = builder(context);
    if (result !== null) {
      // Валидация происходит внутри processBuilderResult перед добавлением в metadata
      processBuilderResult(result, metadata, builderIndex, internalBuildersCount);
    }
    builderIndex++;
  }

  return metadata;
}

/**
 * Обрабатывает результат builder (массив или одиночный элемент)
 * @note Вынесено для снижения cognitive complexity
 */
function processBuilderResult(
  result: LoginMetadata | LoginMetadata[],
  metadata: LoginMetadata[],
  builderIndex: number,
  internalBuildersCount: number,
): void {
  // Обработка массива результатов (для MFA builder)
  if (Array.isArray(result)) {
    for (const item of result) {
      // Валидация только для external builders (после internal)
      if (builderIndex >= internalBuildersCount) {
        validateBuilderResult(item);
      }
      // Валидированные данные добавляются в массив
      metadata.push(item);
    }
  } else {
    // Валидация только для external builders (после internal)
    if (builderIndex >= internalBuildersCount) {
      validateBuilderResult(result);
    }
    // Валидированные данные добавляются в массив
    metadata.push(result);
  }
}
