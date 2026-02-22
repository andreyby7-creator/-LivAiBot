/**
 * @file packages/core/src/domain-kit/label.ts
 * ============================================================================
 * 🛡️ CORE — Domain Kit (Label)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic label value для domain-specific строковых меток в domain-kit
 * - Label = строковое значение с валидацией и type safety через branded types
 * - Причина изменения: domain-kit, string labels, domain-specific validation
 *
 * Принципы:
 * - ✅ SRP: модульная структура (value object / validator contract)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты
 * - ✅ Domain-pure: без side-effects, платформо-агностично, generic по доменам
 * - ✅ Extensible: domain определяет валидацию через LabelValidator без изменения core
 * - ✅ Strict typing: branded type + phantom generic для type safety между доменами
 * - ✅ Microservice-ready: runtime validation предотвращает cross-service inconsistency
 * - ✅ Scalable: extensible validation через LabelValidator contract
 * - ✅ Security: runtime validation для защиты от forged labels
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения ('SAFE'/'SUSPICIOUS'/'DANGEROUS' - это domain labels)
 * - ❌ НЕ определяет конкретные label значения (только contract через LabelValidator)
 * - ✅ Только generic строковое значение с валидацией
 * - ✅ Domain определяет допустимые label значения через LabelValidator
 * - ✅ Type-safe: branded type предотвращает смешивание разных доменов
 * - ✅ Runtime-safe: защита от forged labels при десериализации
 *
 * ⚠️ EDGE CASES:
 * - Phantom generic не защищает runtime от кастов через `as unknown as Label<X>`
 * - Используйте `label.isLabel()` для безопасной проверки типов в runtime
 * - Для критичных микросервисов используйте `label.assertValid()` для fail-fast
 * - ESLint правило `no-restricted-syntax` настроено для запрета `as unknown as Label<X>`
 */

/* ============================================================================
 * 1. TYPES — LABEL MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Label: строковое значение с phantom generic для type safety между доменами
 * Используется для представления domain-specific меток (классификация, категории, статусы)
 * @template TLabel - Union type допустимых label значений ('SAFE' | 'SUSPICIOUS' | 'DANGEROUS')
 * @public
 */
export type Label<TLabel extends string = string> = TLabel & {
  readonly __brand: 'Label';
};

/**
 * Результат валидации label (effect-based)
 * @template TLabel - Union type допустимых label значений
 * @public
 */
export type LabelOutcome<TLabel extends string> =
  | Readonly<{ ok: true; value: Label<TLabel>; }>
  | Readonly<{ ok: false; reason: LabelFailureReason; }>;

/**
 * Причина ошибки валидации label
 * @public
 */
export type LabelFailureReason =
  | Readonly<{ kind: 'NOT_A_STRING'; value: unknown; }>
  | Readonly<{ kind: 'EMPTY_STRING'; value: string; }>
  | Readonly<
    { kind: 'INVALID_LABEL'; value: string; allowedValues?: readonly string[] | undefined; }
  >
  | Readonly<{ kind: 'VALIDATION_ERROR'; value: string; message: string; }>;

/**
 * Контракт для валидации label значений
 * @template TLabel - Union type допустимых label значений
 * @note Extensible contract для domain-specific логики валидации
 * @public
 */
export interface LabelValidator<TLabel extends string = string> {
  /**
   * Проверяет, является ли значение валидным label
   * @param value - Строковое значение для проверки
   * @returns true если значение валидно
   */
  isValid(value: string): value is TLabel; // true если значение валидно

  /**
   * Возвращает список допустимых значений (опционально, для лучших error messages)
   * @returns Массив допустимых значений или undefined
   */
  getAllowedValues?(): readonly TLabel[] | undefined; // Массив допустимых значений или undefined
}

/* ============================================================================
 * 2. INTERNAL — BRANDED TYPE CONSTRUCTION
 * ============================================================================
 */

/**
 * Helper для создания branded type
 * @internal
 * ⚠️ Внутренняя функция - безопасный каст, так как value уже валидирован через validator
 */
function createBrandedLabel<TLabel extends string>(value: TLabel): Label<TLabel> {
  return value as Label<TLabel>;
}

/**
 * Проверяет валидность label значения (runtime safety)
 * @internal
 */
function validateLabel<TLabel extends string>(
  lbl: Label<TLabel>,
  validator: LabelValidator<TLabel>,
): LabelOutcome<Label<TLabel>> {
  const val = label.value(lbl);
  if (val.length === 0) {
    return {
      ok: false,
      reason: {
        kind: 'EMPTY_STRING' as const,
        value: val,
      },
    };
  }
  if (!validator.isValid(val)) {
    const allowedValues = validator.getAllowedValues?.();
    return {
      ok: false,
      reason: {
        kind: 'INVALID_LABEL' as const,
        value: val,
        ...(allowedValues !== undefined && { allowedValues: allowedValues as readonly string[] }),
      },
    };
  }
  return { ok: true, value: lbl };
}

/* ============================================================================
 * 3. LABEL — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Label value object: создание, валидация, сериализация, type guards
 * @public
 */
export const label = {
  /**
   * Создает label из строки с валидацией
   * @template TLabel - Union type допустимых label значений
   * @note Автоматически нормализует значение (trim) для защиты от пробельных строк
   * @example type RiskLabel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'; const validator: LabelValidator<RiskLabel> = { isValid: (v): v is RiskLabel => ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(v) }; const result = label.create('SAFE', validator); if (result.ok) { const lbl = result.value; // Label<'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'> }
   * @public
   */
  create<TLabel extends string>(
    value: unknown, // Строковое значение
    validator: LabelValidator<TLabel>, // Валидатор для проверки допустимых значений
    options?: Readonly<{ normalize?: boolean; }>, // Опции создания (normalize: автоматический trim)
  ): LabelOutcome<TLabel> { // LabelOutcome с результатом валидации
    if (typeof value !== 'string') {
      return {
        ok: false,
        reason: {
          kind: 'NOT_A_STRING' as const,
          value,
        },
      };
    }

    // Нормализация: автоматический trim для защиты от пробельных строк
    const normalizedValue = options?.normalize !== false ? value.trim() : value;

    if (normalizedValue.length === 0) {
      return {
        ok: false,
        reason: {
          kind: 'EMPTY_STRING' as const,
          value: normalizedValue,
        },
      };
    }

    if (!validator.isValid(normalizedValue)) {
      const allowedValues = validator.getAllowedValues?.();
      return {
        ok: false,
        reason: {
          kind: 'INVALID_LABEL' as const,
          value: normalizedValue,
          ...(allowedValues !== undefined && { allowedValues: allowedValues as readonly string[] }),
        },
      };
    }

    return {
      ok: true,
      value: createBrandedLabel<TLabel>(normalizedValue),
    };
  },

  /**
   * Десериализует label из строки с валидацией
   * @template TLabel - Union type допустимых label значений
   * @public
   */
  deserialize<TLabel extends string>(
    value: unknown, // Строковое значение
    validator: LabelValidator<TLabel>, // Валидатор для проверки допустимых значений
  ): LabelOutcome<TLabel> { // LabelOutcome с результатом валидации
    return label.create(value, validator);
  },

  /**
   * Извлекает строковое значение из label
   * @template TLabel - Union type допустимых label значений
   * @public
   */
  value<TLabel extends string>(
    lbl: Label<TLabel>, // Label значение
  ): TLabel { // Строковое значение
    return lbl as TLabel;
  },

  /**
   * Type guard для проверки, является ли значение label заданного типа
   * Безопасная проверка типа с runtime валидацией
   * @param value - Значение для проверки
   * @param validator - Валидатор для проверки допустимых значений
   * @returns true если значение является валидным label
   * @example
   * ```ts
   * type RiskLabel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
   * const validator: LabelValidator<RiskLabel> = {
   *   isValid: (v): v is RiskLabel => ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(v),
   * };
   * if (label.isLabel(unknownValue, validator)) {
   *   // unknownValue теперь типизирован как Label<RiskLabel>
   *   const lbl: Label<RiskLabel> = unknownValue;
   * }
   * ```
   */
  isLabel<TLabel extends string>(
    value: unknown, // Значение для проверки
    validator: LabelValidator<TLabel>, // Валидатор для проверки допустимых значений
  ): value is Label<TLabel> {
    if (typeof value !== 'string') {
      return false;
    }
    if (value.length === 0) {
      return false;
    }
    return validator.isValid(value);
  },

  /**
   * Fail-fast проверка валидности label для критичных runtime use-cases
   * @template TLabel - Union type допустимых label значений
   * @note Возвращает undefined если label валиден, иначе возвращает причину ошибки.
   *       Caller решает, что делать с ошибкой (throw/logging).
   *       Используйте для критичных микросервисов, где нужно fail-fast при corrupted data
   * @example const validationError = label.assertValid(unknownLabel, validator); if (validationError !== undefined) { logger.error('Invalid label', validationError); return; } label.assertValid(unknownLabel, validator, { throwOnInvalid: true });
   * @throws Error если throwOnInvalid === true и валидация не прошла
   * @public
   */
  assertValid<TLabel extends string>(
    lbl: Label<TLabel>, // Label значение для проверки
    validator: LabelValidator<TLabel>, // Валидатор для проверки допустимых значений
    options?: Readonly<{ throwOnInvalid?: boolean; }>, // Опции: throwOnInvalid для автоматического throw (syntactic sugar)
  ): LabelFailureReason | undefined { // undefined если label валиден, иначе LabelFailureReason (если throwOnInvalid !== true)
    const validation = validateLabel(lbl, validator);
    if (!validation.ok) {
      const reason = validation.reason;
      // Syntactic sugar: автоматический throw, если запрошен
      if (options?.throwOnInvalid === true) {
        // eslint-disable-next-line fp/no-throw -- syntactic sugar для удобства caller'а
        throw new Error(`Invalid label: ${reason.kind} - ${JSON.stringify(reason)}`);
      }
      return reason;
    }
    return undefined;
  },
} as const;

/* ============================================================================
 * 4. LABEL VALIDATORS — PRESET VALIDATORS FACTORY
 * ============================================================================
 */

/**
 * Кеш для validators (для reuse в high-throughput scenarios)
 * Использует двухуровневое кеширование:
 * - WeakMap для случаев, когда массив переиспользуется (reference-based)
 * - Map с JSON.stringify для динамических массивов (value-based)
 * @internal
 */
const validatorCacheWeak = new WeakMap<readonly string[], LabelValidator<string>>();
const validatorCacheMap = new Map<string, LabelValidator<string>>();

/**
 * Создает ключ для Map кеша из массива значений
 * @internal
 */
function createCacheKey(allowedValues: readonly string[]): string {
  return JSON.stringify([...allowedValues].sort());
}

/**
 * Label Validators: factory для создания preset validators
 * Отдельный модуль для соблюдения SRP (validator factory vs value object)
 * Поддерживает кеширование validators для high-performance rule-engines
 * @public
 */
export const labelValidators = {
  /**
   * Создает validator для whitelist значений
   * @template TLabel - Union type допустимых label значений
   * @note Использует кеширование для reuse в high-throughput scenarios
   * @example type RiskLabel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'; const validator = labelValidators.whitelist<RiskLabel>(['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
   * @public
   */
  whitelist<TLabel extends string>(
    allowedValues: readonly TLabel[], // Массив допустимых значений
    useCache: boolean = true, // Использовать кеш для reuse (по умолчанию true)
  ): LabelValidator<TLabel> { // LabelValidator для whitelist strategy
    // Двухуровневое кеширование для high-performance rule-engines
    if (useCache) {
      // Уровень 1: WeakMap для случаев, когда массив переиспользуется (reference-based)
      const cachedWeak = validatorCacheWeak.get(allowedValues as readonly string[]);
      if (cachedWeak !== undefined) {
        return cachedWeak as LabelValidator<TLabel>;
      }

      // Уровень 2: Map с JSON.stringify для динамических массивов (value-based)
      // Решает проблему reference mismatch для динамически создаваемых массивов
      const cacheKey = createCacheKey(allowedValues as readonly string[]);
      const cachedMap = validatorCacheMap.get(cacheKey);
      if (cachedMap !== undefined) {
        // Сохраняем также в WeakMap для будущих обращений по reference
        validatorCacheWeak.set(allowedValues as readonly string[], cachedMap);
        return cachedMap as LabelValidator<TLabel>;
      }
    }

    const allowedSet = new Set(allowedValues);
    const validator: LabelValidator<TLabel> = {
      isValid(value): value is TLabel {
        return allowedSet.has(value as TLabel);
      },
      getAllowedValues(): readonly TLabel[] {
        return allowedValues;
      },
    };

    // Сохраняем в оба кеша для reuse
    if (useCache) {
      // WeakMap для reference-based доступа
      validatorCacheWeak.set(
        allowedValues as readonly string[],
        validator as LabelValidator<string>,
      );
      // Map для value-based доступа (для динамических массивов)
      const cacheKey = createCacheKey(allowedValues as readonly string[]);
      // eslint-disable-next-line functional/immutable-data -- кеширование требует мутации для производительности
      validatorCacheMap.set(cacheKey, validator as LabelValidator<string>);
    }

    return validator;
  },

  /**
   * Создает validator для pattern matching (regex)
   * @template TLabel - Union type допустимых label значений
   * @note allowedValues опционально, используется для лучших error messages
   * @example const validator = labelValidators.pattern(/^[A-Z_]+$/, ['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
   * @public
   */
  pattern<TLabel extends string>(
    pattern: RegExp, // Регулярное выражение для проверки
    allowedValues?: readonly TLabel[], // Опциональный массив допустимых значений (для лучших error messages)
  ): LabelValidator<TLabel> { // LabelValidator для pattern strategy
    return {
      isValid(value): value is TLabel {
        return pattern.test(value);
      },
      getAllowedValues(): readonly TLabel[] | undefined {
        return allowedValues;
      },
    };
  },

  /**
   * Создает validator для custom функции валидации
   * @template TLabel - Union type допустимых label значений
   * @note allowedValues опционально, используется для лучших error messages
   * @example const validator = labelValidators.custom((v): v is RiskLabel => v.length > 0 && v === v.toUpperCase(), ['SAFE', 'SUSPICIOUS', 'DANGEROUS']);
   * @public
   */
  custom<TLabel extends string>(
    validateFn: (value: string) => value is TLabel, // Функция валидации
    allowedValues?: readonly TLabel[], // Опциональный массив допустимых значений (для лучших error messages)
  ): LabelValidator<TLabel> { // LabelValidator для custom strategy
    return {
      isValid: validateFn,
      getAllowedValues(): readonly TLabel[] | undefined {
        return allowedValues;
      },
    };
  },
} as const;
