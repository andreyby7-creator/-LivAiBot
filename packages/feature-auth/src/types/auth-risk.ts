/**
 * @file packages/feature-auth/src/types/auth-risk.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Assessment Types (Auth-Specific)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Auth-specific типы для risk assessment
 * - Адаптирует типы из @livai/domains для feature-auth
 * - Используется в effects/login/risk-assessment.ts, index.ts и тестах
 * - Не содержит бизнес-логику, только типы
 *
 * Принципы:
 * - ✅ Re-export из domains где возможно (ClassificationSignals, RiskLevel)
 * - ✅ Auth-specific типы только там, где нужна адаптация
 * - ✅ Immutable — все типы readonly для безопасности
 * - ✅ Self-documenting — диапазоны значений документированы в JSDoc
 *
 * Архитектура типов:
 * - Базовые типы (RiskLevel, ClassificationSignals, ClassificationRule) импортируются из @livai/domains
 * - Auth-specific типы (RiskContext, RiskPolicy, RiskAssessmentResult) определены здесь
 * - Адаптация между domains и feature-auth типами выполняется в effects/login/risk-assessment.ts
 */

import type { RiskWeights } from '@livai/domains/aggregation';
import type { RiskLevel } from '@livai/domains/policies';
import type {
  ClassificationSignals,
  ExternalClassificationSignals,
  InternalClassificationSignals,
} from '@livai/domains/signals';
import type { ClassificationRule } from '@livai/domains/strategies';

import type { LoginRiskAssessment } from '../domain/LoginRiskAssessment.js';

/* ============================================================================
 * 🔄 RE-EXPORTS FROM DOMAINS
 * ============================================================================
 */

/**
 * Re-export RiskLevel из domains
 * @note Единый источник истины для RiskLevel в feature-auth
 *       Обеспечивает domain purity и избегает дублирования
 */
export type { RiskLevel } from '@livai/domains/policies';

/**
 * Re-export ClassificationSignals из domains
 * Используется как базовый тип для RiskSignals
 */
export type {
  ClassificationSignals,
  ExternalClassificationSignals,
  InternalClassificationSignals,
} from '@livai/domains/signals';

/* ============================================================================
 * 🔧 UTILITY TYPES
 * ============================================================================
 */

/**
 * Deep readonly helper для защиты вложенных объектов от мутаций
 * @note Локальная реализация без внешних зависимостей
 *       Рекурсивно делает все поля readonly на всех уровнях вложенности
 */
export type ReadonlyDeep<T> = T extends Function ? T
  : T extends (infer U)[] ? readonly ReadonlyDeep<U>[]
  : T extends object ? { readonly [K in keyof T]: ReadonlyDeep<T[K]>; }
  : T;

/* ============================================================================
 * 🧭 RISK SIGNALS TYPES (Auth-Specific Aliases)
 * ============================================================================
 *
 * @note Все типы в этом блоке используют readonly поля для предотвращения мутаций
 *       (консистентно с domain типами и принципами immutability).
 */

/**
 * Внутренние сигналы риска (domain layer)
 * Используются для scoring и rule evaluation
 * @note Алиас для InternalClassificationSignals из domains
 */
export type InternalRiskSignals = InternalClassificationSignals;

/**
 * Внешние сигналы от risk vendors (изолированы от domain)
 * Контракт:
 * - JSON-serializable (примитивы, массивы, объекты без циклических ссылок)
 * - Read-only (immutable)
 * - Детерминированные (одинаковый вход → одинаковый выход)
 * - Не влияют напрямую на правила (используются только для scoring)
 *
 * @security Sanitization выполняется через sanitizeExternalSignals() из adapter layer (security boundary).
 *           Domain layer проверяет только семантику через validateClassificationSemantics().
 *           Не пробрасываются в DTO для безопасности
 * @note Алиас для ExternalClassificationSignals из domains
 */
export type ExternalRiskSignals = ExternalClassificationSignals;

/**
 * Типизированные сигналы риска (internal + external)
 * Разделение internal/external для чистоты domain и безопасности
 * @note Алиас для ClassificationSignals из domains
 */
export type RiskSignals = ClassificationSignals;

/* ============================================================================
 * 🔧 TYPE ALIASES
 * ============================================================================
 */

/**
 * ISO 8601 timestamp string
 * @note Semantic alias для обеспечения детерминизма и формального контракта
 *       Все timestamp должны быть в формате ISO 8601 (например: "2024-01-15T10:30:00.000Z")
 *       Передаются извне (orchestrator) для детерминизма, не генерируются внутри
 */
export type IsoTimestamp = string;

/* ============================================================================
 * 🧭 RISK CONTEXT TYPES (Auth-Specific)
 * ============================================================================
 */

/**
 * Контекст для оценки риска логина
 * @note timestamp передается извне (orchestrator) для детерминизма
 * @note Адаптирован из ClassificationContext для совместимости с auth-специфичными плагинами
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
  /**
   * Типизированные сигналы риска
   * @security ReadonlyDeep защищает вложенные объекты (previousGeo, externalSignals) от мутаций плагинами
   *           ClassificationSignals из domains использует только shallow Readonly, поэтому требуется ReadonlyDeep
   *           для полной защиты boundary, особенно для externalSignals и вложенных объектов
   */
  readonly signals?: ReadonlyDeep<RiskSignals>;

  /** Timestamp события (ISO 8601) */
  readonly timestamp?: IsoTimestamp;
};

/**
 * Политика оценки риска
 * @note weights должны быть static config или versioned policy object, не произвольный runtime input
 *       Это обеспечивает domain purity: auth layer не должен мутировать weights, влияя на scoring
 *       Если weights — это конфигурация системы → нормально
 *       Если это runtime input → это опасно (policy mutation outside domain)
 */
export type RiskPolicy = {
  readonly weights?: RiskWeights; // Веса для scoring (static config или versioned policy)
  // @note DecisionPolicy из domains не используется в auth, decision делается через classification-mapper
};

/**
 * Результат оценки риска
 * @note Адаптирован для auth-специфичного использования
 *       triggeredRules и riskLevel берутся из ClassificationEvaluationResult из domains
 */
export type RiskAssessmentResult = {
  /**
   * Оценка риска
   * @range 0-100
   * @note 0 = минимальный риск, 100 = максимальный риск
   */
  readonly riskScore: number;

  /** Уровень риска (low, medium, high, critical) */
  readonly riskLevel: RiskLevel;

  /**
   * Сработавшие правила (отсортированы по приоритету)
   * @note Для больших наборов правил (> ~200) можно оптимизировать, передавая только ruleIds
   *       вместо полных объектов rule metadata для снижения нагрузки на auth layer
   */
  readonly triggeredRules: readonly ClassificationRule[];

  /**
   * Рекомендация по действию с причиной блокировки (для audit logging)
   * @note Тип DecisionResult определён в classification-mapper.ts
   */
  readonly decisionHint: {
    readonly action: 'login' | 'mfa' | 'block';
    readonly blockReason?: string;
  };

  /** Полная оценка риска для аудита */
  readonly assessment: LoginRiskAssessment;
};

/* ============================================================================
 * 🧭 PLUGIN TYPES (Auth-Specific)
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
 * Контекст для buildAssessment (используется в ContextBuilderPlugin)
 * @note Используется в extendAssessmentContext для расширения assessment context
 */
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
  readonly timestamp?: IsoTimestamp;
  /**
   * Сигналы для assessment context
   * @security ReadonlyDeep защищает вложенные объекты (previousGeo, externalSignals) от мутаций плагинами
   *           Обеспечивает архитектурную консистентность с другими контекстами (RiskContext, AuthScoringContext, AuthRuleEvaluationContext)
   */
  readonly signals?: ReadonlyDeep<RiskSignals>;
};

/**
 * Плагин для расширения контекстов risk assessment
 * Позволяет добавлять кастомные сигналы без изменения core logic
 * @note Адаптирован для работы с auth-специфичными типами (RiskContext, AuthScoringContext, AuthRuleEvaluationContext)
 *       Внутри используется маппинг в/из domains типов
 */
export type ContextBuilderPlugin = {
  /**
   * Уникальный идентификатор плагина
   * @note Для плагинов из разных пакетов рекомендуется использовать namespace в id
   *       (например: "vendor:plugin-name") для предотвращения конфликтов
   */
  readonly id: string;

  /**
   * Приоритет плагина (опционально, для упорядочивания)
   * @range 0-100
   * @note Меньше = выше приоритет, применяется раньше (для deterministic plugin execution)
   * @default undefined (применяется в порядке массива)
   */
  readonly priority?: number;
} & {
  /**
   * Расширяет scoring context кастомными сигналами
   * @note Использует auth-специфичные типы, внутри маппится в domains типы
   */
  readonly extendScoringContext?: (
    context: Readonly<AuthScoringContext>,
    riskContext: Readonly<RiskContext>,
  ) => Readonly<AuthScoringContext>;

  /**
   * Расширяет rule context кастомными сигналами
   * @note Использует auth-специфичные типы, внутри маппится в domains типы
   */
  readonly extendRuleContext?: (
    context: Readonly<AuthRuleEvaluationContext>,
    riskContext: Readonly<RiskContext>,
  ) => Readonly<AuthRuleEvaluationContext>;

  /**
   * Расширяет assessment context кастомными полями
   */
  readonly extendAssessmentContext?: (
    context: Readonly<BuildAssessmentContext>,
    riskContext: Readonly<RiskContext>,
  ) => Readonly<BuildAssessmentContext>;
};

/**
 * Auth-специфичный тип для RuleEvaluationContext
 * @note Используется в плагинах, маппится в/из RuleEvaluationContext из domains
 */
export type AuthRuleEvaluationContext = {
  readonly device?: {
    readonly deviceId?: string;
    readonly fingerprint?: string;
    readonly platform?: 'web' | 'ios' | 'android' | 'desktop';
    readonly os?: string;
    readonly browser?: string;
  };
  readonly geo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly previousGeo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  /**
   * Сигналы для rule evaluation
   * @security ReadonlyDeep защищает вложенные объекты от мутаций плагинами
   */
  readonly signals?: ReadonlyDeep<{
    readonly isVpn?: boolean;
    readonly isTor?: boolean;
    readonly isProxy?: boolean;
    readonly reputationScore?: number;
    readonly velocityScore?: number;
  }>;
  /**
   * Метаданные для rule evaluation
   * @security ReadonlyDeep защищает вложенные объекты от мутаций плагинами
   *           Плагин может положить mutable nested object, поэтому требуется ReadonlyDeep
   */
  readonly metadata?: ReadonlyDeep<Record<string, unknown>>;
};

/**
 * Auth-специфичный тип для ScoringContext
 * @note Используется в плагинах, маппится в/из ScoringContext из domains
 */
export type AuthScoringContext = {
  readonly device?: {
    readonly deviceId?: string;
    readonly fingerprint?: string;
    readonly platform?: 'web' | 'ios' | 'android' | 'desktop';
    readonly os?: string;
    readonly browser?: string;
  };
  readonly geo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly ip?: string;
  /**
   * Сигналы для scoring
   * @security ReadonlyDeep защищает вложенные объекты (previousGeo) от мутаций плагинами
   *           Обеспечивает архитектурную симметрию с AuthRuleEvaluationContext
   */
  readonly signals?: ReadonlyDeep<{
    readonly isVpn?: boolean;
    readonly isTor?: boolean;
    readonly isProxy?: boolean;
    readonly reputationScore?: number;
    readonly velocityScore?: number;
    readonly previousGeo?: {
      readonly country?: string;
      readonly region?: string;
      readonly city?: string;
      readonly lat?: number;
      readonly lng?: number;
    };
  }>;
};
