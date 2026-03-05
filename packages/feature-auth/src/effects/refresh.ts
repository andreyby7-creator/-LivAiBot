/**
 * @file packages/feature-auth/src/effects/refresh.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Refresh Effect Orchestrator
 * ============================================================================
 * Оркестратор refresh-flow:
 * - policy check через sessionManager.decide() перед API-вызовом
 * - двухфазный API-call (/v1/auth/refresh + /v1/auth/me) с strict Zod-валидацией
 * - mapping в domain-результат
 * - обновление store через refresh-store-updater с withStoreLock (атомарность)
 * - нормализация ошибок через injected error-mapper
 * - concurrency control (serialize / ignore, cancel_previous запрещён)
 * Инварианты:
 * - ❌ Нет бизнес-логики внутри orchestrator
 * - ❌ Нет прямых вызовов Date.now()/new Date()
 * - ✅ Все side-effects только через DI-порты (apiClient, sessionManager, authStore, auditLogger)
 * - ✅ Все ошибки проходят через deps.errorMapper.map(...)
 * - ✅ Fail-closed multi-step: /refresh + /me → invalidate при любом fail, без partial state
 * - ✅ Isolation guard: один in-flight refresh, повторные вызовы возвращают текущий Promise
 * - ✅ Concurrency: строго serialize или ignore, cancel_previous запрещён
 */

import type { Effect } from '@livai/core/effect';
import { orchestrate, step, validatedEffect, withTimeout } from '@livai/core/effect';

import type { DeviceInfo } from '../domain/DeviceInfo.js';
import type { LoginTokenPairValues, MeResponseValues } from '../schemas/index.js';
import { loginTokenPairSchema, meResponseSchema } from '../schemas/index.js';
import type { AuthError, SessionState } from '../types/auth.js';
import {
  mapRefreshRequestToApiPayload,
  mapRefreshResponseToDomain,
} from './refresh/refresh-api.mapper.js';
import {
  createRefreshAuditContext,
  mapRefreshResultToAuditEvent,
} from './refresh/refresh-audit.mapper.js';
import type {
  RefreshEffectConfig,
  RefreshEffectDeps,
  RefreshResult,
  SessionDecision,
} from './refresh/refresh-effect.types.js';
import { applyRefreshInvalidate, updateRefreshState } from './refresh/refresh-store-updater.js';
import { withStoreLock } from './shared/auth-store.port.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Максимальная длина очереди для serialize стратегии (защита от DoS) */
const MAX_SERIALIZE_QUEUE_LENGTH = 10;

/* ============================================================================
 * 🧭 TYPES — PUBLIC REFRESH RESULT
 * ============================================================================
 */

/**
 * Публичный результат refresh-effect.
 * @remarks
 * - Слой над RefreshResult для удобства вызывающей стороны
 * - Orchestrator сам не делает побочных эффектов, кроме DI-портов
 * - Идентичен RefreshResult из refresh-effect.types.ts (явно показывает связь)
 */
export type RefreshEffectResult = RefreshResult;

/* ============================================================================
 * 🧰 HELPERS — TIME & CONTEXT
 * ============================================================================
 */

/* ============================================================================
 * 🔧 HELPERS — POLICY CHECK & SESSION STATE
 * ============================================================================
 */

/**
 * Получает текущее SessionState из store.
 * @note Вынесено в отдельную функцию для улучшения читаемости и тестируемости.
 */
function getCurrentSessionState(
  store: RefreshEffectDeps['authStore'],
): SessionState | null {
  return store.getSessionState();
}

/**
 * Валидирует refreshToken на корректность формата и длины.
 * @note Sanity-check для предотвращения отправки некорректных токенов на сервер.
 * @throws Error если refreshToken не проходит валидацию.
 */
function validateRefreshTokenFormat(refreshToken: string): void {
  if (typeof refreshToken !== 'string' || refreshToken.trim() === '') {
    throw new Error('[refresh] refreshToken must be a non-empty string');
  }
  // Минимальная длина для JWT-подобных токенов (обычно 32+ символов)
  // Максимальная длина для защиты от DoS (обычно 2048 символов для JWT)
  const MIN_TOKEN_LENGTH = 16;
  const MAX_TOKEN_LENGTH = 4096;
  if (refreshToken.length < MIN_TOKEN_LENGTH || refreshToken.length > MAX_TOKEN_LENGTH) {
    throw new Error(
      `[refresh] refreshToken length must be between ${MIN_TOKEN_LENGTH} and ${MAX_TOKEN_LENGTH} characters`,
    );
  }
}

/**
 * Получает refreshToken из secure storage (httpOnly cookie или secure memory).
 * @note В production refreshToken должен быть получен через httpOnly cookie или secure storage.
 * @throws Error если refreshToken недоступен или не проходит валидацию.
 */
function getRefreshToken(
  sessionState: SessionState | null,
  deps: RefreshEffectDeps,
): string {
  if (sessionState?.status !== 'active') {
    throw new Error('[refresh] SessionState is not active, cannot get refreshToken');
  }
  const refreshToken = deps.authStore.getRefreshToken();
  validateRefreshTokenFormat(refreshToken);
  return refreshToken;
}

/**
 * Получает DeviceInfo из SessionState.
 * @note DeviceInfo требуется для построения нового SessionState после refresh.
 */
function getDeviceInfoFromSession(sessionState: SessionState | null): DeviceInfo | undefined {
  if (sessionState?.status !== 'active') {
    return undefined;
  }
  return sessionState.device;
}

/**
 * Обрабатывает SessionDecision и возвращает соответствующий RefreshResult или null (если нужно продолжить).
 * @note Вынесено в отдельную функцию для улучшения читаемости runOnce.
 */
function handleSessionDecision(
  decision: SessionDecision,
  deps: RefreshEffectDeps,
): RefreshResult | null {
  if (decision.type === 'noop') {
    // Маппинг reason из SessionDecision в RefreshResult
    const reason = decision.reason === 'fresh' ? 'already_fresh' : decision.reason;
    return {
      type: 'noop',
      reason,
    };
  }

  if (decision.type === 'invalidate') {
    // Применяем invalidate через store-updater с блокировкой
    withStoreLock(deps.authStore, () => {
      applyRefreshInvalidate(deps.authStore, decision.reason);
    });

    return {
      type: 'invalidated',
      reason: decision.reason,
    };
  }

  // decision.type === 'refresh' → продолжаем выполнение
  return null;
}

/**
 * Обрабатывает ошибки refresh-flow и применяет invalidate при необходимости.
 * @note Вынесено в отдельную функцию для улучшения читаемости runOnce.
 */
function handleRefreshError(
  unknownError: unknown,
  sessionState: SessionState | null,
  deps: RefreshEffectDeps,
  now: number,
): RefreshResult {
  const error = deps.errorMapper.map(unknownError);

  // Проверяем, нужно ли инвалидировать сессию при ошибке
  const decision = deps.sessionManager.decide(sessionState, now);
  if (decision.type === 'invalidate') {
    // Применяем invalidate через store-updater с блокировкой
    withStoreLock(deps.authStore, () => {
      applyRefreshInvalidate(deps.authStore, decision.reason);
    });

    return {
      type: 'invalidated',
      reason: decision.reason,
    };
  }

  return {
    type: 'error',
    error,
  };
}

/**
 * Выполняет audit logging для refresh результата.
 * @note Best-effort: ошибки не влияют на основной flow.
 */
function performAuditLogging(
  result: RefreshResult,
  sessionState: SessionState | null,
  deps: RefreshEffectDeps,
): void {
  try {
    if (sessionState !== null) {
      const auditContext = createRefreshAuditContext(
        sessionState,
        deps.clock,
        deps.eventIdGenerator,
      );
      const auditEvent = mapRefreshResultToAuditEvent(result, auditContext);
      if (auditEvent !== null) {
        deps.auditLogger.logRefreshEvent(auditEvent);
      }
    }
  } catch {
    // Audit logging не должен ломать основной refresh-flow
  }
}

/**
 * Проверяет AbortSignal перед выполнением операции.
 * @throws Error если сигнал отменен (cooperative cancellation).
 */
function checkAbortSignal(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted === true) {
    throw new Error(`[refresh] Operation ${operation} was aborted`);
  }
}

/**
 * Выполняет API-вызовы refresh и me.
 * @note Fail-closed: при ошибке любого шага выбрасывает исключение.
 * @note Cooperative cancellation: проверяет AbortSignal перед каждым major step.
 */
async function performRefreshApiCalls(
  refreshRequestPayload: Readonly<{ refreshToken: string; }>,
  deps: RefreshEffectDeps,
  config: RefreshEffectConfig,
  externalSignal?: AbortSignal,
): Promise<[LoginTokenPairValues, MeResponseValues]> {
  checkAbortSignal(externalSignal, 'refresh-api-calls');
  // Effect-based API-клиент: AbortSignal передаётся через параметр Effect
  const refreshEffect = validatedEffect(
    loginTokenPairSchema,
    deps.apiClient.post<LoginTokenPairValues>(
      '/v1/auth/refresh',
      refreshRequestPayload,
    ),
    { service: 'AUTH' },
  );

  // Step 4 — API call `/v1/auth/me` (если требуется синхронизация профиля)
  // Fail-closed: если /me падает → invalidate через session-manager, не применяем новые токены
  const orchestrated = orchestrate<
    [LoginTokenPairValues, MeResponseValues]
  >([
    step(
      'auth-refresh',
      refreshEffect,
      config.timeout,
    ),
    step(
      'auth-me',
      async (sig?: AbortSignal, previous?: unknown): Promise<MeResponseValues> => {
        // Type assertion безопасен: orchestrator гарантирует тип из предыдущего step
        const previousTokenPair = previous as LoginTokenPairValues;

        // Effect-based API-клиент: AbortSignal передаётся через параметр Effect
        const meEffect = validatedEffect(
          meResponseSchema,
          deps.apiClient.get<MeResponseValues>('/v1/auth/me', {
            headers: { Authorization: `Bearer ${previousTokenPair.accessToken}` },
          }),
          { service: 'AUTH' },
        );

        // Timeout enforced by step DSL (config.timeout)
        // eslint-disable-next-line @livai/multiagent/orchestration-safety
        const me = await meEffect(sig);
        return me;
      },
      config.timeout,
    ),
  ]);

  // Global hard timeout для всего refresh-effect (защита от зависания orchestration logic)
  const refreshWithHardTimeout = withTimeout(
    orchestrated,
    { timeoutMs: config.timeout, tag: 'refresh-orchestrator' },
  );
  // Timeout enforced by global hard timeout above
  // eslint-disable-next-line @livai/multiagent/orchestration-safety
  const aggregated = await refreshWithHardTimeout(externalSignal);
  // Type assertion безопасен: orchestrator возвращает тип из step definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- orchestrator возвращает tuple, но тип не выводится корректно
  return aggregated as any as [LoginTokenPairValues, MeResponseValues];
}

/* ============================================================================
 * 🔄 CONCURRENCY CONTROL — УПРАВЛЕНИЕ КОНКУРЕНТНОСТЬЮ
 * ============================================================================
 */

/** Состояние для управления конкурентностью refresh-effect. */
type RefreshConcurrencyState = {
  inFlight: Promise<RefreshEffectResult> | null;
  queueTail: Promise<RefreshEffectResult> | null;
  queueLength: number;
};

/**
 * Создает менеджер конкурентности для refresh-effect.
 * @note Отдельный компонент для concurrency semantics, упрощает unit-тестирование.
 * @note Изолирует логику очереди от основной flow логики orchestrator'а.
 */
function createRefreshConcurrencyManager(
  config: RefreshEffectConfig,
): {
  execute: (
    runOnce: (signal?: AbortSignal) => Promise<RefreshEffectResult>,
    externalSignal?: AbortSignal,
  ) => Promise<RefreshEffectResult>;
} {
  const state: RefreshConcurrencyState = {
    inFlight: null,
    queueTail: null,
    queueLength: 0,
  };

  return {
    execute: (
      runOnce: (signal?: AbortSignal) => Promise<RefreshEffectResult>,
      externalSignal?: AbortSignal,
    ): Promise<RefreshEffectResult> => {
      // Конкурентная стратегия: ignore — возвращаем уже выполняющийся запрос
      if (config.concurrency === 'ignore' && state.inFlight !== null) {
        // Возвращаем уже выполняющийся запрос (очистка inFlight происходит в finally)
        return state.inFlight;
      }

      const executeWithStrategy = async (): Promise<RefreshEffectResult> => {
        if (config.concurrency === 'serialize') {
          // Защита от DoS: проверяем лимит длины очереди
          if (state.queueLength >= MAX_SERIALIZE_QUEUE_LENGTH) {
            const error: AuthError = {
              kind: 'rate_limited',
              message: 'Refresh queue is full, please try again later',
            };
            return { type: 'error', error };
          }

          state.queueLength++;
          const previous = state.queueTail;
          const current = (async (): Promise<RefreshEffectResult> => {
            if (previous) {
              // Ждем завершения предыдущего запроса (игнорируем ошибки, чтобы не блокировать очередь)
              // Previous request имеет свой timeout через global hard timeout выше
              // eslint-disable-next-line @livai/multiagent/orchestration-safety
              await previous.catch(() => {});
            }
            return runOnce(externalSignal);
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

        return runOnce(externalSignal);
      };

      const promise = executeWithStrategy();

      // Устанавливаем inFlight только для ignore стратегии
      if (config.concurrency === 'ignore') {
        state.inFlight = promise;
      }

      // Очищаем состояние после завершения запроса
      promise.finally(() => {
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
 * 🎯 EFFECT FACTORY — CREATE REFRESH EFFECT
 * ============================================================================
 */

/**
 * Оркестратор refresh-flow.
 * @note Поддерживает стратегии concurrency: serialize и ignore (cancel_previous запрещён).
 * @note Fail-closed: при ошибке /refresh или /me → invalidate, без partial state.
 * @note Isolation guard: один in-flight refresh, повторные вызовы возвращают текущий Promise.
 */
export function createRefreshEffect(
  deps: RefreshEffectDeps, // DI-порты для refresh-effect
  config: RefreshEffectConfig, // Конфигурация таймаутов и стратегии конкуренции
): () => Effect<RefreshEffectResult> {
  const concurrencyManager = createRefreshConcurrencyManager(config);

  return (): Effect<RefreshEffectResult> =>
  async (externalSignal?: AbortSignal): Promise<RefreshEffectResult> => {
    const runOnce = async (signal?: AbortSignal): Promise<RefreshEffectResult> => {
      const now = deps.clock.now();

      try {
        // Cooperative cancellation: проверяем AbortSignal перед каждым major step
        checkAbortSignal(signal, 'policy-check');

        // Step 1 — Policy check: чтение SessionState из store → sessionManager.decide()
        const sessionState = getCurrentSessionState(deps.authStore);
        const decision = deps.sessionManager.decide(sessionState, now);

        // Обрабатываем решение session-manager (noop/invalidate → early return)
        const earlyResult = handleSessionDecision(decision, deps);
        if (earlyResult !== null) {
          performAuditLogging(earlyResult, sessionState, deps);
          // eslint-disable-next-line @livai/rag/source-citation -- Это локальный результат policy check, не RAG response
          return earlyResult;
        }

        // Step 2 — Получение refreshToken
        // @note sessionState гарантированно не null после handleSessionDecision (decision.type === 'refresh')
        if (sessionState === null) {
          throw new Error('[refresh] SessionState is null after policy check');
        }

        checkAbortSignal(signal, 'refresh-token-retrieval');
        const refreshToken = getRefreshToken(sessionState, deps);

        // Step 3 — API call `/v1/auth/refresh` + `/v1/auth/me`
        checkAbortSignal(signal, 'refresh-api-payload-mapping');
        const refreshRequestPayload = mapRefreshRequestToApiPayload(
          sessionState,
          refreshToken,
        );
        // Timeout enforced by performRefreshApiCalls (withTimeout wrapper)
        // eslint-disable-next-line @livai/multiagent/orchestration-safety
        const [tokenPairDto, meDto] = await performRefreshApiCalls(
          refreshRequestPayload,
          deps,
          config,
          signal,
        );

        // Step 4 — Domain mapping
        checkAbortSignal(signal, 'domain-mapping');
        const domainResult = mapRefreshResponseToDomain(tokenPairDto, meDto);

        // @note me гарантированно присутствует после успешного mapRefreshResponseToDomain
        if (domainResult.me === undefined) {
          throw new Error('[refresh] MeResponse is required after successful refresh');
        }

        // Type assertion безопасен: проверка выше гарантирует, что me !== undefined
        const meResponse = domainResult.me;

        // Step 5 — Store update через refresh-store-updater с withStoreLock (атомарность)
        checkAbortSignal(signal, 'store-update');
        const deviceInfo = getDeviceInfoFromSession(sessionState);

        withStoreLock(deps.authStore, () => {
          updateRefreshState(
            deps.authStore,
            domainResult.tokenPair,
            meResponse,
            deviceInfo,
          );
        });

        // Step 6 — Audit logging для success результата
        const successResult: RefreshEffectResult = {
          type: 'success',
          userId: meResponse.user.id,
        };
        performAuditLogging(successResult, sessionState, deps);

        // eslint-disable-next-line @livai/rag/source-citation -- Это локальный результат API, не RAG response
        return successResult;
      } catch (unknownError: unknown) {
        const sessionState = getCurrentSessionState(deps.authStore);
        const now = deps.clock.now();
        const errorResult = handleRefreshError(unknownError, sessionState, deps, now);
        performAuditLogging(errorResult, sessionState, deps);
        // eslint-disable-next-line @livai/rag/source-citation -- Это локальный результат обработки ошибки, не RAG response
        return errorResult;
      }
    };

    return concurrencyManager.execute(runOnce, externalSignal);
  };
}
