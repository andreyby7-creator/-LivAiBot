/**
 * @file packages/feature-auth/src/effects/register.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Register Effect Orchestrator
 * ============================================================================
 *
 * Оркестратор register-flow с разделением ответственности:
 * - validateAndEnrich: валидация и обогащение метаданных
 * - callRegisterApi: API-вызов и domain mapping
 * - handleStoreAndAudit: обновление store и audit logging
 *
 * Инварианты:
 * - ❌ Нет бизнес-логики внутри orchestrator
 * - ✅ Все side-effects только через DI-порты
 * - ✅ Все ошибки через deps.errorMapper.map(...)
 * - ✅ Fail-closed: при частично успешном ответе — reject
 * - ❌ Не пересчитывает security (security-pipeline опционален)
 * - ❌ Не читает store, не делает fallback
 */

import type { Effect } from '@livai/core/effect';
import { validatedEffect, withTimeout } from '@livai/core/effect';

import type { AuthErrorResponse } from '../domain/AuthErrorResponse.js';
import { getAuthRetryable } from '../domain/AuthRetry.js';
import type { DeviceInfo } from '../domain/DeviceInfo.js';
import type { RegisterIdentifierType, RegisterRequest } from '../domain/RegisterRequest.js';
import type { RegisterResponse } from '../domain/RegisterResponse.js';
import type { RegisterResponseValues } from '../schemas/index.js';
import { registerResponseSchema } from '../schemas/index.js';
import type { AuthError } from '../types/auth.js';
import {
  mapRegisterRequestToApiPayload,
  mapRegisterResponseToDomain,
} from './register/register-api.mapper.js';
import type { RegisterResultForAudit } from './register/register-audit.mapper.js';
import {
  createRegisterAuditContext,
  mapAuditResultToPublicResult,
  mapDomainResultToAuditResult,
  mapRegisterResultToAuditEvent,
} from './register/register-audit.mapper.js';
import type {
  EventIdGeneratorPort,
  RegisterEffectConfig,
  RegisterEffectDeps,
  TraceIdGeneratorPort,
} from './register/register-effect.types.js';
import { buildRegisterMetadata } from './register/register-metadata.enricher.js';
import { updateRegisterState } from './register/register-store-updater.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Максимальная длина очереди для serialize стратегии (защита от DoS) */
const MAX_SERIALIZE_QUEUE_LENGTH = 10;

/* ============================================================================
 * 🧭 TYPES — PUBLIC REGISTER RESULT
 * ============================================================================
 */

/**
 * Публичный результат register-effect.
 * @remarks
 * - Слой над RegisterResponse/AuthError для удобства вызывающей стороны
 * - Orchestrator сам не делает побочных эффектов, кроме DI-портов
 * - На данный момент идентичен RegisterResultForAudit (явно показывает связь)
 */
export type RegisterResult = RegisterResultForAudit;

/* ============================================================================
 * 🧰 HELPERS — TIME & METADATA CONTEXT
 * ============================================================================
 */

/**
 * Конвертирует epoch milliseconds в ISO 8601 string.
 * @note Используется для детерминизма и тестируемости (вместо new Date().toISOString())
 *       Принимает timestamp извне (deps.clock.now()) для тестируемости.
 */
function epochMsToIsoString(epochMs: number): string {
  const date = new Date(epochMs);
  return date.toISOString();
}

/**
 * Генерирует traceId для register-flow через DI.
 */
function generateTraceId(traceIdGenerator: TraceIdGeneratorPort): string {
  return traceIdGenerator.generate();
}

/**
 * Контекст для register-flow metadata enrichment.
 * @note Отдельный тип от LoginContext для domain purity.
 */
type RegisterContext = {
  readonly request: RegisterRequest<RegisterIdentifierType>;
  readonly traceId: string;
  readonly timestamp: string;
};

/**
 * Создаёт RegisterContext для metadata enricher.
 * @note Использует LoginContext структуру для переиспользования buildLoginMetadata.
 *       RegisterRequest совместим с LoginRequest по структуре identifier.
 */
function createRegisterContext(
  request: RegisterRequest<RegisterIdentifierType>,
  deps: RegisterEffectDeps,
): RegisterContext {
  const nowMs = deps.clock.now();
  const timestampIso = epochMsToIsoString(nowMs);
  const traceId = generateTraceId(deps.traceIdGenerator);

  return {
    request,
    traceId,
    timestamp: timestampIso,
  };
}

/**
 * Генерирует уникальный eventId для audit-события.
 * @note Используется в orchestrator для детерминизма в тестах (можно подменить через DI).
 *       eventIdGenerator обязателен (передаётся через DI в composer'е).
 */
function generateEventId(
  eventIdGenerator: EventIdGeneratorPort,
): string {
  return eventIdGenerator.generate();
}

/* ============================================================================
 * 🏭 ERROR FACTORIES — ЦЕНТРАЛИЗОВАННОЕ СОЗДАНИЕ ОШИБОК
 * ============================================================================
 */

/**
 * Создает ошибку rate_limited для переполнения очереди.
 * @note Централизованная фабрика для унификации кодов ошибок и сообщений.
 */
function createRateLimitedError(): AuthError {
  return {
    kind: 'rate_limited',
    message: 'Register queue is full, please try again later',
  };
}

/* ============================================================================
 * 📋 AUDIT HANDLER — ОТДЕЛЬНЫЙ HANDLER ДЛЯ AUDIT LOGGING
 * ============================================================================
 */

/** Параметры для audit logging. */
type AuditLogParams = {
  readonly deps: RegisterEffectDeps;
  readonly registerContext: RegisterContext;
  readonly originalRequest: RegisterRequest<RegisterIdentifierType>;
  readonly domainResult: RegisterResponse | undefined;
  readonly auditResult: RegisterResultForAudit;
  readonly deviceInfo?: DeviceInfo | undefined;
};

/**
 * Выполняет audit logging для register-flow.
 * @note Best-effort: не влияет на основной flow и не await'ит результат логгера.
 */
function handleAuditLogging(params: AuditLogParams): void {
  try {
    const eventId = generateEventId(params.deps.eventIdGenerator);
    const auditContext = createRegisterAuditContext(
      params.registerContext,
      params.originalRequest,
      params.domainResult,
      eventId,
      params.deviceInfo,
    );
    const auditEvent = mapRegisterResultToAuditEvent(params.auditResult, auditContext);
    const logResult = params.deps.auditLogger.logRegisterEvent(auditEvent);
    // Не await'им результат: если это Promise, подавляем ошибки через catch
    if (logResult instanceof Promise) {
      logResult.catch((e: unknown) => {
        params.deps.telemetry?.recordAuditFailure({
          operation: 'register',
          reason: e instanceof Error ? e.message : String(e),
        });
      });
    }
  } catch {
    // Best-effort: ошибки аудита не ломают регистрацию (логирование вне scope эффекта).
    params.deps.telemetry?.recordAuditFailure({
      operation: 'register',
      reason: 'audit logging failed',
    });
  }
}

/* ============================================================================
 * 🔄 PIPELINE STEPS — РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ
 * ============================================================================
 */

/** Параметры для validateAndEnrich. */
type ValidateAndEnrichParams = {
  readonly request: RegisterRequest<RegisterIdentifierType>;
  readonly deps: RegisterEffectDeps;
};

/** Результат validateAndEnrich. */
type ValidateAndEnrichResult = {
  readonly validatedRequest: RegisterRequest<RegisterIdentifierType>;
  readonly registerContext: RegisterContext;
};

/** Валидирует структуру `request.identifier`. */
function validateIdentifier(
  identifier: RegisterRequest<RegisterIdentifierType>['identifier'],
): void {
  if (typeof identifier !== 'object') {
    throw new Error('[register] identifier is required and must be an object');
  }
  const identifierType = identifier.type;
  if (typeof identifierType !== 'string') {
    throw new Error('[register] identifier.type is required and must be a string');
  }
  const identifierValue = identifier.value;
  if (typeof identifierValue !== 'string') {
    throw new Error('[register] identifier.value is required and must be a string');
  }
}

/** Валидирует обязательные поля для non-OAuth регистрации. */
function validateNonOAuthFields(
  password: RegisterRequest<RegisterIdentifierType>['password'],
  workspaceName: RegisterRequest<RegisterIdentifierType>['workspaceName'],
): void {
  const passwordValue = password;
  if (typeof passwordValue !== 'string' || passwordValue.trim() === '') {
    throw new Error('[register] password is required for non-OAuth registration');
  }
  const workspaceNameValue = workspaceName;
  if (typeof workspaceNameValue !== 'string' || workspaceNameValue.trim() === '') {
    throw new Error('[register] workspaceName is required for non-OAuth registration');
  }
}

/** Валидирует OAuth поля. */
function validateOAuthFields(provider: RegisterRequest<'oauth'>['provider']): void {
  if (typeof provider !== 'string') {
    throw new Error('[register] provider is required for OAuth registration');
  }
}

/**
 * Валидирует domain RegisterRequest.
 * @note Проверяет обязательные поля и структуру identifier.
 */
function validateRegisterRequest(
  request: RegisterRequest<RegisterIdentifierType>,
): void {
  validateIdentifier(request.identifier);

  const identifierType = request.identifier.type;
  if (identifierType === 'oauth') {
    validateOAuthFields(request.provider);
    return;
  }
  validateNonOAuthFields(request.password, request.workspaceName);
}

/**
 * Выполняет валидацию и обогащение метаданных.
 * @note Выделено отдельно для читаемости (SRP).
 */
function validateAndEnrich(params: ValidateAndEnrichParams): ValidateAndEnrichResult {
  // Step 1 — validate-input (domain RegisterRequest)
  validateRegisterRequest(params.request);
  const validatedRequest = params.request;

  // Step 2 — enrich-metadata
  const registerContext = createRegisterContext(validatedRequest, params.deps);
  // Детеминированное обогащение метаданных (без зависимости от login-specific abstractions)
  buildRegisterMetadata(
    {
      request: registerContext.request,
      traceId: registerContext.traceId,
      timestamp: registerContext.timestamp,
    },
    { identifierHasher: params.deps.identifierHasher.hash },
  );

  return {
    validatedRequest,
    registerContext,
  };
}

/** Параметры для callRegisterApi. */
type CallRegisterApiParams = {
  readonly validatedRequest: RegisterRequest<RegisterIdentifierType>;
  readonly deps: RegisterEffectDeps;
  readonly config: RegisterEffectConfig;
  readonly signal: AbortSignal;
};

/** Результат callRegisterApi. */
type CallRegisterApiResult = {
  readonly domainResult: RegisterResponse;
};

/**
 * Выполняет API-вызов register и domain mapping.
 * @note Отдельный шаг пайплайна (SRP).
 */
async function callRegisterApi(params: CallRegisterApiParams): Promise<CallRegisterApiResult> {
  // Step 3 — API-call через validatedEffect
  const registerRequestPayload = mapRegisterRequestToApiPayload(params.validatedRequest);

  // Effect-based API-клиент: AbortSignal передаётся через параметр Effect
  const registerEffect = validatedEffect(
    registerResponseSchema,
    params.deps.apiClient.post<RegisterResponseValues>(
      '/v1/auth/register',
      registerRequestPayload,
    ),
    { service: 'AUTH' },
  );

  // Global hard timeout для всего register-effect (защита от зависания)
  // Default задаётся в composer, не здесь (уменьшает количество состояний системы)
  const registerHardTimeoutMs = params.config.hardTimeout;
  const registerWithHardTimeout = withTimeout(
    registerEffect,
    { timeoutMs: registerHardTimeoutMs, tag: 'register-orchestrator' },
  );
  // Timeout enforced by global hard timeout above
  // eslint-disable-next-line @livai/multiagent/orchestration-safety
  const registerResponseValues = await registerWithHardTimeout(params.signal);

  // Domain mapping
  const domainResult: RegisterResponse = mapRegisterResponseToDomain(
    registerResponseValues,
    () => params.deps.clock.now(),
  );

  return {
    domainResult,
  };
}

/** Параметры для updateStore. */
type UpdateStoreParams = {
  readonly deps: RegisterEffectDeps;
  readonly validatedRequest: RegisterRequest<RegisterIdentifierType>;
  readonly domainResult: RegisterResponse;
};

/** Выполняет обновление store. Отдельный шаг пайплайна (SRP). */
function updateStore(params: UpdateStoreParams): void {
  updateRegisterState(
    params.deps.authStore,
    params.domainResult,
    params.validatedRequest,
  );
}

/** Параметры для handleStoreAndAudit. */
type HandleStoreAndAuditParams = {
  readonly deps: RegisterEffectDeps;
  readonly validatedRequest: RegisterRequest<RegisterIdentifierType>;
  readonly registerContext: RegisterContext;
  readonly domainResult: RegisterResponse;
};

/** Результат handleStoreAndAudit. */
type HandleStoreAndAuditResult = {
  readonly publicResult: RegisterResult;
};

/** Выполняет обновление store и audit logging. Отдельный шаг пайплайна (SRP). */
function handleStoreAndAudit(params: HandleStoreAndAuditParams): HandleStoreAndAuditResult {
  // Store update (атомарный updater)
  updateStore({
    deps: params.deps,
    validatedRequest: params.validatedRequest,
    domainResult: params.domainResult,
  });

  // Преобразуем domain result в audit result (табличный подход)
  const auditResult = mapDomainResultToAuditResult(params.domainResult);

  // Строим DeviceInfo для audit context (используем тот же подход, что и в store-updater)
  const deviceInfo: DeviceInfo = {
    deviceId: params.validatedRequest.clientContext?.deviceId ?? '',
    deviceType: 'unknown',
    ...(params.validatedRequest.clientContext?.geo !== undefined
      ? { geo: params.validatedRequest.clientContext.geo }
      : {}),
  };

  // Audit logging (отдельный handler)
  handleAuditLogging({
    deps: params.deps,
    registerContext: params.registerContext,
    originalRequest: params.validatedRequest,
    domainResult: params.domainResult,
    auditResult,
    deviceInfo,
  });

  // Преобразуем audit result в публичный результат (табличный подход)
  const publicResult = mapAuditResultToPublicResult(auditResult);

  return {
    publicResult,
  };
}

/* ============================================================================
 * 🔄 CONCURRENCY CONTROL — УПРАВЛЕНИЕ КОНКУРЕНТНОСТЬЮ
 * ============================================================================
 */

/** Состояние для управления конкурентностью. */
type ConcurrencyState = {
  inFlight: Promise<RegisterResult> | null;
  currentController: AbortController | null;
  queueTail: Promise<RegisterResult> | null;
  queueLength: number;
};

/**
 * Создает менеджер конкурентности для register-effect.
 * @note Отдельный компонент для concurrency semantics.
 */
function createConcurrencyManager(
  config: RegisterEffectConfig,
  deps: RegisterEffectDeps,
): {
  execute: (
    request: RegisterRequest<RegisterIdentifierType>,
    runOnce: (signal: AbortSignal) => Promise<RegisterResult>,
    externalSignal?: AbortSignal,
  ) => Promise<RegisterResult>;
} {
  const state: ConcurrencyState = {
    inFlight: null,
    currentController: null,
    queueTail: null,
    queueLength: 0,
  };

  return {
    execute: (
      _request: RegisterRequest<RegisterIdentifierType>,
      runOnce: (signal: AbortSignal) => Promise<RegisterResult>,
      externalSignal?: AbortSignal,
    ): Promise<RegisterResult> => {
      // Конкурентная стратегия: ignore — возвращаем уже выполняющийся запрос
      if (config.concurrency === 'ignore' && state.inFlight !== null) {
        // Возвращаем уже выполняющийся запрос (очистка inFlight происходит в finally)
        return state.inFlight;
      }

      const controller = deps.abortController.create();
      const signal = externalSignal ?? controller.signal;

      const executeWithStrategy = async (): Promise<RegisterResult> => {
        if (config.concurrency === 'cancel_previous' && state.currentController !== null) {
          // Отменяем предыдущий запрос через его AbortController
          state.currentController.abort();
        }

        if (config.concurrency === 'serialize') {
          // Защита от DoS: проверяем лимит длины очереди
          if (state.queueLength >= MAX_SERIALIZE_QUEUE_LENGTH) {
            return { type: 'error', error: createRateLimitedError() };
          }

          state.queueLength++;
          const previous = state.queueTail;
          const current = (async (): Promise<RegisterResult> => {
            if (previous) {
              // Ждем завершения предыдущего запроса (игнорируем ошибки, чтобы не блокировать очередь)
              // Previous request имеет свой timeout через global hard timeout выше
              // eslint-disable-next-line @livai/multiagent/orchestration-safety
              await previous.catch(() => {});
            }
            return runOnce(signal);
          })();
          state.queueTail = current; // Обновляем хвост очереди для следующего запроса
          // Очищаем счетчик после завершения
          current.finally(() => {
            state.queueLength--;
            if (state.queueTail === current) {
              state.queueTail = null;
            }
          }).catch(() => {
            // Игнорируем ошибки при очистке
          });
          return current;
        }

        return runOnce(signal);
      };

      // Сохраняем текущий controller для cancel_previous стратегии
      state.currentController = controller;

      const promise = executeWithStrategy();

      // Устанавливаем inFlight только для ignore стратегии
      if (config.concurrency === 'ignore') {
        state.inFlight = promise;
      }

      if (externalSignal) {
        externalSignal.addEventListener(
          'abort',
          () => {
            controller.abort();
          },
          { once: true },
        );
      }

      // Очищаем состояние после завершения запроса
      promise.finally(() => {
        // Очищаем currentController (проверяем, что это все еще тот же controller)
        if (state.currentController === controller) {
          state.currentController = null;
        }
        // Очищаем inFlight для ignore стратегии (защита от edge-case: новый запрос до finally)
        if (config.concurrency === 'ignore' && state.inFlight === promise) {
          state.inFlight = null;
        }
      }).catch(() => {
        // Игнорируем ошибки при очистке
      });

      return promise;
    },
  };
}

/* ============================================================================
 * 🎯 EFFECT FACTORY — CREATE REGISTER EFFECT
 * ============================================================================
 */

/** Оркестратор register-flow. */
export function createRegisterEffect(
  deps: RegisterEffectDeps, // DI-порты для register-effect
  config: RegisterEffectConfig, // Конфигурация таймаутов и стратегии конкуренции
): (request: RegisterRequest<RegisterIdentifierType>) => Effect<RegisterResult> {
  const concurrencyManager = createConcurrencyManager(config, deps);

  return (request: RegisterRequest<RegisterIdentifierType>): Effect<RegisterResult> =>
  async (externalSignal?: AbortSignal): Promise<RegisterResult> => {
    const runOnce = async (signal: AbortSignal): Promise<RegisterResult> => {
      try {
        // Pipeline: validate → enrich → API call → store update → audit
        // Timeout enforced by global hard timeout in callRegisterApi (withTimeout wrapper)
        const { validatedRequest, registerContext } = validateAndEnrich({
          request,
          deps,
        });

        // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Timeout enforced by global hard timeout in callRegisterApi (withTimeout wrapper)
        const { domainResult } = await callRegisterApi({
          validatedRequest,
          deps,
          config,
          signal,
        });

        const { publicResult } = handleStoreAndAudit({
          deps,
          validatedRequest,
          registerContext,
          domainResult,
        });

        // eslint-disable-next-line @livai/rag/source-citation -- Это локальный результат API, не RAG response
        return publicResult;
      } catch (unknownError: unknown) {
        // Production-safe защита от ошибок mapper: если mapper бросит, используем fallback
        let error: AuthError;
        try {
          error = deps.errorMapper.map(unknownError);
        } catch (mapperError: unknown) {
          // Fallback: если mapper сам упал, создаём unknown error
          // raw обязателен для kind: 'unknown', создаём минимальный AuthErrorResponse
          // retryable определяется через централизованную политику AuthRetryPolicy
          deps.telemetry?.recordErrorMapperFailure({
            operation: 'register',
            reason: mapperError instanceof Error ? mapperError.message : String(mapperError),
          });
          const fallbackRaw: AuthErrorResponse = {
            error: 'unknown_error',
            message: 'Unexpected error',
            retryable: getAuthRetryable('unknown_error'),
          };
          error = {
            kind: 'unknown',
            message: 'Unexpected error',
            raw: fallbackRaw,
          };
        }

        // Audit logging для error результата
        const auditResult: RegisterResultForAudit = {
          type: 'error',
          error,
        };
        handleAuditLogging({
          deps,
          registerContext: createRegisterContext(request, deps),
          originalRequest: request,
          domainResult: undefined,
          auditResult,
        });

        return { type: 'error', error };
      }
    };

    return concurrencyManager.execute(request, runOnce, externalSignal);
  };
}
