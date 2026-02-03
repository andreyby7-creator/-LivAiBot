/**
 * @file packages/app/src/state/query/query-client.ts
 * ============================================================================
 * 🧠 QUERY CLIENT — ГЛОБАЛЬНАЯ ИНФРАСТРУКТУРА REACT QUERY
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единая точка конфигурации React Query для всего приложения
 * - Микросервисно-нейтральный слой (без доменной логики)
 * - SSR-safe конфигурация и централизованная телеметрия
 * - Детерминированные правила retry/кеширования
 *
 * Принципы:
 * - Никаких side-effects в queryFn (observability здесь)
 * - Никаких зависимостей на UI/feature-слои
 * - Безопасная обработка ошибок (unknown-friendly)
 * - Чёткие и расширяемые контракты конфигурации
 */

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { logFireAndForget } from '../../lib/telemetry.js';

/* ========================================================================== */
/* ⚙️ БАЗОВАЯ КОНФИГУРАЦИЯ */
/* ========================================================================== */

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const STALE_TIME_MINUTES = 5;
const GC_TIME_MINUTES = 10;
const MINUTES_5_MS = STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
const MINUTES_10_MS = GC_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
const DEFAULT_RETRY_LIMIT = 3;
const DEFAULT_MUTATION_RETRY_LIMIT = 1;

/**
 * Опции для настройки глобального QueryClient.
 * Можно расширять по мере роста системы.
 */
export type AppQueryClientOptions = Readonly<{
  /** Время актуальности данных (staleTime). */
  staleTimeMs?: number;

  /** Время сборки мусора (gcTime). */
  gcTimeMs?: number;

  /** Максимальное количество retry для query. */
  retryLimit?: number;

  /** Максимальное количество retry для mutation. */
  mutationRetryLimit?: number;
}>;

/* ========================================================================== */
/* 🧪 УТИЛИТЫ */
/* ========================================================================== */

/** Безопасно сериализует данные для логирования. */
function toSafeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return `[Unserializable: ${Object.prototype.toString.call(value ?? 'null')}]`;
  }
}

/**
 * Извлекает HTTP статус из ошибки.
 *
 * Поддерживаемые форматы:
 * - { status: number }
 * - { response: { status: number } }
 *
 * Возвращает null, если статус не определён.
 */
function extractHttpStatus(error: unknown): number | null {
  if (error != null && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;

    if ('status' in errorObj && typeof errorObj['status'] === 'number') {
      return errorObj['status'];
    }

    if (
      'response' in errorObj
      && errorObj['response'] != null
      && typeof errorObj['response'] === 'object'
    ) {
      const responseObj = errorObj['response'] as Record<string, unknown>;
      if ('status' in responseObj && typeof responseObj['status'] === 'number') {
        return responseObj['status'];
      }
    }
  }
  return null;
}

const HTTP_STATUS_CLIENT_ERROR_MIN = 400;
const HTTP_STATUS_SERVER_ERROR_MIN = 500;

/** Определяет, можно ли повторять запрос для данной ошибки. */
function shouldRetryRequest(
  failureCount: number,
  error: unknown,
  retryLimit: number,
): boolean {
  if (failureCount >= retryLimit) return false;

  const status = extractHttpStatus(error);
  if (
    status !== null
    && status >= HTTP_STATUS_CLIENT_ERROR_MIN
    && status < HTTP_STATUS_SERVER_ERROR_MIN
  ) return false;

  return true;
}

/** Логирует ошибки query/mutation в телеметрию. */
function logQueryError(params: {
  kind: 'query' | 'mutation';
  error: unknown;
  metadata?: Record<string, string | number | boolean | null>;
}): void {
  const status = extractHttpStatus(params.error);
  const message = params.error instanceof Error
    ? params.error.message
    : typeof params.error === 'string'
    ? params.error
    : toSafeJson(params.error);

  const level = status !== null
      && status >= HTTP_STATUS_CLIENT_ERROR_MIN
      && status < HTTP_STATUS_SERVER_ERROR_MIN
    ? 'WARN'
    : 'ERROR';

  logFireAndForget(level, 'React Query error', {
    kind: params.kind,
    message,
    ...(status !== null && { status }),
    ...params.metadata,
  });
}

/* ========================================================================== */
/* 🧠 QUERY CLIENT */
/* ========================================================================== */

/**
 * Создает глобальный QueryClient с преднастроенными cache и telemetry.
 * Вызывать один раз на runtime (singleton).
 */
export function createQueryClient(options: AppQueryClientOptions = {}): QueryClient {
  const queryCache = new QueryCache({
    onError: (error: unknown, query: { queryKey: unknown; queryHash: string; }): void => {
      logQueryError({
        kind: 'query',
        error,
        metadata: {
          queryKey: toSafeJson(query.queryKey),
          queryHash: query.queryHash,
        },
      });
    },
  });

  const mutationCache = new MutationCache({
    onError: (
      error: unknown,
      _variables: unknown,
      _context: unknown,
      mutation: { options?: { mutationKey?: unknown; }; } | undefined,
    ): void => {
      const mutationKey = mutation?.options?.mutationKey;
      logQueryError({
        kind: 'mutation',
        error,
        metadata: {
          mutationKey: mutationKey != null
            ? toSafeJson(mutationKey)
            : null,
        },
      });
    },
  });

  const retryLimit = options.retryLimit ?? DEFAULT_RETRY_LIMIT;
  const mutationRetryLimit = options.mutationRetryLimit ?? DEFAULT_MUTATION_RETRY_LIMIT;

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: options.staleTimeMs ?? MINUTES_5_MS,
        gcTime: options.gcTimeMs ?? MINUTES_10_MS,
        retry: (failureCount: number, error: unknown) =>
          shouldRetryRequest(failureCount, error, retryLimit),
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: mutationRetryLimit,
      },
    },
  });
}

/**
 * Глобальный singleton QueryClient.
 *
 * ❗ Должен создаваться ровно один раз на runtime.
 * ❗ Не использовать в тестах — создавать через createQueryClient().
 */
export const queryClient = createQueryClient();

/* ============================================================================
 * 🧪 TEST EXPORTS — Только для тестирования
 * ============================================================================
 *
 * Эти экспорты доступны только в тестовой среде для обеспечения полного покрытия.
 * Не использовать в production коде.
 */

export { extractHttpStatus, logQueryError, shouldRetryRequest, toSafeJson };
