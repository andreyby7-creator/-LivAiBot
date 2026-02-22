/**
 * @file packages/core/src/input-boundary/generic-validation.ts
 * ============================================================================
 * 🛡️ CORE — Input Boundary (Generic Validation)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic type guards и структурная валидация для DTO на input boundary
 * - Только DTO guards (структурная валидация), без sanitization (data-safety/)
 * - Причина изменения: input boundary, DTO validation, structural guards
 *
 * Принципы:
 * - ✅ SRP: только структурная валидация DTO, без бизнес-логики
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты
 * - ✅ Domain-pure: без side-effects, платформо-агностично, generic по типам значений
 * - ✅ Extensible: добавление правил через ValidationRule без изменения core-логики
 * - ✅ Strict typing: union-типы для ValidationFailureReason, без string и Record в domain
 * - ✅ Microservice-ready: строгие контракты для межсервисного взаимодействия
 * - ✅ Scalable: extensible через registry, без if/else-монолита
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает sanitization (это в data-safety/)
 * - ✅ Только структурная валидация (shape, types, JSON-serializable)
 * - ✅ Fail-fast: первая ошибка останавливает валидацию (по умолчанию)
 * - ✅ Immutable: все результаты frozen
 */

/* ============================================================================
 * 1. TYPES — VALIDATION MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Базовые JSON-примитивы (union type для строгой типизации) */
export type JsonPrimitive = string | number | boolean | null;

/** JSON-значение (рекурсивный union type, без Record<string, unknown>) */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/** JSON-массив (рекурсивный) */
export type JsonArray = readonly JsonValue[];

/** JSON-объект (immutable, domain-pure типизация) */
export type JsonObject = Readonly<
  {
    readonly [K in string]?: JsonValue;
  }
>;

/** Результат валидации (effect-based, для composability) */
export type ValidationOutcome<T> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: ValidationFailureReason; }>;

/** Причина ошибки валидации (union type) */
export type ValidationFailureReason =
  | Readonly<{ kind: 'INVALID_TYPE'; expected: string; actual: string; }>
  | Readonly<{ kind: 'MISSING_PROPERTY'; property: string; }>
  | Readonly<{ kind: 'INVALID_STRUCTURE'; path: string; reason: string; }>
  | Readonly<{ kind: 'NOT_JSON_SERIALIZABLE'; path: string; }>
  | Readonly<{ kind: 'CUSTOM_RULE_FAILED'; rule: string; reason: string; }>;

/**
 * Правило валидации (pure predicate, extensible без изменения core)
 * @template T - Тип валидируемого значения
 * @template TMetadata - Тип метаданных контекста
 */
export type ValidationRule<T = unknown, TMetadata = unknown> = Readonly<{
  /** Имя правила (для отладки и логирования) */
  readonly name: string;
  /** Проверяет валидность значения (pure predicate) */
  readonly validate: (
    value: unknown,
    context: ValidationContext<TMetadata>,
  ) => ValidationOutcome<T>;
}>;

/**
 * Контекст валидации (статический, без runtime state)
 * @template TMetadata - Тип метаданных для type-safe расширения правил
 */
export type ValidationContext<TMetadata = unknown> = Readonly<{
  /** Путь к текущему значению (для error reporting) */
  readonly path?: string;
  /** Опциональные метаданные для правил (type-safe через generic) */
  readonly metadata?: TMetadata;
}>;

/**
 * Registry правил валидации: invariants (обязательные) + policies (расширяемые)
 * Invariants всегда выполняются первыми и не могут быть обойдены
 * @template T - Тип валидируемого значения
 * @template TMetadata - Тип метаданных контекста
 */
export type ValidationRuleRegistry<T = unknown, TMetadata = unknown> = Readonly<{
  /** Обязательные invariant правила (базовые проверки типов) */
  readonly invariants: readonly ValidationRule<T, TMetadata>[];
  /** Расширяемые policy правила (domain-specific валидация) */
  readonly policies: readonly ValidationRule<T, TMetadata>[];
  /** Map для O(1) lookup правил по имени (type-safe через generic) */
  readonly ruleMap: ReadonlyMap<string, ValidationRule<T, TMetadata>>;
}>;

/* ============================================================================
 * 🔍 TYPE GUARDS — БАЗОВЫЕ ТИПЫ
 * ============================================================================
 */

/** Проверяет, является ли значение строкой (type guard) @public */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Проверяет, является ли значение числом (type guard, исключает NaN) @public */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
}

/** Проверяет, является ли значение булевым (type guard) @public */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Проверяет, является ли значение null (type guard) @public */
export function isNull(value: unknown): value is null {
  return value === null;
}

/** Проверяет, является ли значение undefined (type guard) @public */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/** Проверяет, является ли значение null или undefined (type guard) @public */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Проверяет, является ли значение массивом (type guard) @public */
export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Проверяет, является ли значение объектом (type guard, исключает null и массивы)
 * Фильтрует symbol-ключи для безопасности (только string-ключи) @public
 */
export function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  // Проверка на symbol-ключи: Object.keys() фильтрует их, но явная проверка для безопасности
  const keys = Object.keys(value);
  const allKeys = Object.getOwnPropertyNames(value);
  return keys.length === allKeys.length;
}

/* ============================================================================
 * 📋 JSON-SERIALIZABLE VALIDATION
 * ============================================================================
 */

/** Проверяет, является ли значение JSON-примитивом @public */
export function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    isString(value)
    || isNumber(value)
    || isBoolean(value)
    || isNull(value)
  );
}

/**
 * Проверяет, является ли значение JSON-сериализуемым
 * @note Рекурсивно проверяет структуру без циклических ссылок, замораживает для immutability
 * @public
 */
export function isJsonSerializable(
  value: unknown, // Значение для проверки
  visited: ReadonlySet<unknown> = new Set(), // Set для отслеживания циклических ссылок (internal)
): value is JsonValue { // true если значение JSON-сериализуемо
  if (visited.has(value)) {
    return false;
  }

  if (isJsonPrimitive(value)) {
    return true;
  }

  if (isArray(value)) {
    const newVisited = new Set([...visited, value]);
    const allSerializable = value.every((item) => isJsonSerializable(item, newVisited));
    if (allSerializable && !Object.isFrozen(value)) {
      Object.freeze(value);
    }
    return allSerializable;
  }

  if (isObject(value)) {
    const newVisited = new Set([...visited, value]);
    const allSerializable = Object.values(value).every((prop) =>
      isJsonSerializable(prop, newVisited)
    );
    if (allSerializable && !Object.isFrozen(value)) {
      Object.freeze(value);
    }
    return allSerializable;
  }

  return false;
}

/* ============================================================================
 * 🏗️ STRUCTURAL VALIDATION — ОБЪЕКТЫ
 * ============================================================================
 */

/** Проверяет наличие свойства в объекте (type guard) @public */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Readonly<Record<K, unknown>> {
  return isObject(obj) && key in obj;
}

/** Проверяет наличие нескольких свойств в объекте (type guard) @public */
export function hasProperties<K extends string>(
  obj: unknown,
  keys: readonly K[],
): obj is Readonly<Record<K, unknown>> {
  if (!isObject(obj)) {
    return false;
  }
  return keys.every((key) => key in obj);
}

/** Извлекает значение свойства из объекта с type guard @public */
export function getProperty<K extends string>(
  obj: unknown,
  key: K,
): unknown {
  if (!hasProperty(obj, key)) {
    return undefined;
  }
  return obj[key];
}

/** Проверяет отсутствующие свойства объекта @internal */
function findMissingProperties(
  value: Readonly<Record<string, unknown>>,
  shape: Readonly<Record<string, (val: unknown) => boolean>>,
): readonly string[] {
  return Object.keys(shape).filter((key) => !(key in value));
}

/** Создает ошибку для отсутствующих свойств @internal */
function createMissingPropertyError(
  missingProperties: readonly string[],
  context: ValidationContext,
  accumulateErrors: boolean,
): ValidationOutcome<never> {
  if (missingProperties.length === 0) {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'MISSING_PROPERTY',
        property: context.path ?? 'root',
      }),
    });
  }

  const firstMissing = missingProperties[0];
  if (firstMissing === undefined) {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'MISSING_PROPERTY',
        property: context.path ?? 'root',
      }),
    });
  }

  const path = context.path !== undefined ? `${context.path}.${firstMissing}` : firstMissing;

  if (accumulateErrors && missingProperties.length > 1) {
    const allPaths = missingProperties
      .map((key) => (context.path !== undefined ? `${context.path}.${key}` : key))
      .join(', ');
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'INVALID_STRUCTURE',
        path: context.path ?? 'root',
        reason: `Missing properties: ${allPaths}`,
      }),
    });
  }

  return Object.freeze({
    ok: false,
    reason: Object.freeze({
      kind: 'MISSING_PROPERTY',
      property: path,
    }),
  });
}

/** Проверяет типы свойств объекта @internal */
function validatePropertyTypes(
  value: Readonly<Record<string, unknown>>,
  shape: Readonly<Record<string, (val: unknown) => boolean>>,
  context: ValidationContext,
  accumulateErrors: boolean,
): ValidationOutcome<Readonly<Record<string, unknown>>> | readonly string[] {
  const typeErrors = Object.entries(shape)
    .map(([key, typeGuard]) => {
      const propertyValue = value[key];
      if (!typeGuard(propertyValue)) {
        const path = context.path !== undefined ? `${context.path}.${key}` : key;
        return path;
      }
      return null;
    })
    .filter((path): path is string => path !== null);

  if (typeErrors.length > 0 && !accumulateErrors) {
    const firstError = typeErrors[0];
    if (firstError !== undefined) {
      const pathParts = firstError.split('.');
      const key = pathParts.length > 0 ? pathParts[pathParts.length - 1] ?? firstError : firstError;
      const propertyValue = value[key];
      return Object.freeze({
        ok: false,
        reason: Object.freeze({
          kind: 'INVALID_STRUCTURE',
          path: firstError,
          reason:
            `Property "${key}" has invalid type: expected valid type, got ${typeof propertyValue}`,
        }),
      });
    }
  }

  return typeErrors;
}

/**
 * Проверяет структуру объекта (shape validation)
 * @note Проверяет наличие обязательных свойств и их типы, поддерживает path accumulation
 * @public
 */
export function validateObjectShape(
  value: unknown, // Значение для проверки
  shape: Readonly<Record<string, (val: unknown) => boolean>>, // Схема валидации (field → validator)
  context: ValidationContext = {}, // Контекст валидации
  accumulateErrors: boolean = false, // Если true, собирает все ошибки (по умолчанию false, fail-fast)
): ValidationOutcome<Readonly<Record<string, unknown>>> { // Результат валидации
  if (!isObject(value)) {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'INVALID_TYPE',
        expected: 'object',
        actual: typeof value,
      }),
    });
  }

  const missingProperties = findMissingProperties(value, shape);
  if (missingProperties.length > 0) {
    return createMissingPropertyError(missingProperties, context, accumulateErrors);
  }

  const typeValidationResult = validatePropertyTypes(value, shape, context, accumulateErrors);

  if (!accumulateErrors && 'ok' in typeValidationResult && !typeValidationResult.ok) {
    return typeValidationResult;
  }

  if (accumulateErrors && Array.isArray(typeValidationResult) && typeValidationResult.length > 0) {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'INVALID_STRUCTURE',
        path: context.path ?? 'root',
        reason: `Invalid types at paths: ${typeValidationResult.join(', ')}`,
      }),
    });
  }

  return Object.freeze({
    ok: true,
    value,
  });
}

/* ============================================================================
 * 🎯 DEFAULT RULES (Core Rules)
 * ============================================================================
 */

/** Базовое правило проверки JSON-сериализуемости */
const jsonSerializableRule: ValidationRule<JsonValue, unknown> = Object.freeze({
  name: 'json-serializable',
  validate: (value: unknown, context: ValidationContext<unknown>): ValidationOutcome<JsonValue> => {
    if (!isJsonSerializable(value)) {
      const path = context.path ?? 'root';
      return Object.freeze({
        ok: false,
        reason: Object.freeze({
          kind: 'NOT_JSON_SERIALIZABLE',
          path,
        }),
      });
    }
    return Object.freeze({ ok: true, value });
  },
});

/** Базовое правило проверки объекта */
const objectRule: ValidationRule<Readonly<Record<string, unknown>>, unknown> = Object.freeze({
  name: 'object',
  validate: (
    value: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- context может использоваться в будущих расширениях
    _context: ValidationContext<unknown>,
  ): ValidationOutcome<Readonly<Record<string, unknown>>> => {
    if (!isObject(value)) {
      return Object.freeze({
        ok: false,
        reason: Object.freeze({
          kind: 'INVALID_TYPE',
          expected: 'object',
          actual: typeof value,
        }),
      });
    }
    return Object.freeze({ ok: true, value });
  },
});

/** Дефолтный registry с базовыми правилами (thread-safe, immutable) */
export const defaultValidationRuleRegistry: ValidationRuleRegistry<unknown, unknown> = Object
  .freeze({
    invariants: Object.freeze([jsonSerializableRule, objectRule]),
    policies: Object.freeze([]),
    ruleMap: Object.freeze(
      new Map<string, ValidationRule<unknown, unknown>>([
        [jsonSerializableRule.name, jsonSerializableRule],
        [objectRule.name, objectRule],
      ]),
    ) as ReadonlyMap<string, ValidationRule<unknown, unknown>>,
  });

/* ============================================================================
 * 2. RULE ENGINE — APPLY RULES
 * ============================================================================
 */

/**
 * Применяет правила валидации с fail-fast семантикой
 * @template T - Тип валидируемого значения
 * @template TMetadata - Тип метаданных контекста
 * @note Invariants выполняются первыми, затем policies
 * @internal
 */
function applyValidationRules<T = unknown, TMetadata = unknown>(
  value: unknown, // Значение для валидации
  context: ValidationContext<TMetadata>, // Контекст валидации
  registry: ValidationRuleRegistry<T, TMetadata> =
    defaultValidationRuleRegistry as ValidationRuleRegistry<T, TMetadata>, // Registry правил валидации
): ValidationOutcome<T> { // Результат валидации (первая ошибка останавливает проверку)
  const invariantResult = registry.invariants.reduce<ValidationOutcome<T> | null>(
    (acc, rule) => {
      if (acc !== null && !acc.ok) {
        return acc;
      }
      const result = rule.validate(value, context);
      return result.ok ? null : result;
    },
    null,
  );

  if (invariantResult !== null) {
    return invariantResult;
  }

  const policyResult = registry.policies.reduce<ValidationOutcome<T> | null>(
    (acc, rule) => {
      if (acc !== null && !acc.ok) {
        return acc;
      }
      const result = rule.validate(value, context);
      return result.ok ? null : result;
    },
    null,
  );

  if (policyResult !== null) {
    return policyResult;
  }

  return Object.freeze({ ok: true, value: value as T });
}

/**
 * Валидирует значение через rule engine
 * @template T - Тип валидируемого значения
 * @template TMetadata - Тип метаданных контекста
 * @public
 */
export function validate<T = unknown, TMetadata = unknown>(
  value: unknown, // Значение для валидации
  context: ValidationContext<TMetadata> = {}, // Контекст валидации
  registry: ValidationRuleRegistry<T, TMetadata> =
    defaultValidationRuleRegistry as ValidationRuleRegistry<T, TMetadata>, // Registry правил валидации (по умолчанию defaultValidationRuleRegistry)
): ValidationOutcome<T> { // Результат валидации
  return applyValidationRules(value, context, registry);
}

/* ============================================================================
 * 3. EXTENSIBILITY HELPERS — REGISTRY BUILDERS
 * ============================================================================
 */

/**
 * Создает новый registry с добавленным правилом (immutable)
 * @template T - Тип валидируемого значения
 * @template TMetadata - Тип метаданных контекста
 * @note Helper для динамического расширения registry без мутации
 * @public
 */
export function registerValidationRule<T = unknown, TMetadata = unknown>(
  registry: ValidationRuleRegistry<T, TMetadata>, // Registry правил валидации
  rule: ValidationRule<T, TMetadata>, // Правило для добавления
  asInvariant: boolean = false, // Если true, добавляет в invariants, иначе в policies
): ValidationRuleRegistry<T, TMetadata> { // Новый registry с добавленным правилом
  if (registry.ruleMap.has(rule.name)) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(`Validation rule "${rule.name}" already exists in registry`);
  }

  const newRuleMap = new Map<string, ValidationRule<T, TMetadata>>([
    ...registry.ruleMap.entries(),
    [rule.name, rule],
  ]);

  if (asInvariant) {
    return Object.freeze({
      invariants: Object.freeze([...registry.invariants, rule]),
      policies: registry.policies,
      ruleMap: Object.freeze(newRuleMap) as ReadonlyMap<string, ValidationRule<T, TMetadata>>,
    });
  }

  return Object.freeze({
    invariants: registry.invariants,
    policies: Object.freeze([...registry.policies, rule]),
    ruleMap: Object.freeze(newRuleMap) as ReadonlyMap<string, ValidationRule<T, TMetadata>>,
  });
}

/** @deprecated Используйте registerValidationRule */
export const registerRule = registerValidationRule;

/* ============================================================================
 * 4. COMPOSABLE PREDICATES — RULE COMPOSITION
 * ============================================================================
 */

/**
 * Создает правило, которое требует прохождения всех переданных правил (AND логика)
 * Все правила должны вернуть ok: true для успешной валидации
 * @public
 */
export function andRule<T = unknown, TMetadata = unknown>(
  name: string,
  rules: readonly ValidationRule<T, TMetadata>[],
): ValidationRule<T, TMetadata> {
  return Object.freeze({
    name,
    validate: (value: unknown, context: ValidationContext<TMetadata>): ValidationOutcome<T> => {
      const failedRule = rules.find((rule) => {
        const result = rule.validate(value, context);
        return !result.ok;
      });

      if (failedRule !== undefined) {
        return Object.freeze({
          ok: false,
          reason: Object.freeze({
            kind: 'CUSTOM_RULE_FAILED',
            rule: name,
            reason: `AND rule failed: ${failedRule.name} returned error`,
          }),
        });
      }

      return Object.freeze({ ok: true, value: value as T });
    },
  });
}

/**
 * Создает правило, которое требует прохождения хотя бы одного правила (OR логика)
 * Хотя бы одно правило должно вернуть ok: true для успешной валидации
 * @public
 */
export function orRule<T = unknown, TMetadata = unknown>(
  name: string,
  rules: readonly ValidationRule<T, TMetadata>[],
): ValidationRule<T, TMetadata> {
  return Object.freeze({
    name,
    validate: (value: unknown, context: ValidationContext<TMetadata>): ValidationOutcome<T> => {
      const passedRule = rules.find((rule) => {
        const result = rule.validate(value, context);
        return result.ok;
      });

      if (passedRule !== undefined) {
        return Object.freeze({ ok: true, value: value as T });
      }

      const errors = rules.map((rule) => rule.name);
      return Object.freeze({
        ok: false,
        reason: Object.freeze({
          kind: 'CUSTOM_RULE_FAILED',
          rule: name,
          reason: `OR rule failed: all rules (${errors.join(', ')}) returned errors`,
        }),
      });
    },
  });
}

/**
 * Создает правило, которое инвертирует результат другого правила (NOT логика)
 * Успех, если исходное правило провалилось, и наоборот
 * @public
 */
export function notRule<T = unknown, TMetadata = unknown>(
  name: string,
  rule: ValidationRule<T, TMetadata>,
): ValidationRule<T, TMetadata> {
  return Object.freeze({
    name,
    validate: (value: unknown, context: ValidationContext<TMetadata>): ValidationOutcome<T> => {
      const result = rule.validate(value, context);
      if (result.ok) {
        return Object.freeze({
          ok: false,
          reason: Object.freeze({
            kind: 'CUSTOM_RULE_FAILED',
            rule: name,
            reason: `NOT rule failed: ${rule.name} passed (expected failure)`,
          }),
        });
      }
      return Object.freeze({ ok: true, value: value as T });
    },
  });
}
