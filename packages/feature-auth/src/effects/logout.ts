/**
 * @file packages/feature-auth/src/effects/logout.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Logout Effect Orchestrator
 * ============================================================================
 *
 * Оркестратор logout-flow:
 * - lock store → reset store → unlock store (атомарно)
 * - (remote mode) revoke API параллельно после unlock (best-effort, не блокирует logout)
 * - audit logging через LogoutAuditLoggerPort
 * - concurrency control (ignore / cancel_previous / serialize)
 *
 * Инварианты:
 * - ❌ Нет бизнес-логики внутри orchestrator
 * - ❌ Нет прямых вызовов Date.now()/new Date()
 * - ✅ Все side-effects только через DI-порты (authStore, auditLogger, apiClient, errorMapper)
 * - ✅ Все ошибки проходят через deps.errorMapper.map(...) (только для remote mode)
 * - ✅ Fail-closed: не вводит fallback-значения, не читает текущее состояние store
 * - ✅ Remote logout: reset store всегда, revoke API best-effort (не блокирует logout при timeout/500/network error)
 * - ✅ Idempotency: reset уже выполненного состояния является no-op (через batchUpdate)
 */

import { withTimeout } from '@livai/app/lib/effect-timeout.js';
import type { Effect } from '@livai/app/lib/effect-utils.js';

import type { AuthError } from '../types/auth.js';
import type { LogoutAuditContext, LogoutResultForAudit } from './logout/logout-audit.mapper.js';
import {
  mapLogoutResultToAuditEvent,
  mapRevokeErrorToAuditEvent,
  mapRevokeSkippedToAuditEvent,
} from './logout/logout-audit.mapper.js';
import type {
  ClockPort,
  EventIdGeneratorPort,
  LogoutAuditLoggerPort,
  LogoutEffectConfig,
  LogoutEffectDeps,
} from './logout/logout-effect.types.js';
import { isRemoteLogoutDeps } from './logout/logout-effect.types.js';
import { applyLogoutReset } from './logout/logout-store-updater.js';
import { withStoreLock } from './shared/auth-store.port.js';

/* ============================================================================
 * 🧭 TYPES — PUBLIC LOGOUT RESULT
 * ============================================================================
 */

/**
 * Публичный результат logout-effect.
 * @remarks
 * - Слой над void/AuthError для удобства вызывающей стороны
 * - Orchestrator сам не делает побочных эффектов, кроме DI-портов
 */
export type LogoutResult =
  | Readonly<{ type: 'success'; }>
  | Readonly<{ type: 'error'; error: AuthError; }>;

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Максимальная длина очереди для serialize стратегии (защита от DoS) */
const MAX_SERIALIZE_QUEUE_LENGTH = 10;
/** Максимальное количество параллельных revoke-запросов (защита от DoS) */
const MAX_REVOKE_CONCURRENT = 3;
/** Дефолтный timeout для revoke-запроса (если не задан в config) */
const DEFAULT_REVOKE_TIMEOUT_MS = 5000;
/** Длина случайной части eventId при использовании crypto.randomUUID */
const EVENT_ID_UUID_LENGTH = 8;
/** Количество байт для генерации случайных данных через crypto.getRandomValues */
const RANDOM_BYTES_LENGTH = 8;
/** Radix для base36 конвертации (используется для преобразования байт в строку) */
const BASE36_RADIX = 36;

/* ============================================================================
 * 🧰 HELPERS — REVOKE & AUDIT
 * ============================================================================
 */

/**
 * Генерирует уникальный eventId для audit-события.
 * @note Использует eventIdGenerator из DI, если доступен (для детерминизма в тестах).
 *       Иначе использует дефолтную генерацию с crypto.randomUUID или crypto.getRandomValues.
 * @note Fallback на crypto.getRandomValues для поддержки edge runtime (Cloudflare Workers и т.п.),
 *       где process недоступен, но Web Crypto API доступен.
 */
function generateEventId(
  clock: ClockPort,
  eventIdGenerator?: EventIdGeneratorPort | undefined,
): string {
  if (eventIdGenerator !== undefined) {
    return eventIdGenerator.generate();
  }
  const timestamp = clock.now();
  // Предпочтительно: crypto.randomUUID (доступен в Node.js 14.17.0+, браузерах, edge runtime)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    const random = crypto.randomUUID().slice(0, EVENT_ID_UUID_LENGTH);
    return `logout-${timestamp}-${random}`;
  }
  // Fallback: crypto.getRandomValues для edge runtime (Cloudflare Workers, Deno и т.п.)
  // Генерируем случайные байты и конвертируем в base36 для читаемости
  if (typeof crypto !== 'undefined' && typeof (crypto as Crypto).getRandomValues === 'function') {
    const randomBytes = new Uint8Array(RANDOM_BYTES_LENGTH);
    (crypto as Crypto).getRandomValues(randomBytes);
    // Конвертируем в base36 для компактности и читаемости
    const random = Array.from(randomBytes)
      .map((byte) => byte.toString(BASE36_RADIX))
      .join('')
      .slice(0, EVENT_ID_UUID_LENGTH);
    return `logout-${timestamp}-${random}`;
  }
  // Последний fallback: если crypto недоступен (крайне редкий случай)
  // Используем timestamp + process.hrtime если доступен, иначе только timestamp
  const hrtimeValue = typeof process !== 'undefined'
      && typeof process.hrtime === 'function'
      && typeof process.hrtime.bigint === 'function'
    ? process.hrtime.bigint().toString()
    : '';
  return `logout-${timestamp}-${hrtimeValue !== '' ? `fallback-${hrtimeValue}` : 'no-crypto'}`;
}

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
 * Выполняет revoke API-запрос (best-effort, не блокирует logout).
 * @note Выполняется параллельно после unlock store, ошибки не влияют на результат logout.
 * @note Ошибки логируются через auditLogger, но не пробрасываются наружу.
 */
async function performRevoke(
  deps: Extract<LogoutEffectDeps, { mode: 'remote'; }>,
  config: Extract<LogoutEffectConfig, { mode: 'remote'; }>,
  signal?: AbortSignal,
): Promise<void> {
  try {
    // Effect-based API-клиент: AbortSignal передаётся через параметр Effect
    const revokeEffect = deps.apiClient.post(
      '/v1/auth/logout',
      {},
      signal !== undefined
        ? { signal }
        : undefined,
    );
    const timeoutMs = config.timeout ?? DEFAULT_REVOKE_TIMEOUT_MS;
    const revokeWithTimeout = withTimeout(
      revokeEffect,
      { timeoutMs, tag: 'logout-revoke' },
    );
    // Timeout enforced by withTimeout above
    // eslint-disable-next-line @livai/multiagent/orchestration-safety
    await revokeWithTimeout(signal);
  } catch (unknownError: unknown) {
    // Revoke ошибки логируются, но не влияют на результат logout
    const error = deps.errorMapper.map(unknownError);
    const auditContext: LogoutAuditContext = {
      timestamp: epochMsToIsoString(deps.clock.now()),
      eventId: generateEventId(deps.clock, deps.eventIdGenerator),
      traceId: undefined, // Revoke не имеет traceId (выполняется после reset)
      userId: undefined, // userId не доступен для revoke (выполняется после reset)
      ip: undefined,
      userAgent: undefined,
      deviceId: undefined,
      geo: undefined,
      riskScore: undefined,
    };
    try {
      const event = mapRevokeErrorToAuditEvent(error, auditContext);
      deps.auditLogger.logLogoutEvent(event);
    } catch {
      // Audit logging не должен влиять на revoke flow
    }
  }
}

/**
 * Выполняет атомарный reset store с блокировкой.
 * @note Вынесено в отдельную функцию для улучшения читаемости runOnce.
 * @note reason передается через config для поддержки разных сценариев (timeout, forced, token invalidation).
 */
function performStoreReset(deps: LogoutEffectDeps, reason: string): void {
  // Idempotency: reset уже выполненного состояния является no-op (через batchUpdate)
  withStoreLock(deps.authStore, () => {
    applyLogoutReset(deps.authStore, {
      reason,
    });
  });
}

/**
 * Логирует пропуск revoke из-за превышения лимита параллельных запросов.
 * @note Вынесено в отдельную функцию для снижения cognitive complexity runOnce.
 */
function logRevokeSkipped(
  clock: ClockPort,
  eventIdGenerator: EventIdGeneratorPort | undefined,
  auditLogger: LogoutAuditLoggerPort,
): void {
  try {
    const auditContext: LogoutAuditContext = {
      timestamp: epochMsToIsoString(clock.now()),
      eventId: generateEventId(clock, eventIdGenerator),
      traceId: undefined,
      userId: undefined, // userId не доступен после reset
      ip: undefined,
      userAgent: undefined,
      deviceId: undefined,
      geo: undefined,
      riskScore: undefined,
    };
    const event = mapRevokeSkippedToAuditEvent(auditContext);
    auditLogger.logLogoutEvent(event);
  } catch {
    // Audit logging не должен влиять на основной logout-flow
  }
}

/**
 * Выполняет revoke запрос или логирует пропуск при превышении лимита.
 * @note Вынесено в отдельную функцию для снижения cognitive complexity runOnce.
 * @note Использует замыкание для обновления activeRevokeCount.
 */
function handleRevokeRequest(
  deps: Extract<LogoutEffectDeps, { mode: 'remote'; }>,
  config: Extract<LogoutEffectConfig, { mode: 'remote'; }>,
  signal: AbortSignal,
  currentCount: number,
  updateCount: (updater: (prev: number) => number) => void,
): void {
  if (currentCount < MAX_REVOKE_CONCURRENT) {
    updateCount((prev) => prev + 1);
    // Выполняем revoke в фоне, не блокируя основной flow
    performRevoke(deps, config, signal)
      .finally(() => {
        updateCount((prev) => prev - 1);
      })
      .catch(() => {
        // Ошибки revoke уже обработаны в performRevoke
      });
  } else {
    // Логируем пропуск revoke из-за превышения лимита
    logRevokeSkipped(deps.clock, deps.eventIdGenerator, deps.auditLogger);
  }
}

/* ============================================================================
 * 🎯 EFFECT FACTORY — CREATE LOGOUT EFFECT
 * ============================================================================
 */

/**
 * Оркестратор logout-flow.
 * @note Поддерживает два режима: local (только reset store) и remote (reset + revoke API).
 * @note Idempotency: reset уже выполненного состояния является no-op (через batchUpdate).
 * @note Remote logout: reset store всегда, revoke API best-effort (не блокирует logout).
 */
export function createLogoutEffect(
  deps: LogoutEffectDeps, // DI-порты для logout-effect
  config: LogoutEffectConfig, // Конфигурация режима, таймаутов и стратегии конкуренции
): () => Effect<LogoutResult> {
  // Конкурентная защита: cancel_previous / ignore / serialize
  let inFlight: Promise<LogoutResult> | null = null;
  // Map для хранения контроллеров по уникальным ключам (защита от race conditions)
  // @note logout может иметь несколько параллельных запросов → controllerMap
  //       login один запрос → currentController достаточно
  const controllerMap = new Map<symbol, AbortController>();
  let queueTail: Promise<LogoutResult> | null = null;
  let queueLength = 0; // Счетчик длины очереди для serialize (защита от DoS)
  // Счетчик активных revoke-запросов (защита от DoS)
  let activeRevokeCount = 0;

  return (): Effect<LogoutResult> =>
  async (
    externalSignal?: AbortSignal,
  ): Promise<LogoutResult> => {
    // Конкурентная стратегия: ignore — возвращаем уже выполняющийся запрос
    if (config.concurrency === 'ignore' && inFlight !== null) {
      // Возвращаем уже выполняющийся запрос (очистка inFlight происходит в finally)
      return inFlight;
    }

    const requestId = Symbol('logout-request'); // Уникальный ключ для каждого запроса
    const controller = isRemoteLogoutDeps(deps) && deps.abortController !== undefined
      ? deps.abortController.create()
      : new AbortController();
    const signal = controller.signal;

    const runOnce = (): Promise<LogoutResult> => {
      try {
        // Step 1 — lock → reset → unlock (атомарно через withStoreLock)
        // @note reason передается через config для поддержки разных сценариев
        const reason = config.reason ?? 'user_initiated';
        performStoreReset(deps, reason);

        // Step 2 — (remote mode) revoke API параллельно после unlock (best-effort)
        // Revoke выполняется параллельно, не блокирует logout
        // Защита от DoS: ограничение на количество параллельных revoke-запросов
        // @note Revoke выполняется ПОСЛЕ reset. Если revoke требует токен из store,
        //       токен должен быть передан явно через headers (см. api-client.port.ts).
        //       Согласно middleware, /v1/auth/* публичные, но для безопасности рекомендуется
        //       передавать токен явно, если он доступен до reset.
        if (isRemoteLogoutDeps(deps) && config.mode === 'remote') {
          handleRevokeRequest(
            deps,
            config,
            signal,
            activeRevokeCount,
            (updater) => {
              activeRevokeCount = updater(activeRevokeCount);
            },
          );
        }

        const result: LogoutResult = { type: 'success' as const };

        // Audit logging для success результата
        // См. logout-audit.mapper.ts для деталей маппинга в audit-события
        try {
          const auditResult: LogoutResultForAudit = { type: 'success' };
          const auditContext: LogoutAuditContext = {
            timestamp: epochMsToIsoString(deps.clock.now()),
            eventId: generateEventId(deps.clock, deps.eventIdGenerator),
            traceId: undefined, // Logout не имеет traceId (можно добавить в будущем)
            userId: undefined, // userId не доступен после reset, используем undefined для pre-auth logout scenario
            ip: undefined,
            userAgent: undefined,
            deviceId: undefined,
            geo: undefined,
            riskScore: undefined,
          };
          const event = mapLogoutResultToAuditEvent(auditResult, auditContext);
          deps.auditLogger.logLogoutEvent(event);
        } catch {
          // Audit logging не должен ломать основной logout-flow
        }

        return Promise.resolve(result);
      } catch (unknownError: unknown) {
        // Ошибки обрабатываются только для remote mode (local mode не имеет errorMapper)
        let error: AuthError;
        if (isRemoteLogoutDeps(deps)) {
          error = deps.errorMapper.map(unknownError);
        } else {
          // Local mode: ошибки не ожидаются (reset store синхронный)
          // Но на всякий случай возвращаем fallback error
          error = {
            kind: 'network',
            retryable: true,
            message: 'Logout failed',
          };
        }

        const result: LogoutResult = { type: 'error' as const, error };

        // Audit logging для error результата
        // См. logout-audit.mapper.ts для деталей маппинга в audit-события
        try {
          const auditResult: LogoutResultForAudit = { type: 'error', error };
          const auditContext: LogoutAuditContext = {
            timestamp: epochMsToIsoString(deps.clock.now()),
            eventId: generateEventId(deps.clock, deps.eventIdGenerator),
            traceId: undefined, // Logout не имеет traceId (можно добавить в будущем)
            userId: undefined, // userId не доступен после reset, используем undefined для pre-auth logout scenario
            ip: undefined,
            userAgent: undefined,
            deviceId: undefined,
            geo: undefined,
            riskScore: undefined,
          };
          const event = mapLogoutResultToAuditEvent(auditResult, auditContext);
          deps.auditLogger.logLogoutEvent(event);
        } catch {
          // Ошибки аудита не должны влиять на основной результат
        }

        return Promise.resolve(result);
      }
    };

    const executeWithStrategy = async (): Promise<LogoutResult> => {
      if (config.concurrency === 'cancel_previous') {
        // Отменяем все предыдущие запросы через их AbortController
        for (const [id, ctrl] of controllerMap.entries()) {
          if (id !== requestId) {
            ctrl.abort();
            controllerMap.delete(id);
          }
        }
      }

      if (config.concurrency === 'serialize') {
        // Защита от DoS: проверяем лимит длины очереди
        if (queueLength >= MAX_SERIALIZE_QUEUE_LENGTH) {
          const error: AuthError = {
            kind: 'rate_limited',
            message: 'Logout queue is full, please try again later',
          };
          return { type: 'error', error };
        }

        queueLength++;
        const previous = queueTail;
        const current = (async (): Promise<LogoutResult> => {
          if (previous) {
            // Ждем завершения предыдущего запроса (игнорируем ошибки, чтобы не блокировать очередь)
            // Previous request имеет свой timeout через global hard timeout (если есть)
            // eslint-disable-next-line @livai/multiagent/orchestration-safety
            await previous.catch(() => {});
          }
          return runOnce();
        })();
        queueTail = current;
        // Очищаем счетчик после завершения
        current.finally(() => {
          queueLength--;
          if (queueTail === current) {
            queueTail = null;
          }
        }).catch(() => {
          // Игнорируем ошибки при очистке
        });
        return current;
      }

      return runOnce();
    };

    // Сохраняем controller в Map для cancel_previous стратегии
    controllerMap.set(requestId, controller);

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
      // Удаляем controller из Map
      controllerMap.delete(requestId);
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
