/**
 * @file packages/feature-auth/src/effects/logout/logout-effect.types.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Logout Effect DI Types
 * ============================================================================
 * Архитектурная роль:
 * - Определяет DI-контракт для logout-effect до реализации самой логики
 * - Фиксирует строгий портовый DI-контракт для security-критичного эффекта
 * - Гарантирует чистый DI без глобалов и утечки инфраструктуры в orchestrator
 * - Использует портовую модель (*Port), чтобы DI-контейнер содержал только объектные порты без "сырых" функций
 * - Обеспечивает compile-time safety через discriminated unions для deps и config
 */

import type { SecurityPipelineResult } from '../../lib/security-pipeline.js';
import type { AuditEventValues } from '../../schemas/index.js';
import type { AuthError } from '../../types/auth.js';
import type { RiskLevel } from '../../types/auth-risk.js';
import type { AuthApiClientPort } from '../shared/api-client.port.js';
import type { AuthStorePort } from '../shared/auth-store.port.js';

// Re-export для обратной совместимости
export type { ApiRequestOptions, AuthApiClientPort } from '../shared/api-client.port.js';

/* ============================================================================
 * 🧭 TYPES — MODES & SECURITY DECISIONS
 * ============================================================================
 */

/**
 * Режим logout-операции.
 * - `local` — локальный logout без API-запроса (только reset store)
 * - `remote` — удалённый logout с revoke-запросом (reset store + API best-effort)
 * @note Разделение режимов позволяет явно контролировать зависимости через discriminated unions.
 *       Compile-time гарантии: local не требует apiClient/errorMapper, remote требует.
 */
export type LogoutMode = 'local' | 'remote';

/**
 * Решение security-политики для logout-flow.
 * @note Все варианты — объектные, чтобы union оставался однородным и расширяемым:
 * - базовые решения: allow / block
 * - кастомные решения rule-engine: { type: 'custom', code: string, metadata?: unknown }
 * @note `metadata` в custom-решении позволяет расширять контракт без breaking changes:
 *       rule-engine может передавать дополнительный payload для обработки в effects.
 */
export type LogoutSecurityDecision =
  | Readonly<{ type: 'allow'; }>
  | Readonly<{ type: 'block'; reason?: string; }>
  | Readonly<{ type: 'custom'; code: string; metadata?: unknown; }>;

/**
 * Aggregated security result для logout-effect.
 * Тонкий projection результата security-pipeline для logout-effect (аналогично LoginSecurityResult).
 * @note Logout-effect использует только projection-поля (decision/riskScore/riskLevel) для принятия решений.
 *       Полный `SecurityPipelineResult` прокидывается в metadata/store-updater без модификации.
 */
export type LogoutSecurityResult = Readonly<{
  decision: LogoutSecurityDecision; // Решение security-политики для logout-flow
  riskScore: number; // Risk score (0-100)
  riskLevel: RiskLevel; // Уровень риска
  pipelineResult: SecurityPipelineResult; // Полный SecurityPipelineResult для metadata/store-updater
}>;

/**
 * Стратегия конкурентных вызовов logout-effect.
 * - `ignore` — новый вызов игнорируется, пока предыдущий не завершится
 * - `cancel_previous` — активный вызов отменяет предыдущий через AbortController
 * - `serialize` — вызовы ставятся в очередь и выполняются по одному
 * @note Для logout обычно используется 'ignore' (idempotency через проверку состояния).
 *       Isolation guard не обязателен, если concurrency = 'ignore'.
 */
export type LogoutConcurrency = 'ignore' | 'cancel_previous' | 'serialize';

/* ============================================================================
 * 🧭 TYPES — PORTS
 * ============================================================================
 */

/**
 * Порт для error-mapper'а.
 * @note Используется только в remote mode для обработки ошибок revoke-запроса.
 * @note Позволяет расширять контракт (например, telemetry) без изменения DI-формы.
 */
export type ErrorMapperPort = Readonly<{
  map: (unknownError: unknown) => AuthError; // Трансформация unknown ошибки в AuthError
}>;

/**
 * Порт для времени (clock).
 * @note Обязателен: используется для audit/telemetry (timestamp для security-событий).
 */
export type ClockPort = Readonly<{
  now: () => number; // UnixTimestampMs (milliseconds)
}>;

/**
 * Порт для генерации eventId.
 * @note Опционален: если не задан, используется дефолтная генерация с crypto.randomUUID.
 *       Для детерминизма в тестах рекомендуется передавать кастомный генератор.
 */
export type EventIdGeneratorPort = Readonly<{
  generate: () => string; // Генератор уникального eventId для audit-событий
}>;

/**
 * Порт для audit-логгера logout-событий.
 * @note Обеспечивает consistency с login-effect для централизованного логирования security-событий.
 * @note Используется для логирования logout-событий (logout_success/logout_failure/revoke_error).
 */
export type LogoutAuditLoggerPort = Readonly<{
  /**
   * Логирование logout-событий (logout_success/logout_failure).
   * @note События должны быть заранее провалидированы через auditEventSchema.
   * @note Использует AuditEventValues для консистентности с login-audit.
   */
  logLogoutEvent: (event: AuditEventValues) => void;
}>;

/**
 * Порт для AbortController.
 * @note Инкапсулирует стратегию создания контроллеров (pooling, tracing и т.п.).
 * @note Используется только при concurrency = 'cancel_previous'.
 * @note Опционален: обязателен только при concurrency = 'cancel_previous'.
 */
export type AbortControllerPort = Readonly<{
  create: () => AbortController; // Создание нового AbortController для отмены запросов
}>;

/* ============================================================================
 * 🧭 TYPES — DI DEPENDENCIES
 * ============================================================================
 */

/** Базовые зависимости для logout-effect (общие для всех режимов). */
type BaseLogoutEffectDeps = Readonly<{
  authStore: AuthStorePort; // Порт для работы с store (обязателен для всех режимов)
  clock: ClockPort; // Порт времени (обязателен для audit/telemetry)
  auditLogger: LogoutAuditLoggerPort; // Порт для audit-логирования logout-событий
  eventIdGenerator?: EventIdGeneratorPort | undefined; // Порт для генерации eventId (опционален, для детерминизма в тестах)
}>;

/** Зависимости для remote logout (дополнительно к базовым). */
type RemoteLogoutEffectDeps = Readonly<{
  apiClient: AuthApiClientPort; // Effect-based HTTP-клиент для revoke-запроса
  errorMapper: ErrorMapperPort; // Маппер ошибок для обработки API-ошибок
  abortController?: AbortControllerPort | undefined; // Контроллер отмены (опционален, используется при cancel_previous)
}>;

/**
 * DI-зависимости logout-effect (discriminated union для compile-time safety).
 * Структура зависит от режима:
 * - `local` — только базовые зависимости (authStore, clock, auditLogger)
 * - `remote` — базовые + remote зависимости (apiClient, errorMapper, опционально abortController)
 * @note Discriminated union обеспечивает compile-time гарантии: компилятор не позволит передать
 *       remote конфигурацию без обязательных deps. Все side-effects только через порты.
 */
export type LogoutEffectDeps =
  | (BaseLogoutEffectDeps & { mode: 'local'; })
  | (BaseLogoutEffectDeps & RemoteLogoutEffectDeps & { mode: 'remote'; });

/* ============================================================================
 * 🧭 TYPES — CONFIGURATION
 * ============================================================================
 */

/**
 * Config для logout-effect (timeouts, feature-flags, concurrency).
 * @note `timeout` доступен только в remote mode (compile-time гарантия).
 *       Все политики/режимы prod/dev вычисляются на уровне composer'а.
 */
export type LogoutFeatureFlags = Readonly<{
  /**
   * Резерв под future-флаги logout-flow.
   * @note Закрытый set: новые флаги добавляются явным образом, без generic map вида Record<string, boolean>.
   * Примеры будущих флагов:
   * - forceRemoteLogout?: boolean;
   * - skipAuditLogging?: boolean;
   */
}>;

export type LogoutEffectConfig =
  | Readonly<{
    /** Режим logout-операции: local (без API-запроса). */
    mode: 'local';

    /**
     * Стратегия конкурентных вызовов logout-effect.
     * @default 'ignore' (idempotency через проверку состояния)
     */
    concurrency?: LogoutConcurrency | undefined;

    /**
     * Причина logout-операции (для audit/telemetry).
     * @default 'user_initiated'
     */
    reason?: string | undefined;

    featureFlags?: LogoutFeatureFlags; // Feature flags для logout-flow
  }>
  | Readonly<{
    /** Режим logout-операции: remote (с revoke-запросом). */
    mode: 'remote';

    /**
     * Стратегия конкурентных вызовов logout-effect.
     * @default 'ignore' (idempotency через проверку состояния)
     */
    concurrency?: LogoutConcurrency | undefined;

    /**
     * Таймаут для revoke-запроса (только для remote mode).
     * @note Если не задан, используется дефолтный таймаут из apiClient.
     * @note Runtime validation: должен быть > 0, иначе throw Error.
     *       Используйте validateLogoutConfig для проверки перед использованием.
     */
    timeout?: number | undefined; // Milliseconds, опционален, только для remote mode

    /**
     * Причина logout-операции (для audit/telemetry).
     * @default 'user_initiated'
     */
    reason?: string | undefined;

    featureFlags?: LogoutFeatureFlags; // Feature flags для logout-flow
  }>;

/* ============================================================================
 * 🔧 VALIDATION & TYPE GUARDS — RUNTIME VALIDATION
 * ============================================================================
 */

/**
 * Валидирует конфигурацию logout-effect.
 * @throws Error если timeout задан и <= 0 в remote mode.
 */
export function validateLogoutConfig(
  config: LogoutEffectConfig, // Конфигурация для валидации
): void {
  if (config.mode === 'remote' && config.timeout !== undefined && config.timeout <= 0) {
    throw new Error('logout timeout must be > 0');
  }
}

/**
 * Type guard для проверки, что deps соответствуют remote mode.
 * @note С discriminated union compile-time гарантии обеспечиваются автоматически,
 *       но runtime guard полезен для дополнительной проверки в edge cases.
 */
export function isRemoteLogoutDeps(
  deps: LogoutEffectDeps, // Зависимости для проверки
): deps is BaseLogoutEffectDeps & RemoteLogoutEffectDeps & { mode: 'remote'; } {
  return deps.mode === 'remote';
}

/**
 * Type guard для проверки, что deps соответствуют local mode.
 * @note С discriminated union compile-time гарантии обеспечиваются автоматически,
 *       но runtime guard полезен для дополнительной проверки в edge cases.
 */
export function isLocalLogoutDeps(
  deps: LogoutEffectDeps, // Зависимости для проверки
): deps is BaseLogoutEffectDeps & { mode: 'local'; } {
  return deps.mode === 'local';
}
