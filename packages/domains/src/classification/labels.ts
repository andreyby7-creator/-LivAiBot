/**
 * @file packages/domains/src/classification/labels.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Labels (Domain-Specific Labels)
 * ============================================================================
 * Domain-specific labels для classification domain.
 * Использует generic Label<T> из @livai/core/domain-kit для type safety.
 * Архитектура: библиотека из 3 модулей в одном файле
 * - ClassificationLabel: union type допустимых значений (single source of truth)
 * - classificationLabel: value object модуль (создание, валидация)
 * - classificationLabelUtils: pure label helpers (без business logic)
 * - classificationPolicy: business logic через declarative policy map (rule-engine scalable)
 * Принципы:
 * - ✅ SRP: модульная структура (value object / pure utilities / policy)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты
 * - ✅ Domain-pure: без side-effects, domain объявляет labels (НЕ core), использует generic Label<T>
 * - ✅ Scalable: declarative policy map (O(1) lookup), расширяется через LabelValidator/policy map без изменения кода
 * - ✅ Strict typing: union types из массива (single source of truth), branded type через Label<T>
 * - ✅ Security: runtime validation (whitelist validator) для защиты от forged labels
 */

import type { Label, LabelOutcome, LabelValidator } from '@livai/core';
import { label, labelValidators } from '@livai/core';

/* ============================================================================
 * 🧩 ТИПЫ — UNION TYPE ДЛЯ CLASSIFICATION LABELS
 * ============================================================================
 */

/**
 * Массив допустимых значений classification labels
 * Single source of truth: тип выводится из массива для предотвращения рассинхронизации
 * @public
 */
export const CLASSIFICATION_LABELS = [
  'SAFE',
  'SUSPICIOUS',
  'DANGEROUS',
  'UNKNOWN',
] as const;

/**
 * Допустимые значения classification labels
 * Union type выводится из CLASSIFICATION_LABELS для single source of truth
 * @public
 */
export type ClassificationLabelValue = (typeof CLASSIFICATION_LABELS)[number];

/**
 * Classification Label: branded type для type safety между доменами
 * Использует generic Label<T> из @livai/core/domain-kit
 * @public
 */
export type ClassificationLabel = Label<ClassificationLabelValue>;

/**
 * Результат операций с classification labels (effect-based)
 * @public
 */
export type ClassificationLabelOutcome = LabelOutcome<ClassificationLabelValue>;

/* ============================================================================
 * 🔒 INTERNAL — VALIDATOR CONFIGURATION
 * ============================================================================
 */

/**
 * Validator для classification labels
 * Использует whitelist strategy для O(1) проверки через Set
 * Кешируется через labelValidators.whitelist для high-performance
 * Использует CLASSIFICATION_LABELS как single source of truth
 * @internal
 */
const CLASSIFICATION_LABEL_VALIDATOR: LabelValidator<ClassificationLabelValue> = labelValidators
  .whitelist<ClassificationLabelValue>(CLASSIFICATION_LABELS, true);

/* ============================================================================
 * 🏗️ CLASSIFICATION LABEL — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Classification Label value object: создание, валидация, утилиты
 * Thin wrapper над generic label API из @livai/core/domain-kit
 * @public
 */
export const classificationLabel = {
  /**
   * Создает classification label из строки с валидацией (автоматически нормализует через trim)
   *
   * @example
   * ```ts
   * const result = classificationLabel.create('SAFE');
   * if (result.ok) { const lbl = result.value; }
   * ```
   */
  create(
    value: unknown,
    options?: Readonly<{ normalize?: boolean; }>,
  ): ClassificationLabelOutcome {
    return label.create(value, CLASSIFICATION_LABEL_VALIDATOR, options);
  },

  /**
   * Десериализует classification label из строки с валидацией (для JSON/API responses)
   *
   * @example
   * ```ts
   * const result = classificationLabel.deserialize(jsonData.label);
   * if (result.ok) { const lbl = result.value; }
   * ```
   */
  deserialize(value: unknown): ClassificationLabelOutcome {
    return label.deserialize(value, CLASSIFICATION_LABEL_VALIDATOR);
  },

  /** Извлекает строковое значение из classification label */
  value(lbl: ClassificationLabel): ClassificationLabelValue {
    return label.value(lbl);
  },

  /**
   * Type guard для проверки, является ли значение classification label (runtime валидация)
   *
   * @example
   * ```ts
   * if (classificationLabel.isLabel(unknownValue)) { const lbl = unknownValue; }
   * ```
   */
  isLabel(value: unknown): value is ClassificationLabel {
    return label.isLabel(value, CLASSIFICATION_LABEL_VALIDATOR);
  },

  /**
   * Fail-fast проверка валидности classification label (undefined если валиден, иначе LabelFailureReason)
   * @throws Error если throwOnInvalid === true и валидация не прошла
   *
   * @example
   * ```ts
   * const error = classificationLabel.assertValid(lbl);
   * if (error !== undefined) { logger.error('Invalid label', error); }
   * classificationLabel.assertValid(lbl, { throwOnInvalid: true });
   * ```
   */
  assertValid(
    lbl: ClassificationLabel,
    options?: Readonly<{ throwOnInvalid?: boolean; }>,
  ) {
    return label.assertValid(lbl, CLASSIFICATION_LABEL_VALIDATOR, options);
  },
} as const;

/* ============================================================================
 * 🔧 UTILITIES — PURE LABEL HELPERS
 * ============================================================================
 */

/**
 * Helper: получает значение label
 * @internal
 */
function getValue(lbl: ClassificationLabel): ClassificationLabelValue {
  return classificationLabel.value(lbl);
}

/**
 * Утилиты для работы с classification labels (pure helpers)
 * Только операции над самими labels, без business logic
 * Гибридный подход:
 * - Семантические методы (isSafe, isSuspicious, etc.) для частых случаев и читаемости
 * - Универсальный hasValue() для динамических проверок и масштабируемости
 * @public
 */
export const classificationLabelUtils = {
  /** Возвращает массив всех допустимых значений classification labels */
  getAllowedValues(): readonly ClassificationLabelValue[] {
    return CLASSIFICATION_LABELS;
  },

  /** Проверяет, является ли значение безопасным (SAFE) */
  isSafe(lbl: ClassificationLabel): boolean {
    return getValue(lbl) === 'SAFE';
  },

  /** Проверяет, является ли значение подозрительным (SUSPICIOUS) */
  isSuspicious(lbl: ClassificationLabel): boolean {
    return getValue(lbl) === 'SUSPICIOUS';
  },

  /** Проверяет, является ли значение опасным (DANGEROUS) */
  isDangerous(lbl: ClassificationLabel): boolean {
    return getValue(lbl) === 'DANGEROUS';
  },

  /** Проверяет, является ли значение неизвестным (UNKNOWN) */
  isUnknown(lbl: ClassificationLabel): boolean {
    return getValue(lbl) === 'UNKNOWN';
  },

  /**
   * Универсальная проверка значения label (type-safe, масштабируется автоматически)
   * Используется для динамических проверок или когда семантических методов недостаточно
   *
   * @example
   * ```ts
   * const value = getLabelFromAPI();
   * if (classificationLabelUtils.hasValue(lbl, value)) { }
   * ```
   */
  hasValue(lbl: ClassificationLabel, value: ClassificationLabelValue): boolean {
    return getValue(lbl) === value;
  },
} as const;

/* ============================================================================
 * 📋 POLICY — BUSINESS LOGIC (DECLARATIVE POLICY MAP)
 * ============================================================================
 */

/**
 * Политика для classification labels (declarative policy map)
 * Single source of truth для business logic, легко расширяется без изменения кода
 * Использует O(1) lookup вместо if/else для rule-engine scalability
 * @internal
 */
const LABEL_POLICY: Readonly<
  Record<
    ClassificationLabelValue,
    Readonly<{
      /** Требует ли label дополнительной проверки */
      readonly requiresReview: boolean;
      /** Является ли label критичным */
      readonly critical: boolean;
    }>
  >
> = {
  SAFE: { requiresReview: false, critical: false },
  SUSPICIOUS: { requiresReview: true, critical: false },
  DANGEROUS: { requiresReview: true, critical: true },
  UNKNOWN: { requiresReview: false, critical: false },
} as const;

/**
 * Helper: получает политику для label
 * @internal
 */
function getPolicy(lbl: ClassificationLabel): Readonly<{
  readonly requiresReview: boolean;
  readonly critical: boolean;
}> {
  return LABEL_POLICY[classificationLabel.value(lbl)];
}

/**
 * Политика для classification labels (business logic)
 * Declarative policy map для rule-engine scalability
 * Легко расширяется новыми labels без изменения кода проверок
 * @public
 */
export const classificationPolicy = {
  /**
   * Проверяет, требует ли label дополнительной проверки (declarative policy map, O(1) lookup)
   *
   * @example
   * ```ts
   * if (classificationPolicy.requiresReview(lbl)) { }
   * if (classificationPolicy.isCritical(lbl)) { }
   * ```
   */
  requiresReview(lbl: ClassificationLabel): boolean {
    return getPolicy(lbl).requiresReview;
  },

  /** Проверяет, является ли label критичным (declarative policy map, O(1) lookup) */
  isCritical(lbl: ClassificationLabel): boolean {
    return getPolicy(lbl).critical;
  },
} as const;
