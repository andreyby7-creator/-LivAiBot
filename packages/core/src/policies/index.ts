/**
 * @file @livai/core/policies — Business Policies и Rules Engine
 * Публичный API пакета policies.
 * Экспортирует все публичные компоненты, типы и утилиты для бизнес-политик и правил доступа.
 */

/* ============================================================================
 * 🔐 AUTH POLICY — ПОЛИТИКИ АУТЕНТИФИКАЦИИ И СЕССИЙ
 * ========================================================================== */

/**
 * Auth Policy: жизненный цикл access/refresh токенов, валидность сессий.
 * Security-инварианты: time-based, rotation, revocation.
 * Используется для проверки токенов и управления сессиями.
 * @public
 */
export {
  AuthPolicy,
  type AuthPolicyConfig,
  type AuthSessionState,
  type AuthTokenState,
  type AuthTokenType,
  type RefreshDecision,
  type SessionDecision,
  type TokenDecision,
  type TokenInvalidReason,
} from './AuthPolicy.js';

/* ============================================================================
 * 🤖 BOT PERMISSIONS — ПРАВА ДОСТУПА ДЛЯ БОТОВ
 * ========================================================================== */

/**
 * Bot Permissions: проверка прав доступа для действий с ботами.
 * Определяет допустимые действия на основе роли пользователя и контекста бота.
 * Используется для авторизации операций с ботами.
 * @public
 */
export {
  type BotAction,
  type BotPermissionDecision,
  type BotPermissionDeniedReason,
  BotPermissions,
  type BotPermissionsConfig,
  type BotRole,
  type BotUserContext,
} from './BotPermissions.js';

/* ============================================================================
 * 🤖 BOT POLICY — БИЗНЕС-ПОЛИТИКИ БОТОВ
 * ========================================================================== */

/**
 * Bot Policy: бизнес-ограничения жизненного цикла ботов.
 * Контролирует режимы работы (draft/active/paused/archived).
 * Проверяет допустимость действий с учётом состояния бота и роли пользователя.
 * @public
 */
export {
  type BotActorContext,
  type BotMode,
  BotPolicy,
  type BotPolicyAction,
  type BotPolicyConfig,
  type BotPolicyDecision,
  type BotPolicyDeniedReason,
  type BotState,
} from './BotPolicy.js';

/* ============================================================================
 * 💬 CHAT POLICY — ПОЛИТИКИ ЧАТОВ
 * ========================================================================== */

/**
 * Chat Policy: бизнес-правила для чатов и сообщений.
 * Контролирует режимы чата, роли участников и допустимые действия.
 * Используется для авторизации операций с чатами и сообщениями.
 * @public
 */
export {
  type ChatAction,
  type ChatActorContext,
  type ChatActorType,
  type ChatDecision,
  type ChatDeniedReason,
  type ChatMessageContext,
  type ChatMode,
  ChatPolicy,
  type ChatPolicyConfig,
  type ChatRole,
  type ChatState,
} from './ChatPolicy.js';

/* ============================================================================
 * 💳 BILLING POLICY — ПОЛИТИКИ БИЛЛИНГА
 * ========================================================================== */

/**
 * Billing Policy: бизнес-правила для биллинга и подписок.
 * Контролирует планы, использование ресурсов и стратегии переиспользования.
 * Используется для проверки доступа к платным функциям.
 * @public
 */
export {
  type BillingAction,
  type BillingDecision,
  type BillingDeniedReason,
  type BillingPlan,
  BillingPolicy,
  type BillingPolicyConfig,
  type BillingSubjectState,
  type BillingSubjectType,
  type BillingUsageContext,
  type OveruseStrategy,
} from './BillingPolicy.js';

/* ============================================================================
 * 🧩 COMPOSED POLICY — СОСТАВНАЯ ПОЛИТИКА
 * ========================================================================== */

/**
 * Composed Policy: объединяет все бизнес-политики в одну точку истины.
 * Позволяет делать pre-flight проверки действий пользователей и ботов.
 * Используется для комплексной авторизации операций.
 * @public
 */
export { ComposedPolicy, type ComposedPolicyConfig } from './ComposedPolicy.js';
