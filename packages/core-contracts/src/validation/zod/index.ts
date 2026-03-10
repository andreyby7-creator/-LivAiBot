/**
 * @file @livai/core-contracts/validation/zod — Runtime Validation (Zod)
 *
 * Публичный API пакета validation/zod.
 * Экспортирует все публичные компоненты, схемы и утилиты для runtime-валидации через Zod.
 *
 * Принципы:
 * - `generated/**` автогенерируется из OpenAPI и не правится вручную
 * - кастомные схемы/правила живут в `custom/**` и композируются через `.extend()` / `.refine()`
 */

/* ============================================================================
 * 📦 GENERATED — AUTO-GENERATED SCHEMAS FROM OPENAPI
 * ============================================================================
 */

/**
 * Автогенерированные схемы из OpenAPI.
 * Не редактируются вручную, обновляются через автогенерацию.
 * Используются как база для кастомных расширений.
 * @public
 */
export * as generatedAuth from './generated/auth.js';
export * as generatedBots from './generated/bots.js';
export * as generatedConversations from './generated/conversations.js';

/* ============================================================================
 * 🎨 CUSTOM — CUSTOM SCHEMAS & RULES
 * ============================================================================
 */

/**
 * Кастомные схемы и правила для форм, условной валидации, i18n.
 * Расширяют автогенерированные схемы через `.extend()` / `.refine()`.
 * @public
 */
export * from './custom/conditional.js';
export * from './custom/forms.js';
export * from './custom/i18n.js';

/* ============================================================================
 * 🔧 UTILS — VALIDATION UTILITIES
 * ============================================================================
 */

/**
 * Утилиты для валидации: типизация и интеграция с Effect.
 * Включает Infer (типизация Zod схем) и Effect интеграцию.
 * @public
 */
export * from './utils/effect.js';
export * from './utils/validate.js';
