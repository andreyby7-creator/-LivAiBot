/**
 * @file packages/feature-auth/src/effects/login/login-effect.types.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Effect DI Types
 * ============================================================================
 *
 * Архитектурная роль:
 * - Определяет DI-контракт для login-effect до реализации самой логики
 * - Фиксирует строгий портовый DI-контракт для security-критичного эффекта (AuthApiClientPort, securityPipeline, store, errorMapper)
 * - Гарантирует чистый DI без глобалов и утечки инфраструктуры в orchestrator
 * - Использует портовую модель (*Port), чтобы DI-контейнер содержал только объектные порты без "сырых" функций
 * - Стандартизирует async-модель на Effect для единой композиции в orchestrator
 */

import type { Effect } from '@livai/app/lib/effect-utils.js';

import type {
  MandatoryAuditLogger,
  SecurityPipelineContext,
  SecurityPipelineResult,
} from '../../lib/security-pipeline.js';
import type { AuditEventValues } from '../../schemas/index.js';
import type { RiskLevel, RiskPolicy } from '../../types/auth-risk.js';
import type { AuthError } from '../../types/auth.js';
import type { AuthApiClientPort } from '../shared/api-client.port.js';
import type { AuthStorePort } from '../shared/auth-store.port.js';

// Re-export для обратной совместимости
export type { ApiRequestOptions, AuthApiClientPort } from '../shared/api-client.port.js';

/* ============================================================================
 * 🧭 TYPES — SECURITY DECISIONS & IDENTIFIERS
 * ============================================================================
 */

/**
 * Хешер идентификаторов для метаданных/аудита.
 * @note Синхронный контракт, чтобы не тащить async-цепочки внутрь login-effect.
 */
export type IdentifierHasher = (input: string) => string;

/**
 * Порт для работы с идентификаторами.
 * @note Оборачивает низкоуровневую функцию-хешер в объектный порт.
 */
export type IdentifierHasherPort = Readonly<{
  hash: IdentifierHasher; // Хешер идентификаторов для метаданных/аудита
}>;

/**
 * Решение security-политики для login-flow.
 *
 * @note Все варианты — объектные, чтобы union оставался однородным и расширяемым:
 * - базовые решения: allow / require_mfa / block
 * - кастомные решения rule-engine: { type: 'custom', code: string, metadata?: unknown }
 *
 * @note `metadata` в custom-решении позволяет расширять контракт без breaking changes:
 *       rule-engine может передавать дополнительный payload для обработки в effects.
 */
export type LoginSecurityDecision =
  | Readonly<{ type: 'allow'; }>
  | Readonly<{ type: 'require_mfa'; }>
  | Readonly<{ type: 'block'; }>
  | Readonly<{ type: 'custom'; code: string; metadata?: unknown; }>;

/**
 * Aggregated security result для login-effect.
 *
 * Тонкий projection результата security-pipeline для login-effect.
 *
 * Инварианты:
 * - ❌ Login-effect не использует напрямую deviceInfo, signals, LoginRiskEvaluation и другие domain-структуры
 *       (доступ есть через pipelineResult, но используется только для metadata/store-updater)
 * - ✅ Только заранее принятого решения и агрегированных метрик риска для принятия решений
 *
 * @remarks
 * - `decision` / `riskScore` / `riskLevel` — тонкий projection для login-orchestrator
 * - `pipelineResult` — полный `SecurityPipelineResult` для metadata/store-updater
 *   (deviceInfo, triggeredRules, decisionHint, assessment и т.п.)
 *
 * Login-effect использует только projection-поля для принятия решения,
 * а `pipelineResult` прокидывается дальше в metadata/updater без модификации.
 *
 * @note Полный `SecurityPipelineResult` остаётся внутри security-pipeline/lib и его адаптеров.
 *       Login-effect работает только с этим projection-типом.
 */
export type LoginSecurityResult = Readonly<{
  decision: LoginSecurityDecision; // Решение security-политики для login-flow
  riskScore: number; // Risk score (0-100)
  riskLevel: RiskLevel; // Уровень риска
  pipelineResult: SecurityPipelineResult; // Полный результат security-pipeline для metadata/store-updater
}>;

/**
 * Порт над security-pipeline для login-effect.
 *
 * @note Login-effect не знает о конкретной реализации pipeline, только о run-методе.
 * @note Возвращает login-specific projection (LoginSecurityResult) для упрощения интеграции.
 *       LoginSecurityResult содержит:
 *       - decision/riskScore/riskLevel (projection для принятия решений)
 *       - pipelineResult (полный SecurityPipelineResult для metadata/store-updater)
 *
 * @note Архитектурное решение: projection создаётся внутри адаптера security-pipeline,
 *       а не в login-effect. Это упрощает использование, но создаёт coupling pipeline → login.
 *       Если pipeline будет переиспользоваться в других эффектах (register/refresh),
 *       стоит рассмотреть возврат SecurityPipelineResult с адаптером для projection в каждом эффекте.
 */
export type SecurityPipelinePort = Readonly<{
  run: (
    context: SecurityPipelineContext, // Контекст для security-pipeline
    policy?: RiskPolicy, // Опциональная политика риска
  ) => Effect<LoginSecurityResult>; // Effect с login-specific projection результата
}>;

/* ============================================================================
 * 🧭 TYPES — PORTS
 * ============================================================================
 */

/**
 * Порт для audit-логгера.
 *
 * @note Оборачивает MandatoryAuditLogger и логгер audit-событий в объектный порт для однородности DI.
 * @note Объединяет два механизма логирования:
 *       - pipeline-error logging (для ошибок security-pipeline через `log`)
 *       - auth audit logging (для событий аутентификации через `logAuditEvent`)
 *       Это допустимо для упрощения DI, но при необходимости может быть разделено на два порта.
 */
export type AuditLoggerPort = Readonly<{
  /**
   * Логирование ошибок security-pipeline (совместимо с MandatoryAuditLogger).
   * Используется адаптером security-pipeline, а не самим login-effect.
   */
  log: MandatoryAuditLogger; // Логирование ошибок security-pipeline

  /**
   * Логирование audit-событий аутентификации (login_success/login_failure/mfa_challenge/policy_violation).
   * События должны быть заранее провалидированы через auditEventSchema.
   */
  logAuditEvent: (event: AuditEventValues) => void; // Логирование audit-событий аутентификации
}>;

/**
 * Порт для error-mapper'а.
 * @note Позволяет расширять контракт (например, telemetry) без изменения DI-формы.
 */
export type ErrorMapperPort = Readonly<{
  map: (unknownError: unknown) => AuthError; // Трансформация unknown ошибки в AuthError
}>;

/**
 * Порт для AbortController.
 * @note Инкапсулирует стратегию создания контроллеров (pooling, tracing и т.п.).
 */
export type AbortControllerPort = Readonly<{
  create: () => AbortController; // Создание нового AbortController для отмены запросов
}>;

/**
 * Порт времени.
 * @note Один источник времени для login-effect, легко подменяется в тестах.
 */
export type ClockPort = Readonly<{
  now: () => number; // UnixTimestampMs (milliseconds)
}>;

/* ============================================================================
 * 🧭 TYPES — DI DEPENDENCIES
 * ============================================================================
 */

/**
 * DI-зависимости login-effect.
 * @note Readonly deps, без мутаций и глобального состояния.
 * @note Все async-операции стандартизированы на Effect для единой модели композиции.
 */
export type LoginEffectDeps = Readonly<{
  apiClient: AuthApiClientPort; // Effect-based HTTP-клиент для единой async-модели
  authStore: AuthStorePort; // Порт для работы с store
  securityPipeline: SecurityPipelinePort; // Порт над security-pipeline для login-effect
  identifierHasher: IdentifierHasherPort; // Порт для работы с идентификаторами
  auditLogger: AuditLoggerPort; // Порт для audit-логгера
  errorMapper: ErrorMapperPort; // Порт для error-mapper'а
  abortController: AbortControllerPort; // Порт для AbortController
  clock: ClockPort; // Порт времени
}>;

/* ============================================================================
 * 🧭 TYPES — CONFIGURATION
 * ============================================================================
 */

/**
 * Config для login-effect (timeouts, feature-flags, concurrency).
 *
 * Инварианты:
 * - Security pipeline полностью конфигурируется снаружи и инжектится как `securityPipeline` в deps
 * - Login-effect не знает о внутреннем `SecurityPipelineConfig` и не держит его копию в config
 * - Все политики/режимы prod/dev для security вычисляются на уровне composer'а и pipeline, а не внутри login-effect
 */
export type LoginFeatureFlags = Readonly<{
  /**
   * Резерв под future-флаги login-flow.
   * @note Закрытый set: новые флаги добавляются явным образом, без generic map вида Record<string, boolean>.
   *
   * Примеры будущих флагов:
   * - progressiveMode?: boolean;
   * - captchaEnabled?: boolean;
   */
}>;

export type LoginEffectConfig = Readonly<{
  timeouts: {
    loginApiTimeoutMs: number; // Таймаут для POST /v1/auth/login
    meApiTimeoutMs: number; // Таймаут для GET /v1/auth/me
    // validate и metadata без таймаута или с минимальным фиксированным таймаутом
    /**
     * Global hard timeout для всего login-effect (защита от зависания orchestration logic).
     * Должен быть >= суммы step timeouts + запас на overhead.
     * @note Default задаётся в composer, не здесь (уменьшает количество состояний системы).
     */
    loginHardTimeoutMs: number; // Milliseconds, обязателен (default в composer)
  };
  featureFlags?: LoginFeatureFlags; // Feature flags для login-flow
  /**
   * Стратегия конкурентных вызовов login-effect.
   *
   * - 'cancel_previous' — активный вызов отменяет предыдущий через AbortController
   * - 'ignore'          — новый вызов игнорируется, пока предыдущий не завершится
   * - 'serialize'       — вызовы ставятся в очередь и выполняются по одному
   *
   * @note Стратегия реализуется внутри stateful-инстанса login-effect, без глобального стейта.
   */
  concurrency: 'cancel_previous' | 'ignore' | 'serialize'; // Стратегия конкурентных вызовов
  // policyMode на уровне композиции, login-effect не знает о режимах безопасности (prod/dev)
}>;
