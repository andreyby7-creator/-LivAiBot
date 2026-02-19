/**
 * @file packages/feature-auth/src/types/risk.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Assessment Types
 * ============================================================================
 *
 * Архитектурная роль:
 * - Централизованные типы для risk assessment
 * - Используются в domain, effects и pipeline layers
 * - Повторное использование без дублирования
 *
 * Принципы:
 * - ✅ Shared types — единый источник истины для risk типов
 * - ✅ Domain-focused — типы отражают domain concepts
 * - ✅ Immutable — все типы readonly для безопасности (консистентно с domain типами)
 * - ✅ Self-documenting — диапазоны значений документированы в JSDoc
 */

import type { ReadonlyDeep } from 'type-fest';

import type { RiskLevel } from './auth.js';
import type { LoginRiskAssessment } from '../domain/LoginRiskAssessment.js';
import type { DecisionPolicy, DecisionResult } from '../effects/login/risk-decision.js';
import type { RiskRule, RuleEvaluationContext } from '../effects/login/risk-rules.js';
import type { RiskWeights, ScoringContext } from '../effects/login/risk-scoring.js';

/* ============================================================================
 * 🧭 RISK SIGNALS TYPES
 * ============================================================================
 *
 * @note Все типы в этом блоке используют readonly поля для предотвращения мутаций
 *       (консистентно с domain типами и принципами immutability).
 */

/**
 * Внутренние сигналы риска (domain layer)
 * Используются для scoring и rule evaluation
 */
export type InternalRiskSignals = {
  readonly isVpn?: boolean; // VPN обнаружен
  readonly isTor?: boolean; // TOR сеть обнаружена
  readonly isProxy?: boolean; // Proxy обнаружен
  readonly asn?: string; // ASN (Autonomous System Number)

  /**
   * Репутационный score
   * @range 0-100
   * @note Значения < 30 триггерят LOW_REPUTATION правило
   * @note Значения < 10 триггерят CRITICAL_REPUTATION правило
   */
  readonly reputationScore?: number;

  /**
   * Velocity score (аномалии скорости запросов)
   * @range 0-100
   * @note Значения > 70 триггерят HIGH_VELOCITY правило
   */
  readonly velocityScore?: number;

  /**
   * Предыдущая геолокация для проверки impossible travel
   * @note Используется для определения географических аномалий
   */
  readonly previousGeo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number; // Широта (-90 до 90)
    readonly lng?: number; // Долгота (-180 до 180)
  };
};

/**
 * Внешние сигналы от risk vendors (изолированы от domain)
 * Контракт:
 * - JSON-serializable (примитивы, массивы, объекты без циклических ссылок)
 * - Read-only (immutable)
 * - Детерминированные (одинаковый вход → одинаковый выход)
 * - Не влияют напрямую на правила (используются только для scoring)
 *
 * @security Sanitization выполняется через sanitizeExternalSignals() из adapter layer (security boundary).
 *           Domain layer проверяет только семантику через validateRiskSemantics().
 *           не пробрасываются в DTO для безопасности
 */
export type ExternalRiskSignals = Readonly<Record<string, unknown>>;

/**
 * Типизированные сигналы риска (internal + external)
 * Разделение internal/external для чистоты domain и безопасности
 */
export type RiskSignals = InternalRiskSignals & {
  /**
   * Внешние сигналы от risk vendors (изолированы от domain)
   * @see ExternalRiskSignals для контракта
   */
  readonly externalSignals?: ExternalRiskSignals;
};

/* ============================================================================
 * 🔧 TYPE ALIASES
 * ============================================================================
 */

/** Type alias для параметра buildAssessment (используется в ContextBuilderPlugin) */
export type BuildAssessmentContext = {
  readonly userId?: string;
  readonly ip?: string;
  readonly geo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly userAgent?: string;
  readonly previousSessionId?: string;
  readonly timestamp?: string;
  /** ReadonlyDeep защищает вложенные объекты (previousGeo, externalSignals) от мутаций плагинами */
  readonly signals?: ReadonlyDeep<RiskSignals>;
};

/* ============================================================================
 * 🧭 RISK CONTEXT TYPES
 * ============================================================================
 */

/**
 * Контекст для оценки риска логина
 * @note timestamp передается извне (orchestrator) для детерминизма
 */
export type RiskContext = {
  readonly ip?: string; // IP адрес клиента (IPv4 или IPv6)

  /**
   * Геолокация (IP / GPS / provider)
   * @note Координаты могут быть замаскированы/округлены в facade layer для privacy
   */
  readonly geo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number; // Широта (-90 до 90)
    readonly lng?: number; // Долгота (-180 до 180)
  };

  readonly userId?: string; // ID пользователя (может отсутствовать до идентификации)
  readonly previousSessionId?: string; // ID предыдущей сессии (если есть)
  readonly signals?: RiskSignals; // Типизированные сигналы риска

  /** Timestamp события (ISO 8601) */
  readonly timestamp?: string;
};

/** Политика оценки риска */
export type RiskPolicy = {
  readonly weights?: RiskWeights; // Веса для scoring
  readonly decision?: DecisionPolicy; // Политика принятия решений
};

/** Результат оценки риска */
export type RiskAssessmentResult = {
  /**
   * Оценка риска
   * @range 0-100
   * @note 0 = минимальный риск, 100 = максимальный риск
   */
  readonly riskScore: number;

  /** Уровень риска (low, medium, high, critical) */
  readonly riskLevel: RiskLevel;

  /** Сработавшие правила (отсортированы по приоритету) */
  readonly triggeredRules: readonly RiskRule[];

  /** Рекомендация по действию с причиной блокировки (для audit logging) */
  readonly decisionHint: DecisionResult;

  /** Полная оценка риска для аудита */
  readonly assessment: LoginRiskAssessment;
};

/* ============================================================================
 * 🧭 PLUGIN TYPES
 * ============================================================================
 *
 * @note Общие требования для всех плагинов:
 *       - Security: плагины НЕ должны мутировать входные данные (context, riskContext)
 *       - Immutability: все возвращаемые контексты должны быть readonly (enforced через typing)
 *       - Pure: плагины должны быть детерминированными функциями без side-effects
 *       - Порядок применения плагинов детерминирован (по порядку в массиве)
 *       - Все методы extend*Context должны возвращать НОВЫЙ объект (spread), не мутировать входной context
 *       - ⚠️ КРИТИЧНО: Нельзя мутировать вложенные объекты signals (previousGeo, externalSignals)
 *       - ReadonlyDeep<...Signals> enforce через typing предотвращает мутации вложенных объектов
 *       - Используйте spread: { ...context, signals: { ...context.signals, newField } }
 */

/**
 * Плагин для расширения контекстов risk assessment
 * Позволяет добавлять кастомные сигналы без изменения core logic
 */
export type ContextBuilderPlugin = {
  readonly id: string; // Уникальный идентификатор плагина

  /**
   * Приоритет плагина (опционально, для future ordering)
   * @range 0-100
   * @note Меньше = выше приоритет, применяется раньше (для deterministic plugin execution)
   * @note Совместимо с PrioritizedPlugin из security-pipeline.ts
   * @default undefined (применяется в порядке массива)
   */
  readonly priority?: number;
} & {
  /**
   * Расширяет scoring context кастомными сигналами
   */
  readonly extendScoringContext?: (
    context: Readonly<ScoringContext>,
    riskContext: Readonly<RiskContext>,
  ) => Readonly<ScoringContext>;

  /**
   * Расширяет rule context кастомными сигналами
   */
  readonly extendRuleContext?: (
    context: Readonly<RuleEvaluationContext>,
    riskContext: Readonly<RiskContext>,
  ) => Readonly<RuleEvaluationContext>;

  /**
   * Расширяет assessment context кастомными полями
   */
  readonly extendAssessmentContext?: (
    context: Readonly<BuildAssessmentContext>,
    riskContext: Readonly<RiskContext>,
  ) => Readonly<BuildAssessmentContext>;
};
