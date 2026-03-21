/**
 * @file packages/core/src/policies/BotPolicy.ts
 * ============================================================================
 * 🛡️ CORE — Policies (Bot Policy)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры
 * - Определяет бизнес-ограничения жизненного цикла бота
 * - Контролирует режимы работы: `draft` / `active` / `paused` / `archived`
 * - Проверяет допустимость действий с учётом состояния бота и роли пользователя
 * - Отдельный контур: `canCreateFromTemplate` (создание из шаблона до появления persisted `BotState`)
 * - Возвращает объяснимые и типобезопасные решения
 *
 * Принципы:
 * - ✅ SRP: только типы, правила и решения, без инфраструктуры
 * - ✅ Deterministic: одинаковые входы → одинаковые решения
 * - ✅ Domain-pure: без side-effects, без HTTP / storage / queue
 * - ✅ Strict typing: exhaustive unions для `BotMode`, `BotPolicyAction`, решений create-from-template
 * - ✅ Microservice-ready: используется одинаково в API, UI, Workers
 * - ✅ Stable contract: прежде всего `@livai/feature-bots` (чаты — отдельно `ChatPolicy`)
 *
 * ⚠️ ВАЖНО:
 * - 🚫 Никаких side-effects
 * - 🚫 Никаких HTTP / storage / queue
 * - ✅ Только типы, правила и решения
 * - ✅ Explicit invariants, exhaustive unions, predictable decision outputs
 */

import type { PolicyDecision } from '@livai/core-contracts';
import { Decision } from '@livai/core-contracts';

/* ============================================================================
 * 1. TYPES — BOT POLICY MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Режим (состояние) бота */
export type BotMode =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived';

/** Доменные действия над ботом */
export type BotPolicyAction =
  | 'configure'
  | 'publish'
  | 'pause'
  | 'resume'
  | 'execute'
  | 'archive';

/** Роль пользователя относительно бота */
export type BotRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer';

/** Причины отказа на уровне бизнес-политики */
export type BotPolicyDeniedReason =
  | 'bot_archived'
  | 'bot_not_active'
  | 'invalid_bot_mode'
  | 'insufficient_role'
  | 'action_not_allowed';

/** Состояние бота в домене */
export interface BotState {
  readonly botId: string;
  readonly mode: BotMode;
  readonly createdAt: number;
  readonly isSystemBot: boolean;
}

/** Контекст пользователя */
export interface BotActorContext {
  readonly userId: string;
  readonly role: BotRole;
}

/* ========================================================================== */
/* 📋 CREATE FROM TEMPLATE — PURE CONTEXT / META / DECISIONS */
/* ========================================================================== */

/**
 * Расширяемые метаданные для `canCreateFromTemplate` (версия политики, флаги, сегменты).
 * Без IO: только входные данные для детерминированного решения.
 */
export interface PolicyMeta {
  /** Версия набора правил (аудит/telemetry; по умолчанию не меняет ветвление) */
  readonly policyVersion?: string;
  /** Флаги поведения (расширяемо без поломки вызовов) */
  readonly flags?: Readonly<
    Partial<{
      /** Требовать непустое пересечение `meta.segments` с `templateContext.templateTags` */
      readonly requireTemplateSegmentMatch: boolean;
    }>
  >;
  /** Сегменты актора/тенанта для сопоставления с тегами шаблона */
  readonly segments?: readonly string[];
}

/**
 * Контекст шаблона для политики «создать бота из шаблона».
 */
export interface BotTemplateCreateContext {
  readonly templateId: string;
  /**
   * Рабочее пространство (контекст для будущих правил).
   * Сейчас политика от него не ветвится; при появлении workspace-dependent сегментов/флагов —
   * добавить инварианты здесь и в `canCreateFromTemplate`, не выносить IO в `BotPolicy`.
   */
  readonly workspaceId?: string;
  /** Теги/метки шаблона (для segment-gate) */
  readonly templateTags?: readonly string[];
}

/**
 * Опции вызова {@link BotPolicy.canCreateFromTemplate}.
 */
export interface CanCreateFromTemplateOptions {
  readonly meta?: PolicyMeta;
}

/** Источник решения (объяснимость / SIEM) */
export type BotCreateFromTemplatePolicySource =
  | 'bot_policy:create_from_template'
  | 'bot_policy:configure_gate'
  | 'bot_policy:template_block'
  | 'bot_policy:segment_gate';

/** Причина отказа при create-from-template (включая доменные из `canPerform`) */
export type BotCreateFromTemplateDeniedReason =
  | BotPolicyDeniedReason
  | 'template_blocked'
  | 'segment_mismatch';

/** Разрешение create-from-template с обязательным `source` для объяснимости */
export type BotCreateFromTemplateDecision =
  | {
    readonly allow: true;
    readonly reason: 'CREATE_FROM_TEMPLATE_ALLOWED';
    readonly source: BotCreateFromTemplatePolicySource;
    readonly ruleId?: string;
  }
  | {
    readonly allow: false;
    readonly reason: BotCreateFromTemplateDeniedReason;
    readonly source: BotCreateFromTemplatePolicySource;
    readonly ruleId?: string;
  };

/* ========================================================================== */
/* ⚙️ КОНФИГУРАЦИЯ ПОЛИТИКИ */
/* ========================================================================== */

/**
 * Доп. правила для create-from-template (всё опционально — обратная совместимость).
 */
export interface BotCreateFromTemplatePolicyConfig {
  /** Детерминированный denylist идентификаторов шаблонов */
  readonly blockedTemplateIds?: readonly string[];
}

/**
 * Конфигурация бизнес-политик бота.
 * Является доменным контрактом, а не runtime-логикой.
 */
export interface BotPolicyConfig {
  /** Разрешённые действия по ролям */
  readonly roleActions: Readonly<Record<BotRole, readonly BotPolicyAction[]>>;

  /** Разрешённые действия по режимам бота */
  readonly modeActions: Readonly<Record<BotMode, readonly BotPolicyAction[]>>;

  /** Может ли system-бот быть заархивирован */
  readonly allowArchiveSystemBot: boolean;

  /**
   * Опционально: denylist шаблонов для `canCreateFromTemplate`.
   * Без этого поля denylist пуст; сегменты и флаги задаются через `CanCreateFromTemplateOptions.meta`.
   */
  readonly createFromTemplate?: Readonly<BotCreateFromTemplatePolicyConfig>;
}

/* ========================================================================== */
/* 🚦 РЕШЕНИЯ ПОЛИТИКИ */
/* ========================================================================== */

/** Решение бизнес-политики по действию над ботом */
export type BotPolicyDecision = PolicyDecision<
  'ACTION_ALLOWED',
  BotPolicyDeniedReason
>;

/* ========================================================================== */
/* 🧠 BOT POLICY */
/* ========================================================================== */

/**
 * BotPolicy
 * --------------------------------------------------------------------------
 * Единственный источник истины по бизнес-ограничениям ботов.
 * Используется:
 * - feature-bots (`canPerform`, `canCreateFromTemplate`, publish / execute / archive и т.д.)
 * - API-gateway (pre-flight policy checks)
 * - UI (disable / hide actions)
 * - Workers (background enforcement)
 */
/* eslint-disable functional/no-classes */
/* eslint-disable functional/no-this-expressions */
export class BotPolicy {
  public constructor(
    private readonly config: Readonly<BotPolicyConfig>,
  ) {}

  /**
   * Синтетический `draft`-бот для проверки «можно ли начать create-from-template»
   * (эквивалент `configure` в `draft` до persisted entity).
   */
  private makeSyntheticDraftForTemplate(): BotState {
    return Object.freeze({
      botId: '__synthetic_draft_for_template__',
      mode: 'draft',
      createdAt: 0,
      isSystemBot: false,
    });
  }

  /**
   * Общая логика разрешения действия (без публичного API-обёрток).
   * Используется {@link BotPolicy.canPerform} и {@link BotPolicy.canCreateFromTemplate}.
   */
  private canPerformInternal(
    action: BotPolicyAction,
    bot: BotState,
    actor: BotActorContext,
  ): BotPolicyDecision {
    /* ---------------------------------------------------------------------- */
    /* 🗄️ ARCHIVED BOT INVARIANT */
    /* ---------------------------------------------------------------------- */

    if (bot.mode === 'archived') {
      if (action !== 'archive') {
        return { allow: false, reason: 'bot_archived' };
      }

      if (bot.isSystemBot && !this.config.allowArchiveSystemBot) {
        return { allow: false, reason: 'action_not_allowed' };
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 🧩 MODE CONSTRAINTS */
    /* ---------------------------------------------------------------------- */

    const allowedInMode = this.config.modeActions[bot.mode];
    if (!allowedInMode.includes(action)) {
      return { allow: false, reason: 'invalid_bot_mode' };
    }

    /* ---------------------------------------------------------------------- */
    /* 👤 ROLE CONSTRAINTS */
    /* ---------------------------------------------------------------------- */

    const allowedForRole = this.config.roleActions[actor.role];
    if (!allowedForRole.includes(action)) {
      return { allow: false, reason: 'insufficient_role' };
    }

    /* ---------------------------------------------------------------------- */
    /* ✅ ALLOWED */
    /* ---------------------------------------------------------------------- */

    return Decision.allow('ACTION_ALLOWED');
  }

  /* ------------------------------------------------------------------------ */
  /* 🔐 POLICY CHECK */
  /* ------------------------------------------------------------------------ */

  /**
   * Проверяет, допустимо ли выполнить действие над ботом
   * с учётом его состояния и роли пользователя
   */
  canPerform(
    action: BotPolicyAction,
    bot: BotState,
    actor: BotActorContext,
  ): BotPolicyDecision {
    return this.canPerformInternal(action, bot, actor);
  }

  /**
   * Разрешено ли создать бота из шаблона для данного актора и контекста шаблона.
   *
   * @remarks
   * - Без IO / time / random: только детерминированные правила на основе конфига.
   * - Базовый гейт: то же, что `configure` для синтетического бота в режиме `draft`.
   * - Опционально: denylist `templateId` в конфиге; segment-gate через `PolicyMeta`.
   */
  canCreateFromTemplate(
    actor: BotActorContext,
    templateContext: BotTemplateCreateContext,
    options?: Readonly<CanCreateFromTemplateOptions>,
  ): BotCreateFromTemplateDecision {
    if (
      this.config.createFromTemplate?.blockedTemplateIds?.includes(templateContext.templateId)
        === true
    ) {
      return {
        allow: false,
        reason: 'template_blocked',
        source: 'bot_policy:template_block',
        ruleId: 'create_from_template:blocked_template_id',
      };
    }

    const configureDecision = this.canPerformInternal(
      'configure',
      this.makeSyntheticDraftForTemplate(),
      actor,
    );
    if (!configureDecision.allow) {
      return {
        allow: false,
        reason: (configureDecision as { allow: false; reason: BotPolicyDeniedReason; }).reason,
        source: 'bot_policy:configure_gate',
        ruleId: 'create_from_template:configure_draft_denied',
      };
    }

    const meta = options?.meta;
    if (
      meta?.flags?.requireTemplateSegmentMatch === true
      && meta.segments !== undefined
      && meta.segments.length > 0
    ) {
      const tagSet = new Set(templateContext.templateTags ?? []);
      const hasIntersection = meta.segments.some((segment) => tagSet.has(segment));
      if (!hasIntersection) {
        return {
          allow: false,
          reason: 'segment_mismatch',
          source: 'bot_policy:segment_gate',
          ruleId: 'create_from_template:segment_mismatch',
        };
      }
    }

    return {
      allow: true,
      reason: 'CREATE_FROM_TEMPLATE_ALLOWED',
      source: 'bot_policy:create_from_template',
      ruleId: 'create_from_template:allowed',
    };
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
