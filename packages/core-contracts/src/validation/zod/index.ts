/**
 * @file Публичный экспорт Zod-валидации для frontend/runtime guard.
 *
 * Принципы:
 * - `generated/**` автогенерируется из OpenAPI и не правится вручную
 * - кастомные схемы/правила живут в `custom/**` и композируются через `.extend()` / `.refine()`
 */

export * as generatedAuth from './generated/auth.js';
export * as generatedBots from './generated/bots.js';
export * as generatedConversations from './generated/conversations.js';

export * from './custom/forms.js';
export * from './custom/conditional.js';
export * from './custom/i18n.js';

export * from './utils/validate.js';
export * from './utils/effect.js';
