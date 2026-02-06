/**
 * @file packages/core/src/domain/BotPolicy.ts
 *
 * =============================================================================
 * 🤖 BOT POLICY — ДОМЕННЫЕ БИЗНЕС-ПОЛИТИКИ БОТОВ
 * =============================================================================
 *
 * Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры.
 *
 * Назначение:
 * - Определяет бизнес-ограничения жизненного цикла бота
 * - Контролирует режимы работы (draft / active / archived)
 * - Проверяет допустимость действий с учётом состояния бота и роли пользователя
 * - Возвращает объяснимые и типобезопасные решения
 *
 * Принципы:
 * - 🚫 Никаких side-effects
 * - 🚫 Никаких HTTP / storage / queue
 * - ✅ Только типы, правила и решения
 * - 🧠 Используется одинаково в API, UI, Workers
 * - 🧱 Stable domain contract
 *
 * Style guidelines:
 * - Explicit invariants
 * - Exhaustive unions
 * - Predictable decision outputs
 */

import { Decision } from '@livai/core-contracts';
import type { PolicyDecision } from '@livai/core-contracts';

/* ========================================================================== */
/* 🧩 БАЗОВЫЕ ТИПЫ */
/* ========================================================================== */

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
/* ⚙️ КОНФИГУРАЦИЯ ПОЛИТИКИ */
/* ========================================================================== */

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
 *
 * Используется:
 * - feature-bots (publish / execute / archive)
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
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
