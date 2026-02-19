/**
 * @file packages/core/src/data-safety/taint-source.ts
 * ============================================================================
 * 🛡️ CORE — Taint Source (Input Boundary)
 * ============================================================================
 *
 * Input boundary: пометка внешних данных как tainted и повышение уровня доверия.
 * External → Trusted через валидацию и санитизацию.
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
 * 🔧 UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Обновляет taint metadata с новым уровнем доверия
 * Meet с targetTrustLevel для fail-closed, сохраняет source/timestamp.
 *
 * @internal
 */
function updateTaintMetadata(
  oldTaint: TaintMetadata,
  targetTrustLevel: TrustLevel,
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry,
): TaintMetadata {
  const mergedTrustLevel = meetTrust(oldTaint.trustLevel, targetTrustLevel, trustLevelRegistry);
  return mergeTaintMetadata(
    oldTaint,
    createTaintMetadata(oldTaint.source, mergedTrustLevel, oldTaint.timestamp),
    trustLevelRegistry,
  );
}

/**
 * Создает frozen tainted значение (high-throughput оптимизация)
 * Замораживает только metadata, не весь объект.
 *
 * @internal
 */
function createFrozenTainted<T>(
  value: T,
  taint: TaintMetadata,
): Tainted<T> {
  const frozenTaint = Object.freeze(taint);
  return Object.freeze({
    ...value,
    __taint: frozenTaint,
  }) as Tainted<T>;
}

/* ============================================================================
 * 🎯 INPUT BOUNDARY OPERATIONS
 * ============================================================================
 */

/**
 * Помечает внешние данные как tainted (source=EXTERNAL)
 *
 * @param value - Внешние данные для пометки
 * @param trustLevel - Начальный уровень доверия (по умолчанию UNTRUSTED)
 * @param timestamp - Опциональный timestamp (по умолчанию Date.now())
 * @returns Tainted данные с source=EXTERNAL
 *
 * @example
 * ```ts
 * const userInput = markAsExternal({ name: "John" });
 * // userInput.__taint.source === taintSources.EXTERNAL
 * ```
 */
export function markAsExternal<T>(
  value: T,
  trustLevel: TrustLevel = trustLevels.UNTRUSTED as TrustLevel,
  timestamp?: number,
): Tainted<T> {
  return addTaint(value, taintSources.EXTERNAL as TaintSource, trustLevel, timestamp);
}

/**
 * Валидирует tainted данные и повышает уровень доверия
 * После валидации данные получают targetTrustLevel (по умолчанию PARTIAL).
 * Validator получает только чистые данные (без taint metadata) для защиты от covert channel.
 *
 * @param value - Tainted данные для валидации
 * @param validator - Функция валидации (fail-hard: выбрасывает Error)
 * @param targetTrustLevel - Целевой уровень доверия (по умолчанию PARTIAL)
 * @param trustLevelRegistry - Registry уровней доверия
 * @returns Tainted данные с обновленным trustLevel
 *
 * @throws {Error} Если валидация не прошла или данные не tainted
 *
 * @example
 * ```ts
 * const validated = validateAndPromote(
 *   userInput,
 *   (data) => { if (!data.name) throw new Error("Name required"); }
 * );
 * ```
 */
export function validateAndPromote<T>(
  value: Tainted<T>,
  validator: (value: T) => void,
  targetTrustLevel: TrustLevel = trustLevels.PARTIAL as TrustLevel,
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry,
): Tainted<T> {
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
 * После санитизации данные получают targetTrustLevel (по умолчанию TRUSTED).
 * Sanitizer получает только чистые данные (без taint metadata) для защиты от covert channel.
 *
 * @param value - Tainted данные для санитизации
 * @param sanitizer - Функция санитизации (pure и deterministic)
 * @param sanitizationMode - Режим санитизации (валидируется, NONE пропускает санитизацию)
 * @param targetTrustLevel - Целевой уровень доверия (по умолчанию TRUSTED)
 * @param trustLevelRegistry - Registry уровней доверия
 * @returns Tainted данные с обновленным trustLevel
 *
 * @throws {Error} Если данные не tainted или sanitizationMode невалиден
 *
 * @example
 * ```ts
 * const sanitized = sanitizeAndPromote(
 *   validated,
 *   (data) => ({ ...data, name: escapeHtml(data.name) })
 * );
 * ```
 */
export function sanitizeAndPromote<T>(
  value: Tainted<T>,
  sanitizer: (value: T) => T,
  sanitizationMode: SanitizationMode = sanitizationModes.STRICT as SanitizationMode,
  targetTrustLevel: TrustLevel = trustLevels.TRUSTED as TrustLevel,
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry,
): Tainted<T> {
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
 * Сначала валидация (PARTIAL), затем санитизация (TRUSTED).
 *
 * @param value - Tainted данные для валидации и санитизации
 * @param validator - Функция валидации
 * @param sanitizer - Функция санитизации
 * @param sanitizationMode - Режим санитизации (по умолчанию STRICT)
 * @param targetTrustLevel - Целевой уровень доверия (по умолчанию TRUSTED)
 * @param trustLevelRegistry - Registry уровней доверия
 * @returns Tainted данные с обновленным trustLevel
 *
 * @throws {Error} Если валидация не прошла или данные не tainted
 *
 * @example
 * ```ts
 * const processed = validateAndSanitize(
 *   userInput,
 *   (data) => { if (!data.name) throw new Error("Name required"); },
 *   (data) => ({ ...data, name: escapeHtml(data.name) })
 * );
 * ```
 */
export function validateAndSanitize<T>(
  value: Tainted<T>,
  validator: (value: T) => void,
  sanitizer: (value: T) => T,
  sanitizationMode: SanitizationMode = sanitizationModes.STRICT as SanitizationMode,
  targetTrustLevel: TrustLevel = trustLevels.TRUSTED as TrustLevel,
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry,
): Tainted<T> {
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
 * 🏗️ INPUT BOUNDARY INTERFACE (Extensibility)
 * ============================================================================
 */

/**
 * Generic InputBoundary интерфейс для различных источников (API, file upload, db input)
 * Переиспользование логики без дублирования кода.
 *
 * @example
 * ```ts
 * // Реализация для API input
 * const apiBoundary: InputBoundary<ApiRequest> = {
 *   taintSource: taintSources.EXTERNAL,
 *   mark: markAsExternal,
 *   validate: validateAndPromote,
 *   sanitize: sanitizeAndPromote,
 * };
 *
 * // Использование
 * const processed = apiBoundary.sanitize(
 *   apiBoundary.validate(apiBoundary.mark(apiRequest), apiValidator),
 *   apiSanitizer
 * );
 * ```
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
 * Базовая реализация для API и пользовательского ввода.
 */
export function createExternalInputBoundary<T>(): InputBoundary<T> {
  return {
    taintSource: taintSources.EXTERNAL as TaintSource,
    mark: (value, trustLevel, timestamp) => markAsExternal(value, trustLevel, timestamp),
    validate: (value, validator, targetTrustLevel) =>
      validateAndPromote(value, validator, targetTrustLevel),
    sanitize: (value, sanitizer, sanitizationMode, targetTrustLevel) =>
      sanitizeAndPromote(value, sanitizer, sanitizationMode, targetTrustLevel),
  };
}
