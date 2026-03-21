/**
 * @file packages/core/src/policies/ComposedPolicy.ts
 * ============================================================================
 * 🛡️ CORE — Policies (Composed Policy)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры
 * - Объединяет все бизнес-политики Core/policies в одну точку истины
 * - Позволяет делать pre-flight проверки действий пользователей и ботов
 * - Возвращает объяснимые и типобезопасные решения
 * - Причина изменения: policies, policy composition, unified policy evaluation
 *
 * Принципы:
 * - ✅ SRP: только правила, решения и композиция, без инфраструктуры
 * - ✅ Deterministic: одинаковые входы → одинаковые решения
 * - ✅ Domain-pure: без side-effects, без HTTP / storage / queue
 * - ✅ Strict typing: exhaustive unions для всех policy decisions
 * - ✅ Microservice-ready: используется одинаково в API, UI, Workers
 * - ✅ Stable contract: для всех feature-модулей
 * - ✅ Create-from-template: единая точка `canCreateFromTemplate` (ACL → биллинг → BotPolicy), first-deny-wins
 *
 * ⚠️ ВАЖНО:
 * - 🚫 Внутри `ComposedPolicy` нет HTTP / storage / queue
 * - ✅ Опциональные `audit`-хуки на deny — точка расширения для SIEM/audit (вызов = ответственность caller)
 * - ✅ Invariant: `BotPolicy.canCreateFromTemplate` должен возвращать объект решения; иначе throw (fail-closed)
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
  BillingDeniedReason,
  BillingPolicyConfig,
  BillingSubjectState,
  BillingUsageContext,
} from './BillingPolicy.js';
import { BillingPolicy } from './BillingPolicy.js';
import type {
  BotAction,
  BotPermissionDecision,
  BotPermissionDeniedReason,
  BotPermissionsConfig,
  BotUserContext,
} from './BotPermissions.js';
import { BotPermissions } from './BotPermissions.js';
import type {
  BotActorContext,
  BotCreateFromTemplateDecision,
  BotCreateFromTemplateDeniedReason,
  BotCreateFromTemplatePolicySource,
  BotPolicyAction,
  BotPolicyConfig,
  BotPolicyDecision,
  BotState,
  BotTemplateCreateContext,
  CanCreateFromTemplateOptions,
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
/* 📋 COMPOSED — CREATE FROM TEMPLATE */
/* ========================================================================== */

/** Источник решения при композиции (слои до/включая `BotPolicy`). */
export type ComposedCreateFromTemplatePolicySource =
  | BotCreateFromTemplatePolicySource
  | 'bot_permissions:create_gate'
  | 'billing_policy:create_bot';

export type ComposedCreateFromTemplateDeniedReason =
  | BotCreateFromTemplateDeniedReason
  | BotPermissionDeniedReason
  | BillingDeniedReason;

export type ComposedCreateFromTemplateDecision =
  | {
    readonly allow: true;
    readonly reason: 'CREATE_FROM_TEMPLATE_ALLOWED';
    readonly source: BotCreateFromTemplatePolicySource;
    readonly ruleId?: string;
  }
  | {
    readonly allow: false;
    readonly reason: ComposedCreateFromTemplateDeniedReason;
    readonly source: ComposedCreateFromTemplatePolicySource;
    readonly ruleId?: string;
  };

/** Слой, на котором зафиксирован deny (для audit / SIEM). */
export type ComposedCreateFromTemplateDenyLayer =
  | 'bot_permissions'
  | 'billing_policy'
  | 'bot_policy';

/**
 * Какие слои политики были успешно пройдены до allow (для traceability / SIEM).
 */
export interface ComposedCreateFromTemplatePolicyTrace {
  readonly botPermissions: 'passed';
  /** `skipped`, если `options.billing` не передавали (биллинг не оценивался). */
  readonly billingPolicy: 'skipped' | 'passed';
  readonly botPolicy: 'passed';
}

/**
 * Событие deny для опционального hook (без IO в `ComposedPolicy`; запись в лог — в caller).
 */
export interface ComposedCreateFromTemplateDenyAuditEvent {
  readonly layer: ComposedCreateFromTemplateDenyLayer;
  readonly decision: Extract<ComposedCreateFromTemplateDecision, { allow: false; }>;
  readonly templateId: string;
  readonly actorUserId: string;
}

/**
 * Успешное прохождение композиции (итоговый allow от `BotPolicy`).
 */
export interface ComposedCreateFromTemplateAllowAuditEvent {
  readonly decision: Extract<ComposedCreateFromTemplateDecision, { allow: true; }>;
  readonly templateId: string;
  readonly actorUserId: string;
  readonly policyTrace: ComposedCreateFromTemplatePolicyTrace;
}

/**
 * Единый поток решений для полной traceability (один вызов на финальный исход).
 */
export type ComposedCreateFromTemplateDecisionAuditEvent =
  | ({ readonly outcome: 'allow'; } & ComposedCreateFromTemplateAllowAuditEvent)
  | {
    readonly outcome: 'deny';
    readonly layer: ComposedCreateFromTemplateDenyLayer;
    readonly decision: Extract<ComposedCreateFromTemplateDecision, { allow: false; }>;
    readonly templateId: string;
    readonly actorUserId: string;
  };

export interface ComposedCreateFromTemplateAuditHooks {
  /** Вызывается при любом deny (после формирования `decision`). */
  readonly onDeny?: (event: Readonly<ComposedCreateFromTemplateDenyAuditEvent>) => void;
  /** Вызывается при итоговом allow (все слои до `BotPolicy` пройдены). */
  readonly onAllow?: (event: Readonly<ComposedCreateFromTemplateAllowAuditEvent>) => void;
  /** Один callback на финальное решение (allow или deny) — удобно для SIEM / единого audit stream. */
  readonly onDecision?: (event: Readonly<ComposedCreateFromTemplateDecisionAuditEvent>) => void;
}

/**
 * Опции {@link ComposedPolicy.canCreateFromTemplate}: те же, что у {@link BotPolicy.canCreateFromTemplate},
 * плюс опциональный биллинговый контекст для проверки квоты `create_bot` и audit-хуки.
 */
export interface ComposedCanCreateFromTemplateOptions extends CanCreateFromTemplateOptions {
  readonly billing?: Readonly<{
    readonly subject: BillingSubjectState;
    readonly usage?: BillingUsageContext;
  }>;
  readonly audit?: Readonly<ComposedCreateFromTemplateAuditHooks>;
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

  /**
   * Создание бота из шаблона: **first-deny-wins** — `BotPermissions` (`create`) → опционально `BillingPolicy`
   * (`create_bot`, если передан `options.billing`) → `BotPolicy.canCreateFromTemplate`.
   * У каждого отказа есть `source` и `ruleId`; при успехе — то же решение, что вернёт `BotPolicy` (единый контракт для feature-*).
   * Invariant: ответ `BotPolicy` должен быть объектом с `allow: boolean`; иначе {@link ComposedPolicy.assertBotCreateFromTemplateDecision} бросает ошибку.
   */
  public canCreateFromTemplate(
    actor: BotActorContext,
    templateContext: BotTemplateCreateContext,
    options?: Readonly<ComposedCanCreateFromTemplateOptions>,
  ): ComposedCreateFromTemplateDecision {
    const templateId = templateContext.templateId;

    const permission = this.botPermissions.canPerform('create', {
      userId: actor.userId,
      role: actor.role,
    });
    if (!permission.allow) {
      const decision: Extract<ComposedCreateFromTemplateDecision, { allow: false; }> = {
        allow: false,
        reason: permission.reason,
        source: 'bot_permissions:create_gate',
        ruleId: 'composed:create_from_template:bot_permissions_denied',
      };
      ComposedPolicy.emitCreateFromTemplateDeny(
        options,
        'bot_permissions',
        decision,
        templateId,
        actor.userId,
      );
      return decision;
    }

    if (options?.billing != null) {
      const billingDecision = this.billing.canPerform(
        'create_bot',
        options.billing.subject,
        options.billing.usage,
      );
      if (!billingDecision.allow) {
        const decision: Extract<ComposedCreateFromTemplateDecision, { allow: false; }> = {
          allow: false,
          reason: billingDecision.reason,
          source: 'billing_policy:create_bot',
          ruleId: 'composed:create_from_template:billing_denied',
        };
        ComposedPolicy.emitCreateFromTemplateDeny(
          options,
          'billing_policy',
          decision,
          templateId,
          actor.userId,
        );
        return decision;
      }
    }

    const botOptions = ComposedPolicy.createFromTemplateOptionsForBotPolicy(options);
    const raw = this.botPolicy.canCreateFromTemplate(actor, templateContext, botOptions);
    const botDecision = ComposedPolicy.assertBotCreateFromTemplateDecision(raw);

    if (!botDecision.allow) {
      ComposedPolicy.emitCreateFromTemplateDeny(
        options,
        'bot_policy',
        botDecision,
        templateId,
        actor.userId,
      );
      return botDecision;
    }

    ComposedPolicy.emitCreateFromTemplateAllow(
      options,
      botDecision,
      templateId,
      actor.userId,
      options?.billing == null,
    );
    return botDecision;
  }

  /**
   * Fail-closed: при регрессии/рефакторе `BotPolicy` не должен возвращать `undefined` или невалидный объект.
   * @throws Error если значение не похоже на {@link BotCreateFromTemplateDecision}.
   */
  /* eslint-disable fp/no-throw -- intentional invariant guard for composed policy boundary */
  public static assertBotCreateFromTemplateDecision(value: unknown): BotCreateFromTemplateDecision {
    if (value === undefined || value === null) {
      throw new Error(
        'ComposedPolicy invariant: BotPolicy.canCreateFromTemplate returned undefined or null',
      );
    }
    if (typeof value !== 'object' || !('allow' in value)) {
      throw new Error(
        'ComposedPolicy invariant: BotPolicy.canCreateFromTemplate returned unexpected shape',
      );
    }
    const allow = (value as { allow: unknown; }).allow;
    if (allow !== true && allow !== false) {
      throw new Error(
        'ComposedPolicy invariant: BotPolicy.canCreateFromTemplate.allow is not boolean',
      );
    }
    return value as BotCreateFromTemplateDecision;
  }
  /* eslint-enable fp/no-throw */

  private static emitCreateFromTemplateDeny(
    options: Readonly<ComposedCanCreateFromTemplateOptions> | undefined,
    layer: ComposedCreateFromTemplateDenyLayer,
    decision: Extract<ComposedCreateFromTemplateDecision, { allow: false; }>,
    templateId: string,
    actorUserId: string,
  ): void {
    const denyPayload: ComposedCreateFromTemplateDenyAuditEvent = {
      layer,
      decision,
      templateId,
      actorUserId,
    };
    options?.audit?.onDeny?.(denyPayload);
    options?.audit?.onDecision?.({
      outcome: 'deny',
      layer,
      decision,
      templateId,
      actorUserId,
    });
  }

  private static emitCreateFromTemplateAllow(
    options: Readonly<ComposedCanCreateFromTemplateOptions> | undefined,
    decision: Extract<ComposedCreateFromTemplateDecision, { allow: true; }>,
    templateId: string,
    actorUserId: string,
    billingSkipped: boolean,
  ): void {
    const policyTrace: ComposedCreateFromTemplatePolicyTrace = {
      botPermissions: 'passed',
      billingPolicy: billingSkipped ? 'skipped' : 'passed',
      botPolicy: 'passed',
    };
    const allowPayload: ComposedCreateFromTemplateAllowAuditEvent = {
      decision,
      templateId,
      actorUserId,
      policyTrace,
    };
    options?.audit?.onAllow?.(allowPayload);
    options?.audit?.onDecision?.({
      outcome: 'allow',
      ...allowPayload,
    });
  }

  private static createFromTemplateOptionsForBotPolicy(
    options?: Readonly<ComposedCanCreateFromTemplateOptions>,
  ): CanCreateFromTemplateOptions | undefined {
    if (options == null) return undefined;
    return options.meta !== undefined ? { meta: options.meta } : {};
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
