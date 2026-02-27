/**
 * @file packages/feature-auth/src/effects/login/login-effect.types.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Effect DI Types
 * ============================================================================
 *
 * Архитектурная роль:
 * - Определяет DI-контракт для login-effect до реализации самой логики
 * - Фиксирует строгий портовый DI-контракт для security-критичного эффекта (ApiClient, securityPipeline, store, errorMapper)
 * - Гарантирует чистый DI без глобалов и утечки инфраструктуры в orchestrator
 * - Использует портовую модель (*Port), чтобы DI-контейнер содержал только объектные порты без "сырых" функций
 */

import type { Effect } from '@livai/app/lib/effect-utils.js';

import type { MandatoryAuditLogger, SecurityPipelineContext } from '../../lib/security-pipeline.js';
import type { RiskLevel, RiskPolicy } from '../../types/auth-risk.js';
import type {
  AuthError,
  AuthEvent,
  AuthState,
  SecurityState,
  SessionState,
} from '../../types/auth.js';

/**
 * Store-порт для login-effect (абстракция над конкретной реализацией store/Zustand).
 * @note Хранит только необходимые методы для обновления auth/session/security состояния.
 */
export type LoginStorePort = {
  setAuthState: (state: AuthState) => void;
  setSessionState: (state: SessionState | null) => void;
  setSecurityState: (state: SecurityState) => void;
  applyEventType: (type: AuthEvent['type']) => void;
};

/**
 * Минимальный контракт HTTP-клиента для login-effect.
 * @note Не знает про fetch/axios/baseURL/retry — только post/get с AbortSignal для concurrency.
 * @note Auth headers (например, Authorization) всегда передаются ЯВНО через options.headers,
 *       никакие глобальные interceptors/implicit headers не используются.
 */
export type ApiRequestOptions = Readonly<{
  signal?: AbortSignal;
  /**
   * Явные HTTP-заголовки для запроса.
   * @note Важно для /v1/auth/me — access_token должен передаваться через Authorization header,
   *       а не через глобальное состояние или implicit интерцепторы.
   */
  headers?: Readonly<Record<string, string>>;
}>;

export type ApiClient = {
  post<T>(url: string, body: unknown, options?: ApiRequestOptions): Promise<T>;
  get<T>(url: string, options?: ApiRequestOptions): Promise<T>;
};

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
  hash: IdentifierHasher;
}>;

/**
 * Тонкий projection результата security-pipeline для login-effect.
 *
 * Инварианты:
 * - ❌ Нет доступа к deviceInfo, signals, LoginRiskEvaluation и другим domain-структурам
 * - ✅ Только заранее принятого решения и агрегированных метрик риска
 *
 * @note Полный `SecurityPipelineResult` остаётся внутри security-pipeline/lib и его адаптеров.
 *       Login-effect работает только с этим projection-типом.
 */
/**
 * Решение security-политики для login-flow.
 *
 * @note Все варианты — объектные, чтобы union оставался однородным и расширяемым:
 * - базовые решения: allow / require_mfa / block
 * - кастомные решения rule-engine: { type: 'custom', code: string }
 */
export type LoginSecurityDecision =
  | Readonly<{ type: 'allow'; }>
  | Readonly<{ type: 'require_mfa'; }>
  | Readonly<{ type: 'block'; }>
  | Readonly<{ type: 'custom'; code: string; }>;

export type LoginSecurityResult = Readonly<{
  decision: LoginSecurityDecision;
  riskScore: number;
  riskLevel: RiskLevel;
}>;

/**
 * Порт над security-pipeline для login-effect.
 * @note Login-effect не знает о конкретной реализации pipeline, только о run-методе.
 */
export type SecurityPipelinePort = Readonly<{
  run: (
    context: SecurityPipelineContext,
    policy?: RiskPolicy,
  ) => Effect<LoginSecurityResult>;
}>;

/**
 * Порт для audit-логгера.
 * @note Оборачивает MandatoryAuditLogger в объектный порт для однородности DI.
 */
export type AuditLoggerPort = Readonly<{
  log: MandatoryAuditLogger;
}>;

/**
 * Порт для error-mapper'а.
 * @note Позволяет расширять контракт (например, telemetry) без изменения DI-формы.
 */
export type ErrorMapperPort = Readonly<{
  map: (unknownError: unknown) => AuthError;
}>;

/**
 * Порт для AbortController.
 * @note Инкапсулирует стратегию создания контроллеров (pooling, tracing и т.п.).
 */
export type AbortControllerPort = Readonly<{
  create: () => AbortController;
}>;

/**
 * Порт времени.
 * @note Один источник времени для login-effect, легко подменяется в тестах.
 */
export type ClockPort = Readonly<{
  now: () => number;
}>;

/**
 * DI-зависимости login-effect.
 * @note Readonly deps, без мутаций и глобального состояния.
 */
export type LoginEffectDeps = Readonly<{
  apiClient: ApiClient;
  authStore: LoginStorePort;
  securityPipeline: SecurityPipelinePort;
  identifierHasher: IdentifierHasherPort;
  auditLogger: AuditLoggerPort;
  errorMapper: ErrorMapperPort;
  abortController: AbortControllerPort;
  clock: ClockPort;
}>;

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
    loginApiTimeoutMs: number; // для POST /v1/auth/login
    meApiTimeoutMs: number; // для GET /v1/auth/me
    // validate и metadata без таймаута или с минимальным фиксированным таймаутом
  };
  featureFlags?: LoginFeatureFlags;
  /**
   * Стратегия конкурентных вызовов login-effect.
   *
   * - 'cancel_previous' — активный вызов отменяет предыдущий через AbortController
   * - 'ignore'          — новый вызов игнорируется, пока предыдущий не завершится
   * - 'serialize'       — вызовы ставятся в очередь и выполняются по одному
   *
   * @note Стратегия реализуется внутри stateful-инстанса login-effect, без глобального стейта.
   */
  concurrency: 'cancel_previous' | 'ignore' | 'serialize';
  // policyMode на уровне композиции, login-effect не знает о режимах безопасности (prod/dev)
}>;
