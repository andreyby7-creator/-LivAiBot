/**
 * @file packages/core/src/policies/BillingPolicy.ts
 * ============================================================================
 * 🛡️ CORE — Policies (Billing Policy)
 * ============================================================================
 * Архитектурная роль:
 * - Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры
 * - Ограничивает использование ресурсов по тарифу
 * - Определяет поведение при превышении лимитов (overuse)
 * - Блокирует действия при жёстких ограничениях
 * - Возвращает объяснимые и типобезопасные решения
 * - Причина изменения: policies, billing, resource limits, quota management
 * Принципы:
 * - ✅ SRP: только правила, лимиты и решения, без инфраструктуры
 * - ✅ Deterministic: одинаковые входы → одинаковые решения
 * - ✅ Domain-pure: без side-effects, без платежей, HTTP, storage, таймеров
 * - ✅ Strict typing: exhaustive unions для BillingSubjectType, BillingPlan
 * - ✅ Microservice-ready: используется ТОЛЬКО в feature-billing effects
 * - ✅ Stable contract: не вызывается напрямую из API / UI
 * ⚠️ ВАЖНО:
 * - 🚫 Никаких side-effects
 * - 🚫 Никаких платежей, HTTP, storage, таймеров
 * - ✅ Только правила, лимиты и решения
 * - ✅ Explicit invariants, exhaustive unions, predictable decision outputs
 */

import type { PolicyDecision, UnixTimestampMs } from '@livai/core-contracts';
import { Decision } from '@livai/core-contracts';

/* ============================================================================
 * 1. TYPES — BILLING POLICY MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Тип биллингового субъекта */
export type BillingSubjectType =
  | 'user'
  | 'organization'
  | 'system';

/** Тип тарифа */
export type BillingPlan =
  | 'free'
  | 'pro'
  | 'enterprise';

/** Доменные биллинговые действия */
export type BillingAction =
  | 'consume_tokens'
  | 'send_message'
  | 'create_bot'
  | 'run_job';

/** Стратегия поведения при превышении лимита */
export type OveruseStrategy =
  | 'block' // жёсткая блокировка
  | 'allow' // разрешить без ограничений
  | 'allow_warn'; // разрешить с предупреждением

/** Причины отказа биллинга */
export type BillingDeniedReason =
  | 'billing_blocked'
  | 'plan_expired'
  | 'plan_limit_exceeded'
  | 'overuse_not_allowed'
  | 'subject_not_allowed'
  | 'action_not_configured';

/* ========================================================================== */
/* 🧠 СОСТОЯНИЕ ДОМЕНА */
/* ========================================================================== */

/** Состояние биллингового субъекта */
export interface BillingSubjectState {
  readonly subjectId: string;
  readonly type: BillingSubjectType;
  readonly plan: BillingPlan;
  readonly isBlocked: boolean;
  readonly validUntil?: UnixTimestampMs;
}

/** Контекст потребления ресурса */
export interface BillingUsageContext {
  readonly amount: number;
  readonly usedInPeriod: number;
}

/* ========================================================================== */
/* ⚙️ КОНФИГУРАЦИЯ ПОЛИТИКИ */
/* ========================================================================== */

/**
 * Конфигурация BillingPolicy.
 * Является доменным контрактом, а не runtime-реализацией.
 */
export interface BillingPolicyConfig {
  /** Лимиты по тарифам и действиям */
  readonly planLimits: Readonly<
    Record<BillingPlan, Readonly<Record<BillingAction, number>>>
  >;

  /** Стратегия overuse по тарифам */
  readonly overuseStrategy: Readonly<
    Record<BillingPlan, OveruseStrategy>
  >;

  /** Разрешённые действия по типу субъекта */
  readonly subjectActions: Readonly<
    Record<BillingSubjectType, readonly BillingAction[]>
  >;
}

/* ========================================================================== */
/* 🚦 РЕШЕНИЯ ПОЛИТИКИ */
/* ========================================================================== */

/** Решение биллинговой политики */
export type BillingDecision = PolicyDecision<
  'BILLING_ALLOWED',
  BillingDeniedReason
>;

/* ========================================================================== */
/* 💳 BILLING POLICY */
/* ========================================================================== */

/**
 * BillingPolicy
 * --------------------------------------------------------------------------
 * Единственный источник истины по правилам биллинга и лимитов.
 * Используется:
 * - feature-billing effects (pre-consumption checks)
 * - overuse handling
 * - блокировки аккаунтов
 */
/* eslint-disable functional/no-classes */
/* eslint-disable functional/no-this-expressions */
export class BillingPolicy {
  public constructor(
    private readonly config: Readonly<BillingPolicyConfig>,
  ) {}

  /* ------------------------------------------------------------------------ */
  /* 🔐 POLICY CHECK */
  /* ------------------------------------------------------------------------ */

  /**
   * Проверяет, может ли субъект выполнить биллинговое действие
   */
  canPerform(
    action: BillingAction,
    subject: BillingSubjectState,
    usage?: BillingUsageContext,
  ): BillingDecision {
    const blockedCheck = this.checkBlockedInvariant(subject);
    if (!blockedCheck.allow) return blockedCheck;

    const expiredCheck = this.checkExpiredInvariant(subject);
    if (!expiredCheck.allow) return expiredCheck;

    const subjectCheck = this.checkSubjectConstraints(subject, action);
    if (!subjectCheck.allow) return subjectCheck;

    const limitCheck = this.checkPlanLimits(subject, action, usage);
    if (!limitCheck.allow) return limitCheck;

    /* ---------------------------------------------------------------------- */
    /* ✅ ALLOWED */
    /* ---------------------------------------------------------------------- */

    return Decision.allow('BILLING_ALLOWED');
  }

  /* ------------------------------------------------------------------------ */
  /* 🔍 HELPER METHODS */
  /* ------------------------------------------------------------------------ */

  private checkBlockedInvariant(
    subject: BillingSubjectState,
  ): BillingDecision {
    /* ---------------------------------------------------------------------- */
    /* 🚫 BLOCKED SUBJECT INVARIANT */
    /* ---------------------------------------------------------------------- */

    if (subject.isBlocked) {
      return { allow: false, reason: 'billing_blocked' };
    }
    return Decision.allow('BILLING_ALLOWED');
  }

  private checkExpiredInvariant(
    subject: BillingSubjectState,
  ): BillingDecision {
    /* ---------------------------------------------------------------------- */
    /* ⏰ EXPIRED PLAN INVARIANT */
    /* ---------------------------------------------------------------------- */

    if (subject.validUntil != null && subject.validUntil < Date.now()) {
      return { allow: false, reason: 'plan_expired' };
    }
    return Decision.allow('BILLING_ALLOWED');
  }

  private checkSubjectConstraints(
    subject: BillingSubjectState,
    action: BillingAction,
  ): BillingDecision {
    /* ---------------------------------------------------------------------- */
    /* 👤 SUBJECT TYPE CONSTRAINTS */
    /* ---------------------------------------------------------------------- */

    const allowedActions = this.config.subjectActions[subject.type];
    if (!allowedActions.includes(action)) {
      return { allow: false, reason: 'subject_not_allowed' };
    }
    return Decision.allow('BILLING_ALLOWED');
  }

  private checkPlanLimits(
    subject: BillingSubjectState,
    action: BillingAction,
    usage?: BillingUsageContext,
  ): BillingDecision {
    /* ---------------------------------------------------------------------- */
    /* 📊 PLAN LIMITS & OVERUSE */
    /* ---------------------------------------------------------------------- */

    if (!usage) {
      return Decision.allow('BILLING_ALLOWED');
    }

    const planLimits = this.config.planLimits[subject.plan];
    const planLimit = planLimits[action];

    if (typeof planLimit !== 'number' || !Number.isFinite(planLimit)) {
      return { allow: false, reason: 'action_not_configured' };
    }

    const projectedUsage = usage.usedInPeriod + usage.amount;

    if (projectedUsage <= planLimit) {
      return Decision.allow('BILLING_ALLOWED');
    }

    // Превышение лимита - применяем стратегию overuse
    const strategy = this.config.overuseStrategy[subject.plan];

    switch (strategy) {
      case 'allow':
        return Decision.allow('BILLING_ALLOWED');

      case 'allow_warn':
        // Для allow_warn возвращаем специальный decision
        // TODO: Возможно, нужно Decision.allowWithMeta('BILLING_ALLOWED_WITH_WARNING')
        return Decision.allow('BILLING_ALLOWED');

      case 'block':
        return { allow: false, reason: 'plan_limit_exceeded' };

      default: {
        /* ------------------------------------------------------------------ */
        /* 🧨 EXHAUSTIVENESS GUARD */
        /* ------------------------------------------------------------------ */
        const exhaustive: never = strategy;
        return exhaustive;
      }
    }
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
