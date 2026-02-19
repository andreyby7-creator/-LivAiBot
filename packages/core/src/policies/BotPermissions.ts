/**
 * @file packages/core/src/policiesBotPermissions.ts
 *
 * =============================================================================
 * 🤖 BOT PERMISSIONS — ДОМЕННЫЕ ПРАВА ДОСТУПА К БОТАМ
 * =============================================================================
 *
 * Доменный слой. ЧИСТАЯ бизнес-логика.
 *
 * Назначение:
 * - Формализует ACL и роли пользователей для ботов
 * - Определяет CRUD / execute / manage permissions
 * - Возвращает объяснимые и типобезопасные решения
 *
 * Принципы:
 * - 🚫 Никаких side-effects
 * - 🚫 Никакого HTTP / storage
 * - ✅ Только типы, правила и решения
 * - 🧠 Используется одинаково в API, UI, Workers
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

/** Тип действия над ботом */
export type BotAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'manage_permissions';

/** Роль пользователя относительно бота */
export type BotRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer';

/** Причины отказа в доступе */
export type BotPermissionDeniedReason =
  | 'not_authenticated'
  | 'not_a_member'
  | 'insufficient_role'
  | 'action_not_allowed';

/** Состояние пользователя относительно бота */
export interface BotUserContext {
  readonly userId: string | null;
  readonly role?: BotRole;
}

/* ========================================================================== */
/* ⚙️ КОНФИГУРАЦИЯ ПОЛИТИКИ */
/* ========================================================================== */

/**
 * Конфигурация прав по ролям.
 * Является доменным контрактом, а не runtime-логикой.
 */
export interface BotPermissionsConfig {
  readonly roleMatrix: Readonly<Record<BotRole, readonly BotAction[]>>;
}

/* ========================================================================== */
/* 🚦 РЕШЕНИЯ */
/* ========================================================================== */

/** Решение по правам доступа к боту */
export type BotPermissionDecision = PolicyDecision<
  'ACTION_ALLOWED',
  BotPermissionDeniedReason
>;

/* ========================================================================== */
/* 🧠 BOT PERMISSIONS POLICY */
/* ========================================================================== */

/**
 * BotPermissions
 * --------------------------------------------------------------------------
 * Единственный источник истины по правам доступа к ботам.
 *
 * Используется:
 * - feature-bots (CRUD, execution)
 * - API-gateway (ACL checks)
 * - UI (disable / hide actions)
 * - Workers (background operations)
 */
/* eslint-disable functional/no-classes */
/* eslint-disable functional/no-this-expressions */
export class BotPermissions {
  public constructor(
    private readonly config: Readonly<BotPermissionsConfig>,
  ) {}

  /* ------------------------------------------------------------------------ */
  /* 🔐 PERMISSION CHECK */
  /* ------------------------------------------------------------------------ */

  /**
   * Проверяет, может ли пользователь выполнить действие над ботом
   */
  canPerform(
    action: BotAction,
    user: BotUserContext,
  ): BotPermissionDecision {
    if (user.userId == null || user.userId === '') {
      return { allow: false, reason: 'not_authenticated' };
    }

    if (!user.role) {
      return { allow: false, reason: 'not_a_member' };
    }

    const allowedActions = this.config.roleMatrix[user.role];

    if (!allowedActions.includes(action)) {
      return { allow: false, reason: 'insufficient_role' };
    }

    return Decision.allow('ACTION_ALLOWED');
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
