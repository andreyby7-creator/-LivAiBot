/**
 * @file ErrorValidators.ts - Сбалансированная система валидации LivAiBot с compile-time и runtime проверками
 *
 * Основные инварианты: `assertImmutable()` с shallow/deep режимами, `assertValidErrorCode()` с registry валидацией,
 * `assertMatchingMetadata()` с configurable tolerance. Compile-time helpers: `ValidErrorCode<T>`, `ImmutableError<E>`,
 * `HasRequiredFields<E>` условные типы. Оптимизированная производительность: lazy validation, configurable уровни строгости
 * (strict/dev/production), Effect-based async валидаторы.
 */

// ==================== ИМПОРТЫ ====================

import { Effect } from 'effect';

import { LIVAI_ERROR_CODES } from './ErrorCode.js';

import type { TaggedError } from './BaseErrorTypes.js';
import type { LivAiErrorCode } from './ErrorCode.js';
import type { ErrorClassification } from './ErrorConstants.js';
import type { ErrorMetadataContext } from './ErrorMetadata.js';

// ==================== CONFIGURABLE STRICTNESS LEVELS ====================

export type ValidationStrictnessLevel = 'strict' | 'dev' | 'production';

export type ValidationConfig = {
  readonly deepImmutabilityChecks: boolean;
  readonly metadataValidation: boolean;
  readonly chainValidation: boolean;
  readonly maxChainDepth: number;
  readonly enableCaching: boolean;
  readonly asyncTimeoutMs: number;
};

const BASE_VALIDATION_CONFIG = {
  deepImmutabilityChecks: false,
  metadataValidation: false,
  chainValidation: false,
  maxChainDepth: 3,
  enableCaching: true,
  asyncTimeoutMs: 2000,
} as const;

export const VALIDATION_CONFIGS: Record<ValidationStrictnessLevel, ValidationConfig> = {
  strict: {
    ...BASE_VALIDATION_CONFIG,
    deepImmutabilityChecks: true,
    metadataValidation: true,
    chainValidation: true,
    maxChainDepth: 10,
    enableCaching: false,
    asyncTimeoutMs: 5000,
  },
  dev: {
    ...BASE_VALIDATION_CONFIG,
    deepImmutabilityChecks: true,
    metadataValidation: true,
    maxChainDepth: 5,
    asyncTimeoutMs: 10000,
  },
  production: BASE_VALIDATION_CONFIG,
} as const;

// ==================== TYPE GUARDS ====================

function hasCodeField(obj: unknown): obj is { code: unknown; } {
  return typeof obj === 'object' && obj !== null && 'code' in obj;
}

// ==================== COMPILE-TIME HELPERS ====================

/** Условный тип для проверки валидности error code на compile-time */
export type ValidErrorCode<C extends string> = C extends LivAiErrorCode ? C : never;

/** Условный тип для проверки иммутабельности ошибки */
export type ImmutableError<E> = E extends Readonly<E> ? E : never;

/** Условный тип для проверки наличия обязательных полей */
export type HasRequiredFields<E, RequiredKeys extends keyof E> =
  & E
  & Required<Pick<E, RequiredKeys>>;

/** Тип для проверки что ошибка имеет все необходимые поля метаданных */
export type ValidatedError<E extends TaggedError<unknown, string>> = E & {
  readonly metadata: ErrorMetadataContext;
  readonly classification: ErrorClassification;
};

export type Immutable<T> = T extends object ? {
    readonly [K in keyof T]: Immutable<T[K]>;
  }
  : T;

// ==================== VALIDATION RESULT TYPES ====================

export type ValidationResult = {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly executionTimeMs: number;
  readonly strictnessLevel: ValidationStrictnessLevel;
};

function createValidationResult(params: {
  readonly errors?: readonly ValidationError[];
  readonly warnings?: readonly ValidationWarning[];
  readonly strictness: ValidationStrictnessLevel;
  readonly startTime: number;
}): ValidationResult {
  const errors = params.errors ?? [];
  const warnings = params.warnings ?? [];

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    executionTimeMs: Date.now() - params.startTime,
    strictnessLevel: params.strictness,
  };
}

type ValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly context?: Record<string, unknown>;
};

export type ValidationError = ValidationIssue;

export type ValidationWarning = ValidationIssue;

// ==================== VALIDATION CONTEXT ====================

export type ValidationContext = {
  readonly strictness: ValidationStrictnessLevel;
  readonly config: ValidationConfig;
  readonly cache: Map<string, ValidationResult>;
  readonly depth: number;
  readonly maxDepth: number;
};

/** Создает контекст валидации с преднастроенными параметрами */
export function createValidationContext(
  strictness: ValidationStrictnessLevel = 'dev',
): ValidationContext {
  const config = getValidationConfig(strictness);
  return {
    strictness,
    config,
    cache: new Map(),
    depth: 0,
    maxDepth: config.maxChainDepth,
  };
}

/** Helper функция для получения конфигурации валидации */
function getValidationConfig(
  strictness: ValidationStrictnessLevel,
  context?: ValidationContext,
): ValidationConfig {
  if (context?.config) {
    return context.config;
  }

  switch (strictness) {
    case 'strict':
      return VALIDATION_CONFIGS.strict;
    case 'dev':
      return VALIDATION_CONFIGS.dev;
    case 'production':
      return VALIDATION_CONFIGS.production;
    default:
      return VALIDATION_CONFIGS.dev;
  }
}

// ==================== CORE INVARIANTS ====================

/**
 * Проверяет иммутабельность объекта
 * @param value - Значение для проверки
 * @param mode - Режим проверки: 'shallow' или 'deep'
 * @param context - Контекст валидации
 * @note Deep режим проверяет только объекты/массивы через Object.isFrozen.
 * Map/Set/Date/Buffer и др. типы не проверяются на внутреннюю иммутабельность.
 */
export function assertImmutable<T>(
  value: T,
  mode: 'shallow' | 'deep' = 'shallow',
  context?: ValidationContext,
): ValidationResult {
  const startTime = Date.now();
  let errors: readonly ValidationError[] = [];
  let warnings: readonly ValidationWarning[] = [];
  const strictness = context?.strictness ?? 'dev';
  const config = getValidationConfig(strictness, context);

  if (value === null || value === undefined) {
    return createValidationResult({ strictness, startTime });
  }

  if (typeof value !== 'object') {
    return createValidationResult({ strictness, startTime });
  }

  if (!Object.isFrozen(value)) {
    errors = [...errors, {
      code: 'IMMUTABLE_SHALLOW_CHECK_FAILED',
      message: 'Object is not frozen (shallow immutability check failed)',
      path: '',
    }];
  }

  if (mode === 'deep' && config.deepImmutabilityChecks) {
    const checkDeepImmutability = (obj: unknown, path: string = ''): void => {
      if (context && context.depth >= context.maxDepth) {
        warnings = [...warnings, {
          code: 'IMMUTABLE_DEPTH_LIMIT_EXCEEDED',
          message: `Deep immutability check stopped at depth ${context.maxDepth}`,
          path,
        }];
        return;
      }

      if (obj !== null && obj !== undefined && typeof obj === 'object') {
        if (!Object.isFrozen(obj)) {
          errors = [...errors, {
            code: 'IMMUTABLE_DEEP_CHECK_FAILED',
            message: 'Nested object is not frozen (deep immutability check failed)',
            path,
          }];
        }

        for (const key in obj) {
          if (key in obj && obj.hasOwnProperty(key)) {
            const value = obj[key as keyof typeof obj];
            checkDeepImmutability(value, path ? `${path}.${key}` : key);
          }
        }
      }
    };

    checkDeepImmutability(value);
  }

  return createValidationResult({ errors, warnings, strictness, startTime });
}

export function assertValidErrorCode(
  code: string,
  context?: ValidationContext,
): ValidationResult {
  const startTime = Date.now();
  let errors: readonly ValidationError[] = [];
  let warnings: readonly ValidationWarning[] = [];
  const strictness = context?.strictness ?? 'dev';

  const pattern = /^(DOMAIN|INFRA|SERVICE|ADMIN)_[A-Z]+_\d{3}$/;
  if (!pattern.test(code)) {
    errors = [...errors, {
      code: 'INVALID_ERROR_CODE_FORMAT',
      message: `Error code '${code}' does not match required format PREFIX_CATEGORY_XXX`,
      path: 'code',
    }];
  }

  const validCodes = new Set(Object.values(LIVAI_ERROR_CODES) as readonly string[]);

  if (!validCodes.has(code)) {
    warnings = [...warnings, {
      code: 'UNKNOWN_ERROR_CODE',
      message: `Error code '${code}' is not in the known registry`,
      path: 'code',
    }];
  }

  return createValidationResult({ errors, warnings, strictness, startTime });
}

/**
 * Проверяет соответствие метаданных заданным критериям.
 * Проверка expectedOrigin работает только если metadata.context.type существует.
 */
export function assertMatchingMetadata(
  metadata: ErrorMetadataContext,
  expectedOrigin: string,
  tolerance: 'strict' | 'lenient' | 'none' = 'lenient',
  context?: ValidationContext,
): ValidationResult {
  const startTime = Date.now();
  let errors: readonly ValidationError[] = [];
  let warnings: readonly ValidationWarning[] = [];
  const strictness = context?.strictness ?? 'dev';
  const config = getValidationConfig(strictness, context);
  if (!config.metadataValidation) {
    return createValidationResult({ strictness, startTime });
  }
  if (typeof metadata.correlationId !== 'string' || metadata.correlationId.trim() === '') {
    errors = [...errors, {
      code: 'MISSING_CORRELATION_ID',
      message: 'Correlation ID is required in metadata',
      path: 'metadata.correlationId',
    }];
  }
  if (typeof metadata.timestamp !== 'number' || !(metadata.timestamp > 0)) {
    errors = [...errors, {
      code: 'INVALID_TIMESTAMP',
      message: 'Timestamp must be a positive number',
      path: 'metadata.timestamp',
    }];
  }
  const now = Date.now();
  const TOLERANCE_STRICT_MS = 1000;
  const TOLERANCE_LENIENT_MS = 60000;
  const TOLERANCE_NONE_MS = 0;
  let maxFutureTolerance: number;
  switch (tolerance) {
    case 'strict':
      maxFutureTolerance = TOLERANCE_STRICT_MS;
      break;
    case 'lenient':
      maxFutureTolerance = TOLERANCE_LENIENT_MS;
      break;
    default:
      maxFutureTolerance = TOLERANCE_NONE_MS;
  }
  if (metadata.timestamp > now + maxFutureTolerance) {
    errors = [...errors, {
      code: 'FUTURE_TIMESTAMP',
      message: `Timestamp is too far in the future (tolerance: ${maxFutureTolerance}ms)`,
      path: 'metadata.timestamp',
      context: { timestamp: metadata.timestamp, now, tolerance },
    }];
  }

  // Проверка источника ошибки через domain context
  if (metadata.context && 'type' in metadata.context) {
    const actualOrigin = metadata.context.type;
    if (expectedOrigin !== 'unknown' && actualOrigin !== expectedOrigin) {
      if (strictness === 'strict') {
        errors = [...errors, {
          code: 'ORIGIN_MISMATCH',
          message: `Error origin '${actualOrigin}' does not match expected '${expectedOrigin}'`,
          path: 'metadata.context.type',
          context: { actualOrigin, expectedOrigin },
        }];
      } else {
        warnings = [...warnings, {
          code: 'ORIGIN_MISMATCH_WARNING',
          message: `Error origin '${actualOrigin}' differs from expected '${expectedOrigin}'`,
          path: 'metadata.context.type',
          context: { actualOrigin, expectedOrigin },
        }];
      }
    }
  }

  const MAX_AGE_STRICT_MS = 3600000; // 1 hour
  const MAX_AGE_LENIENT_MS = 86400000; // 24 hours
  const MAX_AGE_NONE_MS = Infinity;
  let maxAge: number;
  switch (tolerance) {
    case 'strict':
      maxAge = MAX_AGE_STRICT_MS;
      break;
    case 'lenient':
      maxAge = MAX_AGE_LENIENT_MS;
      break;
    default:
      maxAge = MAX_AGE_NONE_MS;
  }
  if (metadata.timestamp < now - maxAge) {
    warnings = [...warnings, {
      code: 'OLD_TIMESTAMP',
      message: `Timestamp is older than expected (max age: ${maxAge}ms)`,
      path: 'metadata.timestamp',
    }];
  }
  return createValidationResult({ errors, warnings, strictness, startTime });
}

// ==================== LAZY VALIDATION ====================

/** Создает lazy валидатор - выполняет валидацию только при первом обращении */
export function createLazyValidator<T>(
  validator: (value: T) => ValidationResult,
): {
  validate(value: T): ValidationResult;
  clearCache(): void;
} {
  // Раздельные кеши для объектов и примитивов
  // WeakMap для объектов (автоматическая сборка мусора, нет проблем с циклами)
  // Map для примитивов (нужен строковый ключ)
  let objectCache = new WeakMap<object, ValidationResult>();
  let primitiveCache = new Map<string, ValidationResult>();

  return {
    validate(value: T): ValidationResult {
      // Для объектов используем WeakMap (безопасно для циклических ссылок)
      if (typeof value === 'object' && value !== null) {
        const cached = objectCache.get(value);
        if (cached !== undefined) {
          return cached;
        }
        const result = validator(value);
        objectCache.set(value, result);
        return result;
      }

      // Для примитивов используем обычную Map с строковыми ключами
      const key = String(value);
      const cached = primitiveCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const result = validator(value);
      primitiveCache = new Map(primitiveCache).set(key, result);
      return result;
    },
    clearCache(): void {
      objectCache = new WeakMap<object, ValidationResult>();
      primitiveCache = new Map<string, ValidationResult>();
    },
  };
}

/** Создает lazy валидатор для error code */
export function createLazyErrorCodeValidator(strictness: ValidationStrictnessLevel = 'dev'): {
  validate(value: string): ValidationResult;
  clearCache(): void;
} {
  const context = createValidationContext(strictness);
  return createLazyValidator((code: string) => assertValidErrorCode(code, context));
}

/** Создает lazy валидатор для метаданных */
export function createLazyMetadataValidator(
  expectedOrigin: string,
  tolerance: 'strict' | 'lenient' | 'none' = 'lenient',
  strictness: ValidationStrictnessLevel = 'dev',
): {
  validate(value: ErrorMetadataContext): ValidationResult;
  clearCache(): void;
} {
  const context = createValidationContext(strictness);
  return createLazyValidator((metadata: ErrorMetadataContext) =>
    assertMatchingMetadata(metadata, expectedOrigin, tolerance, context)
  );
}

// ==================== ADVANCED VALIDATION ====================

/** Валидирует цепочку ошибок с проверкой структуры и глубины */
export function validateErrorChain(
  error: TaggedError<unknown, string>,
  context?: ValidationContext,
): ValidationResult {
  const startTime = Date.now();
  let errors: readonly ValidationError[] = [];
  let warnings: readonly ValidationWarning[] = [];
  const strictness = context?.strictness ?? 'dev';
  const config = getValidationConfig(strictness, context);

  if (!config.chainValidation) {
    return createValidationResult({ strictness, startTime });
  }

  // Обход цепочки ошибок с контролем глубины
  let currentError: unknown = error;
  let depth = 0;
  let visitedErrors = new Set<unknown>(); // Предотвращение циклов

  while (currentError !== null && currentError !== undefined && depth < config.maxChainDepth) {
    // Проверка на цикл в цепочке
    if (visitedErrors.has(currentError)) {
      errors = [...errors, {
        code: 'CHAIN_CYCLE_DETECTED',
        message: 'Circular reference detected in error chain',
        path: `chain[${depth}]`,
        context: { depth },
      }];
      break;
    }

    visitedErrors = new Set(visitedErrors).add(currentError);

    // Проверка что текущий элемент является TaggedError
    if (typeof currentError === 'object' && '_tag' in currentError) {
      const taggedError = currentError as TaggedError<unknown, string>;

      // Валидация структуры текущей ошибки
      const structureResult = validateErrorStructure(
        taggedError,
        ['code', 'message', 'metadata'],
        context,
      );
      if (!structureResult.isValid) {
        errors = [
          ...errors,
          ...structureResult.errors.map((err) => ({
            ...err,
            path: `chain[${depth}].${err.path}`,
            context: { ...err.context, chainDepth: depth },
          })),
        ];
      }

      // Валидация кода ошибки
      const codeResult = hasCodeField(taggedError)
        ? assertValidErrorCode(String(taggedError.code), context)
        : assertValidErrorCode('', context);
      if (!codeResult.isValid) {
        errors = [
          ...errors,
          ...codeResult.errors.map((err) => ({
            ...err,
            path: `chain[${depth}].${err.path}`,
            context: { ...err.context, chainDepth: depth },
          })),
        ];
      }
    } else {
      // Текущий элемент не является TaggedError
      warnings = [...warnings, {
        code: 'NON_TAGGED_ERROR_IN_CHAIN',
        message: 'Error in chain is not a TaggedError',
        path: `chain[${depth}]`,
        context: { type: typeof currentError, depth },
      }];
    }

    // Переход к следующей ошибке в цепочке (стандартный Error.cause)
    if (currentError instanceof Error && 'cause' in currentError) {
      currentError = currentError.cause;
    } else {
      // Нет cause - конец цепочки
      break;
    }

    depth++;

    // Проверка на превышение максимальной глубины
    if (depth >= config.maxChainDepth) {
      warnings = [...warnings, {
        code: 'CHAIN_DEPTH_LIMIT_EXCEEDED',
        message: `Error chain depth exceeded limit of ${config.maxChainDepth}`,
        path: 'chain',
        context: { depth, maxDepth: config.maxChainDepth },
      }];
      break;
    }
  }

  return createValidationResult({ errors, warnings, strictness, startTime });
}

/** Структурная валидация ошибки */
export function validateErrorStructure(
  error: TaggedError<unknown, string>,
  requiredFields: readonly string[],
  context?: ValidationContext,
): ValidationResult {
  const startTime = Date.now();
  let errors: readonly ValidationError[] = [];
  const strictness = context?.strictness ?? 'dev';

  for (const field of requiredFields) {
    if (!(field in error)) {
      errors = [...errors, {
        code: 'MISSING_REQUIRED_FIELD',
        message: `Required field '${field}' is missing`,
        path: field,
      }];
    }
  }

  if (!error._tag || error._tag === '') {
    errors = [...errors, {
      code: 'MISSING_TAG',
      message: 'Error must have a _tag property',
      path: '_tag',
    }];
  }

  return createValidationResult({ errors, strictness, startTime });
}

/** Кастомная валидационная правило */
export type CustomValidationRule<T> = {
  readonly name: string;
  readonly validate: (value: T, context?: ValidationContext) => ValidationResult;
  readonly priority: number;
};

/** Композитный валидатор с кастомными правилами */
export class CompositeValidator<T> {
  private readonly rules: readonly CustomValidationRule<T>[];

  addRule(rule: CustomValidationRule<T>): CompositeValidator<T> {
    const newRules = [...this.rules, rule].sort((a, b) => a.priority - b.priority);
    return new CompositeValidator<T>(newRules);
  }

  constructor(rules: readonly CustomValidationRule<T>[] = []) {
    this.rules = rules;
  }

  validate(value: T, context?: ValidationContext): ValidationResult {
    const startTime = Date.now();
    let allErrors: readonly ValidationError[] = [];
    let allWarnings: readonly ValidationWarning[] = [];
    const strictness = context?.strictness ?? 'dev';

    for (const rule of this.rules) {
      const result = rule.validate(value, context);
      allErrors = [...allErrors, ...result.errors];
      allWarnings = [...allWarnings, ...result.warnings];
    }

    return createValidationResult({
      errors: allErrors,
      warnings: allWarnings,
      strictness,
      startTime,
    });
  }
}

export function createErrorValidator(): CompositeValidator<TaggedError<unknown, string>> {
  let validator = new CompositeValidator<TaggedError<unknown, string>>();
  validator = validator.addRule({
    name: 'structure',
    validate: (error, context) =>
      validateErrorStructure(error, ['code', 'message', 'metadata'], context),
    priority: 1,
  });
  validator = validator.addRule({
    name: 'immutability',
    validate: (error, context) => assertImmutable(error, 'shallow', context),
    priority: 2,
  });
  validator = validator.addRule({
    name: 'errorCode',
    validate: (error, context) =>
      assertValidErrorCode(hasCodeField(error) ? String(error.code) : '', context),
    priority: 3,
  });
  return validator;
}

// ==================== EFFECT INTEGRATION ====================

/** Effect-based async валидатор */
export type AsyncValidator = {
  validateError(error: TaggedError<unknown, string>): Effect.Effect<ValidationResult, never, never>;
  validateMetadata(metadata: ErrorMetadataContext): Effect.Effect<ValidationResult, never, never>;
};

/** Реализация AsyncValidator по умолчанию */
export class DefaultAsyncValidator implements AsyncValidator {
  private readonly strictness: ValidationStrictnessLevel;

  constructor(strictness: ValidationStrictnessLevel = 'dev') {
    this.strictness = strictness;
  }

  validateError(
    error: TaggedError<unknown, string>,
  ): Effect.Effect<ValidationResult, never, never> {
    return Effect.sync(() => {
      const context = createValidationContext(this.strictness);
      const validator = createErrorValidator();
      return validator.validate(error, context);
    });
  }

  validateMetadata(metadata: ErrorMetadataContext): Effect.Effect<ValidationResult, never, never> {
    return Effect.sync(() => {
      const context = createValidationContext(this.strictness);
      return assertMatchingMetadata(metadata, 'unknown', 'lenient', context);
    });
  }
}

/** Создает default async validator */
export function createAsyncValidator(
  strictness: ValidationStrictnessLevel = 'dev',
): AsyncValidator {
  return new DefaultAsyncValidator(strictness);
}

// ==================== UTILITY FUNCTIONS ====================

/** Комбинирует результаты нескольких валидаций */
export function combineValidationResults(results: readonly ValidationResult[]): ValidationResult {
  let allErrors: readonly ValidationError[] = [];
  let allWarnings: readonly ValidationWarning[] = [];
  const strictnessLevels = new Set(results.map((r) => r.strictnessLevel));
  const strictnessLevel = strictnessLevels.size === 1
    ? results[0]?.strictnessLevel ?? 'dev'
    : 'dev';

  for (const result of results) {
    allErrors = [...allErrors, ...result.errors];
    allWarnings = [...allWarnings, ...result.warnings];
  }

  const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);

  return createValidationResult({
    errors: allErrors,
    warnings: allWarnings,
    strictness: strictnessLevel,
    startTime: Date.now() - totalExecutionTime,
  });
}

/** Создает readable summary из ValidationResult */
export function formatValidationResult(result: ValidationResult): string {
  let parts: readonly string[] = [];

  if (result.isValid) {
    parts = [...parts, '✅ Validation passed'];
  } else {
    parts = [...parts, '❌ Validation failed'];
  }

  if (result.errors.length > 0) {
    parts = [...parts, `Errors: ${result.errors.length}`];
    for (const error of result.errors) {
      parts = [...parts, `  - ${error.code}: ${error.message}`];
    }
  }

  if (result.warnings.length > 0) {
    parts = [...parts, `Warnings: ${result.warnings.length}`];
    for (const warning of result.warnings) {
      parts = [...parts, `  - ${warning.code}: ${warning.message}`];
    }
  }

  parts = [...parts, `Execution time: ${result.executionTimeMs}ms`];
  parts = [...parts, `Strictness: ${result.strictnessLevel}`];

  return parts.join('\n');
}
