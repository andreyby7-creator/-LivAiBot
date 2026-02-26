/**
 * @file packages/feature-auth/src/types/login.dto.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Feature-Level DTO для Login Flow
 * ============================================================================
 *
 * Архитектурная роль:
 * - Feature-level агрегированный DTO для login-flow
 * - Композиция transport-level типов из schemas в единый feature-контракт
 * - Используется в effects/login.ts для оркестрации двухфазного процесса
 * - Transport-oriented, без domain leakage
 * - Future-proof для MFA расширения
 *
 * Принципы:
 * - ❌ Нет бизнес-логики (только типы)
 * - ❌ Нет optional-полей в discriminated union (явные ветки)
 * - ❌ Нет domain-типов (только transport-level типы из schemas)
 * - ✅ Discriminated union для type-safe branching
 * - ✅ Readonly для immutability
 * - ✅ Fail-closed: строгая типизация без partial состояний
 * - ✅ Extensible: готов к добавлению новых веток (MFA, OTP и т.д.)
 *
 * @version 1
 */

import type {
  LoginTokenPairValues,
  MeResponseValues,
  MfaChallengeRequestValues,
} from '../schemas/index.js';

/* ============================================================================
 * 🎯 LOGIN RESPONSE DTO (Feature-Level Aggregated)
 * ============================================================================
 */

/**
 * Агрегированный DTO для результата login-flow.
 *
 * Представляет discriminated union двух возможных исходов:
 * - `success`: успешный login с токенами и данными пользователя
 * - `mfa_required`: требуется MFA-верификация (future extension, версия 1 не использует)
 *
 * @remarks
 * **IMPORTANT:**
 * Backend does NOT return LoginResponseDto.
 * This is a feature-level aggregate composed from:
 *   1) POST /v1/auth/login → TokenPairResponse (валидируется через loginTokenPairSchema)
 *   2) GET /v1/auth/me → MeResponse (валидируется через meResponseSchema)
 *
 * Fail-closed поведение: если один из вызовов падает, LoginResponseDto не создаётся.
 *
 * @public
 */
export type LoginResponseDto =
  | {
    readonly type: 'success';
    readonly tokenPair: Readonly<LoginTokenPairValues>;
    readonly me: Readonly<MeResponseValues>;
  }
  | {
    readonly type: 'mfa_required';
    readonly challenge: Readonly<MfaChallengeRequestValues>;
  };

/* ============================================================================
 * 🔍 TYPE GUARDS (Optional, для runtime проверок)
 * ============================================================================
 */

/**
 * Type guard для проверки успешного результата login.
 *
 * @param dto - LoginResponseDto для проверки
 * @returns true, если это success-ветка
 *
 * @example
 * if (isLoginSuccess(response)) {
 *   // TypeScript знает, что response.tokenPair и response.me доступны
 *   console.log(response.tokenPair.accessToken);
 * }
 */
export function isLoginSuccess(
  dto: LoginResponseDto,
): dto is Extract<LoginResponseDto, { type: 'success'; }> {
  return dto.type === 'success';
}

/**
 * Type guard для проверки MFA-требования.
 *
 * @param dto - LoginResponseDto для проверки
 * @returns true, если это mfa_required-ветка
 *
 * @example
 * if (isMfaRequired(response)) {
 *   // TypeScript знает, что response.challenge доступен
 *   console.log(response.challenge.challengeId);
 * }
 */
export function isMfaRequired(
  dto: LoginResponseDto,
): dto is Extract<LoginResponseDto, { type: 'mfa_required'; }> {
  return dto.type === 'mfa_required';
}

/* ============================================================================
 * ✅ EXHAUSTIVENESS HELPER
 * ========================================================================== */

/**
 * Утилита для проверки исчерпывающего разбора union-типов.
 *
 * Используется в switch по `LoginResponseDto` для fail-closed поведения:
 * если появляется новая ветка union-типа и не обрабатывается явно,
 * TypeScript подсветит использование `assertNever` как ошибку компиляции.
 *
 * @throws Error Если в рантайме передан неожиданный вариант union-типа
 */
/* eslint-disable fp/no-throw -- Намеренное исключение для защиты от некорректного состояния */
export function assertNever(x: never): never {
  throw new Error(`Unexpected LoginResponseDto variant: ${JSON.stringify(x)}`);
}
/* eslint-enable fp/no-throw */
