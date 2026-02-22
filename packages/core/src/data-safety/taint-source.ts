/**
 * @file packages/core/src/data-safety/taint-source.ts
 * ============================================================================
 * 🛡️ CORE — Data Safety (Taint Source)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Input boundary: пометка внешних данных как tainted и повышение уровня доверия
 * - External → Trusted через валидацию и санитизацию
 * - Причина изменения: data safety, input boundary guards, trust promotion
 *
 * Принципы:
 * - ✅ SRP: разделение на HELPERS, INPUT BOUNDARY OPERATIONS, INPUT BOUNDARY INTERFACE
 * - ✅ Deterministic: pure functions для валидации и санитизации, детерминированное поведение
 * - ✅ Domain-pure: generic по типам значений, без привязки к domain-специфичным типам
 * - ✅ Extensible: InputBoundary интерфейс для различных источников без изменения core логики
 * - ✅ Strict typing: generic типы для всех операций, union types для SanitizationMode
 * - ✅ Microservice-ready: stateless, без side-effects, thread-safe
 * - ✅ Security: fail-hard при валидации, защита от covert channel (validator/sanitizer получают только чистые данные)
 *
 * ⚠️ ВАЖНО:
 * - Все внешние данные должны быть помечены через markAsExternal()
 * - Validator: fail-hard (выбрасывает Error)
 * - Sanitizer: pure и deterministic (без side-effects)
 */

import type { SanitizationMode } from './sanitization-mode.js';
import {
  defaultSanitizationModeRegistry,
  isSanitizationMode,
  sanitizationModes,
} from './sanitization-mode.js';
import type { Tainted, TaintMetadata, TaintSource } from './taint.js';
import {
  addTaint,
  createTaintMetadata,
  getTaintMetadata,
  isTainted,
  mergeTaintMetadata,
  stripTaint,
  taintSources,
} from './taint.js';
import type { TrustLevel, TrustLevelRegistry } from './trust-level.js';
import { defaultTrustLevelRegistry, meetTrust, trustLevels } from './trust-level.js';

/* ============================================================================
 * 1. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Обновляет taint metadata с новым уровнем доверия
 * @note Meet с targetTrustLevel для fail-closed, сохраняет source/timestamp
 * @internal
 */
function updateTaintMetadata(
  oldTaint: TaintMetadata, // Старый taint metadata
  targetTrustLevel: TrustLevel, // Целевой уровень доверия
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): TaintMetadata { // Обновленный taint metadata
  const mergedTrustLevel = meetTrust(oldTaint.trustLevel, targetTrustLevel, trustLevelRegistry);
  return mergeTaintMetadata(
    oldTaint,
    createTaintMetadata(oldTaint.source, mergedTrustLevel, oldTaint.timestamp),
    trustLevelRegistry,
  );
}

/**
 * Создает frozen tainted значение (high-throughput оптимизация)
 * @note Замораживает только metadata, не весь объект
 * @internal
 */
function createFrozenTainted<T>(
  value: T, // Значение для пометки taint
  taint: TaintMetadata, // Taint metadata
): Tainted<T> { // Frozen tainted значение
  const frozenTaint = Object.freeze(taint);
  return Object.freeze({
    ...value,
    __taint: frozenTaint,
  }) as Tainted<T>;
}

/* ============================================================================
 * 2. API — INPUT BOUNDARY OPERATIONS
 * ============================================================================
 */

/**
 * Помечает внешние данные как tainted (source=EXTERNAL)
 * @template T - Тип внешних данных
 * @example const userInput = markAsExternal({ name: "John" }); // userInput.__taint.source === taintSources.EXTERNAL
 * @public
 */
export function markAsExternal<T>(
  value: T, // Внешние данные для пометки
  trustLevel: TrustLevel = trustLevels.UNTRUSTED as TrustLevel, // Начальный уровень доверия (по умолчанию UNTRUSTED)
  timestamp?: number, // Опциональный timestamp (по умолчанию Date.now())
): Tainted<T> { // Tainted данные с source=EXTERNAL
  return addTaint(value, taintSources.EXTERNAL as TaintSource, trustLevel, timestamp);
}

/**
 * Валидирует tainted данные и повышает уровень доверия
 * @template T - Тип данных для валидации
 * @note После валидации данные получают targetTrustLevel (по умолчанию PARTIAL).
 *       Validator получает только чистые данные (без taint metadata) для защиты от covert channel.
 * @example const validated = validateAndPromote(userInput, (data) => { if (!data.name) throw new Error("Name required"); });
 * @throws {Error} Если валидация не прошла или данные не tainted
 * @public
 */
export function validateAndPromote<T>(
  value: Tainted<T>, // Tainted данные для валидации
  validator: (value: T) => void, // Функция валидации (fail-hard: выбрасывает Error)
  targetTrustLevel: TrustLevel = trustLevels.PARTIAL as TrustLevel, // Целевой уровень доверия (по умолчанию PARTIAL)
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): Tainted<T> { // Tainted данные с обновленным trustLevel
  if (!isTainted(value)) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Value must be tainted before validation');
  }

  // Валидируем данные без taint metadata (защита от covert channel)
  validator(stripTaint(value));

  // Получаем текущий taint metadata (гарантированно существует после isTainted проверки)
  const currentTaint = getTaintMetadata(value);
  if (currentTaint === undefined) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Taint metadata not found after validation check');
  }

  // Обновляем taint metadata с новым уровнем доверия
  const updatedTaint = updateTaintMetadata(currentTaint, targetTrustLevel, trustLevelRegistry);

  // Возвращаем данные с обновленным taint (оптимизированный freeze)
  return createFrozenTainted(value, updatedTaint);
}

/**
 * Санитизирует tainted данные и повышает уровень доверия
 * @template T - Тип данных для санитизации
 * @note После санитизации данные получают targetTrustLevel (по умолчанию TRUSTED).
 *       Sanitizer получает только чистые данные (без taint metadata) для защиты от covert channel.
 *       Режим санитизации валидируется, NONE пропускает санитизацию.
 * @example const sanitized = sanitizeAndPromote(validated, (data) => ({ ...data, name: escapeHtml(data.name) }));
 * @throws {Error} Если данные не tainted или sanitizationMode невалиден
 * @public
 */
export function sanitizeAndPromote<T>(
  value: Tainted<T>, // Tainted данные для санитизации
  sanitizer: (value: T) => T, // Функция санитизации (pure и deterministic)
  sanitizationMode: SanitizationMode = sanitizationModes.STRICT as SanitizationMode, // Режим санитизации (валидируется, NONE пропускает санитизацию)
  targetTrustLevel: TrustLevel = trustLevels.TRUSTED as TrustLevel, // Целевой уровень доверия (по умолчанию TRUSTED)
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): Tainted<T> { // Tainted данные с обновленным trustLevel
  if (!isTainted(value)) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Value must be tainted before sanitization');
  }

  // Получаем текущий taint metadata один раз (минимизация дублей для больших объектов)
  const currentTaint = getTaintMetadata(value);
  if (currentTaint === undefined) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('Taint metadata not found after sanitization check');
  }

  // Валидируем режим санитизации (fail-hard для безопасности)
  if (!isSanitizationMode(sanitizationMode, defaultSanitizationModeRegistry)) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(`Invalid sanitization mode: ${String(sanitizationMode)}`);
  }

  // Если режим NONE, пропускаем санитизацию (только для trusted данных)
  if (sanitizationMode === sanitizationModes.NONE) {
    const updatedTaint = updateTaintMetadata(currentTaint, targetTrustLevel, trustLevelRegistry);
    return createFrozenTainted(value, updatedTaint);
  }

  // Санитизируем данные без taint metadata (защита от covert channel)
  const sanitizedValue = sanitizer(stripTaint(value));

  // Обновляем taint metadata с новым уровнем доверия
  const updatedTaint = updateTaintMetadata(currentTaint, targetTrustLevel, trustLevelRegistry);

  // Возвращаем санитизированные данные с обновленным taint (оптимизированный freeze)
  return createFrozenTainted(sanitizedValue, updatedTaint);
}

/**
 * Валидирует и санитизирует tainted данные (комбинированная операция)
 * @template T - Тип данных для валидации и санитизации
 * @note Сначала валидация (PARTIAL), затем санитизация (TRUSTED)
 * @example const processed = validateAndSanitize(userInput, (data) => { if (!data.name) throw new Error("Name required"); }, (data) => ({ ...data, name: escapeHtml(data.name) }));
 * @throws {Error} Если валидация не прошла или данные не tainted
 * @public
 */
export function validateAndSanitize<T>(
  value: Tainted<T>, // Tainted данные для валидации и санитизации
  validator: (value: T) => void, // Функция валидации
  sanitizer: (value: T) => T, // Функция санитизации
  sanitizationMode: SanitizationMode = sanitizationModes.STRICT as SanitizationMode, // Режим санитизации (по умолчанию STRICT)
  targetTrustLevel: TrustLevel = trustLevels.TRUSTED as TrustLevel, // Целевой уровень доверия (по умолчанию TRUSTED)
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): Tainted<T> { // Tainted данные с обновленным trustLevel
  const validated = validateAndPromote(
    value,
    validator,
    trustLevels.PARTIAL as TrustLevel,
    trustLevelRegistry,
  );

  return sanitizeAndPromote(
    validated,
    sanitizer,
    sanitizationMode,
    targetTrustLevel,
    trustLevelRegistry,
  );
}

/* ============================================================================
 * 3. INPUT BOUNDARY INTERFACE — EXTENSIBILITY
 * ============================================================================
 */

/**
 * Generic InputBoundary интерфейс для различных источников (API, file upload, db input)
 * @template T - Тип данных для boundary
 * @note Переиспользование логики без дублирования кода
 * @example const apiBoundary: InputBoundary<ApiRequest> = { taintSource: taintSources.EXTERNAL, mark: markAsExternal, validate: validateAndPromote, sanitize: sanitizeAndPromote }; const processed = apiBoundary.sanitize(apiBoundary.validate(apiBoundary.mark(apiRequest), apiValidator), apiSanitizer);
 * @public
 */
export interface InputBoundary<T> {
  /** Источник taint для данного boundary */
  readonly taintSource: TaintSource;
  /** Помечает данные как tainted */
  mark(value: T, trustLevel?: TrustLevel, timestamp?: number): Tainted<T>;
  /** Валидирует tainted данные и повышает уровень доверия */
  validate(
    value: Tainted<T>,
    validator: (value: T) => void,
    targetTrustLevel?: TrustLevel,
  ): Tainted<T>;
  /** Санитизирует tainted данные и повышает уровень доверия */
  sanitize(
    value: Tainted<T>,
    sanitizer: (value: T) => T,
    sanitizationMode?: SanitizationMode,
    targetTrustLevel?: TrustLevel,
  ): Tainted<T>;
}

/**
 * Создает InputBoundary для внешних источников (EXTERNAL)
 * @template T - Тип данных для boundary
 * @note Базовая реализация для API и пользовательского ввода
 * @public
 */
export function createExternalInputBoundary<T>(): InputBoundary<T> { // InputBoundary для внешних источников
  return {
    taintSource: taintSources.EXTERNAL as TaintSource,
    mark: (value, trustLevel, timestamp) => markAsExternal(value, trustLevel, timestamp),
    validate: (value, validator, targetTrustLevel) =>
      validateAndPromote(value, validator, targetTrustLevel),
    sanitize: (value, sanitizer, sanitizationMode, targetTrustLevel) =>
      sanitizeAndPromote(value, sanitizer, sanitizationMode, targetTrustLevel),
  };
}
