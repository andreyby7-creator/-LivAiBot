/**
 * @file packages/core/src/policies/ComposedPolicy.ts
 * ============================================================================
 * 🛡️ CORE — Policies (Composed Policy)
 * ============================================================================
 * Архитектурная роль:
 * - Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры
 * - Объединяет все бизнес-политики Core/policies в одну точку истины
 * - Позволяет делать pre-flight проверки действий пользователей и ботов
 * - Возвращает объяснимые и типобезопасные решения
 * - Причина изменения: policies, policy composition, unified policy evaluation
 * Принципы:
 * - ✅ SRP: только правила, решения и композиция, без инфраструктуры
 * - ✅ Deterministic: одинаковые входы → одинаковые решения
 * - ✅ Domain-pure: без side-effects, без HTTP / storage / queue
 * - ✅ Strict typing: exhaustive unions для всех policy decisions
 * - ✅ Microservice-ready: используется одинаково в API, UI, Workers
 * - ✅ Stable contract: для всех feature-модулей
 * ⚠️ ВАЖНО:
 * - 🚫 Никаких side-effects
 * - 🚫 Никаких HTTP / storage / queue
 * - ✅ Только правила, решения и композиция
 * - ✅ Explicit invariants, exhaustive unions, predictable decision outputs
 */

import type { UnixTimestampMs } from '@livai/core-contracts';

import type {
  AuthPolicyConfig,
  AuthSessionState,
  AuthTokenState,
  RefreshDecision,
  SessionDecision,
  TokenDecision,
} from './AuthPolicy.js';
import { AuthPolicy } from './AuthPolicy.js';
import type {
  BillingAction,
  BillingDecision,
  BillingPolicyConfig,
  BillingSubjectState,
  BillingUsageContext,
} from './BillingPolicy.js';
import { BillingPolicy } from './BillingPolicy.js';
import type {
  BotAction,
  BotPermissionDecision,
  BotPermissionsConfig,
  BotUserContext,
} from './BotPermissions.js';
import { BotPermissions } from './BotPermissions.js';
import type {
  BotActorContext,
  BotPolicyAction,
  BotPolicyConfig,
  BotPolicyDecision,
  BotState,
} from './BotPolicy.js';
import { BotPolicy } from './BotPolicy.js';
import type {
  ChatAction,
  ChatActorContext,
  ChatDecision,
  ChatMessageContext,
  ChatPolicyConfig,
  ChatState,
} from './ChatPolicy.js';
import { ChatPolicy } from './ChatPolicy.js';

/* ========================================================================== */
/* 🧱 СОСТАВНАЯ КОНФИГУРАЦИЯ */
/* ========================================================================== */

export interface ComposedPolicyConfig {
  readonly auth: Readonly<AuthPolicyConfig>;
  readonly botPermissions: Readonly<BotPermissionsConfig>;
  readonly botPolicy: Readonly<BotPolicyConfig>;
  readonly chat: Readonly<ChatPolicyConfig>;
  readonly billing: Readonly<BillingPolicyConfig>;
}

/* ========================================================================== */
/* 🧠 СОСТАВНАЯ ПОЛИТИКА */
/* ========================================================================== */

/**
 * ComposedPolicy
 * --------------------------------------------------------------------------
 * Центральная точка проверки всех доменных политик:
 * - Auth
 * - BotPermissions
 * - BotPolicy
 * - ChatPolicy
 * - BillingPolicy
 * Используется:
 * - feature-auth
 * - feature-bots
 * - feature-chat
 * - feature-billing effects
 */
/* eslint-disable functional/no-classes */
/* eslint-disable functional/no-this-expressions */
/* eslint-disable fp/no-mutation */
export class ComposedPolicy {
  private readonly auth: AuthPolicy;
  private readonly botPermissions: BotPermissions;
  private readonly botPolicy: BotPolicy;
  private readonly chat: ChatPolicy;
  private readonly billing: BillingPolicy;

  public constructor(config: Readonly<ComposedPolicyConfig>) {
    this.auth = new AuthPolicy(config.auth);
    this.botPermissions = new BotPermissions(config.botPermissions);
    this.botPolicy = new BotPolicy(config.botPolicy);
    this.chat = new ChatPolicy(config.chat);
    this.billing = new BillingPolicy(config.billing);
  }

  /* ------------------------------------------------------------------------ */
  /* 🔐 AUTH CHECKS */
  /* ------------------------------------------------------------------------ */

  public evaluateToken(token: AuthTokenState, now: UnixTimestampMs): TokenDecision {
    return this.auth.evaluateToken(token, now);
  }

  public evaluateSession(session: AuthSessionState, now: UnixTimestampMs): SessionDecision {
    return this.auth.evaluateSession(session, now);
  }

  public canRefresh(
    refreshToken: AuthTokenState,
    session: AuthSessionState,
    now: UnixTimestampMs,
  ): RefreshDecision {
    return this.auth.canRefresh(refreshToken, session, now);
  }

  /* ------------------------------------------------------------------------ */
  /* 🔐 BOT CHECKS */
  /* ------------------------------------------------------------------------ */

  public canPerformBotAction(action: BotAction, user: BotUserContext): BotPermissionDecision {
    return this.botPermissions.canPerform(action, user);
  }

  public canPerformBotPolicy(
    action: BotPolicyAction,
    bot: BotState,
    actor: BotActorContext,
  ): BotPolicyDecision {
    return this.botPolicy.canPerform(action, bot, actor);
  }

  /* ------------------------------------------------------------------------ */
  /* 🔐 CHAT CHECKS */
  /* ------------------------------------------------------------------------ */

  public canPerformChat(
    action: ChatAction,
    chat: ChatState,
    actor: ChatActorContext,
    message?: ChatMessageContext,
  ): ChatDecision {
    return this.chat.canPerform(action, chat, actor, message);
  }

  /* ------------------------------------------------------------------------ */
  /* 🔐 BILLING CHECKS */
  /* ------------------------------------------------------------------------ */

  public canPerformBilling(
    action: BillingAction,
    subject: BillingSubjectState,
    usage?: BillingUsageContext,
  ): BillingDecision {
    return this.billing.canPerform(action, subject, usage);
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
/* eslint-enable fp/no-mutation */
