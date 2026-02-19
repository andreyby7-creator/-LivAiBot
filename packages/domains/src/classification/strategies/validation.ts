/**
 * @file packages/domains/src/classification/strategies/validation.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Semantics Validation (Domain Layer)
 * ============================================================================
 *
 * Classification-специфичная валидация signals для strategies.
 * Использует semanticViolationValidator из signals/violations.ts.
 *
 * Архитектурная роль:
 * - Семантическая валидация classification signals (domain logic)
 * - Проверка бизнес-правил и диапазонов значений
 * - Возвращает violations для observability, explainability и policy-engine
 * - НЕ проверяет безопасность (это responsibility adapter layer)
 *
 * Принципы:
 * - ✅ Pure — детерминированная функция без side-effects
 * - ✅ Domain-focused — только бизнес-логика, не security
 * - ✅ Composable — использует composable validators из violations.ts
 * - ✅ Policy-ready — violations пригодны для policy-engine без парсинга
 * - ✅ Explainable — возвращает violations с impact для explainability
 */

import type { InternalClassificationSignals } from '../signals/signals.js';
import { semanticViolationValidator } from '../signals/violations.js';
import type { SemanticViolation } from '../signals/violations.js';

/* ============================================================================
 * 🧩 ТИПЫ — CONTRACT TYPE ALIASES
 * ============================================================================
 */

/**
 * Контракт для валидатора семантики classification signals
 * Явный type alias для контрактной стабильности в strategy layer
 *
 * @public
 */
export type ClassificationSemanticValidator = (
  signals: InternalClassificationSignals | undefined,
) => readonly SemanticViolation[];

/* ============================================================================
 * 🎯 ГЛАВНЫЙ API
 * ============================================================================
 */

/**
 * Валидирует семантику classification signals (domain logic)
 *
 * Проверяет: диапазоны значений (0-100), finite numbers, валидность координат (WGS84),
 * invariant координат (полные или отсутствуют — защита от spoofing).
 *
 * НЕ проверяет: безопасность, JSON-serializable, формат передачи данных (adapter layer).
 *
 * @param signals - Сигналы для валидации
 * @returns Массив нарушений (пустой если всё валидно)
 *
 * @note Security sanitization должна быть выполнена ДО вызова через adapter layer.
 * @note Missing signals не являются violations — влияют на confidence через scoring.
 * @note Fraud-система: type/range invalid → block, missing → degrade confidence.
 * @note Performance: использует composable validators из violations.ts для O(1) аллокаций.
 * @note Contract stability: использует ClassificationSemanticValidator для явного контракта.
 *
 * @public
 */
export const validateClassificationSemantics: ClassificationSemanticValidator = (
  signals,
) => semanticViolationValidator.validate(signals);
