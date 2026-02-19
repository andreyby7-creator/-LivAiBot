/**
 * @file packages/core/src/policies/AuthPolicy.ts
 *
 * =============================================================================
 * 🔐 AUTH POLICY — ДОМЕННЫЕ ПОЛИТИКИ АУТЕНТИФИКАЦИИ И СЕССИЙ
 * =============================================================================
 *
 * Доменный слой. ЧИСТАЯ бизнес-логика. Без инфраструктуры.
 *
 * Назначение:
 * - Описывает жизненный цикл access / refresh токенов
 * - Определяет валидность сессии и правила её обновления
 * - Инкапсулирует security-инварианты (time-based, rotation, revocation)
 *
 * Принципы:
 * - 🚫 Никаких side-effects
 * - 🚫 Никаких HTTP / storage / crypto реализаций
 * - ✅ Только типы, правила и решения
 * - 🧠 Микросервисно: используется одинаково в API, Workers, Edge, UI
 * - 🧱 Stable contract для feature-auth, feature-chat, feature-billing
 *
 * Style guidelines:
 * - Explicit invariants
 * - Exhaustive unions
 * - Predictable decision outputs
 */

import { Decision, DecisionUtils } from '@livai/core-contracts';
import type { DurationMs, PolicyDecision, UnixTimestampMs } from '@livai/core-contracts';

/* ========================================================================== */
/* 🧩 БАЗОВЫЕ ТИПЫ */
/* ========================================================================== */

/** Тип токена в системе */
export type AuthTokenType = 'access' | 'refresh';

/** Причины инвалидности токена */
export type TokenInvalidReason =
  | 'expired'
  | 'revoked'
  | 'rotated'
  | 'session_invalid'
  | 'unknown';

/** Состояние токена с точки зрения домена */
export interface AuthTokenState {
  readonly type: AuthTokenType;
  readonly issuedAt: UnixTimestampMs;
  readonly expiresAt: UnixTimestampMs;
  readonly lastUsedAt?: UnixTimestampMs;
  readonly isRevoked: boolean;
  readonly rotationCounter?: number;
}

/** Состояние auth-сессии */
export interface AuthSessionState {
  readonly sessionId: string;
  readonly userId: string;
  readonly createdAt: UnixTimestampMs;
  readonly lastActivityAt: UnixTimestampMs;
  readonly isTerminated: boolean;
}

/* ========================================================================== */
/* ⚙️ КОНФИГУРАЦИЯ ПОЛИТИКИ */
/* ========================================================================== */

/**
 * Конфигурация AuthPolicy.
 * Задаётся инфраструктурой (env / config-service),
 * но интерпретируется только здесь.
 */
export interface AuthPolicyConfig {
  /** Максимальная длительность access-токена */
  readonly accessTokenTtlMs: DurationMs;

  /** Максимальная длительность refresh-токена */
  readonly refreshTokenTtlMs: DurationMs;

  /** Абсолютный TTL сессии (hard limit) */
  readonly sessionMaxLifetimeMs: DurationMs;

  /** Inactivity timeout сессии */
  readonly sessionIdleTimeoutMs: DurationMs;

  /** Требовать ли rotation refresh-токенов */
  readonly requireRefreshRotation: boolean;

  /** Максимально допустимое количество refresh-использований */
  readonly maxRefreshRotations?: number;
}

/* ========================================================================== */
/* 🚦 РЕШЕНИЯ ПОЛИТИКИ */
/* ========================================================================== */

/** Решение по токену */
export type TokenDecision = PolicyDecision<'TOKEN_VALID', TokenInvalidReason>;

/** Решение по сессии */
export type SessionDecision = PolicyDecision<
  'SESSION_VALID',
  'expired' | 'idle_timeout' | 'terminated'
>;

/** Решение о возможности refresh */
export type RefreshDecision = PolicyDecision<'REFRESH_ALLOWED', 'REFRESH_DENIED'>;

/* ========================================================================== */
/* 🧠 AUTH POLICY */
/* ========================================================================== */

/**
 * AuthPolicy
 * --------------------------------------------------------------------------
 * Единственный источник истины по auth-правилам.
 *
 * Используется:
 * - feature-auth (login / refresh / logout)
 * - API-gateway (pre-flight checks)
 * - UI (reasoned auth state)
 * - Workers (background session cleanup)
 */
/* eslint-disable functional/no-classes */
/* eslint-disable functional/no-this-expressions */
export class AuthPolicy {
  public constructor(private readonly config: Readonly<AuthPolicyConfig>) {}

  /* ------------------------------------------------------------------------ */
  /* 🔑 TOKEN VALIDATION */
  /* ------------------------------------------------------------------------ */

  /** Проверка валидности access / refresh токена */
  evaluateToken(
    token: AuthTokenState,
    now: UnixTimestampMs,
  ): TokenDecision {
    if (token.isRevoked) {
      return { allow: false, reason: 'revoked' };
    }

    if (now >= token.expiresAt) {
      return { allow: false, reason: 'expired' };
    }

    return Decision.allow('TOKEN_VALID');
  }

  /* ------------------------------------------------------------------------ */
  /* 🧾 SESSION VALIDATION */
  /* ------------------------------------------------------------------------ */

  /** Проверка состояния auth-сессии */
  evaluateSession(
    session: AuthSessionState,
    now: UnixTimestampMs,
  ): SessionDecision {
    if (session.isTerminated) {
      return { allow: false, reason: 'terminated' };
    }

    if (now - session.createdAt > this.config.sessionMaxLifetimeMs) {
      return { allow: false, reason: 'expired' };
    }

    if (now - session.lastActivityAt > this.config.sessionIdleTimeoutMs) {
      return { allow: false, reason: 'idle_timeout' };
    }

    return Decision.allow('SESSION_VALID');
  }

  /* ------------------------------------------------------------------------ */
  /* 🔄 REFRESH POLICY */
  /* ------------------------------------------------------------------------ */

  /**
   * Можно ли выполнить refresh access-токена
   * на основе refresh-токена и сессии
   */
  canRefresh(
    refreshToken: AuthTokenState,
    session: AuthSessionState,
    now: UnixTimestampMs,
  ): RefreshDecision {
    const tokenDecision = this.evaluateToken(refreshToken, now);
    if (DecisionUtils.isDenied(tokenDecision)) {
      return {
        allow: false,
        reason: 'REFRESH_DENIED',
        violation: {
          code: 'REFRESH_TOKEN_INVALID',
          reason: tokenDecision.reason,
        },
      };
    }

    const sessionDecision = this.evaluateSession(session, now);
    if (DecisionUtils.isDenied(sessionDecision)) {
      return {
        allow: false,
        reason: 'REFRESH_DENIED',
        violation: {
          code: 'SESSION_INVALID',
          reason: sessionDecision.reason,
        },
      };
    }

    if (
      this.config.requireRefreshRotation
      && typeof refreshToken.rotationCounter === 'number'
      && typeof this.config.maxRefreshRotations === 'number'
      && refreshToken.rotationCounter >= this.config.maxRefreshRotations
    ) {
      return {
        allow: false,
        reason: 'REFRESH_DENIED',
        violation: {
          code: 'REFRESH_ROTATION_LIMIT',
        },
      };
    }

    return Decision.allow('REFRESH_ALLOWED');
  }
}
/* eslint-enable functional/no-classes */
/* eslint-enable functional/no-this-expressions */
