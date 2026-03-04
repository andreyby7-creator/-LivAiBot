/**
 * @file packages/domains/src/classification/evaluation/result.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Evaluation Result (Domain-Specific Evaluation Result)
 * ============================================================================
 * Domain-specific evaluation result для classification domain.
 * Использует generic типы из @livai/core/domain-kit для type safety.
 * Архитектура: библиотека из 1 модуля
 * - ClassificationEvaluationResult: полный результат оценки классификации с orchestration данными
 * Принципы:
 * - ✅ SRP: модульная структура (только типы результата оценки)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, без side-effects
 * - ✅ Domain-pure: без side-effects, domain объявляет evaluation result (НЕ core), использует generic типы
 * - ✅ Complete orchestration result: содержит все данные для feature layer (riskScore, riskLevel, triggeredRules)
 * - ✅ Single source of truth: вся orchestration логика в domains, feature layer только маппит и применяет
 * - ✅ Scalable: легко расширяется новыми полями без изменения core-логики
 * - ✅ Strict typing: branded types через generic типы из core, union types для всех значений
 * - ✅ Extensible: легко расширяется новыми полями через optional properties
 * - ✅ Immutable: все поля readonly для защиты от мутаций
 * - ✅ Security: runtime validation через branded types
 */

import type { Confidence, EvaluationLevel, EvaluationScale } from '@livai/core';

import type { ClassificationLabel } from '../labels.js';
import type { RiskLevel } from '../policies/base.policy.js';
import type { ClassificationContext, ClassificationSignals } from '../signals/signals.js';
import type { ClassificationRule } from '../strategies/rules.js';

/* ============================================================================
 * 🧩 ТИПЫ — CLASSIFICATION EVALUATION RESULT TYPES
 * ============================================================================
 */

/**
 * Результат оценки классификации
 * Production-grade модель для policy-engine и explainability
 * Использует generic типы из @livai/core/domain-kit для type safety между доменами
 * Содержит полный результат orchestration из domains:
 * - evaluationLevel, confidence, label, scale (generic decision algebra)
 * - riskScore, riskLevel, triggeredRules (orchestration данные для feature layer)
 * @note Invariant: label и evaluationLevel должны быть согласованы (SAFE → низкий уровень, DANGEROUS → высокий уровень)
 *       Проверка invariant выполняется на уровне factory/validation layer, не на type-level
 *       Type-level проверка требует factory layer с runtime validation
 * @note Архитектурный принцип: вся orchestration логика (scoring, rules, decision) находится в domains.
 *       Feature layer (auth, billing, etc.) получает полный результат и только маппит/применяет его.
 *       Это обеспечивает single source of truth и предотвращает leaking abstraction.
 * @public
 */
export type ClassificationEvaluationResult = Readonly<{
  /**
   * Уровень оценки (числовая шкала 0..N)
   * Использует EvaluationLevel<'classification'> для type safety
   * @public
   */
  readonly evaluationLevel: EvaluationLevel<'classification'>;

  /**
   * Уверенность в оценке (0..1)
   * Использует Confidence<'classification'> для type safety
   * @public
   */
  readonly confidence: Confidence<'classification'>;

  /**
   * Классификационный label (SAFE, SUSPICIOUS, DANGEROUS, UNKNOWN)
   * Использует ClassificationLabel для type safety
   * @note Должен быть согласован с evaluationLevel (проверяется на уровне factory/validation)
   * @public
   */
  readonly label: ClassificationLabel;

  /**
   * Шкала оценки (parametric algebra contract)
   * Использует EvaluationScale<'classification'> для предотвращения semantic split-brain
   * @public
   */
  readonly scale: EvaluationScale<'classification'>;

  /**
   * Ключи сигналов, использованных для оценки (опционально)
   * Легковесная альтернатива полному объекту signals для explainability и audit logging
   * Используется для отслеживания, какие сигналы повлияли на результат
   * Строгая типизация через keyof ClassificationSignals предотвращает передачу несуществующих ключей
   * Автоматически синхронизируется с domain, предотвращает drift
   *
   * @example ['reputationScore', 'velocityScore', 'isVpn']
   * @public
   */
  readonly usedSignals?: readonly (keyof ClassificationSignals)[];

  /**
   * Контекст оценки (опционально)
   * Используется для explainability и audit logging
   * @note Для хранения в БД рекомендуется использовать только необходимые поля или ссылку на контекст
   * @public
   */
  readonly context?: ClassificationContext;

  /**
   * Risk score из aggregation (0-100)
   * Используется для принятия решений на уровне feature layer (auth, billing, etc.)
   * @range 0-100
   * @note 0 = минимальный риск, 100 = максимальный риск
   * @public
   */
  readonly riskScore: number;

  /**
   * Уровень риска на основе risk score и policy thresholds
   * Используется для принятия решений на уровне feature layer
   * @public
   */
  readonly riskLevel: RiskLevel;

  /**
   * Сработавшие классификационные правила (отсортированы по приоритету)
   * Используется для explainability и принятия решений на уровне feature layer
   * @public
   */
  readonly triggeredRules: readonly ClassificationRule[];
}>;
