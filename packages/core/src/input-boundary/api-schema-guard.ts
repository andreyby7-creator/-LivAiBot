/**
 * @file packages/core/src/input-boundary/api-schema-guard.ts
 * ============================================================================
 * 🛡️ API SCHEMA GUARD — ЗАЩИТА И ВАЛИДАЦИЯ API КОНТРАКТОВ
 * ============================================================================
 *
 * Архитектурная роль (orchestration слой):
 * - Координация валидации API запросов/ответов (request/response/interaction)
 * - Строгая типизация входящих/исходящих контрактов через ApiSchemaConfig
 * - Стандартизированная интеграция с error-mapping.ts и ServiceName
 * - Делегирование low-level security/errors/Zod/telemetry в runtime-слой (`api-validation-runtime.ts`)
 *
 * Свойства:
 * - Effect-first архитектура для надежной обработки ошибок (чистое использование Effect<A, E, R>)
 * - Расширяемый rule-pipeline (pre/post rules) поверх request/response для auth/rate-limit/header/etc.
 * - Композиционные валидаторы для сложных схем (combineRequest/ResponseValidators)
 * - Детерминированные трансформации данных и strict-mode гарантия валидаторов
 * - Поддержка distributed tracing и request context через ApiValidationContext
 * - Встроенная проверка версии схемы и payload size на boundary-слое
 * - Graceful degradation при ошибках валидации (типизированные ApiValidationError)
 *
 * Принципы:
 * - Минимальный runtime overhead для валидных данных за счёт простых, ранних проверок
 * - Максимальная безопасность и предсказуемость через централизованный runtime-слой
 * - Микросервисная декомпозиция валидаторов и правил (per-service ApiSchemaConfig, ServiceName)
 * - Строгая типизация endpoint'ов через EndpointPath и совместимость с error-mapping.ts/schema-validated-effect
 */

import { Effect as EffectLib } from 'effect';

import { pipeMany } from '@livai/core/effect';
import type { HttpMethod, ServiceName } from '@livai/core-contracts';

import type {
  ApiRequestValidator,
  ApiResponseValidator,
  ApiValidationContextBase,
  ApiValidationError,
  ApiValidationErrorCode,
  ApiValidationTelemetry,
} from './api-validation-runtime.js';
import {
  checkPayloadSize,
  createApiValidationErrorFactory,
  emitWarning,
} from './api-validation-runtime.js';

export { createZodRequestValidator, createZodResponseValidator } from './api-validation-runtime.js';

/* ============================================================================
 * 🔢 CONSTANTS
 * ========================================================================== */

const BYTES_IN_KB = 1024;
const DEFAULT_REQUEST_SIZE_LIMIT = BYTES_IN_KB * BYTES_IN_KB; // 1MB
const DEFAULT_RESPONSE_SIZE_LIMIT = 10 * BYTES_IN_KB * BYTES_IN_KB; // 10MB

/**
 * Глобальная настройка strict mode по умолчанию.
 * Определяется исключительно через явную конфигурацию (bootstrap/infra), а не через env.
 */
const DEFAULT_STRICT_MODE = false;

/* ============================================================================
 * 🧠 КОНТЕКСТ ВАЛИДАЦИИ API
 * ========================================================================== */

/** Брендированный тип пути endpoint'а для избежания путаницы со свободными строками. */
export type EndpointPath = string & { readonly __brand: 'EndpointPath'; };

/**
 * Контекст валидации API запросов/ответов.
 * Расширяет базовый ValidationContext дополнительными API-специфичными полями.
 * Включает serviceId/instanceId для точного tracing при горизонтальном масштабировании.
 */
export type ApiValidationContext = ApiValidationContextBase;
export type { ApiValidationTelemetry };

/* ============================================================================
 * ❌ ОШИБКИ API ВАЛИДАЦИИ
 * ========================================================================== */

/**
 * Специфические коды ошибок для API schema validation.
 * Совместимы с error-mapping.ts и микросервисной архитектурой.
 */
export type { ApiValidationError, ApiValidationErrorCode };

/* ============================================================================
 * 🔧 ВАЛИДАТОРЫ API СХЕМ
 * ========================================================================== */

/**
 * Валидатор для API запросов.
 * Проверяет структуру, типы и бизнес-правила входящих данных.
 */
export type { ApiRequestValidator };

/**
 * Валидатор для API ответов.
 * Проверяет структуру, типы и бизнес-правила исходящих данных.
 */
export type { ApiResponseValidator };

/**
 * Конфигурация валидации для конкретного API endpoint'а.
 * Позволяет гибко настраивать валидацию для разных микросервисов.
 * Strict mode:
 * - Если `strictMode: true`, валидаторы обязательны для request и response
 * - Если `strictMode` не указан, используется глобальная настройка DEFAULT_STRICT_MODE
 * - В strict mode отсутствие валидаторов приводит к ошибке валидации
 */
export interface ApiSchemaConfig<TRequest = unknown, TResponse = unknown> {
  readonly service: ServiceName;
  readonly method: HttpMethod;
  readonly endpoint: EndpointPath;

  // Валидаторы
  readonly requestValidator?: ApiRequestValidator<TRequest> | undefined;
  readonly responseValidator?: ApiResponseValidator<TResponse> | undefined;

  /**
   * Дополнительные произвольные правила валидации запроса.
   * Фаза выполнения задаётся на уровне каждого правила (pre/post), порядок — через priority.
   */
  readonly requestRules?: readonly ApiValidationRule[] | undefined;
  /**
   * Дополнительные произвольные правила валидации ответа.
   * Фаза выполнения задаётся на уровне каждого правила (pre/post), порядок — через priority.
   */
  readonly responseRules?: readonly ApiValidationRule[] | undefined;

  // Лимиты
  readonly maxRequestSize?: number | undefined;
  readonly maxResponseSize?: number | undefined;

  // Версионирование схем
  readonly schemaVersion?: string | undefined;
  readonly supportedVersions?: readonly string[] | undefined;

  /**
   * Strict mode — обязательная валидация для всех effects.
   * Если `true`, валидаторы обязательны для request и response.
   * Если не указано, используется глобальная настройка DEFAULT_STRICT_MODE.
   */
  readonly strictMode?: boolean | undefined;
}

/* ============================================================================
 * 🛡️ ОСНОВНЫЕ ФУНКЦИИ ЗАЩИТЫ
 * ========================================================================== */

const createApiValidationError = createApiValidationErrorFactory();

/* ============================================================================
 * 🔁 VALIDATION PIPELINE ENGINE
 * ========================================================================== */

/** Фаза выполнения правила валидации относительно size/schema‑проверок. */
export type ApiValidationPhase = 'pre' | 'post';

/**
 * Унифицированное правило валидации payload на boundary-слое.
 * Используется для расширяемого rule‑pipeline (auth, rate-limit, header checks и т.п.).
 * maxSize (опционально) позволяет задать локальный лимит размера для конкретного правила;
 * priority (опционально) управляет порядком выполнения правил внутри одной фазы.
 */
export interface ApiValidationRule<TPayload = unknown> {
  readonly phase: ApiValidationPhase;
  readonly maxSize?: number | undefined;
  readonly priority?: number | undefined;
  readonly run: (
    payload: TPayload,
    config: ApiSchemaConfig,
    context: ApiValidationContext,
  ) => EffectLib.Effect<void, ApiValidationError, never>;
}

function applyRules(
  rules: readonly ApiValidationRule[] | undefined,
  phase: ApiValidationPhase,
  kind: 'request' | 'response',
  payload: unknown,
  config: ApiSchemaConfig,
  context: ApiValidationContext,
  sizeErrorCode: ApiValidationErrorCode,
  globalMaxSize: number | undefined,
): EffectLib.Effect<void, ApiValidationError, never> {
  if (!rules || rules.length === 0) {
    return EffectLib.succeed(undefined);
  }

  const rulesForPhase = rules
    .filter((rule) => rule.phase === phase)
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  if (rulesForPhase.length === 0) {
    return EffectLib.succeed(undefined);
  }

  return rulesForPhase.reduce(
    (effect, rule) =>
      EffectLib.flatMap(
        effect,
        () => {
          const effectiveRuleMaxSize = rule.maxSize ?? globalMaxSize;

          if (effectiveRuleMaxSize !== undefined) {
            const violation = checkPayloadSize(kind, payload, effectiveRuleMaxSize, context);
            if (violation !== null) {
              return createApiValidationError(
                sizeErrorCode,
                [],
                context,
                undefined,
                violation,
              ) as EffectLib.Effect<void, ApiValidationError, never>;
            }
          }

          return rule.run(payload, config, context);
        },
      ),
    EffectLib.succeed(undefined) as EffectLib.Effect<void, ApiValidationError, never>,
  );
}

interface ValidatePayloadOptions {
  readonly kind: 'request' | 'response';
  readonly payload: unknown;
  readonly config: ApiSchemaConfig;
  readonly context: ApiValidationContext;
  readonly validator?: ApiRequestValidator<unknown> | ApiResponseValidator<unknown> | undefined;
  readonly maxSize?: number | undefined;
  readonly strictErrorCode: ApiValidationErrorCode;
  readonly sizeErrorCode: ApiValidationErrorCode;
  readonly field: 'request' | 'response';
  readonly rules?: readonly ApiValidationRule[] | undefined;
}

function validatePayload<T>({
  kind,
  payload,
  config,
  context,
  validator,
  maxSize,
  strictErrorCode,
  sizeErrorCode,
  field,
  rules,
}: ValidatePayloadOptions): EffectLib.Effect<T, ApiValidationError, never> {
  const effectiveStrictMode = config.strictMode ?? DEFAULT_STRICT_MODE;

  // 1) Strict‑mode: проверяем, что валидатор задан.
  if (effectiveStrictMode && validator === undefined) {
    return createApiValidationError(
      strictErrorCode,
      [{
        code: strictErrorCode,
        field,
        message: `${
          kind === 'request' ? 'Request' : 'Response'
        } validator is required in strict mode for ${config.service} ${config.method} ${config.endpoint}`,
      }],
      context,
    ) as EffectLib.Effect<T, ApiValidationError, never>;
  }

  // 2) Pre‑rules (работают до size/schema‑проверок).
  const preRulesEffect = applyRules(
    rules,
    'pre',
    kind,
    payload,
    config,
    context,
    sizeErrorCode,
    maxSize,
  );

  return EffectLib.flatMap(
    preRulesEffect,
    () => {
      // 3) Ограничение размера payload (глобальный лимит).
      const effectiveMaxSize = maxSize
        ?? (kind === 'request'
          ? DEFAULT_REQUEST_SIZE_LIMIT
          : undefined);

      if (effectiveMaxSize !== undefined) {
        const violation = checkPayloadSize(kind, payload, effectiveMaxSize, context);
        if (violation !== null) {
          return createApiValidationError(
            sizeErrorCode,
            [],
            context,
            undefined,
            violation,
          ) as EffectLib.Effect<T, ApiValidationError, never>;
        }
      }

      // 4) Схемная валидация.
      if (validator) {
        const validationResult = validator(payload, context);
        if (!validationResult.success) {
          return createApiValidationError(
            strictErrorCode,
            [...validationResult.errors],
            context,
          ) as EffectLib.Effect<T, ApiValidationError, never>;
        }

        const validatedValue = validationResult.value as T;

        // 5) Post‑rules — работают уже поверх прошедших schema‑проверку данных.
        const postRulesEffect = applyRules(
          rules,
          'post',
          kind,
          validatedValue,
          config,
          context,
          sizeErrorCode,
          effectiveMaxSize,
        );

        return EffectLib.map(
          postRulesEffect,
          () => validatedValue,
        );
      }

      // Non‑strict режим без валидатора — просто пропускаем данные дальше.
      const passthroughValue = payload as T;
      const postRulesEffect = applyRules(
        rules,
        'post',
        kind,
        passthroughValue,
        config,
        context,
        sizeErrorCode,
        effectiveMaxSize,
      );

      return EffectLib.map(
        postRulesEffect,
        () => passthroughValue,
      );
    },
  );
}

export function validateApiRequest<T>(
  /** сырые данные запроса */
  request: unknown,
  /** конфигурация валидации */
  config: ApiSchemaConfig<T>,
  /** контекст выполнения */
  context: ApiValidationContext,
): EffectLib.Effect<T, ApiValidationError, never> {
  // Сначала опционально проверяем версию схемы.
  const hasVersionConfig = config.schemaVersion !== undefined
    || (config.supportedVersions !== undefined && config.supportedVersions.length > 0);

  const versionCheckEffect: EffectLib.Effect<void, ApiValidationError, never> = hasVersionConfig
    ? validateSchemaVersion(
      config.schemaVersion,
      config.supportedVersions,
      context,
    )
    : EffectLib.succeed(undefined);

  return EffectLib.flatMap(
    versionCheckEffect,
    () =>
      validatePayload<T>({
        kind: 'request',
        payload: request,
        config,
        context,
        validator: config.requestValidator,
        maxSize: config.maxRequestSize,
        strictErrorCode: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        sizeErrorCode: 'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
        field: 'request',
        rules: config.requestRules,
      }),
  );
}

export function validateApiResponse<T>(
  /** данные ответа */
  response: unknown,
  /** конфигурация валидации */
  config: ApiSchemaConfig<unknown, T>,
  /** контекст выполнения */
  context: ApiValidationContext,
): EffectLib.Effect<T, ApiValidationError, never> {
  return validatePayload<T>({
    kind: 'response',
    payload: response,
    config,
    context,
    validator: config.responseValidator,
    maxSize: config.maxResponseSize,
    strictErrorCode: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
    sizeErrorCode: 'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE',
    field: 'response',
    rules: config.responseRules,
  });
}

export function validateApiInteraction<TRequest, TResponse>(
  /** входящий запрос */
  request: unknown,
  /** исходящий ответ */
  response: unknown,
  /** конфигурация валидации */
  config: ApiSchemaConfig<TRequest, TResponse>,
  /** контекст выполнения */
  context: ApiValidationContext,
): EffectLib.Effect<{ request: TRequest; response: TResponse; }, ApiValidationError, never> {
  return EffectLib.flatMap(
    validateApiRequest<TRequest>(request, config, context),
    (validatedRequest) =>
      EffectLib.map(
        validateApiResponse<TResponse>(response, config, context),
        (validatedResponse) => ({
          request: validatedRequest,
          response: validatedResponse,
        }),
      ),
  );
}

/* ============================================================================
 * 🔒 STRICT MODE И ENFORCE
 * ========================================================================== */

/**
 * Проверяет, что в strict mode валидаторы присутствуют.
 * Используется для enforce обязательной валидации на уровне инфраструктуры.
 * Исключений не бросает — возвращает boolean‑флаг, решение о throw остаётся за вызывающим кодом.
 */
export function enforceStrictValidation<TRequest = unknown, TResponse = unknown>(
  config: ApiSchemaConfig<TRequest, TResponse>, // Конфигурация валидации API
): boolean {
  // Определяем эффективный strict mode (локальный или глобальный)
  const effectiveStrictMode = config.strictMode ?? DEFAULT_STRICT_MODE;

  if (!effectiveStrictMode) {
    return true;
  }

  return config.requestValidator !== undefined && config.responseValidator !== undefined;
}

/** Получает текущую глобальную настройку strict mode. */
export function getDefaultStrictMode(): boolean {
  return DEFAULT_STRICT_MODE; // true если strict mode включен глобально
}

/* ============================================================================
 * 🎯 УТИЛИТЫ ДЛЯ МИКРОСЕРВИСОВ
 * ========================================================================== */

/**
 * Создает стандартную конфигурацию валидации для REST API.
 * Упрощает настройку типичных сценариев.
 * В strict mode автоматически проверяет наличие валидаторов.
 * Если strictMode не указан, используется глобальная настройка DEFAULT_STRICT_MODE.
 * @throws Error если в strict mode отсутствуют обязательные валидаторы
 */
export function createRestApiSchema<TRequest = unknown, TResponse = unknown>(
  service: ServiceName, // Имя сервиса
  method: HttpMethod, // HTTP метод
  endpoint: EndpointPath, // Путь endpoint'а
  options: { // Опции конфигурации
    requestValidator?: ApiRequestValidator<TRequest>;
    responseValidator?: ApiResponseValidator<TResponse>;
    maxRequestSize?: number;
    maxResponseSize?: number;
    schemaVersion?: string;
    strictMode?: boolean;
    requestRules?: readonly ApiValidationRule[];
    responseRules?: readonly ApiValidationRule[];
  } = {},
): ApiSchemaConfig<TRequest, TResponse> { // Конфигурация валидации API
  const config: ApiSchemaConfig<TRequest, TResponse> = {
    service,
    method,
    endpoint,
    requestValidator: options.requestValidator,
    responseValidator: options.responseValidator,
    maxRequestSize: options.maxRequestSize ?? DEFAULT_REQUEST_SIZE_LIMIT,
    maxResponseSize: options.maxResponseSize ?? DEFAULT_RESPONSE_SIZE_LIMIT,
    schemaVersion: options.schemaVersion,
    supportedVersions: options.schemaVersion !== undefined ? [options.schemaVersion] : [],
    strictMode: options.strictMode,
    requestRules: options.requestRules,
    responseRules: options.responseRules,
  };

  return config;
}

/**
 * Создает комбинированный валидатор для сложных схем запросов.
 * Полезно для композиции нескольких request валидаторов.
 */
export function combineRequestValidators<T>(
  ...validators: ApiRequestValidator<T>[]
): ApiRequestValidator<T> {
  return pipeMany(...validators);
}

/**
 * Создает комбинированный валидатор для сложных схем ответов.
 * Полезно для композиции нескольких response валидаторов.
 */
export function combineResponseValidators<T>(
  ...validators: ApiResponseValidator<T>[]
): ApiResponseValidator<T> {
  return pipeMany(...validators);
}

/**
 * Проверяет совместимость версий схем.
 * Используется для graceful handling breaking changes.
 */
export function validateSchemaVersion(
  requestedVersion: string | undefined,
  supportedVersions: readonly string[] | undefined,
  context: ApiValidationContext,
): EffectLib.Effect<void, ApiValidationError, never> {
  const effectiveSupportedVersions = supportedVersions ?? [];

  if (requestedVersion !== undefined && !effectiveSupportedVersions.includes(requestedVersion)) {
    emitWarning(context, 'API schema version mismatch detected', {
      requestedVersion,
      supportedVersions: effectiveSupportedVersions.join(','),
    });

    return EffectLib.flatMap(
      createApiValidationError(
        'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
        [],
        context,
        undefined,
        {
          requestedVersion,
          supportedVersions: [...effectiveSupportedVersions],
        },
      ),
      () => EffectLib.succeed(undefined),
    );
  }

  return EffectLib.succeed(undefined);
}
