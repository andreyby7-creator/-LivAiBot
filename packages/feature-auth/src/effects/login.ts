/**
 * @file packages/feature-auth/src/effects/login.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Effect Orchestrator
 * ============================================================================
 *
 * Оркестратор login-flow:
 * - validate-input (domain LoginRequest)
 * - security-pipeline (через SecurityPipelinePort)
 * - metadata enrichment
 * - двухфазный API-call (/v1/auth/login + /v1/auth/me) с strict Zod-валидацией
 * - mapping в DomainLoginResult
 * - (опционально) обновление store через login-store-updater
 * - нормализация ошибок через injected error-mapper
 * - concurrency control (cancel_previous / ignore / serialize)
 *
 * Инварианты:
 * - ❌ Нет бизнес-логики внутри orchestrator
 * - ❌ Нет прямых вызовов Date.now()/new Date()
 * - ✅ Все side-effects только через DI-порты (apiClient, securityPipeline, authStore, auditLogger)
 * - ✅ Все ошибки проходят через deps.errorMapper.map(...)
 * - ✅ Двухфазный login: без успешного /me → login не считается успешным (fail-closed)
 */

import { withTimeout } from '@livai/app/lib/effect-timeout.js';
import type { Effect } from '@livai/app/lib/effect-utils.js';
import { orchestrate, step } from '@livai/app/lib/orchestrator.js';
import { validatedEffect } from '@livai/app/lib/schema-validated-effect.js';

import type { LoginIdentifierType, LoginRequest } from '../domain/LoginRequest.js';
import type { DomainLoginResult } from '../domain/LoginResult.js';
import type { LoginTokenPairValues, MeResponseValues } from '../schemas/index.js';
import { loginRequestSchema, loginTokenPairSchema, meResponseSchema } from '../schemas/index.js';
import type { AuthError } from '../types/auth.js';
import type { LoginResponseDto } from '../types/login.dto.js';
import { mapLoginRequestToApiPayload, mapLoginResponseToDomain } from './login/login-api.mapper.js';
import type { LoginAuditContext, LoginResultForAudit } from './login/login-audit.mapper.js';
import { mapLoginResultToAuditEvent } from './login/login-audit.mapper.js';
import type {
  ClockPort,
  LoginEffectConfig,
  LoginEffectDeps,
  LoginSecurityResult,
} from './login/login-effect.types.js';
import { buildLoginMetadata } from './login/login-metadata.enricher.js';
import type { LoginContext, LoginMetadata } from './login/login-metadata.enricher.js';
import { applyBlockedState, updateLoginState } from './login/login-store-updater.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтный global hard timeout для login-effect (60 секунд) */
const DEFAULT_LOGIN_HARD_TIMEOUT_MS = 60_000;
/** Radix для base36 конвертации (используется для traceId и eventId) */
const BASE36_RADIX = 36;
/** Длина случайной части traceId при fallback генерации */
const TRACE_ID_FALLBACK_LENGTH = 11;
/** Длина случайной части eventId при использовании crypto.randomUUID */
const EVENT_ID_UUID_LENGTH = 8;
/** Длина случайной части eventId при fallback генерации (slice(2) убирает "0.") */
const EVENT_ID_FALLBACK_LENGTH = 10;

/* ============================================================================
 * 🧭 TYPES — PUBLIC LOGIN RESULT
 * ============================================================================
 */

/**
 * Публичный результат login-effect.
 * @remarks
 * - Слой над DomainLoginResult/AuthError для удобства вызывающей стороны
 * - Orchestrator сам не делает побочных эффектов, кроме DI-портов
 */
export type LoginResult =
  | Readonly<{ type: 'success'; userId: string; }>
  | Readonly<{ type: 'mfa_required'; challengeId: string; }>
  | Readonly<{ type: 'blocked'; reason: string; }>
  | Readonly<{ type: 'error'; error: AuthError; }>;

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

/** Создаёт LoginContext для metadata enricher. */
function createLoginContext(
  request: LoginRequest<LoginIdentifierType>,
  deps: LoginEffectDeps,
  security: LoginSecurityResult | undefined,
): LoginContext {
  const nowMs = deps.clock.now();
  const timestampIso = epochMsToIsoString(nowMs);

  // Валидируем triggeredRules перед использованием (защита от model poisoning)
  const triggeredRuleIds = security?.pipelineResult.riskAssessment.triggeredRules;
  const validatedRuleIds = triggeredRuleIds !== undefined
      && Array.isArray(triggeredRuleIds)
      && triggeredRuleIds.every((rule) => typeof rule === 'string')
    ? triggeredRuleIds
    : [];

  // riskScore и riskLevel уже нормализованы на boundary:
  // - scoring: calculateRiskScore() в @livai/domains/classification/aggregation/scoring.ts (clamp 0-100)
  // - policies: determineRiskLevel() в @livai/domains/classification/policies/base.policy.ts (validated enum)
  // - assessment: assembleAssessmentResult() в @livai/domains/classification/evaluation/assessment.ts
  // eslint-disable-next-line ai-security/model-poisoning
  const riskMetadata = security !== undefined
    ? {
      riskScore: security.riskScore,
      riskLevel: security.riskLevel,
      // Извлекаем только ID правил (rule уже является строкой-идентификатором, валидировано выше)
      triggeredRuleIds: validatedRuleIds,
    }
    : undefined;

  const deviceInfo = security?.pipelineResult.deviceInfo;

  // Генерируем UUID для traceId (избегаем коллизий при high throughput)
  const traceId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID() // Предпочтительно: стандартный UUID
    : `login-${nowMs}-${Math.random().toString(BASE36_RADIX).slice(2, TRACE_ID_FALLBACK_LENGTH)}`; // Fallback: slice(2) убирает "0."

  return {
    request,
    traceId,
    timestamp: timestampIso,
    // Условно добавляем поля только если они определены (оптимизация размера объекта)
    ...(deviceInfo !== undefined ? { deviceInfo } : {}),
    ...(riskMetadata !== undefined ? { riskMetadata } : {}),
  };
}

/* ============================================================================
 * 🔧 HELPERS — SECURITY CONTEXT BUILDING
 * ============================================================================
 */

/**
 * Создает SecurityPipelineContext для security pipeline.
 * Вынесено в отдельную функцию для снижения cognitive complexity.
 */
function buildSecurityContext(
  request: LoginRequest<LoginIdentifierType>,
  deps: LoginEffectDeps,
): {
  readonly context: Parameters<LoginEffectDeps['securityPipeline']['run']>[0];
  readonly timestampIso: string;
} {
  const nowMs = deps.clock.now();
  const timestampIso = epochMsToIsoString(nowMs);
  const securityContextIp = request.clientContext?.ip;
  const securityContextDeviceId = request.clientContext?.deviceId;
  const securityContextUserAgent = request.clientContext?.userAgent;

  // Хешируем identifier для security pipeline (privacy-safe)
  // Используем hashed identifier как userId для risk assessment
  const hashedIdentifier = deps.identifierHasher.hash(
    request.identifier.value,
  );

  // Формируем signals с userAgent через externalSignals (если есть)
  const signals = securityContextUserAgent !== undefined
    ? {
      externalSignals: {
        userAgent: securityContextUserAgent,
      },
    } as const
    : undefined;

  const context: Parameters<LoginEffectDeps['securityPipeline']['run']>[0] = {
    // Различаем OAuth и обычный login для разных правил оценки риска
    operation: request.identifier.type === 'oauth' ? 'oauth_login' : 'login',
    ...(securityContextIp !== undefined ? { ip: securityContextIp } : {}),
    // Используем hashed identifier как userId для risk assessment (privacy-safe)
    userId: hashedIdentifier,
    ...(securityContextDeviceId !== undefined
      ? {
        // deviceId передаем через externalSignals, так как userId уже занят hashed identifier
        signals: signals
          ? {
            ...signals,
            externalSignals: {
              ...signals.externalSignals,
              deviceId: securityContextDeviceId, // Мержим с существующими externalSignals
            },
          }
          : {
            externalSignals: {
              deviceId: securityContextDeviceId, // Создаем новый externalSignals
            },
          },
      }
      : signals !== undefined
      ? { signals }
      : {}), // Если только userAgent без deviceId
    timestamp: timestampIso,
  };

  return { context, timestampIso };
}

/**
 * Обрабатывает blocked результат от security-pipeline.
 * @note Вынесено в отдельную функцию для уменьшения cognitive complexity runOnce.
 */
function handleBlockedResult(
  validatedRequest: LoginRequest<LoginIdentifierType>,
  securityResult: LoginSecurityResult,
  deps: LoginEffectDeps,
): LoginResultForAudit {
  // Обновляем store через applyBlockedState для консистентности
  applyBlockedState(deps.authStore, securityResult.pipelineResult);

  const blockedResult: LoginResultForAudit = {
    type: 'blocked',
    reason: securityResult.pipelineResult.riskAssessment.decisionHint.blockReason
      ?? 'blocked_by_security_policy',
  };

  // Audit logging для blocked результата
  // См. login-audit.mapper.ts для деталей маппинга в audit-события
  try {
    const eventId = generateEventId(deps.clock);
    const auditContext = createFlattenedAuditContext(
      createLoginContext(validatedRequest, deps, securityResult),
      securityResult,
      undefined,
      eventId,
    );
    const auditEvent = mapLoginResultToAuditEvent(blockedResult, auditContext);
    deps.auditLogger.logAuditEvent(auditEvent);
  } catch {
    // Audit logging не должен ломать основной login-flow.
  }

  // См. login-store-updater.ts:applyBlockedState для деталей обновления store
  return blockedResult; // eslint-disable-line @livai/rag/source-citation
}

/**
 * Создает flattened LoginAuditContext из loginContext и securityResult.
 * @note Flattened контекст уменьшает coupling маппера к внутренней структуре pipeline.
 */
function createFlattenedAuditContext(
  loginContext: LoginContext,
  securityResult: LoginSecurityResult | undefined,
  domainResult: DomainLoginResult | undefined,
  eventId: string,
): LoginAuditContext {
  const deviceInfo = securityResult?.pipelineResult.deviceInfo;
  const blockReason = securityResult?.pipelineResult.riskAssessment.decisionHint.blockReason;

  return {
    domainResult,
    timestamp: loginContext.timestamp,
    traceId: loginContext.traceId,
    eventId,
    ip: loginContext.request.clientContext?.ip,
    userAgent: loginContext.request.clientContext?.userAgent,
    deviceId: deviceInfo?.deviceId,
    geo: deviceInfo?.geo !== undefined
      ? {
        lat: deviceInfo.geo.lat,
        lng: deviceInfo.geo.lng,
      }
      : undefined,
    riskScore: securityResult?.riskScore,
    blockReason,
  };
}

/**
 * Генерирует уникальный eventId для audit-события.
 * @note Используется в orchestrator для детерминизма в тестах (можно подменить через DI).
 */
function generateEventId(clock: ClockPort): string {
  const timestamp = clock.now();
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, EVENT_ID_UUID_LENGTH)
    : Math.random().toString(BASE36_RADIX).slice(2, EVENT_ID_FALLBACK_LENGTH);
  return `login-${timestamp}-${random}`;
}

/* ============================================================================
 * 🎯 EFFECT FACTORY — CREATE LOGIN EFFECT
 * ============================================================================
 */

/** Оркестратор login-flow. */
export function createLoginEffect(
  deps: LoginEffectDeps, // DI-порты для login-effect
  config: LoginEffectConfig, // Конфигурация таймаутов и стратегии конкуренции
): (request: LoginRequest<LoginIdentifierType>) => Effect<LoginResult> {
  // Примитивная конкурентная защита: cancel_previous / ignore / serialize.
  let inFlight: Promise<LoginResult> | null = null;
  let currentController: AbortController | null = null;
  let queueTail: Promise<LoginResult> | null = null;

  return (request: LoginRequest<LoginIdentifierType>): Effect<LoginResult> =>
  async (externalSignal?: AbortSignal): Promise<LoginResult> => {
    // Конкурентная стратегия: ignore — возвращаем уже выполняющийся запрос
    if (config.concurrency === 'ignore' && inFlight !== null) {
      // Возвращаем уже выполняющийся запрос (очистка inFlight происходит в finally)
      return inFlight;
    }

    const controller = deps.abortController.create();
    const signal = controller.signal;

    const runOnce = async (): Promise<LoginResult> => {
      try {
        // Step 1 — validate-input (strict Zod schema validation)
        // Используем loginRequestSchema.strict() для полной boundary-валидации
        const validationResult = loginRequestSchema.strict().safeParse(request);
        if (!validationResult.success) {
          // Используем общий error code вместо детального Zod message для предотвращения утечки структуры
          const error = deps.errorMapper.map(
            new Error('invalid_login_request'),
          );
          return { type: 'error', error };
        }
        // После успешной валидации используем валидированные данные
        // Type assertion безопасен: strict Zod схема гарантирует соответствие структуре LoginRequest
        const validatedRequest = validationResult.data as LoginRequest<LoginIdentifierType>;

        // Step 2 — security-pipeline (projection + raw result)
        const { context: securityContext } = buildSecurityContext(validatedRequest, deps);
        const securityEffect = deps.securityPipeline.run(securityContext);
        // Timeout handled inside securityPipeline (agent-level guarantee)
        // eslint-disable-next-line @livai/multiagent/orchestration-safety
        const securityResult: LoginSecurityResult = await securityEffect(signal);

        // Step 3 — security policy (минимальная: block short-circuit)
        if (securityResult.decision.type === 'block') {
          return handleBlockedResult(validatedRequest, securityResult, deps);
        }

        // Step 4 — enrich-metadata
        const loginContext = createLoginContext(validatedRequest, deps, securityResult);
        // Валидация loginContext выполняется внутри buildLoginMetadata через validateLoginContext
        // (см. validateLoginContext в login-metadata.enricher.ts)
        // eslint-disable-next-line ai-security/model-poisoning
        const metadata: readonly LoginMetadata[] = buildLoginMetadata(loginContext, {
          identifierHasher: deps.identifierHasher.hash,
        });

        // Step 5 — двухфазный API-calls через orchestrator + validatedEffect
        const loginRequestPayload = mapLoginRequestToApiPayload(validatedRequest);

        const loginEffect = validatedEffect(
          loginTokenPairSchema,
          async (sig?: AbortSignal): Promise<LoginTokenPairValues> => {
            // Передаем AbortSignal только если он предоставлен (для отмены запроса)
            const options = sig !== undefined ? { signal: sig } : undefined;
            return deps.apiClient.post<LoginTokenPairValues>(
              '/v1/auth/login',
              loginRequestPayload,
              options,
            );
          },
          { service: 'AUTH' },
        );

        const orchestrated = orchestrate<
          [LoginTokenPairValues, LoginResponseDto]
        >([
          step(
            'auth-login',
            async (sig?: AbortSignal): Promise<LoginTokenPairValues> => {
              return loginEffect(sig);
            },
            config.timeouts.loginApiTimeoutMs,
          ),
          step(
            'auth-me',
            async (sig?: AbortSignal, previous?: unknown): Promise<LoginResponseDto> => {
              // Type assertion безопасен: orchestrator гарантирует тип из предыдущего step
              const previousTokenPair = previous as LoginTokenPairValues;

              // Используем accessToken из previous аргумента вместо closure (избегаем race conditions)
              const meEffect = validatedEffect(
                meResponseSchema,
                async (sig?: AbortSignal): Promise<MeResponseValues> => {
                  const options: {
                    signal?: AbortSignal;
                    headers: Readonly<Record<string, string>>;
                  } = {
                    headers: { Authorization: `Bearer ${previousTokenPair.accessToken}` },
                  };
                  // Добавляем signal только если он передан (для отмены запроса)
                  if (sig !== undefined) {
                    options.signal = sig;
                  }
                  return deps.apiClient.get<MeResponseValues>('/v1/auth/me', options);
                },
                { service: 'AUTH' },
              );

              // Timeout enforced by step DSL (config.timeouts.meApiTimeoutMs)
              // eslint-disable-next-line @livai/multiagent/orchestration-safety
              const me = await meEffect(sig);
              return {
                type: 'success',
                tokenPair: previousTokenPair,
                me,
              };
            },
            config.timeouts.meApiTimeoutMs,
          ),
        ]);

        // Global hard timeout для всего login-effect (защита от зависания orchestration logic)
        const loginHardTimeoutMs = config.timeouts.loginHardTimeoutMs
          ?? DEFAULT_LOGIN_HARD_TIMEOUT_MS;
        const orchestratedWithHardTimeout = withTimeout(
          orchestrated,
          { timeoutMs: loginHardTimeoutMs, tag: 'login-orchestrator' },
        );
        // Timeout enforced by global hard timeout above
        // eslint-disable-next-line @livai/multiagent/orchestration-safety
        const aggregated = await orchestratedWithHardTimeout(signal);
        // Type assertion безопасен: orchestrator возвращает тип из step definitions
        const loginResponse = aggregated as LoginResponseDto;

        // Domain mapping
        const domainResult: DomainLoginResult = mapLoginResponseToDomain(
          loginResponse,
        );

        // Store update (атомарный updater)
        updateLoginState(
          deps.authStore,
          securityResult.pipelineResult,
          domainResult,
          metadata,
        );

        // Упрощённый LoginResult для вызывающего кода
        let publicResult: LoginResultForAudit;
        if (domainResult.type === 'success') {
          publicResult = {
            type: 'success',
            userId: domainResult.me.user.id,
          };
        } else {
          publicResult = {
            type: 'mfa_required',
            challengeId: domainResult.challenge.userId,
          };
        }

        // Audit logging для success/mfa_required результата
        // См. login-audit.mapper.ts для деталей маппинга в audit-события
        try {
          const eventId = generateEventId(deps.clock);
          const auditContext = createFlattenedAuditContext(
            loginContext,
            securityResult,
            domainResult,
            eventId,
          );
          const auditEvent = mapLoginResultToAuditEvent(publicResult, auditContext);
          deps.auditLogger.logAuditEvent(auditEvent);
        } catch {
          // Audit logging не должен ломать основной login-flow.
        }

        if (publicResult.type === 'success') {
          // См. login-store-updater.ts:updateLoginState для деталей обновления store
          return publicResult; // eslint-disable-line @livai/rag/source-citation
        }

        return {
          type: 'mfa_required',
          challengeId: publicResult.challengeId,
        };
      } catch (unknownError: unknown) {
        const error = deps.errorMapper.map(unknownError);

        try {
          const auditResult: LoginResultForAudit = {
            type: 'error',
            error,
          };
          const eventId = generateEventId(deps.clock);
          const auditContext = createFlattenedAuditContext(
            createLoginContext(request, deps, undefined),
            undefined,
            undefined,
            eventId,
          );
          const auditEvent = mapLoginResultToAuditEvent(auditResult, auditContext);
          deps.auditLogger.logAuditEvent(auditEvent);
        } catch {
          // Ошибки аудита не должны влиять на основной результат.
        }

        return { type: 'error', error };
      }
    };

    const executeWithStrategy = async (): Promise<LoginResult> => {
      if (config.concurrency === 'cancel_previous' && currentController !== null) {
        // Отменяем предыдущий запрос через его AbortController
        currentController.abort();
      }

      if (config.concurrency === 'serialize') {
        const previous = queueTail;
        const current = (async (): Promise<LoginResult> => {
          if (previous) {
            // Ждем завершения предыдущего запроса (игнорируем ошибки, чтобы не блокировать очередь)
            // Previous request имеет свой timeout через global hard timeout выше
            // eslint-disable-next-line @livai/multiagent/orchestration-safety
            await previous.catch(() => {});
          }
          return runOnce();
        })();
        queueTail = current; // Обновляем хвост очереди для следующего запроса
        return current;
      }

      return runOnce();
    };

    // Сохраняем текущий controller для cancel_previous стратегии
    currentController = controller;

    const promise = executeWithStrategy();

    // Устанавливаем inFlight только для ignore стратегии
    if (config.concurrency === 'ignore') {
      inFlight = promise;
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
      if (currentController === controller) {
        currentController = null;
      }
      // Очищаем inFlight для ignore стратегии (защита от edge-case: новый запрос до finally)
      if (config.concurrency === 'ignore' && inFlight === promise) {
        inFlight = null;
      }
    }).catch(() => {
      // Игнорируем ошибки при очистке
    });

    return promise;
  };
}
