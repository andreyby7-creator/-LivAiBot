/**
 * @file packages/feature-auth/src/domain/AuthRetry.ts
 * ============================================================================
 * 🔄 FEATURE-AUTH — Retry-политики для Auth/OAuth ошибок
 * ============================================================================
 *
 * Архитектурная роль:
 * - Централизованная retry-политика для `AuthErrorType` и `OAuthErrorType`.
 * - Тонкая обёртка над core-примитивом `@livai/core/resilience/retry-policy`.
 * - Source-of-truth для retryability в feature-auth (effects, error-mapper, DTO-фабрики).
 *
 * Принципы:
 * - ✅ SRP: только retry-политики и helper’ы, без бизнес-логики.
 * - ✅ Deterministic: один код ошибки → одно решение по retry.
 * - ✅ Domain-pure: без side-effects и transport-деталей.
 * - ✅ Extensible: добавление нового кода ошибки требует явного обновления политики.
 *
 * @remarks
 * - Ключи `AuthRetryKey` / `OAuthRetryKey` должны оставаться исчерпывающими union-типами
 *   (`AuthErrorType` / `OAuthErrorType`), а не произвольным `string`. Это гарантирует,
 *   что при добавлении нового значения TypeScript потребует обновить политику.
 * - Edge-cases:
 *   - `unknown_error` → всегда `false`: это fallback-кейс, по которому мы **не** делаем автоматический retry,
 *     чтобы не зациклиться на неизвестных/неклассифицированных ошибках. Повтор возможен только по явному
 *     решению клиента/пользователя.
 *   - Fallback-конфигурации (например, когда backend вернул некорректный/неизвестный код) должны
 *     маппиться на `unknown_error` и тем самым попадать под эту политику.
 */

import type { RetryPolicy } from '@livai/core/resilience';
import { createRetryPolicy, getRetryable, mergeRetryPolicies } from '@livai/core/resilience';

import type { AuthErrorType } from '../contracts/AuthErrorResponse.js';
import type { OAuthErrorType } from '../contracts/OAuthErrorResponse.js';

/* ============================================================================
 * 🔐 AUTH — RETRY POLICY
 * ========================================================================== */

export type AuthRetryKey = AuthErrorType;

/**
 * Default retry-политика для AuthErrorType.
 * @privateRemarks
 * Значения подобраны консервативно и могут быть откалиброваны позже,
 * но политика уже является полной и детерминированной для всех кодов.
 */
/* eslint-disable @livai/rag/context-leakage -- статические retry-политики (pure data), не содержат user-specific контекста */
const RawAuthRetryPolicy = {
  invalid_credentials: false,
  account_locked: false,
  account_disabled: false,
  email_not_verified: false,
  phone_not_verified: false,
  mfa_required: false,
  mfa_failed: false,
  rate_limited: true,
  session_expired: true,
  session_revoked: false,
  token_invalid: false,
  token_expired: true,
  permission_denied: false,
  risk_blocked: false,
  conflict: false,
  unknown_error: false,
} as const satisfies RetryPolicy<AuthRetryKey>;

export const AuthRetryPolicy: RetryPolicy<AuthRetryKey> = createRetryPolicy<AuthRetryKey>(
  RawAuthRetryPolicy,
);

/** Type-safe helper для получения retryability по коду auth-ошибки. */
export const getAuthRetryable = (error: AuthRetryKey): boolean =>
  getRetryable<AuthRetryKey>(AuthRetryPolicy, error);

/**
 * Helper для мержинга Auth retry-политик (base + override) без дублирования.
 * Полезен для per-environment / per-tenant overrides поверх базовой политики.
 */
export const mergeAuthRetryPolicies = (
  base: RetryPolicy<AuthRetryKey>,
  override: Partial<RetryPolicy<AuthRetryKey>>,
): RetryPolicy<AuthRetryKey> => mergeRetryPolicies<AuthRetryKey>(base, override);

/* ============================================================================
 * 🔑 OAUTH — RETRY POLICY
 * ========================================================================== */

export type OAuthRetryKey = OAuthErrorType;

/**
 * Default retry-политика для OAuthErrorType.
 * @privateRemarks
 * Значения подобраны консервативно и могут быть откалиброваны позже,
 * но политика уже является полной и детерминированной для всех кодов.
 */
const RawOAuthRetryPolicy = {
  invalid_token: false,
  expired_token: true,
  provider_unavailable: true,
  user_denied: false,
  invalid_scope: false,
  account_conflict: false,
  email_not_verified: false,
  rate_limited: true,
  unknown_error: false,
} as const satisfies RetryPolicy<OAuthRetryKey>;

export const OAuthRetryPolicy: RetryPolicy<OAuthRetryKey> = createRetryPolicy<OAuthRetryKey>(
  RawOAuthRetryPolicy,
);

/* eslint-enable @livai/rag/context-leakage */

/** Type-safe helper для получения retryability по коду OAuth-ошибки. */
export const getOAuthRetryable = (error: OAuthRetryKey): boolean =>
  getRetryable<OAuthRetryKey>(OAuthRetryPolicy, error);

/** Helper для мержинга OAuth retry-политик (base + override) без дублирования. */
export const mergeOAuthRetryPolicies = (
  base: RetryPolicy<OAuthRetryKey>,
  override: Partial<RetryPolicy<OAuthRetryKey>>,
): RetryPolicy<OAuthRetryKey> => mergeRetryPolicies<OAuthRetryKey>(base, override);
