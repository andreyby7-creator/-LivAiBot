/**
 * @file packages/domains/src/classification/signals/signals.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Signals & Context (Domain-Specific Signals)
 * ============================================================================
 * Domain-specific signals и context для classification domain.
 * Использует generic типы из @livai/core/domain-kit для type safety.
 * Архитектура: библиотека из 2 модулей в одном файле
 * - ClassificationSignals: типизированные сигналы классификации (internal + external)
 * - ClassificationContext: контекст для оценки классификации
 * Принципы:
 * - ✅ SRP: модульная структура (signals / context, разделение internal/external)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, timestamp передается извне
 * - ✅ Domain-pure: без side-effects, domain объявляет signals (НЕ core), использует generic типы
 * - ✅ Scalable: declarative структура, расширяется через spread без изменения кода
 * - ✅ Strict typing: union types, branded types через generic типы из core
 * - ✅ Security: runtime validation через type guards, защита от forged signals
 */

import type { Confidence, EvaluationLevel, EvaluationScale } from '@livai/core';

import { GEO_VALIDATION, SCORE_VALIDATION } from '../constants.js';
import type { ClassificationLabel } from '../labels.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION SIGNALS TYPES
 * ============================================================================
 */

/**
 * Геолокация для проверки impossible travel и географических аномалий
 * @public
 */
export type ClassificationGeo = Readonly<{
  /** Код страны (ISO 3166-1 alpha-2) */
  readonly country?: string;
  /** Регион/штат */
  readonly region?: string;
  /** Город */
  readonly city?: string;
  /** Широта (-90 до 90) */
  readonly lat?: number;
  /** Долгота (-180 до 180) */
  readonly lng?: number;
}>;

/**
 * Внутренние сигналы классификации (domain layer)
 * Используются для scoring и rule evaluation
 * @public
 */
export type InternalClassificationSignals = Readonly<{
  /** VPN обнаружен */
  readonly isVpn?: boolean;
  /** TOR сеть обнаружена */
  readonly isTor?: boolean;
  /** Proxy обнаружен */
  readonly isProxy?: boolean;
  /** ASN (Autonomous System Number) */
  readonly asn?: string;

  /**
   * Репутационный score
   * @range 0-100
   * @note Значения < 30 триггерят LOW_REPUTATION правило
   * @note Значения < 10 триггерят CRITICAL_REPUTATION правило
   */
  readonly reputationScore?: number;

  /**
   * Velocity score (аномалии скорости запросов)
   * @range 0-100
   * @note Значения > 70 триггерят HIGH_VELOCITY правило
   */
  readonly velocityScore?: number;

  /**
   * Предыдущая геолокация для проверки impossible travel
   * @note Используется для определения географических аномалий
   */
  readonly previousGeo?: ClassificationGeo;

  /**
   * Evaluation level для классификации (generic числовая шкала)
   * Используется для rule-engine evaluation через EvaluationOrder
   * @note Domain определяет scale и ordering через EvaluationScale и EvaluationOrder
   */
  readonly evaluationLevel?: EvaluationLevel<'classification'>;

  /**
   * Confidence для классификации (probability/uncertainty)
   * Используется для представления уверенности в классификации
   * @note Domain определяет стратегию комбинирования через ConfidenceCombiner
   */
  readonly confidence?: Confidence<'classification'>;
}>;

/**
 * Внешние сигналы от classification vendors (изолированы от domain)
 * Контракт:
 * - JSON-serializable (примитивы, массивы, объекты без циклических ссылок)
 * - Read-only (immutable)
 * - Детерминированные (одинаковый вход → одинаковый выход)
 * - Не влияют напрямую на правила (используются только для scoring)
 * @security Sanitization выполняется через sanitizeExternalSignals() из adapter layer (security boundary).
 *           Domain layer проверяет только семантику через validateClassificationSemantics().
 *           Не пробрасываются в DTO для безопасности
 * @public
 */
export type ExternalClassificationSignals = Readonly<Record<string, unknown>>;

/**
 * Типизированные сигналы классификации (internal + external)
 * Разделение internal/external для чистоты domain и безопасности
 * @public
 */
export type ClassificationSignals =
  & InternalClassificationSignals
  & Readonly<{
    /**
     * Внешние сигналы от classification vendors (изолированы от domain)
     * @see ExternalClassificationSignals для контракта
     */
    readonly externalSignals?: ExternalClassificationSignals;
  }>;

/* ============================================================================
 * 🧭 CLASSIFICATION CONTEXT TYPES
 * ============================================================================
 */

/**
 * Контекст для оценки классификации
 * @note timestamp передается извне (orchestrator) для детерминизма
 * @public
 */
export type ClassificationContext = Readonly<{
  /** IP адрес клиента (IPv4 или IPv6) */
  readonly ip?: string;

  /**
   * Геолокация (IP / GPS / provider)
   * @note Координаты могут быть замаскированы/округлены в facade layer для privacy
   */
  readonly geo?: ClassificationGeo;

  /** ID пользователя (может отсутствовать до идентификации) */
  readonly userId?: string;

  /** ID предыдущей сессии (если есть) */
  readonly previousSessionId?: string;

  /** Типизированные сигналы классификации */
  readonly signals?: ClassificationSignals;

  /** Timestamp события (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Classification label (результат классификации)
   * @note Может отсутствовать до выполнения классификации
   */
  readonly label?: ClassificationLabel;

  /**
   * Evaluation scale для classification evaluation level
   * @note Используется для валидации evaluationLevel в signals
   */
  readonly evaluationScale?: EvaluationScale<'classification'>;
}>;

/* ============================================================================
 * 🔧 TYPE ALIASES
 * ============================================================================
 */

/**
 * Type alias для параметра buildAssessment (используется в ContextBuilderPlugin)
 * @public
 */
export type BuildClassificationContext = Readonly<{
  readonly userId?: string;
  readonly ip?: string;
  readonly geo?: ClassificationGeo;
  readonly userAgent?: string;
  readonly previousSessionId?: string;
  readonly timestamp?: string;
  /** ReadonlyDeep защищает вложенные объекты (previousGeo, externalSignals) от мутаций плагинами */
  readonly signals?: ReadonlyDeep<ClassificationSignals>;
}>;

/**
 * Type alias для ReadonlyDeep (из type-fest)
 * @internal
 */
type ReadonlyDeep<T> = T extends object ? {
    readonly [P in keyof T]: ReadonlyDeep<T[P]>;
  }
  : T;

/* ============================================================================
 * 🔒 INTERNAL — CONSTANTS & TYPE GUARDS & VALIDATION
 * ============================================================================
 */

/**
 * Проверяет валидность координаты (lat или lng)
 * @internal
 */
function isValidCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= min
    && value <= max
  );
}

/**
 * Проверяет валидность строковых полей геолокации
 * @internal
 */
function isValidGeoStringFields(g: Record<string, unknown>): boolean {
  if (g['country'] !== undefined && typeof g['country'] !== 'string') {
    return false;
  }
  if (g['region'] !== undefined && typeof g['region'] !== 'string') {
    return false;
  }
  if (g['city'] !== undefined && typeof g['city'] !== 'string') {
    return false;
  }
  return true;
}

/**
 * Проверяет валидность координат геолокации
 * @internal
 */
function isValidGeoCoordinates(g: Record<string, unknown>): boolean {
  if (
    g['lat'] !== undefined
    && !isValidCoordinate(
      g['lat'],
      GEO_VALIDATION.MIN_LAT,
      GEO_VALIDATION.MAX_LAT,
    )
  ) {
    return false;
  }
  if (
    g['lng'] !== undefined
    && !isValidCoordinate(
      g['lng'],
      GEO_VALIDATION.MIN_LNG,
      GEO_VALIDATION.MAX_LNG,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Проверяет валидность геолокации (runtime validation)
 * @internal
 */
function isValidGeo(geo: unknown): geo is ClassificationGeo {
  if (typeof geo !== 'object' || geo === null) {
    return false;
  }

  const g = geo as Record<string, unknown>;

  if (!isValidGeoStringFields(g)) {
    return false;
  }

  if (!isValidGeoCoordinates(g)) {
    return false;
  }

  return true;
}

/**
 * Проверяет валидность score (0-100)
 * @internal
 */
function isValidScore(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= SCORE_VALIDATION.MIN_SCORE
    && value <= SCORE_VALIDATION.MAX_SCORE
  );
}

/**
 * Проверяет валидность boolean полей signals
 * @internal
 */
function isValidBooleanFields(s: Record<string, unknown>): boolean {
  if (s['isVpn'] !== undefined && typeof s['isVpn'] !== 'boolean') {
    return false;
  }
  if (s['isTor'] !== undefined && typeof s['isTor'] !== 'boolean') {
    return false;
  }
  if (s['isProxy'] !== undefined && typeof s['isProxy'] !== 'boolean') {
    return false;
  }
  return true;
}

/**
 * Проверяет валидность score полей signals
 * @internal
 */
function isValidScoreFields(s: Record<string, unknown>): boolean {
  if (s['reputationScore'] !== undefined && !isValidScore(s['reputationScore'])) {
    return false;
  }
  if (s['velocityScore'] !== undefined && !isValidScore(s['velocityScore'])) {
    return false;
  }
  return true;
}

/**
 * Проверяет валидность internal signals (runtime validation)
 * @internal
 */
function isValidInternalSignals(signals: unknown): signals is InternalClassificationSignals {
  if (typeof signals !== 'object' || signals === null) {
    return false;
  }

  const s = signals as Record<string, unknown>;

  if (!isValidBooleanFields(s)) {
    return false;
  }

  if (s['asn'] !== undefined && typeof s['asn'] !== 'string') {
    return false;
  }

  if (!isValidScoreFields(s)) {
    return false;
  }

  if (s['previousGeo'] !== undefined && !isValidGeo(s['previousGeo'])) {
    return false;
  }

  // evaluationLevel и confidence проверяются через branded types из core
  // (валидация выполняется при создании через evaluationLevel.create/confidence.create)

  return true;
}

/* ============================================================================
 * 🏗️ CLASSIFICATION SIGNALS — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Classification Signals value object: создание, валидация, утилиты
 * @public
 */
export const classificationSignals = {
  /**
   * Создает internal signals из объекта с валидацией
   * @returns Результат валидации или shallow copy для immutability
   * @note Возвращает shallow copy для защиты от мутаций исходного объекта
   *
   * @example
   * ```ts
   * const signals = classificationSignals.createInternal({
   *   isVpn: true,
   *   reputationScore: 45,
   * });
   * ```
   */
  createInternal(
    signals: unknown, // Объект для создания internal signals
  ): InternalClassificationSignals | null {
    if (!isValidInternalSignals(signals)) {
      return null;
    }
    // Shallow copy для защиты от мутаций исходного объекта
    return { ...signals };
  },

  /**
   * Создает external signals из объекта (без валидации структуры, только тип)
   * @note External signals не валидируются структурно (только тип Record<string, unknown>)
   *       Валидация выполняется в adapter layer через sanitizeExternalSignals()
   *       Проверяет только базовую структуру (plain object, не class instance)
   *       Возвращает shallow copy для полной защищенности от мутаций
   * @returns External signals или null если невалиден
   */
  createExternal(
    signals: unknown, // Объект для создания external signals
  ): ExternalClassificationSignals | null {
    if (typeof signals !== 'object' || signals === null) {
      return null;
    }
    // Проверяем, что это plain object (не class instance, не array, не Date, etc.)
    // Object.getPrototypeOf(null) throws, поэтому проверяем null выше
    if (Object.getPrototypeOf(signals) !== Object.prototype) {
      return null;
    }
    // Проверяем только базовую структуру (Record<string, unknown>)
    // Детальная валидация (depth, size, JSON serializability) выполняется в adapter layer
    // Shallow copy для полной защищенности от мутаций исходного объекта
    return { ...signals } as ExternalClassificationSignals;
  },

  /**
   * Извлекает internal signals из объекта используя whitelist keys
   * @internal
   */
  extractInternalSignals(s: Record<string, unknown>): Partial<InternalClassificationSignals> {
    return {
      ...(s['isVpn'] !== undefined && { isVpn: s['isVpn'] as boolean }),
      ...(s['isTor'] !== undefined && { isTor: s['isTor'] as boolean }),
      ...(s['isProxy'] !== undefined && { isProxy: s['isProxy'] as boolean }),
      ...(s['asn'] !== undefined && { asn: s['asn'] as string }),
      ...(s['reputationScore'] !== undefined
        && { reputationScore: s['reputationScore'] as number }),
      ...(s['velocityScore'] !== undefined && { velocityScore: s['velocityScore'] as number }),
      ...(s['previousGeo'] !== undefined && { previousGeo: s['previousGeo'] as ClassificationGeo }),
      ...(s['evaluationLevel'] !== undefined && {
        evaluationLevel: s['evaluationLevel'] as EvaluationLevel<'classification'>,
      }),
      ...(s['confidence'] !== undefined && {
        confidence: s['confidence'] as Confidence<'classification'>,
      }),
    };
  },

  /**
   * Создает полные signals (internal + external) из объекта с валидацией
   * @returns Результат валидации или shallow copy если валиден
   * @note Использует whitelist keys для security-correct извлечения internal signals
   *       Предотвращает silent data propagation и rule bypass через unknown keys
   */
  create(
    signals: unknown, // Объект для создания signals
  ): ClassificationSignals | null {
    if (typeof signals !== 'object' || signals === null) {
      return null;
    }

    const s = signals as Record<string, unknown>;

    // Whitelist keys для security-correct извлечения internal signals
    const internal = classificationSignals.extractInternalSignals(s);
    const internalSignals = classificationSignals.createInternal(internal);
    if (internalSignals === null) {
      return null;
    }

    const externalSignals = s['externalSignals'] !== undefined
      ? classificationSignals.createExternal(s['externalSignals'])
      : undefined;

    if (externalSignals === null && s['externalSignals'] !== undefined) {
      return null;
    }

    return {
      ...internalSignals,
      ...(externalSignals !== undefined && { externalSignals }),
    } as ClassificationSignals;
  },
} as const;

/* ============================================================================
 * 🏗️ CLASSIFICATION CONTEXT — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Валидирует одно строковое поле context
 * @internal
 */
function validateStringField(
  value: unknown,
): { value: string; } | null {
  if (value === undefined) {
    return null; // Поле отсутствует - не ошибка
  }
  if (typeof value !== 'string') {
    return null; // Ошибка валидации
  }
  return { value };
}

/**
 * Валидирует previousSessionId: должна быть непустая строка или undefined
 * Пустая строка считается невалидной
 * @internal
 */
function validatePreviousSessionId(
  value: unknown,
): { value: string; } | null {
  if (value === undefined) {
    return null; // Поле отсутствует - не ошибка
  }
  if (typeof value !== 'string') {
    return null; // Ошибка валидации: не строка
  }
  if (value.length === 0) {
    return null; // Ошибка валидации: пустая строка невалидна
  }
  return { value };
}

/**
 * Валидирует строковые поля context
 * @internal
 */
function validateContextStringFields(
  c: Record<string, unknown>,
): {
  ip?: string;
  userId?: string;
  previousSessionId?: string;
  timestamp?: string;
} | null {
  const ipResult = validateStringField(c['ip']);
  const userIdResult = validateStringField(c['userId']);
  const previousSessionIdResult = validatePreviousSessionId(c['previousSessionId']);
  const timestampResult = validateStringField(c['timestamp']);

  // Проверяем ошибки валидации (поле было, но невалидно)
  const hasIpError = c['ip'] !== undefined && ipResult === null;
  const hasUserIdError = c['userId'] !== undefined && userIdResult === null;
  const hasPreviousSessionIdError = c['previousSessionId'] !== undefined
    && previousSessionIdResult === null;
  const hasTimestampError = c['timestamp'] !== undefined && timestampResult === null;

  if (hasIpError || hasUserIdError || hasPreviousSessionIdError || hasTimestampError) {
    return null;
  }

  return {
    ...(ipResult !== null && { ip: ipResult.value }),
    ...(userIdResult !== null && { userId: userIdResult.value }),
    ...(previousSessionIdResult !== null && { previousSessionId: previousSessionIdResult.value }),
    ...(timestampResult !== null && { timestamp: timestampResult.value }),
  };
}

/**
 * Валидирует геолокацию в context
 * @internal
 */
function validateContextGeo(c: Record<string, unknown>): ClassificationGeo | undefined {
  const geo = c['geo'];
  if (geo !== undefined && !isValidGeo(geo)) {
    return undefined;
  }
  return geo;
}

/**
 * Валидирует signals в context
 * @internal
 */
function validateContextSignals(
  c: Record<string, unknown>,
): ClassificationSignals | null {
  const signals = c['signals'];
  if (signals === undefined) {
    return null; // null означает "не было поля", не ошибка
  }
  return classificationSignals.create(signals);
}

/**
 * Проверяет ошибки валидации сложных полей
 * @internal
 */
function hasComplexFieldsValidationErrors(
  c: Record<string, unknown>,
  geo: ClassificationGeo | undefined,
  validatedSignals: ClassificationSignals | null,
): boolean {
  if (geo === undefined && c['geo'] !== undefined) {
    return true; // Ошибка валидации geo
  }
  if (validatedSignals === null && c['signals'] !== undefined) {
    return true; // Ошибка валидации signals
  }
  return false;
}

/**
 * Валидирует сложные поля context (geo, signals)
 * @internal
 */
function validateContextComplexFields(
  c: Record<string, unknown>,
): {
  geo?: ClassificationGeo;
  signals?: ClassificationSignals;
} | null {
  const geo = validateContextGeo(c);
  const validatedSignals = validateContextSignals(c);

  if (hasComplexFieldsValidationErrors(c, geo, validatedSignals)) {
    return null;
  }

  return {
    ...(geo !== undefined && { geo }),
    ...(validatedSignals !== null && { signals: validatedSignals }),
  };
}

/**
 * Classification Context value object: создание, валидация, утилиты
 * @public
 */
export const classificationContext = {
  /**
   * Создает context из объекта с валидацией
   * @returns Результат валидации или исходный объект если валиден
   *
   * @example
   * ```ts
   * const context = classificationContext.create({
   *   ip: '192.168.1.1',
   *   geo: { country: 'US', lat: 40.7128, lng: -74.0060 },
   *   signals: { isVpn: true },
   * });
   * ```
   */
  create(
    context: unknown, // Объект для создания context
  ): ClassificationContext | null {
    if (typeof context !== 'object' || context === null) {
      return null;
    }

    const c = context as Record<string, unknown>;

    const stringFields = validateContextStringFields(c);
    if (stringFields === null) {
      return null;
    }

    const complexFields = validateContextComplexFields(c);
    if (complexFields === null) {
      return null;
    }

    // Извлечение branded types (валидация выполняется в core)
    const label = c['label'];
    const evaluationScale = c['evaluationScale'];

    // Создаем context только из валидированных полей (immutable approach)
    return {
      ...stringFields,
      ...complexFields,
      ...(label !== undefined && {
        // label валидируется через branded type из core/labels
        // (валидация выполняется при создании через classificationLabel.create)
        // ⚠️ Security assumption: Label<T> имеет runtime brand protection в core
        // Если Label<T> - только TS-brand без runtime проверки, возможен forged object
        // Это не баг этого файла, но security assumption, которое должно быть обеспечено в core
        label: label as ClassificationLabel,
      }),
      ...(evaluationScale !== undefined && {
        // evaluationScale валидируется через branded type из core
        // (валидация выполняется при создании через evaluationScale.create)
        evaluationScale: evaluationScale as EvaluationScale<'classification'>,
      }),
    } as ClassificationContext;
  },
} as const;
