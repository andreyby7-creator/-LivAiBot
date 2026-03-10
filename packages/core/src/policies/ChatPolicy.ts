/**
 * @file packages/core/src/policies/ChatPolicy.ts
 * ============================================================================
 * 🛡️ CORE — Policies (Chat Policy)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры
 * - Определяет, кто и кому может писать
 * - Контролирует режимы чата (open / restricted / read-only / archived)
 * - Ограничивает частоту и объём сообщений
 * - Возвращает объяснимые и типобезопасные решения
 * - Причина изменения: policies, chat interaction, message rate limiting
 *
 * Принципы:
 * - ✅ SRP: только типы, правила и решения, без инфраструктуры
 * - ✅ Deterministic: одинаковые входы → одинаковые решения
 * - ✅ Domain-pure: без side-effects, без HTTP / storage / rate-limit реализаций
 * - ✅ Strict typing: exhaustive unions для ChatActorType, ChatRole, ChatMode
 * - ✅ Microservice-ready: используется одинаково в API, UI, Workers
 * - ✅ Stable contract: для feature-chat
 *
 * ⚠️ ВАЖНО:
 * - 🚫 Никаких side-effects
 * - 🚫 Никаких HTTP / storage / rate-limit реализаций
 * - ✅ Только типы, правила и решения
 * - ✅ Explicit invariants, exhaustive unions, predictable decision outputs
 */

import type { DurationMs, PolicyDecision, UnixTimestampMs } from '@livai/core-contracts';
import { Decision } from '@livai/core-contracts';

/* ============================================================================
 * 1. TYPES — CHAT POLICY MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Тип участника чата */
export type ChatActorType =
  | 'user'
  | 'bot'
  | 'system';

/** Роль пользователя в чате */
export type ChatRole =
  | 'owner'
  | 'moderator'
  | 'participant'
  | 'viewer';

/** Режим работы чата */
export type ChatMode =
  | 'open'
  | 'restricted'
  | 'read_only'
  | 'archived';

/** Доменные действия в чате */
export type ChatAction =
  | 'send_message'
  | 'edit_message'
  | 'delete_message';

/** Причины отказа в чате */
export type ChatDeniedReason =
  | 'chat_archived'
  | 'chat_read_only'
  | 'not_a_participant'
  | 'insufficient_role'
  | 'actor_not_allowed'
  | 'rate_limit_exceeded'
  | 'message_too_large';

/* ========================================================================== */
/* 🧠 СОСТОЯНИЕ ДОМЕНА */
/* ========================================================================== */

/** Состояние чата */
export interface ChatState {
  readonly chatId: string;
  readonly mode: ChatMode;
  readonly createdAt: UnixTimestampMs;
}

/** Контекст участника чата */
export interface ChatActorContext {
  readonly actorId: string;
  readonly type: ChatActorType;
  readonly role?: ChatRole;
}

/** Контекст отправляемого сообщения */
export interface ChatMessageContext {
  readonly length: number;
  readonly sentAt: UnixTimestampMs;
  readonly messagesSentRecently: number;
}

/* ========================================================================== */
/* ⚙️ КОНФИГУРАЦИЯ ПОЛИТИКИ */
/* ========================================================================== */

/**
 * Конфигурация ChatPolicy.
 * Является доменным контрактом, а не runtime-реализацией.
 */
export interface ChatPolicyConfig {
  /** Разрешённые действия по ролям */
  readonly roleActions: Readonly<Record<ChatRole, readonly ChatAction[]>>;

  /** Разрешённые действия по режимам чата */
  readonly modeActions: Readonly<Record<ChatMode, readonly ChatAction[]>>;

  /** Максимальная длина сообщения */
  readonly maxMessageLength: number;

  /** Максимум сообщений за окно */
  readonly maxMessagesPerWindow: number;

  /** Размер временного окна для rate-limit */
  readonly rateLimitWindowMs: DurationMs;

  /** Может ли бот писать в чат */
  readonly allowBotsToWrite: boolean;
}

/* ========================================================================== */
/* 🚦 РЕШЕНИЯ ПОЛИТИКИ */
/* ========================================================================== */

/** Решение по действию в чате */
export type ChatDecision = PolicyDecision<
  'ACTION_ALLOWED',
  ChatDeniedReason
>;

/* ========================================================================== */
/* 🧠 CHAT POLICY */
/* ========================================================================== */

/**
 * ChatPolicy
 * --------------------------------------------------------------------------
 * Единственный источник истины по правилам взаимодействия в чате.
 * Используется:
 * - feature-chat (send / edit / delete)
 * - API-gateway (pre-flight checks)
 * - UI (disable input / show reasons)
 * - Workers (anti-spam / moderation)
 */
/* eslint-disable functional/no-classes */
/* eslint-disable functional/no-this-expressions */
export class ChatPolicy {
  public constructor(
    private readonly config: Readonly<ChatPolicyConfig>,
  ) {}

  /* ------------------------------------------------------------------------ */
  /* 🔐 POLICY CHECK */
  /* ------------------------------------------------------------------------ */

  /**
   * Проверяет, может ли актор выполнить действие в чате
   */
  canPerform(
    action: ChatAction,
    chat: ChatState,
    actor: ChatActorContext,
    message?: ChatMessageContext,
  ): ChatDecision {
    const archivedCheck = this.checkArchivedInvariant(chat);
    if (!archivedCheck.allow) return archivedCheck;

    const readOnlyCheck = this.checkReadOnlyInvariant(chat, action);
    if (!readOnlyCheck.allow) return readOnlyCheck;

    const actorTypeCheck = this.checkActorTypeConstraints(actor);
    if (!actorTypeCheck.allow) return actorTypeCheck;

    const participationCheck = this.checkParticipationConstraints(actor);
    if (!participationCheck.allow) return participationCheck;

    const modeCheck = this.checkModeConstraints(chat, action);
    if (!modeCheck.allow) return modeCheck;

    const roleCheck = this.checkRoleConstraints(actor, action);
    if (!roleCheck.allow) return roleCheck;

    const messageCheck = this.checkMessageLimits(action, message);
    if (!messageCheck.allow) return messageCheck;

    /* ---------------------------------------------------------------------- */
    /* ✅ ALLOWED */
    /* ---------------------------------------------------------------------- */

    return Decision.allow('ACTION_ALLOWED');
  }

  /* ------------------------------------------------------------------------ */
  /* 🔍 HELPER METHODS */
  /* ------------------------------------------------------------------------ */

  private checkArchivedInvariant(chat: ChatState): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* 🗄️ ARCHIVED CHAT INVARIANT */
    /* ---------------------------------------------------------------------- */

    if (chat.mode === 'archived') {
      return { allow: false, reason: 'chat_archived' };
    }
    return Decision.allow('ACTION_ALLOWED');
  }

  private checkReadOnlyInvariant(chat: ChatState, action: ChatAction): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* 📖 READ-ONLY INVARIANT */
    /* ---------------------------------------------------------------------- */

    if (chat.mode === 'read_only' && action === 'send_message') {
      return { allow: false, reason: 'chat_read_only' };
    }
    return Decision.allow('ACTION_ALLOWED');
  }

  private checkActorTypeConstraints(actor: ChatActorContext): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* 🤖 ACTOR TYPE CONSTRAINTS */
    /* ---------------------------------------------------------------------- */

    if (actor.type === 'bot' && !this.config.allowBotsToWrite) {
      return { allow: false, reason: 'actor_not_allowed' };
    }
    return Decision.allow('ACTION_ALLOWED');
  }

  private checkParticipationConstraints(actor: ChatActorContext): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* 👤 PARTICIPATION CONSTRAINT */
    /* ---------------------------------------------------------------------- */

    if (!actor.role) {
      return { allow: false, reason: 'not_a_participant' };
    }
    return Decision.allow('ACTION_ALLOWED');
  }

  private checkModeConstraints(chat: ChatState, action: ChatAction): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* 🧩 MODE CONSTRAINTS */
    /* ---------------------------------------------------------------------- */

    const allowedInMode = this.config.modeActions[chat.mode];
    if (!allowedInMode.includes(action)) {
      return { allow: false, reason: 'chat_read_only' };
    }
    return Decision.allow('ACTION_ALLOWED');
  }

  private checkRoleConstraints(actor: ChatActorContext, action: ChatAction): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* 👥 ROLE CONSTRAINTS */
    /* ---------------------------------------------------------------------- */

    if (!actor.role) {
      return { allow: false, reason: 'not_a_participant' };
    }

    const allowedForRole = this.config.roleActions[actor.role];
    if (!allowedForRole.includes(action)) {
      return { allow: false, reason: 'insufficient_role' };
    }
    return Decision.allow('ACTION_ALLOWED');
  }

  private checkMessageLimits(action: ChatAction, message?: ChatMessageContext): ChatDecision {
    /* ---------------------------------------------------------------------- */
    /* ⏱️ RATE LIMIT & MESSAGE LIMITS */
    /* ---------------------------------------------------------------------- */

    if (action === 'send_message' && message) {
      if (message.length > this.config.maxMessageLength) {
        return { allow: false, reason: 'message_too_large' };
      }

      if (message.messagesSentRecently >= this.config.maxMessagesPerWindow) {
        return { allow: false, reason: 'rate_limit_exceeded' };
      }
    }
    return Decision.allow('ACTION_ALLOWED');
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
